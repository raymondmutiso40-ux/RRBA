import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getSessionUser } from "@/lib/auth/session";
import {
  canManageMatch,
  canRecordMatchStats,
  canViewMatches,
  isAdmin,
} from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCoachedTeamIds } from "@/lib/activity/queries";
import {
  getMatch,
  getMatchBoxScore,
  getSquadCandidates,
} from "@/lib/matches/queries";
import {
  MATCH_RESULT_LABELS,
  formatScoreline,
  matchResultTone,
} from "@/lib/matches/labels";
import {
  EVENT_STATUS_LABELS,
  eventStatusTone,
  formatDuration,
  formatTime,
} from "@/lib/activity/labels";
import { formatDate } from "@/lib/utils";

import { BoxScore } from "../box-score";
import {
  MatchResultForm,
  MatchSquad,
  MatchStatusControls,
} from "../match-controls";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  if (!isSupabaseConfigured()) return { title: "Match" };
  const { id } = await params;
  const match = await getMatch(id);
  return { title: match ? match.title : "Match" };
}

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured()) return null;

  const user = await getSessionUser();
  if (!user) return null;

  if (!canViewMatches(user.roles)) {
    return (
      <EmptyState
        title="No access to matches"
        description="Fixtures are visible to administrators and coaches."
      />
    );
  }

  const { id } = await params;
  const match = await getMatch(id);

  // events_read_authenticated gives every signed-in user the calendar, so a
  // miss means the fixture does not exist rather than that it is hidden.
  if (!match) notFound();

  const coachedTeamIds = isAdmin(user.roles)
    ? []
    : await getCoachedTeamIds(user.id);

  const manage = canManageMatch(user.roles, match.team_id, coachedTeamIds);
  const record = canRecordMatchStats(user.roles, match.team_id, coachedTeamIds);

  const entries = await getMatchBoxScore(match.id, match.team_id);
  const named = entries.filter((entry) => entry.is_call_up);
  const usesRoster = named.length === 0 && match.team_id !== null;

  const candidates = manage ? await getSquadCandidates(match.id) : [];

  const scoreline = formatScoreline(match);
  const played = new Date(match.starts_at) < new Date();

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link
          href="/dashboard/matches"
          className="text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
        >
          ← Matches
        </Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {match.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--foreground-muted)]">
            <Badge tone={eventStatusTone(match.status)}>
              {EVENT_STATUS_LABELS[match.status]}
            </Badge>
            {match.result ? (
              <Badge tone={matchResultTone(match.result)}>
                {MATCH_RESULT_LABELS[match.result]}
              </Badge>
            ) : null}
            {match.team_id ? (
              <Link
                href={`/dashboard/teams/${match.team_id}`}
                className="hover:underline"
              >
                {match.team_name}
              </Link>
            ) : null}
            <span>
              · {formatDate(match.starts_at)} at {formatTime(match.starts_at)}
            </span>
            <span>· {match.is_home ? "Home" : "Away"}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {record ? (
            <Link href={`/dashboard/matches/${match.id}/game-day`}>
              <Button>Open Game Day</Button>
            </Link>
          ) : null}
          {manage ? (
            <Link href={`/dashboard/matches/${match.id}/edit`}>
              <Button variant="outline">Edit fixture</Button>
            </Link>
          ) : null}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Fixture</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-3">
              <Field label="Opponent">{match.opponent ?? "—"}</Field>
              <Field label="Competition">{match.competition ?? "Friendly"}</Field>
              <Field label="Venue">{match.location ?? "—"}</Field>
              <Field label="Coach">{match.coach_name ?? "Unassigned"}</Field>
              <Field label="Scheduled">
                {formatDuration(match.starts_at, match.ends_at)}
              </Field>
              {match.description ? (
                <Field label="Notes">{match.description}</Field>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Result</CardTitle>
            <CardDescription>
              {scoreline
                ? "The final score as recorded. Changing it re-derives the win, loss or draw."
                : played
                  ? "This fixture has been played but has no score recorded."
                  : "Not played yet. The score can be recorded once it has been."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {scoreline ? (
              <div className="flex flex-wrap items-baseline gap-3">
                <p className="text-4xl font-semibold tracking-tight tabular-nums">
                  {scoreline}
                </p>
                <p className="text-sm text-[var(--foreground-muted)]">
                  {match.team_name ?? "The team"} vs {match.opponent}
                </p>
              </div>
            ) : null}

            {manage ? (
              <MatchResultForm
                match={match}
                teamName={match.team_name ?? "Runda Ridge"}
              />
            ) : !scoreline ? (
              <p className="text-sm text-[var(--foreground-muted)]">
                Only a coach of this team can record the result.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Box score</CardTitle>
          <CardDescription>
            {usesRoster
              ? "Built from the team's current roster. Name a squad below to narrow it to who actually played."
              : "Built from the squad named for this fixture."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BoxScore
            eventId={match.id}
            entries={entries}
            canRecord={record}
            teamScore={match.final_score_team}
          />
        </CardContent>
      </Card>

      {manage ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Matchday squad</CardTitle>
              <CardDescription>
                Who travelled. Naming a squad narrows the box score to those
                players.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MatchSquad
                eventId={match.id}
                entries={entries}
                candidates={candidates}
                usesRoster={usesRoster}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fixture status</CardTitle>
            </CardHeader>
            <CardContent>
              <MatchStatusControls eventId={match.id} status={match.status} />
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-[var(--foreground-muted)] uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm whitespace-pre-wrap">{children}</dd>
    </div>
  );
}
