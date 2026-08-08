-- ===========================================================================
-- RRBA — 007 player applications
-- ---------------------------------------------------------------------------
-- Public enrolment path: a parent submits a child's details from the marketing
-- site without creating an account, and staff review the queue and approve.
--
-- Kept separate from contact_submissions on purpose. That table is a general
-- enquiry inbox with a free-text message; an application is structured data
-- that gets converted into player, guardian and player_guardians rows, and it
-- carries a review lifecycle those enquiries do not have.
-- ===========================================================================

create type application_status as enum (
  'pending',
  'approved',
  'declined',
  'withdrawn'
);

create table applications (
  id uuid primary key default uuid_generate_v4(),

  -- Child
  player_first_name text not null,
  player_last_name  text not null,
  date_of_birth     date not null,
  gender            gender not null default 'undisclosed',
  position          basketball_position,
  school            text,
  previous_experience text,

  -- Parent or guardian submitting the application
  guardian_name         text not null,
  guardian_relationship text not null default 'parent',
  guardian_phone        text not null,
  guardian_email        citext,
  guardian_alt_phone    text,

  -- Enrolment intent
  program_interest text,
  medical_notes    text,
  heard_about_us   text,

  -- Review lifecycle
  status       application_status not null default 'pending',
  reviewed_by  uuid references profiles (id) on delete set null,
  reviewed_at  timestamptz,
  review_notes text,

  -- Set once approved, so an application cannot be converted twice.
  created_player_id uuid unique references players (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint applications_dob_sane check (
    date_of_birth > '1950-01-01'::date and date_of_birth < current_date
  ),
  constraint applications_names_len check (
    char_length(player_first_name) between 1 and 100
    and char_length(player_last_name) between 1 and 100
    and char_length(guardian_name) between 2 and 160
  ),
  -- Anonymous writes: bound every free-text field so the endpoint cannot be
  -- used to dump large payloads into the table.
  constraint applications_text_len check (
    coalesce(char_length(school), 0) <= 200
    and coalesce(char_length(previous_experience), 0) <= 2000
    and coalesce(char_length(program_interest), 0) <= 200
    and coalesce(char_length(medical_notes), 0) <= 2000
    and coalesce(char_length(heard_about_us), 0) <= 200
    and coalesce(char_length(review_notes), 0) <= 2000
  ),
  constraint applications_phone_shape check (
    guardian_phone ~ '^\+?[0-9 ()-]{7,20}$'
    and (guardian_alt_phone is null or guardian_alt_phone ~ '^\+?[0-9 ()-]{7,20}$')
  ),
  -- A decided application must record who decided it and when.
  constraint applications_review_complete check (
    status = 'pending'
    or (reviewed_at is not null)
  )
);

create index applications_status_idx on applications (status, created_at desc);
create index applications_pending_idx on applications (created_at desc)
  where status = 'pending';
create index applications_name_idx on applications (player_last_name, player_first_name);

create trigger applications_set_updated_at
  before update on applications
  for each row execute function set_updated_at();

comment on table applications is
  'Public enrolment requests awaiting staff review. Approving one creates the '
  'player, guardian and link rows; see approve_application().';

comment on column applications.created_player_id is
  'Set when approved. Unique, so the same application cannot produce two '
  'player records if the approve action is submitted twice.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table applications enable row level security;

-- Anyone may apply. This is the only anonymous write in the schema, which is
-- why every text column above is length-bounded.
create policy "applications_insert_public"
  on applications for insert
  to anon, authenticated
  with check (
    status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and created_player_id is null
  );

create policy "applications_staff_read"
  on applications for select
  to authenticated
  using (is_staff());

create policy "applications_staff_update"
  on applications for update
  to authenticated
  using (is_staff())
  with check (is_staff());

create policy "applications_admin_delete"
  on applications for delete
  to authenticated
  using (is_admin());

-- ---------------------------------------------------------------------------
-- approve_application — application row becomes player + guardian + link
-- ---------------------------------------------------------------------------
-- Done in one function so the three inserts share a transaction. Doing it as
-- three separate client calls could leave a player with no guardian if the
-- second call failed.

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
    jsonb_build_object('player_id', new_player_id, 'team_id', assign_team)
  );

  return new_player_id;
end;
$$;

grant execute on function approve_application(uuid, uuid, text) to authenticated;

comment on function approve_application(uuid, uuid, text) is
  'Converts a pending application into player, guardian and link rows in one '
  'transaction. Locks the application row so concurrent approvals cannot '
  'create duplicate players.';
