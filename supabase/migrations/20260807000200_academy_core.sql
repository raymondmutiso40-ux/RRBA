-- ===========================================================================
-- RRBA — 002 academy core
-- ---------------------------------------------------------------------------
-- Seasons, teams, coach assignments, players, guardians, and medical records.
--
-- Two decisions drive this shape:
--
--   1. Team membership is history, not state. team_players carries
--      joined_at/left_at instead of players carrying a single team_id, so
--      "who played U16 last season" stays answerable.
--
--   2. Medical data is a separate table. Finance staff must see who owes
--      money without seeing a child's allergies. That distinction is
--      inexpressible if medical fields sit on the player row.
-- ===========================================================================

create type gender as enum ('male', 'female', 'other', 'undisclosed');

create type player_status as enum ('applicant', 'active', 'inactive', 'graduated', 'withdrawn');

create type basketball_position as enum (
  'point_guard',
  'shooting_guard',
  'small_forward',
  'power_forward',
  'center'
);

-- ---------------------------------------------------------------------------
-- seasons
-- ---------------------------------------------------------------------------

create table seasons (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  starts_on  date not null,
  ends_on    date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),

  constraint seasons_name_unique unique (name),
  constraint seasons_date_order check (ends_on > starts_on)
);

-- At most one current season.
create unique index seasons_single_current_idx
  on seasons (is_current)
  where is_current;

-- ---------------------------------------------------------------------------
-- teams
-- ---------------------------------------------------------------------------

create table teams (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  age_group    text not null,
  gender       gender not null default 'undisclosed',
  season_id    uuid references seasons (id) on delete set null,
  description  text,
  logo_path    text,
  min_age      smallint,
  max_age      smallint,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint teams_name_season_unique unique (name, season_id),
  constraint teams_age_range check (
    min_age is null or max_age is null or max_age >= min_age
  )
);

create index teams_season_idx on teams (season_id) where is_active;

create trigger teams_set_updated_at
  before update on teams
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- team_coaches — drives coach RLS scope
-- ---------------------------------------------------------------------------

create table team_coaches (
  id          uuid primary key default uuid_generate_v4(),
  team_id     uuid not null references teams (id) on delete cascade,
  coach_id    uuid not null references profiles (id) on delete cascade,
  is_lead     boolean not null default false,
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz,

  unique (team_id, coach_id)
);

create index team_coaches_coach_idx on team_coaches (coach_id) where unassigned_at is null;
create index team_coaches_team_idx  on team_coaches (team_id)  where unassigned_at is null;

comment on table team_coaches is
  'Source of truth for coach permissions. A coach reaches a player only through '
  'an active row here, so access follows the real assignment.';

-- ---------------------------------------------------------------------------
-- players
-- ---------------------------------------------------------------------------

create table players (
  id                uuid primary key default uuid_generate_v4(),

  -- Null until the player is given a login. Players can exist without accounts.
  profile_id        uuid unique references profiles (id) on delete set null,

  first_name        text not null,
  last_name         text not null,
  date_of_birth     date not null,
  gender            gender not null default 'undisclosed',
  photo_path        text,

  email             citext,
  phone             text,
  address           text,

  position          basketball_position,
  jersey_number     smallint,
  height_cm         smallint,
  weight_kg         numeric(5, 2),
  dominant_hand     text,

  status            player_status not null default 'applicant',
  registration_date date not null default current_date,
  notes             text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint players_dob_sane check (
    date_of_birth > '1950-01-01'::date and date_of_birth < current_date
  ),
  constraint players_jersey_range check (
    jersey_number is null or jersey_number between 0 and 99
  ),
  constraint players_height_range check (height_cm is null or height_cm between 80 and 260),
  constraint players_hand check (
    dominant_hand is null or dominant_hand in ('left', 'right', 'ambidextrous')
  )
);

create index players_status_idx   on players (status);
create index players_name_idx     on players (last_name, first_name);
create index players_profile_idx  on players (profile_id) where profile_id is not null;

create trigger players_set_updated_at
  before update on players
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- team_players — roster history
-- ---------------------------------------------------------------------------

create table team_players (
  id        uuid primary key default uuid_generate_v4(),
  team_id   uuid not null references teams (id) on delete cascade,
  player_id uuid not null references players (id) on delete cascade,
  joined_at date not null default current_date,
  left_at   date,

  constraint team_players_date_order check (left_at is null or left_at >= joined_at)
);

-- A player holds at most one active slot per team; past stints are unrestricted.
create unique index team_players_active_unique
  on team_players (team_id, player_id)
  where left_at is null;

create index team_players_player_idx on team_players (player_id) where left_at is null;
create index team_players_team_idx   on team_players (team_id)   where left_at is null;

-- ---------------------------------------------------------------------------
-- guardians
-- ---------------------------------------------------------------------------

create table guardians (
  id            uuid primary key default uuid_generate_v4(),
  profile_id    uuid unique references profiles (id) on delete set null,
  full_name     text not null,
  relationship  text not null default 'parent',
  email         citext,
  phone         text not null,
  alt_phone     text,
  address       text,
  occupation    text,
  is_emergency_contact boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index guardians_profile_idx on guardians (profile_id) where profile_id is not null;
create index guardians_phone_idx   on guardians (phone);

create trigger guardians_set_updated_at
  before update on guardians
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- player_guardians — drives guardian RLS scope
-- ---------------------------------------------------------------------------

create table player_guardians (
  id          uuid primary key default uuid_generate_v4(),
  player_id   uuid not null references players (id) on delete cascade,
  guardian_id uuid not null references guardians (id) on delete cascade,
  is_primary  boolean not null default false,
  can_collect boolean not null default true,
  created_at  timestamptz not null default now(),

  unique (player_id, guardian_id)
);

create index player_guardians_player_idx   on player_guardians (player_id);
create index player_guardians_guardian_idx on player_guardians (guardian_id);

-- One primary guardian per player.
create unique index player_guardians_single_primary_idx
  on player_guardians (player_id)
  where is_primary;

comment on table player_guardians is
  'Source of truth for guardian permissions. A parent sees exactly the children '
  'linked here and no others.';

-- ---------------------------------------------------------------------------
-- player_medical — deliberately separate, tightest RLS in the schema
-- ---------------------------------------------------------------------------

create table player_medical (
  player_id            uuid primary key references players (id) on delete cascade,
  blood_group          text,
  allergies            text,
  chronic_conditions   text,
  medications          text,
  dietary_requirements text,
  insurance_provider   text,
  insurance_number     text,
  doctor_name          text,
  doctor_phone         text,
  emergency_contact_name  text,
  emergency_contact_phone text,
  last_physical_on      date,
  cleared_to_play       boolean not null default false,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint medical_blood_group check (
    blood_group is null
    or blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-')
  )
);

create trigger player_medical_set_updated_at
  before update on player_medical
  for each row execute function set_updated_at();

comment on table player_medical is
  'Sensitive minor health data. Readable only by admins and the player''s own '
  'assigned coaches. Finance staff are excluded by design.';

-- ---------------------------------------------------------------------------
-- Relationship-aware RLS helpers
-- ---------------------------------------------------------------------------

-- Is the current user an active coach of this team?
create or replace function coaches_team(target_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from team_coaches tc
    where tc.team_id = target_team
      and tc.coach_id = auth.uid()
      and tc.unassigned_at is null
  );
$$;

-- Does the current user coach any active team this player belongs to?
create or replace function coaches_player(target_player uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from team_players tp
    join team_coaches tc on tc.team_id = tp.team_id
    where tp.player_id = target_player
      and tp.left_at is null
      and tc.coach_id = auth.uid()
      and tc.unassigned_at is null
  );
$$;

-- Is the current user a linked guardian of this player?
create or replace function guards_player(target_player uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from player_guardians pg
    join guardians g on g.id = pg.guardian_id
    where pg.player_id = target_player
      and g.profile_id = auth.uid()
  );
$$;

-- Is the current user this player?
create or replace function is_player(target_player uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from players p
    where p.id = target_player
      and p.profile_id = auth.uid()
  );
$$;

grant execute on function coaches_team(uuid)   to authenticated;
grant execute on function coaches_player(uuid) to authenticated;
grant execute on function guards_player(uuid)  to authenticated;
grant execute on function is_player(uuid)      to authenticated;
