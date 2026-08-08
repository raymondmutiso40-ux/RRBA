import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSessionUser } from "@/lib/auth/session";
import { canRecordAttendance, canViewTraining } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { listSessions } from "@/lib/activity/queries";
import {
  EVENT_STATUS_LABELS,
  SESSION_FILTERS,
  SESSION_FILTER_LABELS,
  eventStatusTone,
  formatDuration,
  formatTime,
  isSessionFilter,
  type SessionFilter,
} from "@/lib/activity/labels";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Training" };

type SearchParams = { filter?: string };

export default async function TrainingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
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

  const params = await searchParams;
  const filter: SessionFilter = isSessionFilter(params.filter)
    ? params.filter
    : "upcoming";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Training</h1>
          <p className="text-sm text-[var(--foreground-muted)]">
            Sessions on the calendar, and whose register still needs marking.
          </p>
        </div>

        {canRecordAttendance(user.roles) ? (
          <Link href="/dashboard/training/new">
            <Button>Schedule session</Button>
          </Link>
        ) : null}
      </div>

      <nav aria-label="Filter sessions" className="flex flex-wrap gap-2">
        {SESSION_FILTERS.map((option) => (
          <Link
            key={option}
            href={
              option === "upcoming"
                ? "/dashboard/training"
                : `/dashboard/training?filter=${option}`
            }
            aria-current={option === filter ? "page" : undefined}
            className={
              "rounded-lg px-3 py-1.5 text-sm transition-colors " +
              (option === filter
                ? "bg-[var(--surface-muted)] font-medium"
                : "text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)]")
            }
          >
            {SESSION_FILTER_LABELS[option]}
          </Link>
        ))}
      </nav>

      <Suspense key={filter} fallback={<TableFallback />}>
        <SessionTable
          filter={filter}
          canSchedule={canRecordAttendance(user.roles)}
        />
      </Suspense>
    </div>
  );
}

async function SessionTable({
  filter,
  canSchedule,
}: {
  filter: SessionFilter;
  canSchedule: boolean;
}) {
  const sessions = await listSessions({ filter });

  if (sessions.length === 0) {
    return (
      <EmptyState
        title={
          filter === "unmarked"
            ? "Every register is marked"
            : filter === "upcoming"
              ? "Nothing scheduled"
              : "No sessions yet"
        }
        description={
          filter === "unmarked"
            ? "Sessions that have already happened without a register appear here."
            : "A session belongs to a team, and its register is built from that team's roster."
        }
        action={
          canSchedule && filter !== "unmarked" ? (
            <Link href="/dashboard/training/new">
              <Button>Schedule a session</Button>
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      <Table>
        <caption className="sr-only">
          Training sessions, {sessions.length} shown
        </caption>
        <TableHeader>
          <tr>
            <TableHead>Session</TableHead>
            <TableHead>Team</TableHead>
            <TableHead>When</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Register</TableHead>
            <TableHead>Status</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {sessions.map((session) => (
            <TableRow key={session.id}>
              <TableCell>
                <Link
                  href={`/dashboard/training/${session.id}`}
                  className="font-medium hover:underline"
                >
                  {session.title}
                </Link>
                {session.coach_name ? (
                  <span className="block text-xs text-[var(--foreground-muted)]">
                    {session.coach_name}
                  </span>
                ) : null}
              </TableCell>
              <TableCell>
                {session.team_id ? (
                  <Link
                    href={`/dashboard/teams/${session.team_id}`}
                    className="hover:underline"
                  >
                    {session.team_name}
                  </Link>
                ) : (
                  <span className="text-[var(--foreground-muted)]">
                    Academy-wide
                  </span>
                )}
              </TableCell>
              <TableCell>
                {formatDate(session.starts_at)}
                <span className="block text-xs text-[var(--foreground-muted)]">
                  {formatTime(session.starts_at)} ·{" "}
                  {formatDuration(session.starts_at, session.ends_at)}
                </span>
              </TableCell>
              <TableCell className="text-[var(--foreground-muted)]">
                {session.location ?? "—"}
              </TableCell>
              <TableCell>
                {session.marked_count === 0 ? (
                  <span className="text-sm text-[var(--foreground-muted)]">
                    Not marked
                  </span>
                ) : (
                  <span className="text-sm tabular-nums">
                    {session.marked_count}
                    {session.expected_count > 0
                      ? ` / ${session.expected_count}`
                      : ""}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <Badge tone={eventStatusTone(session.status)}>
                  {EVENT_STATUS_LABELS[session.status]}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function TableFallback() {
  return (
    <Card className="p-4" aria-busy="true">
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </Card>
  );
}
