-- ===========================================================================
-- RRBA — 008 super admin safeguards
-- ---------------------------------------------------------------------------
-- Two holes in the role model, both reachable from the dashboard once user
-- management exists.
--
-- 1. Privilege escalation. user_roles_admin_write checks is_admin(), which is
--    true for academy_admin as well as super_admin — so an academy admin could
--    grant themselves super_admin and take over the account. Granting or
--    revoking super_admin now requires already being one.
--
-- 2. Lockout. Nothing stopped the last super_admin being revoked or suspended.
--    Recovering from that needs direct database access, which the academy will
--    not have. Both paths are now blocked.
--
-- RLS cannot express either rule: policies gate which rows you may touch, not
-- which values you may write or how many rows must survive.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Count active super admins, optionally ignoring one grant row.
-- ---------------------------------------------------------------------------

create or replace function count_active_super_admins(exclude_grant uuid default null)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from user_roles ur
  join profiles p on p.id = ur.user_id
  where ur.role = 'super_admin'
    and p.status = 'active'
    and (exclude_grant is null or ur.id <> exclude_grant);
$$;

grant execute on function count_active_super_admins(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Guard grants of the super admin role
-- ---------------------------------------------------------------------------

create or replace function guard_super_admin_grants()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  jwt_role text;
  affected_role app_role;
begin
  jwt_role := nullif(auth.role(), '');

  -- No request context means a direct database connection: migrations, the
  -- SQL Editor, psql. That already required database credentials and is the
  -- only way to repair a locked-out academy, so it stays permitted.
  -- service_role is the server-side bootstrap that creates the first admin.
  if jwt_role is null or jwt_role = 'service_role' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    affected_role := old.role;
  else
    affected_role := new.role;
  end if;

  if affected_role = 'super_admin' and not has_role('super_admin') then
    raise exception
      'Only a super admin can grant or revoke the super admin role.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Removing the final super admin would leave nobody able to manage roles.
  if tg_op = 'DELETE' and old.role = 'super_admin' then
    if count_active_super_admins(old.id) = 0 then
      raise exception
        'Cannot remove the last super admin. Grant the role to someone else first.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists user_roles_guard_super_admin on user_roles;

create trigger user_roles_guard_super_admin
  before insert or update or delete on user_roles
  for each row execute function guard_super_admin_grants();

comment on function guard_super_admin_grants() is
  'Restricts super_admin grants to existing super admins, and refuses to '
  'remove the last one. Direct database connections bypass both, so a '
  'locked-out academy can still be repaired.';

-- ---------------------------------------------------------------------------
-- Extend the profile guard: suspending the last super admin locks out too
-- ---------------------------------------------------------------------------
-- Replaces the version from migration 006, keeping its status/email rules and
-- adding the lockout check.

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
