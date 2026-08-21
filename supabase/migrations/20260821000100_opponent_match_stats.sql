-- RRBA — opponent match box scores
-- Manually recorded opponent players are intentionally independent of the
-- academy player table: an opposing team's roster is not RRBA-owned data.

create table match_opponent_stats (
  id             uuid primary key default uuid_generate_v4(),
  event_id       uuid not null references events (id) on delete cascade,
  player_key     text not null,
  player_name    text not null,
  jersey_number  smallint,
  minutes_played smallint,
  points         smallint,
  rebounds       smallint,
  assists        smallint,
  steals         smallint,
  blocks         smallint,
  turnovers      smallint,
  fouls          smallint,
  fg_attempts    smallint,
  fg_made        smallint,
  three_attempts smallint,
  three_made     smallint,
  ft_attempts    smallint,
  ft_made        smallint,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (event_id, player_key),
  constraint opponent_stats_nonnegative check (
    coalesce(minutes_played, 0) >= 0 and coalesce(points, 0) >= 0
    and coalesce(rebounds, 0) >= 0 and coalesce(assists, 0) >= 0
    and coalesce(steals, 0) >= 0 and coalesce(blocks, 0) >= 0
    and coalesce(turnovers, 0) >= 0 and coalesce(fouls, 0) >= 0
    and coalesce(fg_attempts, 0) >= 0 and coalesce(fg_made, 0) >= 0
    and coalesce(three_attempts, 0) >= 0 and coalesce(three_made, 0) >= 0
    and coalesce(ft_attempts, 0) >= 0 and coalesce(ft_made, 0) >= 0
  )
);

create index match_opponent_stats_event_idx on match_opponent_stats (event_id);

create trigger match_opponent_stats_set_updated_at
  before update on match_opponent_stats
  for each row execute function set_updated_at();

alter table match_opponent_stats enable row level security;

create policy "match_opponent_stats_read"
  on match_opponent_stats for select
  to authenticated
  using (
    is_admin()
    or exists (
      select 1 from events e
      where e.id = match_opponent_stats.event_id
        and e.team_id is not null and coaches_team(e.team_id)
    )
  );

create policy "match_opponent_stats_write"
  on match_opponent_stats for insert
  to authenticated
  with check (
    is_admin()
    or exists (
      select 1 from events e
      where e.id = match_opponent_stats.event_id
        and e.team_id is not null and coaches_team(e.team_id)
    )
  );

create policy "match_opponent_stats_update"
  on match_opponent_stats for update
  to authenticated
  using (
    is_admin()
    or exists (
      select 1 from events e
      where e.id = match_opponent_stats.event_id
        and e.team_id is not null and coaches_team(e.team_id)
    )
  )
  with check (
    is_admin()
    or exists (
      select 1 from events e
      where e.id = match_opponent_stats.event_id
        and e.team_id is not null and coaches_team(e.team_id)
    )
  );
