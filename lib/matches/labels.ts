import type { MatchResult } from "@/lib/supabase/types";

/**
 * Display labels and derived figures for matches.
 *
 * The shared event vocabulary — status labels, durations, times — stays in
 * lib/activity/labels.ts, which already serves both kinds of event. Only what
 * is specific to a fixture lives here.
 */

export const MATCH_RESULT_LABELS: Record<MatchResult, string> = {
  win: "Win",
  loss: "Loss",
  draw: "Draw",
};

export function matchResultTone(
  result: MatchResult | null,
): "success" | "danger" | "warning" | "neutral" {
  if (result === "win") return "success";
  if (result === "loss") return "danger";
  if (result === "draw") return "warning";
  return "neutral";
}

/** Which slice of the fixture list is showing. */
export type MatchFilter = "upcoming" | "played" | "unrecorded" | "all";

export const MATCH_FILTER_LABELS: Record<MatchFilter, string> = {
  upcoming: "Upcoming",
  played: "Played",
  unrecorded: "Needs a result",
  all: "All",
};

export const MATCH_FILTERS: MatchFilter[] = [
  "upcoming",
  "unrecorded",
  "played",
  "all",
];

export function isMatchFilter(value: string | undefined): value is MatchFilter {
  return value !== undefined && value in MATCH_FILTER_LABELS;
}

/**
 * "RRBA 64 — 58 Opponent", ordered so the academy is always on the left.
 *
 * Home and away change who bats first in the usual convention, but a coach
 * reading their own fixture list wants their own score in the same column
 * every time. `is_home` is shown separately rather than by reordering.
 */
export function formatScoreline(match: {
  final_score_team: number | null;
  final_score_opp: number | null;
}): string | null {
  if (match.final_score_team === null || match.final_score_opp === null) {
    return null;
  }
  return `${match.final_score_team} — ${match.final_score_opp}`;
}

/** The columns a box score is entered and displayed in, in reading order. */
export const STAT_COLUMNS = [
  { key: "minutes_played", short: "MIN", label: "Minutes played" },
  { key: "points", short: "PTS", label: "Points" },
  { key: "rebounds", short: "REB", label: "Rebounds" },
  {
    key: "offensive_rebounds",
    short: "ORB",
    label: "Offensive rebounds",
  },
  {
    key: "defensive_rebounds",
    short: "DRB",
    label: "Defensive rebounds",
  },
  { key: "assists", short: "AST", label: "Assists" },
  { key: "steals", short: "STL", label: "Steals" },
  { key: "blocks", short: "BLK", label: "Blocks" },
  { key: "turnovers", short: "TO", label: "Turnovers" },
  { key: "fouls", short: "PF", label: "Fouls" },
  { key: "fg_made", short: "FGM", label: "Field goals made" },
  { key: "fg_attempts", short: "FGA", label: "Field goals attempted" },
  { key: "three_made", short: "3PM", label: "Three-pointers made" },
  { key: "three_attempts", short: "3PA", label: "Three-pointers attempted" },
  { key: "ft_made", short: "FTM", label: "Free throws made" },
  { key: "ft_attempts", short: "FTA", label: "Free throws attempted" },
] as const;

export type StatKey = (typeof STAT_COLUMNS)[number]["key"];

/** The form field name carrying one player's figure for one column. */
export function statFieldName(playerId: string, key: StatKey): string {
  return `stat:${playerId}:${key}`;
}

/**
 * Shooting percentage, or null when nothing was attempted.
 *
 * Zero attempts is not zero percent — it is an unanswered question, and
 * rendering it as 0% reads as a player who missed everything.
 */
export function shootingPercentage(
  made: number | null,
  attempts: number | null,
): number | null {
  if (attempts === null || attempts <= 0) return null;
  return (made ?? 0) / attempts;
}

export function formatPercentage(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

/**
 * Per-game averages across a player's recorded lines.
 *
 * Each average has its own denominator: only the games where that figure was
 * actually recorded. Dividing everything by the total number of appearances
 * would punish a player for games where the coach logged points but had no
 * time to count rebounds — their rebounding average would fall because of
 * missing paperwork rather than because of how they played.
 */
export function perGameAverages(
  lines: Partial<Record<StatKey, number | null>>[],
): Partial<Record<StatKey, number>> {
  const averages: Partial<Record<StatKey, number>> = {};

  for (const column of STAT_COLUMNS) {
    let sum = 0;
    let counted = 0;

    for (const line of lines) {
      const value = line[column.key];
      if (value === null || value === undefined) continue;
      sum += value;
      counted += 1;
    }

    if (counted > 0) averages[column.key] = sum / counted;
  }

  return averages;
}

export function formatAverage(value: number | undefined): string {
  return value === undefined ? "—" : value.toFixed(1);
}

/**
 * True shooting percentage — points per shooting possession, weighting free
 * throws at 0.44 possessions each. Null (not zero) when nothing was taken,
 * for the same reason as {@link shootingPercentage}.
 */
export function trueShootingPercentage(
  points: number,
  fgAttempts: number,
  ftAttempts: number,
): number | null {
  const denominator = 2 * (fgAttempts + 0.44 * ftAttempts);
  if (denominator <= 0) return null;
  return points / denominator;
}

/**
 * A single-number efficiency rating (the common PTS+REB+AST+STL+BLK, minus
 * missed shots and turnovers formula) — a quick read on a box score line,
 * not a substitute for the underlying counts.
 */
export function efficiencyRating(line: {
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  fg_made: number;
  fg_attempts: number;
  ft_made: number;
  ft_attempts: number;
  turnovers: number;
}): number {
  const missedFg = Math.max(0, line.fg_attempts - line.fg_made);
  const missedFt = Math.max(0, line.ft_attempts - line.ft_made);
  return (
    line.points +
    line.rebounds +
    line.assists +
    line.steals +
    line.blocks -
    missedFg -
    missedFt -
    line.turnovers
  );
}

/** "5:07" from a count of seconds — the live, clock-synced form of MIN. */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Estimated possessions for a team's game — the standard box-score estimate:
 * shot attempts, minus offensive rebounds (an offensive board extends the
 * same possession rather than starting a new one), plus turnovers, plus a
 * fraction of free-throw trips (most FT trips come in pairs or one-and-ones,
 * so 0.44 approximates the share that represents a genuinely new possession).
 * This is a team-level figure — there is no such thing as one player's own
 * possessions count, only their share of the team's.
 */
export function estimatedPossessions(team: {
  fg_attempts: number;
  offensive_rebounds: number;
  turnovers: number;
  ft_attempts: number;
}): number {
  return Math.max(
    0,
    team.fg_attempts - team.offensive_rebounds + team.turnovers + 0.44 * team.ft_attempts,
  );
}

/**
 * A simplified usage rate — the share of the team's estimated possessions a
 * player ended, by their own shot attempts, free-throw trips, and turnovers.
 *
 * This is lighter than the full NBA usage formula, which also weights by how
 * many team minutes the player shared the floor for. That weighting needs a
 * team-minutes figure this app doesn't separately track, so this version
 * reads as "share of the team's plays this player used" rather than a
 * minutes-adjusted rate — close enough for a coach sanity-checking who is
 * shooting the team out of its offense, not a stat to publish alongside
 * NBA.com's.
 */
export function usageRate(
  line: { fg_attempts: number; ft_attempts: number; turnovers: number },
  teamPossessions: number,
): number | null {
  if (teamPossessions <= 0) return null;
  return (100 * (line.fg_attempts + 0.44 * line.ft_attempts + line.turnovers)) / teamPossessions;
}
