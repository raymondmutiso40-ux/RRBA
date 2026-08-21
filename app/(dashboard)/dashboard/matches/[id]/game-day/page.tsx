import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getSessionUser } from "@/lib/auth/session";
import {
  canRecordMatchStats,
  canViewMatches,
  isAdmin,
} from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCoachedTeamIds } from "@/lib/activity/queries";
import { getMatch, getMatchBoxScore, getOpponentBoxScore } from "@/lib/matches/queries";
import { EVENT_STATUS_LABELS, eventStatusTone, formatTime } from "@/lib/activity/labels";
import { formatDate } from "@/lib/utils";

import { GameDayConsole } from "./game-day-console";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  if (!isSupabaseConfigured()) return { title: "Game Day" };
  const { id } = await params;
  const match = await getMatch(id);
  return { title: match ? `Game Day · ${match.title}` : "Game Day" };
}

export default async function GameDayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured()) return null;

  const user = await getSessionUser();
  if (!user) redirect("/login");

  if (!canViewMatches(user.roles)) {
    return (
      <EmptyState
        title="No access to matches"
        description="Game Day is available to administrators and coaches."
      />
    );
  }

  const { id } = await params;
  const match = await getMatch(id);
  if (!match) notFound();

  const coachedTeamIds = isAdmin(user.roles)
    ? []
    : await getCoachedTeamIds(user.id);
  const canRecord = canRecordMatchStats(user.roles, match.team_id, coachedTeamIds);

  if (!canRecord) {
    return (
      <EmptyState
        title="Game Day recording is restricted"
        description="Only an administrator or a coach responsible for this team can record live statistics."
      />
    );
  }

  const [entries, opponentEntries] = await Promise.all([
    getMatchBoxScore(match.id, match.team_id),
    getOpponentBoxScore(match.id),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 pb-6">
      <header className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div>
          <div className="flex items-center gap-2 text-sm text-[var(--foreground-muted)]">
            <Link href={`/dashboard/matches/${match.id}`} className="hover:underline">
              ← Match
            </Link>
            <span>·</span>
            <span>{formatDate(match.starts_at)} · {formatTime(match.starts_at)}</span>
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Game Day</h1>
          <p className="text-sm text-[var(--foreground-muted)]">
            {match.team_name ?? "RRBA"} vs {match.opponent ?? "Opponent"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={eventStatusTone(match.status)}>{EVENT_STATUS_LABELS[match.status]}</Badge>
          <Link href={`/dashboard/matches/${match.id}`}>
            <Button variant="outline" size="sm">Full match</Button>
          </Link>
        </div>
      </header>

      <GameDayConsole
        eventId={match.id}
        teamName={match.team_name ?? "RRBA"}
        opponentName={match.opponent ?? "Opponent"}
        initialTeamScore={match.final_score_team ?? 0}
        initialOpponentScore={match.final_score_opp ?? 0}
        initialEntries={entries}
        initialOpponentEntries={opponentEntries}
      />
    </div>
  );
}
