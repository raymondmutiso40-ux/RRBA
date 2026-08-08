import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { EmptyState } from "@/components/ui/empty-state";
import { requireStaff } from "@/lib/auth/session";
import {
  canCreateTeamlessSession,
  canRecordAttendance,
  isAdmin,
} from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCoachedTeamIds, getSchedulableTeams } from "@/lib/activity/queries";

import { SessionForm } from "../session-form";

export const metadata: Metadata = { title: "Schedule session" };

type SearchParams = { team?: string };

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (!isSupabaseConfigured()) notFound();

  const user = await requireStaff();

  if (!canRecordAttendance(user.roles)) {
    return (
      <EmptyState
        title="Not allowed"
        description="Only administrators and coaches can schedule training."
        action={
          <Link href="/dashboard/training" className="text-sm underline">
            Back to training
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
    getSchedulableTeams({ limitToTeamIds: coachedTeamIds }),
  ]);

  if (teams.length === 0 && !canCreateTeamlessSession(user.roles)) {
    return (
      <EmptyState
        title="No teams to schedule for"
        description="You are not currently assigned to any team, so there is nothing to schedule a session against. An administrator assigns coaches from the team page."
        action={
          <Link href="/dashboard/training" className="text-sm underline">
            Back to training
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/dashboard/training"
          className="text-sm text-[var(--foreground-muted)] hover:underline"
        >
          ← Training
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Schedule session
        </h1>
      </div>

      <SessionForm
        teams={teams}
        canScheduleTeamless={canCreateTeamlessSession(user.roles)}
        defaultTeamId={team}
      />
    </div>
  );
}
