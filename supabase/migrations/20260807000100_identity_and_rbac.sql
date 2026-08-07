-- ===========================================================================
-- RRBA — 001 identity & RBAC
-- ---------------------------------------------------------------------------
-- Establishes profiles, the six-role model, the audit log, and the SQL helper
-- functions every later RLS policy depends on.
--
-- Design note: roles live in a join table, not a column on the profile. One
-- person is commonly both coach and academy admin, and must hold both grants
-- under a single login rather than juggling two accounts.
-- ===========================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "citext";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type app_role as enum (
  'super_admin',
  'academy_admin',
  'coach',
  'finance',
  'player',
  'guardian'
);

create type account_status as enum ('pending', 'active', 'suspended', 'archived');

-- ---------------------------------------------------------------------------
-- profiles — one row per auth user
-- ---------------------------------------------------------------------------

create table profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         citext      not null unique,
  full_name     text        not null default '',
  phone         text,
  avatar_path   text,
  status        account_status not null default 'pending',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint profiles_full_name_len check (char_length(full_name) <= 160),
  constraint profiles_phone_shape   check (phone is null or phone ~ '^\+?[0-9 ()-]{7,20}$')
);

comment on table profiles is
  'Application-side user record mirroring auth.users. Status starts as pending: '
  'a fresh signup has no role and no access until an admin grants one.';

-- ---------------------------------------------------------------------------
-- user_roles — the grant table
-- ---------------------------------------------------------------------------

create table user_roles (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references profiles (id) on delete cascade,
  role        app_role not null,
  granted_by  uuid references profiles (id) on delete set null,
  granted_at  timestamptz not null default now(),

  unique (user_id, role)
);

create index user_roles_user_id_idx on user_roles (user_id);
create index user_roles_role_idx    on user_roles (role);

comment on table user_roles is
  'Role grants. Never written by public signup — only by an admin, so nobody '
  'can self-assign elevated access.';

-- ---------------------------------------------------------------------------
-- audit_log — append-only trail
-- ---------------------------------------------------------------------------

create table audit_log (
  id          bigserial primary key,
  actor_id    uuid references profiles (id) on delete set null,
  action      text not null,
  entity      text not null,
  entity_id   text,
  metadata    jsonb not null default '{}'::jsonb,
  ip_address  inet,
  created_at  timestamptz not null default now()
);

create index audit_log_actor_idx   on audit_log (actor_id, created_at desc);
create index audit_log_entity_idx  on audit_log (entity, entity_id);
create index audit_log_created_idx on audit_log (created_at desc);

comment on table audit_log is
  'Append-only. No update or delete policy is ever granted, including to '
  'super_admin, so the trail cannot be rewritten from the application.';

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Auth hook: mirror new auth users into profiles
-- ---------------------------------------------------------------------------

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, full_name, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'pending'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Deliberately grants no role. Access requires an explicit admin grant.
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS helper functions
-- ---------------------------------------------------------------------------
-- security definer so policies can read user_roles without recursing into
-- that table's own RLS. stable lets Postgres cache within a statement.
-- ---------------------------------------------------------------------------

create or replace function has_role(target_role app_role)
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
    where ur.user_id = auth.uid()
      and ur.role = target_role
      and p.status = 'active'
  );
$$;

create or replace function has_any_role(target_roles app_role[])
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
    where ur.user_id = auth.uid()
      and ur.role = any (target_roles)
      and p.status = 'active'
  );
$$;

-- Full academy-wide administrative reach.
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select has_any_role(array['super_admin', 'academy_admin']::app_role[]);
$$;

-- Any internal user. Note this includes finance, which is why medical tables
-- must check is_admin()/coaches_player() instead of is_staff().
create or replace function is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select has_any_role(
    array['super_admin', 'academy_admin', 'coach', 'finance']::app_role[]
  );
$$;

grant execute on function has_role(app_role)      to authenticated;
grant execute on function has_any_role(app_role[]) to authenticated;
grant execute on function is_admin()              to authenticated;
grant execute on function is_staff()              to authenticated;
