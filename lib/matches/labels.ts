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
