-- RRBA — split rebounds into offensive / defensive
--
-- `rebounds` stays as-is: it is the total, and every box score recorded
-- before this migration only ever had a total. The two new columns are the
-- split going forward — nullable, like every other stat, because a coach who
-- only has the total to hand should still be able to save that without
-- inventing a split they didn't track. The app treats a line's rebound total
-- as offensive_rebounds + defensive_rebounds when both are present, and
-- falls back to the stored `rebounds` figure otherwise, so old rows keep
-- reading correctly.

alter table player_match_stats
  add column offensive_rebounds smallint,
  add column defensive_rebounds smallint;

alter table player_match_stats
  drop constraint match_stats_nonnegative;

alter table player_match_stats
  add constraint match_stats_nonnegative check (
    minutes_played >= 0 and points >= 0 and rebounds >= 0 and assists >= 0
    and steals >= 0 and blocks >= 0 and turnovers >= 0 and fouls >= 0
    and fg_attempts >= 0 and fg_made >= 0 and three_attempts >= 0
    and three_made >= 0 and ft_attempts >= 0 and ft_made >= 0
    and coalesce(offensive_rebounds, 0) >= 0
    and coalesce(defensive_rebounds, 0) >= 0
  );

alter table match_opponent_stats
  add column offensive_rebounds smallint,
  add column defensive_rebounds smallint;

alter table match_opponent_stats
  drop constraint opponent_stats_nonnegative;

alter table match_opponent_stats
  add constraint opponent_stats_nonnegative check (
    coalesce(minutes_played, 0) >= 0 and coalesce(points, 0) >= 0
    and coalesce(rebounds, 0) >= 0 and coalesce(assists, 0) >= 0
    and coalesce(steals, 0) >= 0 and coalesce(blocks, 0) >= 0
    and coalesce(turnovers, 0) >= 0 and coalesce(fouls, 0) >= 0
    and coalesce(fg_attempts, 0) >= 0 and coalesce(fg_made, 0) >= 0
    and coalesce(three_attempts, 0) >= 0 and coalesce(three_made, 0) >= 0
    and coalesce(ft_attempts, 0) >= 0 and coalesce(ft_made, 0) >= 0
    and coalesce(offensive_rebounds, 0) >= 0
    and coalesce(defensive_rebounds, 0) >= 0
  );
