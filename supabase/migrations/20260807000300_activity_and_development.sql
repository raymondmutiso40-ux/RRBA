-- ===========================================================================
-- RRBA — 003 activity & development
-- ---------------------------------------------------------------------------
-- Events (training and matches in one table), attendance, box scores,
-- skills metrics, coach assessments, and development notes.
-- ===========================================================================

create type event_type as enum ('training', 'match');

create type event_status as enum ('scheduled', 'completed', 'cancelled');

create type attendance_status as enum ('present', 'absent', 'late', 'excused');

create type match_result as enum ('win', 'loss', 'draw');

-- ---------------------------------------------------------------------------
-- events — training sessions and matches share one calendar
-- ---------------------------------------------------------------------------

create table events (
  id             uuid primary key default uuid_generate_v4(),
  event_type     event_type not null,
  team_id        uuid references teams (id) on delete set null,
  title          text not null,
  description    text,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  location       text,
  status         event_status not null default 'scheduled',
  -- Assigned coach/caller. Not team_coaches — events can guest-coach.
  coach_id       uuid references profiles (id) on delete set null,

  -- Match-only columns (null for training sessions)
  opponent         text,
  competition      text,
  is_home          boolean,
  final_score_team smallint,
  final_score_opp  smallint,
  result           match_result,
  stats_recorded   boolean not null default false,

  created_by      uuid references profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint events_time_order check (ends_at > starts_at),
  constraint events_title_len check (char_length(title) <= 200)
);

create index events_team_time_idx on events (team_id, starts_at desc);
create index events_time_idx       on events (starts_at);
create index events_coach_idx      on events (coach_id, starts_at desc);

create trigger events_set_updated_at
  before update on events
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- event_participants — which players are expected to attend
-- ---------------------------------------------------------------------------

create table event_participants (
  id         uuid primary key default uuid_generate_v4(),
  event_id   uuid not null references events (id) on delete cascade,
  player_id  uuid not null references players (id) on delete cascade,
  added_by   uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),

  unique (event_id, player_id)
);

create index event_participants_player_idx on event_participants (player_id);

-- ---------------------------------------------------------------------------
-- attendance
-- ---------------------------------------------------------------------------

create table attendance (
  id          uuid primary key default uuid_generate_v4(),
  event_id    uuid not null references events (id) on delete cascade,
  player_id   uuid not null references players (id) on delete cascade,
  status      attendance_status not null default 'absent',
  marked_by   uuid references profiles (id) on delete set null,
  notes       text,
  marked_at   timestamptz not null default now(),

  unique (event_id, player_id)
);

create index attendance_player_idx on attendance (player_id, marked_at desc);
create index attendance_event_idx  on attendance (event_id);

comment on table attendance is
  'One row per player per event. Insert/upsert only — a mistaken mark is '
  'corrected by overwriting status, never by deleting history.';

-- ---------------------------------------------------------------------------
-- player_match_stats — per-player box scores
-- ---------------------------------------------------------------------------

create table player_match_stats (
  id          uuid primary key default uuid_generate_v4(),
  event_id    uuid not null references events (id) on delete cascade,
  player_id   uuid not null references players (id) on delete cascade,
  minutes_played smallint,
  points         smallint,
  rebounds       smallint,
  assists        smallint,
  steals         smallint,
  blocks         smallint,
  turnovers      smallint,
  fouls          smallint,

  -- shooting
  fg_attempts    smallint,
  fg_made        smallint,
  three_attempts smallint,
  three_made     smallint,
  ft_attempts    smallint,
  ft_made        smallint,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (event_id, player_id),
  constraint match_stats_nonnegative check (
    minutes_played >= 0 and points >= 0 and rebounds >= 0 and assists >= 0
    and steals >= 0 and blocks >= 0 and turnovers >= 0 and fouls >= 0
    and fg_attempts >= 0 and fg_made >= 0 and three_attempts >= 0
    and three_made >= 0 and ft_attempts >= 0 and ft_made >= 0
  )
);

create index player_match_stats_player_idx on player_match_stats (player_id, event_id);

create trigger player_match_stats_set_updated_at
  before update on player_match_stats
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- skill_metrics — attributes are rows, not columns
-- ---------------------------------------------------------------------------

create table skill_metrics (
  id          uuid primary key default uuid_generate_v4(),
  code        text not null unique,
  label       text not null,
  category    text not null default 'technical',
  description text,
  sort_order  smallint not null default 0,
  is_active   boolean not null default true,

  constraint skill_metrics_code_shape check (code ~ '^[a-z_]+$')
);

comment on table skill_metrics is
  'The assessed attributes (ball_handling, shooting, …). Rows, not columns: '
  'adding a thirteenth skill is an insert, not a schema migration.';

insert into skill_metrics (code, label, category, sort_order) values
  ('ball_handling',   'Ball Handling',   'technical',   1),
  ('shooting',        'Shooting',        'technical',   2),
  ('passing',         'Passing',         'technical',   3),
  ('defense',         'Defense',         'technical',   4),
  ('rebounding',      'Rebounding',      'technical',   5),
  ('speed',           'Speed',           'athletic',    6),
  ('agility',         'Agility',         'athletic',    7),
  ('strength',        'Strength',        'athletic',    8),
  ('vertical_jump',   'Vertical Jump',   'athletic',    9),
  ('basketball_iq',   'Basketball IQ',   'mental',      10),
  ('teamwork',        'Teamwork',        'mental',      11),
  ('discipline',      'Discipline',      'mental',      12);

-- ---------------------------------------------------------------------------
-- assessments — one observation session per player
-- ---------------------------------------------------------------------------

create table assessments (
  id          uuid primary key default uuid_generate_v4(),
  player_id   uuid not null references players (id) on delete cascade,
  assessed_by uuid not null references profiles (id) on delete set null,
  event_id    uuid references events (id) on delete set null,
  assessed_on date not null default current_date,
  summary     text,
  created_at  timestamptz not null default now(),

  constraint assessments_future check (assessed_on <= current_date)
);

create index assessments_player_idx on assessments (player_id, assessed_on desc);
create index assessments_coach_idx  on assessments (assessed_by, assessed_on desc);

-- ---------------------------------------------------------------------------
-- assessment_scores — one row per skill per assessment
-- ---------------------------------------------------------------------------

create table assessment_scores (
  id            uuid primary key default uuid_generate_v4(),
  assessment_id uuid not null references assessments (id) on delete cascade,
  metric_id     uuid not null references skill_metrics (id) on delete cascade,
  score         smallint not null,

  unique (assessment_id, metric_id),
  constraint assessment_scores_range check (score between 1 and 10)
);

create index assessment_scores_metric_idx on assessment_scores (metric_id);

comment on table assessment_scores is
  'A 1–10 score per skill per assessment. Time series across rows is what '
  'makes development-over-time charts a single query.';

-- ---------------------------------------------------------------------------
-- development_notes — coach observations between formal assessments
-- ---------------------------------------------------------------------------

create table development_notes (
  id         uuid primary key default uuid_generate_v4(),
  player_id  uuid not null references players (id) on delete cascade,
  coach_id   uuid not null references profiles (id) on delete cascade,
  note       text not null,
  created_at timestamptz not null default now(),

  constraint development_notes_len check (char_length(note) <= 2000)
);

create index development_notes_player_idx on development_notes (player_id, created_at desc);
create index development_notes_coach_idx  on development_notes (coach_id, created_at desc);
