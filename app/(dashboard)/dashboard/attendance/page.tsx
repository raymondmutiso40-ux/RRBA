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
import { canViewTraining } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  getAttendanceByPlayer,
  getTrainingSummary,
  listSessions,
} from "@/lib/activity/queries";
import {
  attendanceRate,
  formatRate,
  formatTime,
  rateTone,
} from "@/lib/activity/labels";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Attendance" };

export default async function AttendancePage() {
  if (!isSupabaseConfigured()) return null;

  const user = await getSessionUser();
  if (!user) return null;

  if (!canViewTraining(user.roles)) {
    return (
      <EmptyState
        title="No access to attendance"
        description="Attendance records are visible to administrators and coaches."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
        <p className="text-sm text-[var(--foreground-muted)]">
          Who is turning up. Late counts as attended; an excused absence is left
          out of the rate entirely rather than counted against a player.
        </p>
      </div>

      <Suspense fallback={<SummaryFallback />}>
        <SummaryTiles />
      </Suspense>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Registers outstanding
        </h2>
        <Suspense fallback={<TableFallback />}>
          <UnmarkedSessions />
        </Suspense>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">By player</h2>
        <Suspense fallback={<TableFallback />}>
          <PlayerAttendance />
        </Suspense>
      </section>
    </div>
  );
}

async function SummaryTiles() {
  const summary = await getTrainingSummary();

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Tile
        label="Upcoming sessions"
        value={String(summary.upcomingCount)}
        hint="Scheduled and not cancelled"
      />
      <Tile
        label="Registers outstanding"
        value={String(summary.unmarkedThisMonth)}
        hint="This month, already happened, nothing marked"
        tone={summary.unmarkedThisMonth > 0 ? "danger" : undefined}
      />
      <Tile
        label="Registers marked"
        value={String(summary.markedThisMonth)}
        hint="This month"
      />
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "danger";
}) {
  return (
    <Card className="p-5">
      <p className="text-xs tracking-wide text-[var(--foreground-muted)] uppercase">
        {label}
      </p>
      <p
        className={
          "mt-1 text-2xl font-semibold tabular-nums " +
          (tone === "danger" ? "text-[var(--color-danger)]" : "")
        }
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-[var(--foreground-muted)]">{hint}</p>
    </Card>
  );
}

async function UnmarkedSessions() {
  const sessions = await listSessions({ filter: "unmarked", limit: 25 });

  if (sessions.length === 0) {
    return (
      <EmptyState
        title="Nothing outstanding"
        description="Every session that has happened has a register against it."
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      <Table>
        <caption className="sr-only">
          Sessions awaiting a register, {sessions.length} shown
        </caption>
        <TableHeader>
          <tr>
            <TableHead>Session</TableHead>
            <TableHead>Team</TableHead>
            <TableHead>When</TableHead>
            <TableHead>Expected</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {sessions.map((session) => (
            <TableRow key={session.id}>
              <TableCell className="font-medium">{session.title}</TableCell>
              <TableCell className="text-[var(--foreground-muted)]">
                {session.team_name ?? "Academy-wide"}
              </TableCell>
              <TableCell>
                {formatDate(session.starts_at)}
                <span className="block text-xs text-[var(--foreground-muted)]">
                  {formatTime(session.starts_at)}
                </span>
              </TableCell>
              <TableCell className="tabular-nums">
                {session.expected_count > 0 ? session.expected_count : "—"}
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/dashboard/training/${session.id}`}>
                  <Button variant="outline" size="sm">
                    Mark register
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

async function PlayerAttendance() {
  const players = await getAttendanceByPlayer();

  if (players.length === 0) {
    return (
      <EmptyState
        title="No attendance recorded yet"
        description="Once a register is marked, each player's record builds up here."
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      <Table>
        <caption className="sr-only">
          Attendance by player, {players.length} players
        </caption>
        <TableHeader>
          <tr>
            <TableHead>Player</TableHead>
            <TableHead>Present</TableHead>
            <TableHead>Late</TableHead>
            <TableHead>Absent</TableHead>
            <TableHead>Excused</TableHead>
            <TableHead>Rate</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {players.map((player) => {
            const rate = attendanceRate(player.counts);
            return (
              <TableRow key={player.player_id}>
                <TableCell>
                  <Link
                    href={`/dashboard/players/${player.player_id}`}
                    className="font-medium hover:underline"
                  >
                    {player.last_name}, {player.first_name}
                  </Link>
                  <span className="block text-xs text-[var(--foreground-muted)]">
                    {player.total} session{player.total === 1 ? "" : "s"} marked
                  </span>
                </TableCell>
                <TableCell className="tabular-nums">
                  {player.counts.present}
                </TableCell>
                <TableCell className="tabular-nums">
                  {player.counts.late}
                </TableCell>
                <TableCell className="tabular-nums">
                  {player.counts.absent}
                </TableCell>
                <TableCell className="tabular-nums text-[var(--foreground-muted)]">
                  {player.counts.excused}
                </TableCell>
                <TableCell>
                  <Badge tone={rateTone(rate)}>{formatRate(rate)}</Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

function SummaryFallback() {
  return (
    <div className="grid gap-4 sm:grid-cols-3" aria-busy="true">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </div>
  );
}

function TableFallback() {
  return (
    <Card className="p-4" aria-busy="true">
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </Card>
  );
}
