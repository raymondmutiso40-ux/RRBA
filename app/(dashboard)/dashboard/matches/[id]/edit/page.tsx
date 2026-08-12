import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { EmptyState } from "@/components/ui/empty-state";
import { requireStaff } from "@/lib/auth/session";
import { canManageMatch, canViewMatches, isAdmin } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCoachedTeamIds } from "@/lib/activity/queries";
import { getMatch, getPlayableTeams } from "@/lib/matches/queries";

import { MatchForm } from "../../match-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  if (!isSupabaseConfigured()) return { title: "Edit fixture" };
  const { id } = await params;
  const match = await getMatch(id);
  return { title: match ? `Edit ${match.title}` : "Edit fixture" };
}

export default async function EditMatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured()) notFound();

  const user = await requireStaff();

  if (!canViewMatches(user.roles)) {
    return (
      <EmptyState
        title="Not allowed"
        description="Only administrators and coaches can edit fixtures."
        action={
          <Link href="/dashboard/matches" className="text-sm underline">
            Back to matches
          </Link>
        }
      />
    );
  }

  const { id } = await params;
  const match = await getMatch(id);

  if (!match) notFound();

  const coachedTeamIds = isAdmin(user.roles)
    ? null
    : await getCoachedTeamIds(user.id);

  if (!canManageMatch(user.roles, match.team_id, coachedTeamIds ?? [])) {
    return (
      <EmptyState
        title="Not your fixture"
        description="You can only edit fixtures for teams you currently coach."
        action={
          <Link
            href={`/dashboard/matches/${match.id}`}
            className="text-sm underline"
          >
            Back to the fixture
          </Link>
        }
      />
    );
  }

  const teams = await getPlayableTeams({ limitToTeamIds: coachedTeamIds });

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href={`/dashboard/matches/${match.id}`}
          className="text-sm text-[var(--foreground-muted)] hover:underline"
        >
          ← {match.title}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Edit fixture</h1>
      </div>

      <MatchForm match={match} teams={teams} />
    </div>
  );
}
