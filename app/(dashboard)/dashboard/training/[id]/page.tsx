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
  canManageSession,
  canMarkRegister,
  canViewTraining,
  isAdmin,
} from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  getCallUpCandidates,
  getCoachedTeamIds,
  getSession,
  getSessionRegister,
} from "@/lib/activity/queries";
import {
  ATTENDANCE_STATUS_LABELS,
  EVENT_STATUS_LABELS,
  eventStatusTone,
  formatDuration,
  formatTime,
} from "@/lib/activity/labels";
import { formatDate } from "@/lib/utils";

import { AttendanceRegister } from "../attendance-register";
import { SessionCallUps, SessionStatusControls } from "../session-controls";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  if (!isSupabaseConfigured()) return { title: "Session" };
  const { id } = await params;
  const session = await getSession(id);
  return { title: session ? session.title : "Session" };
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured()) return null;

  const user = await getSessionUser();
  if (!user) return null;

  if (!canViewTraining(user.roles)) {
    return (
      <EmptyState
        title="No access to training"
        description="Training sessions are visible to administrators and coaches."
      />
    );
  }

  const { id } = await params;
  const session = await getSession(id);

  // events_read_authenticated gives every signed-in user the calendar, so a
  // miss means the session does not exist rather than that it is hidden.
  if (!session) notFound();

  const coachedTeamIds = isAdmin(user.roles)
    ? []
    : await getCoachedTeamIds(user.id);

  const manage = canManageSession(user.roles, session.team_id, coachedTeamIds);
  const mark = canMarkRegister(user.roles, session.team_id, coachedTeamIds);

  const register = await getSessionRegister(session.id, session.team_id);
  const callUps = register.filter((entry) => entry.is_call_up);
  // No call-ups and a team means the register is the roster — worth saying so,
  // because the first call-up changes that.
  const usesRoster = callUps.length === 0 && session.team_id !== null;

  const candidates = manage ? await getCallUpCandidates(session.id) : [];

  const marked = register.filter((entry) => entry.status !== null);

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link
          href="/dashboard/training"
          className="text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
        >
          ← Training
        </Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {session.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--foreground-muted)]">
            <Badge tone={eventStatusTone(session.status)}>
              {EVENT_STATUS_LABELS[session.status]}
            </Badge>
            {session.team_id ? (
              <Link
                href={`/dashboard/teams/${session.team_id}`}
                className="hover:underline"
              >
                {session.team_name}
              </Link>
            ) : (
              <span>Academy-wide</span>
            )}
            <span>
              · {formatDate(session.starts_at)} at{" "}
              {formatTime(session.starts_at)}
            </span>
            <span>· {formatDuration(session.starts_at, session.ends_at)}</span>
          </div>
        </div>

        {manage ? (
          <Link href={`/dashboard/training/${session.id}/edit`}>
            <Button variant="outline">Edit session</Button>
          </Link>
        ) : null}
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-3">
              <Field label="Location">{session.location ?? "—"}</Field>
              <Field label="Coach">{session.coach_name ?? "Unassigned"}</Field>
              <Field label="Ends">{formatTime(session.ends_at)}</Field>
              {session.description ? (
                <Field label="Plan">{session.description}</Field>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Attendance</CardTitle>
            <CardDescription>
              {marked.length === 0
                ? "Nothing marked yet."
                : `${marked.length} of ${register.length} marked.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {marked.length === 0 ? (
              <p className="text-sm text-[var(--foreground-muted)]">
                Mark the register below. A player left unmarked stays unmarked —
                only a deliberate mark counts towards their attendance record.
              </p>
            ) : (
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(
                  ["present", "late", "excused", "absent"] as const
                ).map((status) => (
                  <div key={status}>
                    <dt className="text-xs tracking-wide text-[var(--foreground-muted)] uppercase">
                      {ATTENDANCE_STATUS_LABELS[status]}
                    </dt>
                    <dd className="mt-0.5 text-2xl font-semibold tabular-nums">
                      {marked.filter((entry) => entry.status === status).length}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Register</CardTitle>
          <CardDescription>
            {usesRoster
              ? "Built from the team's current roster."
              : "Built from the players called up to this session."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AttendanceRegister
            eventId={session.id}
            entries={register}
            canMark={mark}
            isCancelled={session.status === "cancelled"}
          />
        </CardContent>
      </Card>

      {manage ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Call-ups</CardTitle>
              <CardDescription>
                For a guest from another team, or a session run with only part of
                the squad.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SessionCallUps
                eventId={session.id}
                entries={register}
                candidates={candidates}
                usesRoster={usesRoster}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Session status</CardTitle>
            </CardHeader>
            <CardContent>
              <SessionStatusControls
                eventId={session.id}
                status={session.status}
              />
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
