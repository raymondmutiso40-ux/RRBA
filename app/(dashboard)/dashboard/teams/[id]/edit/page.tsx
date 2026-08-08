import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { EmptyState } from "@/components/ui/empty-state";
import { requireStaff } from "@/lib/auth/session";
import { canManageTeams } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getTeam, listSeasons } from "@/lib/teams/queries";

import { TeamForm } from "../../team-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  if (!isSupabaseConfigured()) return { title: "Edit team" };
  const { id } = await params;
  const team = await getTeam(id);
  return { title: team ? `Edit ${team.name}` : "Edit team" };
}

export default async function EditTeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured()) notFound();

  const user = await requireStaff();

  if (!canManageTeams(user.roles)) {
    return (
      <EmptyState
        title="Not allowed"
        description="Only administrators can edit teams."
        action={
          <Link href="/dashboard/teams" className="text-sm underline">
            Back to teams
          </Link>
        }
      />
    );
  }

  const { id } = await params;
  const [team, seasons] = await Promise.all([getTeam(id), listSeasons()]);

  if (!team) notFound();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href={`/dashboard/teams/${team.id}`}
          className="text-sm text-[var(--foreground-muted)] hover:underline"
        >
          ← {team.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Edit team</h1>
      </div>

      <TeamForm team={team} seasons={seasons} />
    </div>
  );
}
