import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { EmptyState } from "@/components/ui/empty-state";
import { requireStaff } from "@/lib/auth/session";
import { canManageTeams } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { listSeasons } from "@/lib/teams/queries";
import { TeamForm } from "../team-form";

export const metadata: Metadata = { title: "Create team" };

export default async function NewTeamPage() {
  if (!isSupabaseConfigured()) notFound();

  const user = await requireStaff();

  if (!canManageTeams(user.roles)) {
    return (
      <EmptyState
        title="Not allowed"
        description="Only administrators can create teams."
        action={
          <Link href="/dashboard/teams" className="text-sm underline">
            Back to teams
          </Link>
        }
      />
    );
  }

  const seasons = await listSeasons();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/dashboard/teams"
          className="text-sm text-[var(--foreground-muted)] hover:underline"
        >
          ← Teams
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Create team</h1>
      </div>

      <TeamForm seasons={seasons} />
    </div>
  );
}
