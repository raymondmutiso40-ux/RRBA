import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSessionUser } from "@/lib/auth/session";
import { canViewMatches } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getMatchesSummary, listMatches } from "@/lib/matches/queries";
import {
  MATCH_FILTERS,
  MATCH_FILTER_LABELS,
  MATCH_RESULT_LABELS,
  formatScoreline,
  isMatchFilter,
  matchResultTone,
  type MatchFilter,
} from "@/lib/matches/labels";
import {
  EVENT_STATUS_LABELS,
  eventStatusTone,
  formatTime,
} from "@/lib/activity/labels";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Matches" };

type SearchParams = { filter?: string };

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (!isSupabaseConfigured()) return null;

  const user = await getSessionUser();
  if (!user) return null;

  if (!canViewMatches(user.roles)) {
    return (
      <EmptyState
        title="No access to matches"
        description="Fixtures are visible to administrators and coaches. Your own team's fixtures appear under My schedule."
      />
    );
  }

  const params = await searchParams;
  const filter: MatchFilter = isMatchFilter(params.filter)
    ? params.filter
    : "upcoming";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Matches</h1>
          <p className="text-sm text-[var(--foreground-muted)]">
            Fixtures, results, and the box score for each game played.
          </p>
        </div>

        <Link href="/dashboard/matches/new">
          <Button>Arrange fixture</Button>
        </Link>
      </div>

      <Suspense fallback={<SummaryFallback />}>
        <SeasonRecord />
      </Suspense>

      <nav aria-label="Filter fixtures" className="flex flex-wrap gap-2">
        {MATCH_FILTERS.map((option) => (
          <Link
            key={option}
            href={
              option === "upcoming"
                ? "/dashboard/matches"
                : `/dashboard/matches?filter=${option}`
            }
            aria-current={option === filter ? "page" : undefined}
            className={
              "rounded-lg px-3 py-1.5 text-sm transition-colors " +
              (option === filter
                ? "bg-[var(--surface-muted)] font-medium"
                : "text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)]")
            }
          >
            {MATCH_FILTER_LABELS[option]}
          </Link>
        ))}
      </nav>

      <Suspense key={filter} fallback={<TableFallback />}>
        <MatchTable filter={filter} />
      </Suspense>
    </div>
  );
}

/** Won/lost/drawn so far, with points for and against. */
async function SeasonRecord() {
  const summary = await getMatchesSummary();

  if (summary.played === 0 && summary.upcomingCount === 0) return null;

  const figures = [
    { label: "Played", value: summary.played },
    { label: "Won", value: summary.won },
    { label: "Lost", value: summary.lost },
    { label: "Drawn", value: summary.drawn },
    { label: "Points for", value: summary.pointsFor },
    { label: "Points against", value: summary.pointsAgainst },
  ];

  return (
    <Card>
      <CardContent className="pt-5">
        <dl className="grid grid-cols-3 gap-4 sm:grid-cols-6">
          {figures.map((figure) => (
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

        {summary.awaitingResult > 0 ? (
          <p className="mt-4 text-sm text-[var(--foreground-muted)]">
            {summary.awaitingResult} played{" "}
            {summary.awaitingResult === 1 ? "fixture has" : "fixtures have"} no
            result recorded yet, so {summary.awaitingResult === 1 ? "it is" : "they are"}{" "}
            not counted above.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

async function MatchTable({ filter }: { filter: MatchFilter }) {
  const matches = await listMatches({ filter });

  if (matches.length === 0) {
    return (
      <EmptyState
        title={
          filter === "unrecorded"
            ? "Every result is in"
            : filter === "upcoming"
              ? "No fixtures arranged"
              : "No fixtures yet"
        }
        description={
          filter === "unrecorded"
            ? "Fixtures that have been played without a final score appear here."
            : "A fixture belongs to a team, and its box score is built from that team's roster."
        }
        action={
          filter !== "unrecorded" ? (
            <Link href="/dashboard/matches/new">
              <Button>Arrange a fixture</Button>
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      <Table>
        <caption className="sr-only">Fixtures, {matches.length} shown</caption>
        <TableHeader>
          <tr>
            <TableHead>Fixture</TableHead>
            <TableHead>Team</TableHead>
            <TableHead>When</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Box score</TableHead>
            <TableHead>Status</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {matches.map((match) => {
            const scoreline = formatScoreline(match);

            return (
              <TableRow key={match.id}>
                <TableCell>
                  <Link
                    href={`/dashboard/matches/${match.id}`}
                    className="font-medium hover:underline"
                  >
                    {match.opponent ?? match.title}
                  </Link>
                  <span className="block text-xs text-[var(--foreground-muted)]">
                    {match.is_home === null
                      ? null
                      : match.is_home
                        ? "Home"
                        : "Away"}
                    {match.competition ? ` · ${match.competition}` : ""}
                  </span>
                  <Link
                    href={`/dashboard/matches/${match.id}/game-day`}
                    className="mt-1 inline-flex text-xs font-medium text-[var(--primary)] hover:underline"
                  >
                    Open Game Day →
                  </Link>
                </TableCell>
                <TableCell>
                  {match.team_id ? (
                    <Link
                      href={`/dashboard/teams/${match.team_id}`}
                      className="hover:underline"
                    >
                      {match.team_name}
                    </Link>
                  ) : (
                    <span className="text-[var(--foreground-muted)]">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {formatDate(match.starts_at)}
                  <span className="block text-xs text-[var(--foreground-muted)]">
                    {formatTime(match.starts_at)}
                  </span>
                </TableCell>
                <TableCell>
                  {scoreline ? (
                    <span className="flex items-center gap-2">
                      <span className="font-medium tabular-nums">
                        {scoreline}
                      </span>
                      {match.result ? (
                        <Badge tone={matchResultTone(match.result)}>
                          {MATCH_RESULT_LABELS[match.result]}
                        </Badge>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-sm text-[var(--foreground-muted)]">
                      Not played
                    </span>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">
                  {match.stat_lines === 0 ? (
                    <span className="text-sm text-[var(--foreground-muted)]">
                      —
                    </span>
                  ) : (
                    `${match.stat_lines} player${match.stat_lines === 1 ? "" : "s"}`
                  )}
                </TableCell>
                <TableCell>
                  <Badge tone={eventStatusTone(match.status)}>
                    {EVENT_STATUS_LABELS[match.status]}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

function SummaryFallback() {
  return <Skeleton className="h-28 w-full" />;
}

function TableFallback() {
  return (
    <Card className="p-4" aria-busy="true">
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </Card>
  );
}
