import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { EmptyState } from "@/components/ui/empty-state";
import { requireStaff } from "@/lib/auth/session";
import { canViewMatches, isAdmin } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCoachedTeamIds } from "@/lib/activity/queries";
import { getPlayableTeams } from "@/lib/matches/queries";

import { MatchForm } from "../match-form";

export const metadata: Metadata = { title: "Arrange fixture" };

type SearchParams = { team?: string };

export default async function NewMatchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (!isSupabaseConfigured()) notFound();

  const user = await requireStaff();

  if (!canViewMatches(user.roles)) {
    return (
      <EmptyState
        title="Not allowed"
        description="Only administrators and coaches can arrange fixtures."
        action={
          <Link href="/dashboard/matches" className="text-sm underline">
            Back to matches
          </Link>
        }
      />
    );
  }

  // A coach only gets their own teams, matching events_coach_write. Offering
  // the full list would produce a form that fails on submit.
  const coachedTeamIds = isAdmin(user.roles)
    ? null
    : await getCoachedTeamIds(user.id);

  const [{ team }, teams] = await Promise.all([
    searchParams,
    getPlayableTeams({ limitToTeamIds: coachedTeamIds }),
  ]);

  if (teams.length === 0) {
    return (
      <EmptyState
        title="No teams to arrange a fixture for"
        description={
          isAdmin(user.roles)
            ? "There are no active teams yet. Create one first — a fixture belongs to a team, and its box score comes from that team's roster."
            : "You are not currently assigned to any team, so there is nothing to arrange a fixture against. An administrator assigns coaches from the team page."
        }
        action={
          <Link
            href={isAdmin(user.roles) ? "/dashboard/teams/new" : "/dashboard/matches"}
            className="text-sm underline"
          >
            {isAdmin(user.roles) ? "Create a team" : "Back to matches"}
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/dashboard/matches"
          className="text-sm text-[var(--foreground-muted)] hover:underline"
        >
          ← Matches
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Arrange fixture
        </h1>
      </div>

      <MatchForm teams={teams} defaultTeamId={team} />
    </div>
  );
}
