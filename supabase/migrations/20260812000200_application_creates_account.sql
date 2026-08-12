-- ===========================================================================
-- RRBA — 012 the application is the registration
-- ---------------------------------------------------------------------------
-- Enrolling used to be two unconnected jobs. A parent filled in /apply, which
-- wrote an application and no account, then separately signed up at /signup,
-- which created an account attached to nothing. An administrator then had to
-- notice the two belonged together and join them by hand: activate the account,
-- grant the guardian role, and set guardians.profile_id. Miss any one of those
-- and the parent signs in to a dashboard that correctly tells them they are
-- linked to no children.
--
-- Now the application carries the account that submitted it, and approving the
-- application is what joins everything up.
--
-- The parent's login is created when the application is submitted, not here —
-- see submitApplicationAction. This migration is the other half: the column to
-- record it, and the approval doing the work an admin was doing by hand.
-- ===========================================================================

alter table applications
  add column submitted_by uuid references profiles (id) on delete set null;

create index applications_submitted_by_idx on applications (submitted_by)
  where submitted_by is not null;

comment on column applications.submitted_by is
  'The account that submitted this application, set server-side after the '
  'signup succeeds. Never accepted from the request body — see the insert '
  'policy. on delete set null so removing an account keeps the application as '
  'a record of the enrolment.';

-- ---------------------------------------------------------------------------
-- The public insert may not claim an account
-- ---------------------------------------------------------------------------
-- submitted_by decides whose login gets the guardian role and a child attached
-- to it when this row is approved. A request that could set it freely could
-- name any profile in the academy — pointing a stranger's application at a
-- coach's account, which on approval would hand that coach a child they have
-- nothing to do with.
--
-- So the public path may only ever insert null, and the server attaches the id
-- afterwards with a key the browser does not have. Anonymous callers have no
-- session for a `submitted_by = auth.uid()` check to use: the account exists at
-- that moment but is unconfirmed, so it holds no session yet.

drop policy "applications_insert_public" on applications;

create policy "applications_insert_public"
  on applications for insert
  to anon, authenticated
  with check (
    status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and created_player_id is null
    and submitted_by is null
  );

-- ---------------------------------------------------------------------------
-- approve_application — now also joins the account to the family
-- ---------------------------------------------------------------------------
-- Unchanged in what it created before: player, guardian, the link between
-- them, medical notes and an optional team. What is new is the last step, which
-- is the three manual actions this replaces.

create or replace function approve_application(
  target_application uuid,
  assign_team uuid default null,
  notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  app applications%rowtype;
  new_player_id uuid;
  existing_guardian_id uuid;
  guardian_row_id uuid;
  linked_profile uuid;
begin
  if not is_staff() then
    raise exception 'Only staff can approve applications.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Lock the row so two reviewers clicking approve cannot both proceed.
  select * into app
  from applications
  where id = target_application
  for update;

  if not found then
    raise exception 'Application not found.';
  end if;

  if app.status <> 'pending' then
    raise exception 'This application has already been %.', app.status;
  end if;

  insert into players (
    first_name, last_name, date_of_birth, gender, position,
    email, phone, notes, status, registration_date
  )
  values (
    app.player_first_name, app.player_last_name, app.date_of_birth,
    app.gender, app.position,
    app.guardian_email, app.guardian_phone,
    app.previous_experience, 'active', current_date
  )
  returning id into new_player_id;

  -- Reuse an existing guardian when the phone matches, so a second child does
  -- not create a duplicate parent record.
  select id into existing_guardian_id
  from guardians
  where phone = app.guardian_phone
  limit 1;

  if existing_guardian_id is null then
    insert into guardians (full_name, relationship, phone, email, alt_phone)
    values (
      app.guardian_name, app.guardian_relationship,
      app.guardian_phone, app.guardian_email, app.guardian_alt_phone
    )
    returning id into guardian_row_id;
  else
    guardian_row_id := existing_guardian_id;
  end if;

  insert into player_guardians (player_id, guardian_id, is_primary)
  values (new_player_id, guardian_row_id, true);

  if app.medical_notes is not null and length(trim(app.medical_notes)) > 0 then
    insert into player_medical (player_id, notes)
    values (new_player_id, app.medical_notes);
  end if;

  if assign_team is not null then
    insert into team_players (team_id, player_id)
    values (assign_team, new_player_id);
  end if;

  -- ---------------------------------------------------------------------
  -- Join the parent's login to the family they just enrolled.
  -- ---------------------------------------------------------------------
  if app.submitted_by is not null then
    -- guardians.profile_id is unique, so a parent's login belongs to exactly
    -- one guardian record. Both guards matter for a second child: the phone
    -- match above usually returns the same guardian row, which already carries
    -- the link, and the not-exists check covers the case where it did not.
    update guardians
    set profile_id = app.submitted_by
    where id = guardian_row_id
      and profile_id is null
      and not exists (
        select 1 from guardians other
        where other.profile_id = app.submitted_by
      )
    returning profile_id into linked_profile;

    -- The grant an admin used to make by hand. Idempotent, so approving a
    -- second child for the same parent is not an error.
    insert into user_roles (user_id, role, granted_by)
    values (app.submitted_by, 'guardian', auth.uid())
    on conflict (user_id, role) do nothing;

    -- Only from pending: approving an application must never quietly restore
    -- an account an administrator suspended.
    update profiles
    set status = 'active'
    where id = app.submitted_by
      and status = 'pending';
  end if;

  update applications
  set status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_notes = notes,
      created_player_id = new_player_id
  where id = target_application;

  insert into audit_log (actor_id, action, entity, entity_id, metadata)
  values (
    auth.uid(), 'application.approve', 'applications',
    target_application::text,
    jsonb_build_object(
      'player_id', new_player_id,
      'team_id', assign_team,
      'guardian_id', guardian_row_id,
      'account_linked', app.submitted_by,
      'guardian_link_set', linked_profile is not null
    )
  );

  return new_player_id;
end;
$$;

comment on function approve_application(uuid, uuid, text) is
  'Converts a pending application into player, guardian and link rows in one '
  'transaction, and joins the submitting account to the family: guardian role '
  'granted, account activated, guardians.profile_id set. Locks the application '
  'row so concurrent approvals cannot create duplicate players.';

-- ---------------------------------------------------------------------------
-- Let staff activate the account they just approved
-- ---------------------------------------------------------------------------
-- guard_profile_privileged_columns refuses any status change from a caller who
-- is not an admin. approve_application is security definer, so RLS does not
-- stand in its way, but auth.uid() and auth.role() still belong to the caller
-- and the trigger fires on the caller's behalf — so the activation above would
-- raise 'Only administrators can change account status.' for a coach.
--
-- Coaches can approve applications (approve_application checks is_staff, not
-- is_admin), so leaving the guard as it was would have made approval fail for
-- exactly the people most likely to be doing it.
--
-- The exemption is deliberately the narrowest thing that unblocks it: staff may
-- move an account from pending to active, and nothing else. Suspending an
-- account, archiving one, or reviving a suspended one all stay admin-only, and
-- the email rule is re-asserted inside the exemption so a status change cannot
-- carry one through with it.
--
-- Widening the trigger does not widen who can edit profiles: coaches hold no
-- update policy on the table, so RLS still refuses a direct write. This only
-- affects callers that already bypass RLS, which is approve_application.
--
-- Every other rule is carried over from migration 008 unchanged.

create or replace function guard_profile_privileged_columns()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  jwt_role text;
begin
  jwt_role := nullif(auth.role(), '');

  -- Deactivating the last active super admin locks everyone out of role
  -- management. This applies to admins too, which is why it sits above the
  -- is_admin() shortcut below.
  if new.status is distinct from old.status
     and old.status = 'active'
     and new.status <> 'active'
     and jwt_role is not null
     and jwt_role <> 'service_role'
  then
    if exists (
      select 1 from user_roles ur
      where ur.user_id = old.id and ur.role = 'super_admin'
    ) and count_active_super_admins() <= 1 then
      raise exception
        'Cannot deactivate the last super admin. Grant the role to someone else first.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  if jwt_role is null or jwt_role = 'service_role' then
    return new;
  end if;

  if is_admin() then
    return new;
  end if;

  -- New in 012: approving an application activates the parent's login.
  if is_staff()
     and old.status = 'pending'
     and new.status = 'active'
     and new.email = old.email
  then
    return new;
  end if;

  if new.status is distinct from old.status then
    raise exception 'Only administrators can change account status.'
      using errcode = 'insufficient_privilege';
  end if;

  -- profiles.email mirrors auth.users. Letting a user rewrite it here would
  -- let them impersonate the configured bootstrap address.
  if new.email is distinct from old.email then
    raise exception 'Email is managed through account settings.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

comment on function guard_profile_privileged_columns() is
  'Protects profiles.status and profiles.email. Admins are unrestricted; staff '
  'may only move an account from pending to active, which is what approving an '
  'application does; nobody may deactivate the last super admin.';
