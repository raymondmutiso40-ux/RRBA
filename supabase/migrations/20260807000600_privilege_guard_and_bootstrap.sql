-- ===========================================================================
-- RRBA — 006 privilege guard & bootstrap support
-- ---------------------------------------------------------------------------
-- Two changes, both prerequisites for a safe first-admin bootstrap.
--
-- 1. Closes an escalation path in profiles_self_update. That policy lets a
--    user update their own row, and RLS policies cannot restrict which
--    columns are written — so a pending user could set status = 'active',
--    or change their email to match the bootstrap address and claim admin.
--    A BEFORE UPDATE trigger now rejects both unless the caller is an admin
--    or the service role.
--
-- 2. Adds has_any_admin(), which the bootstrap uses to decide whether the
--    academy still has no administrator. Once one exists the bootstrap
--    permanently disables itself.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- has_any_admin — is there at least one active super_admin?
-- ---------------------------------------------------------------------------
-- security definer so an unprivileged caller can ask the question without
-- being able to read user_roles generally.

create or replace function has_any_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from user_roles ur
    join profiles p on p.id = ur.user_id
    where ur.role = 'super_admin'
      and p.status = 'active'
  );
$$;

grant execute on function has_any_admin() to anon, authenticated;

comment on function has_any_admin() is
  'True once the academy has an active super admin. Gates the first-admin '
  'bootstrap, which must stop working the moment an administrator exists.';

-- ---------------------------------------------------------------------------
-- Guard privileged profile columns
-- ---------------------------------------------------------------------------

-- security invoker on purpose. Under security definer, current_user and the
-- privilege checks below would resolve to the function owner instead of the
-- caller, which would defeat the guard. is_admin() is itself definer, so it
-- still reads user_roles correctly from here.

create or replace function guard_profile_privileged_columns()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  jwt_role text;
begin
  -- auth.role() reads the role claim PostgREST attaches to the request, so it
  -- reflects the API caller rather than the database user.
  jwt_role := nullif(auth.role(), '');

  -- No request context at all: a direct database connection (migrations, the
  -- SQL Editor, psql). That already required database credentials, and it is
  -- the only way to repair a locked-out academy, so it stays permitted.
  if jwt_role is null then
    return new;
  end if;

  -- The service role performs the bootstrap grant and other trusted server
  -- work. Its key is server-only and never reaches the browser.
  if jwt_role = 'service_role' then
    return new;
  end if;

  if is_admin() then
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

drop trigger if exists profiles_guard_privileged on profiles;

create trigger profiles_guard_privileged
  before update on profiles
  for each row execute function guard_profile_privileged_columns();

comment on function guard_profile_privileged_columns() is
  'Blocks self-service changes to status and email. RLS alone cannot express '
  'this because policies gate rows, not columns.';
