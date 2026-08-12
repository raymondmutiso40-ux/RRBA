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
import { canAssessPlayers } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { listDevelopment } from "@/lib/development/queries";
import { SCORE_MAX, formatScore } from "@/lib/development/labels";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Development" };

type SearchParams = { filter?: string };

export default async function DevelopmentPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (!isSupabaseConfigured()) return null;

  const user = await getSessionUser();
  if (!user) return null;

  if (!canAssessPlayers(user.roles)) {
    return (
      <EmptyState
        title="No access to development"
        description="Player development is visible to administrators and coaches. A player's own record appears under My profile."
      />
    );
  }

  const params = await searchParams;
  const unassessedOnly = params.filter === "unassessed";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Development</h1>
        <p className="text-sm text-[var(--foreground-muted)]">
          Where each player stands across the twelve assessed skills, and how
          that has moved.
        </p>
      </div>

      <nav aria-label="Filter players" className="flex flex-wrap gap-2">
        {[
          { key: "all", label: "All players", href: "/dashboard/development" },
          {
            key: "unassessed",
            label: "Never assessed",
            href: "/dashboard/development?filter=unassessed",
          },
        ].map((option) => {
          const active =
            option.key === (unassessedOnly ? "unassessed" : "all");
          return (
            <Link
              key={option.key}
              href={option.href}
              aria-current={active ? "page" : undefined}
              className={
                "rounded-lg px-3 py-1.5 text-sm transition-colors " +
                (active
                  ? "bg-[var(--surface-muted)] font-medium"
                  : "text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)]")
              }
            >
              {option.label}
            </Link>
          );
        })}
      </nav>

      <Suspense key={String(unassessedOnly)} fallback={<TableFallback />}>
        <DevelopmentTable unassessedOnly={unassessedOnly} />
      </Suspense>
    </div>
  );
}

async function DevelopmentTable({
  unassessedOnly,
}: {
  unassessedOnly: boolean;
}) {
  const rows = await listDevelopment({ unassessedOnly });

  if (rows.length === 0) {
    return (
      <EmptyState
        title={
          unassessedOnly ? "Every player has been assessed" : "No players yet"
        }
        description={
          unassessedOnly
            ? "Players with no assessment on record appear here."
            : "Assessments are recorded against a player, so there is nothing to show until the academy has some."
        }
        action={
          !unassessedOnly ? (
            <Link href="/dashboard/players">
              <Button>Go to players</Button>
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
          Player development, {rows.length} shown
        </caption>
        <TableHeader>
          <tr>
            <TableHead>Player</TableHead>
            <TableHead>Team</TableHead>
            <TableHead>Latest average</TableHead>
            <TableHead>Change</TableHead>
            <TableHead>Last assessed</TableHead>
            <TableHead>Notes</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const moved =
              row.latest_average !== null && row.previous_average !== null
                ? row.latest_average - row.previous_average
                : null;

            return (
              <TableRow key={row.player_id}>
                <TableCell>
                  <Link
                    href={`/dashboard/development/${row.player_id}`}
                    className="font-medium hover:underline"
                  >
                    {row.first_name} {row.last_name}
                  </Link>
                  {row.jersey_number !== null ? (
                    <span className="block text-xs text-[var(--foreground-muted)]">
                      #{row.jersey_number}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-[var(--foreground-muted)]">
                  {row.team_name ?? "—"}
                </TableCell>
                <TableCell>
                  {row.latest_average === null ? (
                    <Badge tone="neutral">Not assessed</Badge>
                  ) : (
                    <span className="font-medium tabular-nums">
                      {formatScore(row.latest_average)}
                      <span className="text-[var(--foreground-muted)]">
                        /{SCORE_MAX}
                      </span>
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {moved === null ? (
                    <span className="text-sm text-[var(--foreground-muted)]">
                      —
                    </span>
                  ) : (
                    <span
                      className={
                        "text-sm tabular-nums " +
                        (moved > 0
                          ? "text-[var(--color-success)]"
                          : moved < 0
                            ? "text-[var(--color-danger)]"
                            : "text-[var(--foreground-muted)]")
                      }
                    >
                      {moved > 0 ? "+" : ""}
                      {moved.toFixed(1)}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-[var(--foreground-muted)]">
                  {row.last_assessed_on
                    ? formatDate(row.last_assessed_on)
                    : "Never"}
                </TableCell>
                <TableCell className="tabular-nums">
                  {row.note_count === 0 ? (
                    <span className="text-[var(--foreground-muted)]">—</span>
                  ) : (
                    row.note_count
                  )}
                </TableCell>
              </TableRow>
            );
          })}
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
