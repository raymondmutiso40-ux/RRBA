import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { EmptyState } from "@/components/ui/empty-state";
import { requireStaff } from "@/lib/auth/session";
import {
  canCreateTeamlessSession,
  canManageSession,
  canRecordAttendance,
  isAdmin,
} from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  getCoachedTeamIds,
  getSchedulableTeams,
  getSession,
} from "@/lib/activity/queries";

import { SessionForm } from "../../session-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  if (!isSupabaseConfigured()) return { title: "Edit session" };
  const { id } = await params;
  const session = await getSession(id);
  return { title: session ? `Edit ${session.title}` : "Edit session" };
}

export default async function EditSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured()) notFound();

  const user = await requireStaff();

  if (!canRecordAttendance(user.roles)) {
    return (
      <EmptyState
        title="Not allowed"
        description="Only administrators and coaches can edit training."
        action={
          <Link href="/dashboard/training" className="text-sm underline">
            Back to training
          </Link>
        }
      />
    );
  }

  const { id } = await params;
  const session = await getSession(id);

  if (!session) notFound();

  const coachedTeamIds = isAdmin(user.roles)
    ? null
    : await getCoachedTeamIds(user.id);

  if (!canManageSession(user.roles, session.team_id, coachedTeamIds ?? [])) {
    return (
      <EmptyState
        title="Not your session"
        description="You can only edit sessions for teams you currently coach."
        action={
          <Link
            href={`/dashboard/training/${session.id}`}
            className="text-sm underline"
          >
            Back to the session
          </Link>
        }
      />
    );
  }

  const teams = await getSchedulableTeams({ limitToTeamIds: coachedTeamIds });

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href={`/dashboard/training/${session.id}`}
          className="text-sm text-[var(--foreground-muted)] hover:underline"
        >
          ← {session.title}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Edit session</h1>
      </div>

      <SessionForm
        session={session}
        teams={teams}
        canScheduleTeamless={canCreateTeamlessSession(user.roles)}
      />
    </div>
  );
}
