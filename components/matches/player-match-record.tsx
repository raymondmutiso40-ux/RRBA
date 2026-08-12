import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  MATCH_RESULT_LABELS,
  formatAverage,
  formatPercentage,
  formatScoreline,
  matchResultTone,
  perGameAverages,
  shootingPercentage,
} from "@/lib/matches/labels";
import type { PlayerMatchLine } from "@/lib/matches/queries";
import { formatDate } from "@/lib/utils";

/**
 * One player's match record — averages, then the recent lines behind them.
 *
 * Shown on the player profile and on the family's own view of a player, so it
 * takes already-fetched lines rather than querying: the two callers reach the
 * same rows through different RLS paths (coaches_player versus is_player /
 * guards_player) and neither should have to know about the other.
 */
export function PlayerMatchRecord({
  lines,
  /**
   * Whether each row links through to the fixture.
   *
   * Off for the family's own view: /dashboard/matches is staff-only, so a
   * parent following the link would land on a refusal. They can see their
   * child's line here and the fixture itself under My schedule.
   */
  linkToMatch = true,
}: {
  lines: PlayerMatchLine[];
  linkToMatch?: boolean;
}) {
  if (lines.length === 0) {
    return (
      <p className="text-sm text-[var(--foreground-muted)]">
        No match statistics recorded yet. Box scores are entered against a
        fixture once it has been played.
      </p>
    );
  }

  const averages = perGameAverages(lines);

  const headline = [
    { label: "Games", value: String(lines.length) },
    { label: "PPG", value: formatAverage(averages.points) },
    { label: "RPG", value: formatAverage(averages.rebounds) },
    { label: "APG", value: formatAverage(averages.assists) },
    {
      label: "FG%",
      value: formatPercentage(
        shootingPercentage(
          lines.reduce((sum, line) => sum + (line.fg_made ?? 0), 0),
          lines.reduce((sum, line) => sum + (line.fg_attempts ?? 0), 0),
        ),
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-3 gap-4 sm:grid-cols-5">
        {headline.map((figure) => (
          <div key={figure.label}>
            <dt className="text-xs tracking-wide text-[var(--foreground-muted)] uppercase">
              {figure.label}
            </dt>
            <dd className="mt-0.5 text-2xl font-semibold tabular-nums">
              {figure.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="w-full overflow-x-auto">
        <table className="w-full caption-bottom text-sm">
          <caption className="sr-only">
            Recent matches, {lines.length} shown
          </caption>
          <thead className="border-b border-[var(--border-color)]">
            <tr>
              <th
                scope="col"
                className="px-3 py-2 text-left text-xs font-medium tracking-wide text-[var(--foreground-muted)] uppercase"
              >
                Match
              </th>
              {["MIN", "PTS", "REB", "AST", "STL", "BLK"].map((short) => (
                <th
                  key={short}
                  scope="col"
                  className="px-2 py-2 text-right text-xs font-medium tracking-wide text-[var(--foreground-muted)] uppercase"
                >
                  {short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&_tr:not(:last-child)]:border-b [&_tr]:border-[var(--border-color)]">
            {lines.map((line) => (
              <tr key={line.id}>
                <th scope="row" className="px-3 py-2 text-left font-normal">
                  {linkToMatch ? (
                    <Link
                      href={`/dashboard/matches/${line.event_id}`}
                      className="font-medium hover:underline"
                    >
                      {line.opponent ?? "Match"}
                    </Link>
                  ) : (
                    <span className="font-medium">
                      {line.opponent ?? "Match"}
                    </span>
                  )}
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--foreground-muted)]">
                    {formatDate(line.starts_at)}
                    {formatScoreline(line) ? (
                      <span className="tabular-nums">
                        · {formatScoreline(line)}
                      </span>
                    ) : null}
                    {line.result ? (
                      <Badge tone={matchResultTone(line.result)}>
                        {MATCH_RESULT_LABELS[line.result]}
                      </Badge>
                    ) : null}
                  </span>
                </th>
                {(
                  [
                    "minutes_played",
                    "points",
                    "rebounds",
                    "assists",
                    "steals",
                    "blocks",
                  ] as const
                ).map((key) => (
                  <td key={key} className="px-2 py-2 text-right tabular-nums">
                    {line[key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
