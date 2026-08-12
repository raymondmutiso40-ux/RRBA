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
import { canManageUsers } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCoach, type CoachSession } from "@/lib/coaches/queries";
import {
  EVENT_STATUS_LABELS,
  eventStatusTone,
  formatDuration,
  formatTime,
} from "@/lib/activity/labels";
import type { EventStatus } from "@/lib/supabase/types";
import { formatDate } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  if (!isSupabaseConfigured()) return { title: "Coach" };
  const { id } = await params;
  const coach = await getCoach(id);
  return { title: coach ? coach.full_name || coach.email : "Coach" };
}

export default async function CoachDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured()) return null;

  const user = await getSessionUser();
  if (!user) return null;

  if (!canManageUsers(user.roles)) {
    return (
      <EmptyState
        title="No access to the coaching staff"
        description="The coach directory is visible to academy administrators."
      />
    );
  }

  const { id } = await params;
  const coach = await getCoach(id);

  if (!coach) notFound();

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link
          href="/dashboard/coaches"
          className="text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
        >
          ← Coaches
        </Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {coach.full_name || coach.email}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--foreground-muted)]">
            <Badge
              tone={
                coach.status === "active"
                  ? "success"
                  : coach.status === "pending"
                    ? "warning"
                    : "neutral"
              }
            >
              {coach.status}
            </Badge>
            <span>{coach.email}</span>
            <span>· joined {formatDate(coach.created_at)}</span>
          </div>
        </div>

        <Link href={`/dashboard/users/${coach.id}`}>
          <Button variant="outline">Manage account</Button>
        </Link>
      </header>

      {!coach.is_coach ? (
        <Card>
          <CardContent className="pt-5 text-sm text-[var(--foreground-muted)]">
            This account no longer holds the coach role. Any team assignments
            below are left over from when it did — RLS keys off the role, so
            they currently grant nothing.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-3">
              <Field label="Full name">{coach.full_name || "—"}</Field>
              <Field label="Email">{coach.email}</Field>
              <Field label="Phone">{coach.phone || "—"}</Field>
              <Field label="Sessions taken">{coach.session_count}</Field>
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Teams</CardTitle>
            <CardDescription>
              A coach sees and manages only the players and sessions of the
              teams they are assigned to. Assignment is changed from the team
              page, where the history of who coached what is kept.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {coach.teams.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[var(--border-color)] p-6 text-center text-sm text-[var(--foreground-muted)]">
                Not assigned to any team, so they cannot currently see any
                players or mark any register.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {coach.teams.map((team) => (
                  <li
                    key={team.assignment_id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border-color)] px-4 py-3"
                  >
                    <div>
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <Link
                          href={`/dashboard/teams/${team.team_id}`}
                          className="hover:underline"
                        >
                          {team.name}
                        </Link>
                        {team.is_lead ? <Badge tone="brand">Lead</Badge> : null}
                      </p>
                      <p className="text-xs text-[var(--foreground-muted)]">
                        {team.age_group} · {team.player_count} player
                        {team.player_count === 1 ? "" : "s"} · since{" "}
                        {formatDate(team.assigned_at)}
                      </p>
                    </div>
                    <Link href={`/dashboard/teams/${team.team_id}`}>
                      <Button variant="ghost" size="sm">
                        Open team
                      </Button>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <SessionList
              sessions={coach.upcoming}
              empty="Nothing scheduled with this coach named on it."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <SessionList
              sessions={coach.recent}
              empty="No sessions have run with this coach named on them."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SessionList({
  sessions,
  empty,
}: {
  sessions: CoachSession[];
  empty: string;
}) {
  if (sessions.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[var(--border-color)] p-6 text-center text-sm text-[var(--foreground-muted)]">
        {empty}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {sessions.map((session) => (
        <li
          key={session.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border-color)] px-4 py-3"
        >
          <div className="min-w-0">
            <Link
              href={`/dashboard/training/${session.id}`}
              className="text-sm font-medium hover:underline"
            >
              {session.title}
            </Link>
            <p className="text-xs text-[var(--foreground-muted)]">
              {session.team_name ?? "Academy-wide"} ·{" "}
              {formatDuration(session.starts_at, session.ends_at)}
            </p>
          </div>

          <div className="text-right">
            <p className="text-sm">{formatDate(session.starts_at)}</p>
            <p className="text-xs text-[var(--foreground-muted)]">
              {formatTime(session.starts_at)}
            </p>
            {session.status !== "scheduled" ? (
              <Badge tone={eventStatusTone(session.status as EventStatus)}>
                {EVENT_STATUS_LABELS[session.status as EventStatus]}
              </Badge>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
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
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}
