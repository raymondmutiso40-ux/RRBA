"use client";

import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { saveBoxScoreAction } from "@/lib/matches/actions";
import {
  emptyMatchActionState,
  type MatchActionState,
} from "@/lib/matches/action-state";
import {
  STAT_COLUMNS,
  formatPercentage,
  shootingPercentage,
  statFieldName,
  type StatKey,
} from "@/lib/matches/labels";
import type { BoxScoreEntry } from "@/lib/matches/queries";

/**
 * The box score for one match.
 *
 * Fourteen figures per player is a lot of inputs, so the whole grid posts in
 * one submit the way the attendance register does — a coach works down the
 * team sheet and saves once, rather than firing a request per player.
 *
 * A player whose row is left entirely blank is skipped by the server rather
 * than stored as zeroes. "Nobody recorded what they did" and "they did nothing"
 * are different claims, and only the second should drag a season average down.
 */
export function BoxScore({
  eventId,
  entries,
  canRecord,
  teamScore,
}: {
  eventId: string;
  entries: BoxScoreEntry[];
  canRecord: boolean;
  /** The recorded team score, for the cross-check under an editable grid. */
  teamScore: number | null;
}) {
  const [state, formAction, isPending] = useActionState<
    MatchActionState,
    FormData
  >(saveBoxScoreAction, emptyMatchActionState);

  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[var(--border-color)] p-6 text-center text-sm text-[var(--foreground-muted)]">
        Nobody to record. This fixture has no squad named and its team has no
        current roster, so there is no one to enter figures against.
      </p>
    );
  }

  if (!canRecord) {
    return <BoxScoreTable entries={entries} />;
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="eventId" value={eventId} />

      {state.message ? (
        <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>
      ) : null}

      <EditableTable
        entries={entries}
        fieldErrors={state.fieldErrors}
        teamScore={teamScore}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={isPending}>
          Save box score
        </Button>
        <p className="text-xs text-[var(--foreground-muted)]">
          Leave a row blank for a player who did not play. Blanks are not saved
          as zeroes.
        </p>
      </div>
    </form>
  );
}

function playerName(entry: BoxScoreEntry) {
  const number = entry.jersey_number === null ? "" : `#${entry.jersey_number} `;
  return `${number}${entry.first_name} ${entry.last_name}`.trim();
}

/**
 * The editable grid.
 *
 * Only the points column is tracked in React state. It is the one figure that
 * can be checked against something already known — the final score — and
 * mirroring all fourteen columns into state would re-render the whole grid on
 * every keystroke to no purpose. The rest are uncontrolled and read from the
 * form on submit.
 */
function EditableTable({
  entries,
  fieldErrors,
  teamScore,
}: {
  entries: BoxScoreEntry[];
  fieldErrors?: Record<string, string>;
  teamScore: number | null;
}) {
  const [points, setPoints] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const entry of entries) {
      if (entry.stats?.points != null) initial[entry.player_id] = entry.stats.points;
    }
    return initial;
  });

  const pointsTotal = Object.values(points).reduce((sum, n) => sum + n, 0);
  const mismatch = teamScore !== null && pointsTotal !== teamScore;

  return (
    <div className="flex flex-col gap-3">
      {mismatch ? (
        <Alert tone="warning">
          The points entered add up to {pointsTotal}, but the final score has the
          team on {teamScore}. That is fine while the grid is half filled in —
          worth a second look once it is complete.
        </Alert>
      ) : null}

      <div className="w-full overflow-x-auto">
        <table className="w-full caption-bottom text-sm">
          <caption className="sr-only">
            Box score entry, {entries.length} players
          </caption>
          <thead className="border-b border-[var(--border-color)]">
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 bg-[var(--surface)] px-3 py-2 text-left text-xs font-medium tracking-wide text-[var(--foreground-muted)] uppercase"
              >
                Player
              </th>
              {STAT_COLUMNS.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className="px-1.5 py-2 text-center text-xs font-medium tracking-wide text-[var(--foreground-muted)] uppercase"
                >
                  <abbr title={column.label} className="no-underline">
                    {column.short}
                  </abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&_tr:not(:last-child)]:border-b [&_tr]:border-[var(--border-color)]">
            {entries.map((entry) => {
              const error = fieldErrors?.[entry.player_id];

              return (
                <tr key={entry.player_id}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-[var(--surface)] px-3 py-2 text-left font-normal"
                  >
                    <input type="hidden" name="playerId" value={entry.player_id} />
                    <span className="whitespace-nowrap">{playerName(entry)}</span>
                    {error ? (
                      <span
                        role="alert"
                        className="block text-xs text-[var(--color-danger)]"
                      >
                        {error}
                      </span>
                    ) : null}
                  </th>

                  {STAT_COLUMNS.map((column) => (
                    <td key={column.key} className="px-1 py-1.5">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={column.key === "minutes_played" ? 200 : 500}
                        name={statFieldName(entry.player_id, column.key)}
                        aria-label={`${column.label} for ${playerName(entry)}`}
                        aria-invalid={error ? true : undefined}
                        defaultValue={statValue(entry, column.key)}
                        onChange={
                          column.key === "points"
                            ? (event) => {
                                const value = Number(event.currentTarget.value);
                                setPoints((current) => ({
                                  ...current,
                                  [entry.player_id]: Number.isFinite(value)
                                    ? value
                                    : 0,
                                }));
                              }
                            : undefined
                        }
                        className={
                          "h-9 w-14 rounded-md border bg-[var(--surface)] px-1.5 text-center text-sm tabular-nums " +
                          (error
                            ? "border-[var(--color-danger)]"
                            : "border-[var(--border-color)]")
                        }
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function statValue(entry: BoxScoreEntry, key: StatKey): string {
  const value = entry.stats?.[key];
  return value === null || value === undefined ? "" : String(value);
}

/** The read-only box score, with shooting splits and a totals row. */
function BoxScoreTable({ entries }: { entries: BoxScoreEntry[] }) {
  const recorded = entries.filter((entry) => entry.stats !== null);

  if (recorded.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[var(--border-color)] p-6 text-center text-sm text-[var(--foreground-muted)]">
        No box score recorded for this fixture.
      </p>
    );
  }

  const total = (key: StatKey) =>
    recorded.reduce((sum, entry) => sum + (entry.stats?.[key] ?? 0), 0);

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full caption-bottom text-sm">
        <caption className="sr-only">
          Box score, {recorded.length} players
        </caption>
        <thead className="border-b border-[var(--border-color)]">
          <tr>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium tracking-wide text-[var(--foreground-muted)] uppercase"
            >
              Player
            </th>
            {STAT_COLUMNS.map((column) => (
              <th
                key={column.key}
                scope="col"
                className="px-2 py-2 text-right text-xs font-medium tracking-wide text-[var(--foreground-muted)] uppercase"
              >
                <abbr title={column.label} className="no-underline">
                  {column.short}
                </abbr>
              </th>
            ))}
            <th
              scope="col"
              className="px-2 py-2 text-right text-xs font-medium tracking-wide text-[var(--foreground-muted)] uppercase"
            >
              <abbr title="Field goal percentage" className="no-underline">
                FG%
              </abbr>
            </th>
            <th
              scope="col"
              className="px-2 py-2 text-right text-xs font-medium tracking-wide text-[var(--foreground-muted)] uppercase"
            >
              <abbr title="Three-point percentage" className="no-underline">
                3P%
              </abbr>
            </th>
          </tr>
        </thead>
        <tbody className="[&_tr:not(:last-child)]:border-b [&_tr]:border-[var(--border-color)]">
          {recorded.map((entry) => (
            <tr key={entry.player_id} className="hover:bg-[var(--surface-muted)]">
              <th
                scope="row"
                className="px-3 py-2 text-left font-normal whitespace-nowrap"
              >
                {playerName(entry)}
              </th>
              {STAT_COLUMNS.map((column) => (
                <td
                  key={column.key}
                  className="px-2 py-2 text-right tabular-nums"
                >
                  {entry.stats?.[column.key] ?? "—"}
                </td>
              ))}
              <td className="px-2 py-2 text-right tabular-nums">
                {formatPercentage(
                  shootingPercentage(
                    entry.stats?.fg_made ?? null,
                    entry.stats?.fg_attempts ?? null,
                  ),
                )}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">
                {formatPercentage(
                  shootingPercentage(
                    entry.stats?.three_made ?? null,
                    entry.stats?.three_attempts ?? null,
                  ),
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-[var(--border-color)] font-medium">
          <tr>
            <th scope="row" className="px-3 py-2 text-left">
              Total
            </th>
            {STAT_COLUMNS.map((column) => (
              <td key={column.key} className="px-2 py-2 text-right tabular-nums">
                {total(column.key)}
              </td>
            ))}
            <td className="px-2 py-2 text-right tabular-nums">
              {formatPercentage(
                shootingPercentage(total("fg_made"), total("fg_attempts")),
              )}
            </td>
            <td className="px-2 py-2 text-right tabular-nums">
              {formatPercentage(
                shootingPercentage(total("three_made"), total("three_attempts")),
              )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
