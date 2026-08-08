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
import { canManageTeams, canViewTeams } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { listTeams } from "@/lib/teams/queries";
import { TEAM_GENDER_LABELS, teamAgeRange } from "@/lib/teams/labels";

export const metadata: Metadata = { title: "Teams" };

type SearchParams = { search?: string; inactive?: string };

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (!isSupabaseConfigured()) return null;

  const user = await getSessionUser();
  if (!user) return null;

  if (!canViewTeams(user.roles)) {
    return (
      <EmptyState
        title="No access to teams"
        description="Your role does not include access to team records."
      />
    );
  }

  const params = await searchParams;
  const showInactive = params.inactive === "1";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Teams</h1>
          <p className="text-sm text-[var(--foreground-muted)]">
            Age groups, rosters, and coaching assignments.
          </p>
        </div>

        {canManageTeams(user.roles) ? (
          <Link href="/dashboard/teams/new">
            <Button>Create team</Button>
          </Link>
        ) : null}
      </div>

      <nav aria-label="Filter teams" className="flex gap-2">
        <Link
          href="/dashboard/teams"
          aria-current={!showInactive ? "page" : undefined}
          className={
            "rounded-lg px-3 py-1.5 text-sm transition-colors " +
            (!showInactive
              ? "bg-[var(--surface-muted)] font-medium"
              : "text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)]")
          }
        >
          Active
        </Link>
        <Link
          href="/dashboard/teams?inactive=1"
          aria-current={showInactive ? "page" : undefined}
          className={
            "rounded-lg px-3 py-1.5 text-sm transition-colors " +
            (showInactive
              ? "bg-[var(--surface-muted)] font-medium"
              : "text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)]")
          }
        >
          All teams
        </Link>
      </nav>

      <Suspense key={JSON.stringify(params)} fallback={<TableFallback />}>
        <TeamTable
          includeInactive={showInactive}
          canCreate={canManageTeams(user.roles)}
        />
      </Suspense>
    </div>
  );
}

async function TeamTable({
  includeInactive,
  canCreate,
}: {
  includeInactive: boolean;
  canCreate: boolean;
}) {
  const teams = await listTeams({ includeInactive });

  if (teams.length === 0) {
    return (
      <EmptyState
        title={includeInactive ? "No teams yet" : "No active teams"}
        description="Teams group players by age and gender, and hold the training schedule and roster."
        action={
          canCreate ? (
            <Link href="/dashboard/teams/new">
              <Button>Create the first team</Button>
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      <Table>
        <caption className="sr-only">Academy teams, {teams.length} total</caption>
        <TableHeader>
          <tr>
            <TableHead>Team</TableHead>
            <TableHead>Age group</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Players</TableHead>
            <TableHead>Coaches</TableHead>
            <TableHead>Season</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {teams.map((team) => (
            <TableRow key={team.id}>
              <TableCell>
                <Link
                  href={`/dashboard/teams/${team.id}`}
                  className="font-medium hover:underline"
                >
                  {team.name}
                </Link>
                {!team.is_active ? (
                  <Badge tone="neutral" className="ml-2">
                    Inactive
                  </Badge>
                ) : null}
              </TableCell>
              <TableCell>
                {team.age_group}
                <span className="block text-xs text-[var(--foreground-muted)]">
                  {teamAgeRange(team)}
                </span>
              </TableCell>
              <TableCell>{TEAM_GENDER_LABELS[team.gender]}</TableCell>
              <TableCell>{team.player_count}</TableCell>
              <TableCell>{team.coach_count}</TableCell>
              <TableCell className="text-[var(--foreground-muted)]">
                {team.season_name ?? "—"}
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
