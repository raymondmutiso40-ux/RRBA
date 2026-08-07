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
import { canCreatePlayers, canViewPlayers } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { listPlayers, type PlayerSort } from "@/lib/players/queries";
import {
  PLAYER_STATUS_LABELS,
  POSITION_ABBR,
  playerFullName,
  statusTone,
} from "@/lib/players/labels";
import type { BasketballPosition, PlayerStatus } from "@/lib/supabase/types";
import { calculateAge, formatDate } from "@/lib/utils";

import { PlayerFilters } from "./player-filters";

export const metadata: Metadata = {
  title: "Players",
};

type SearchParams = {
  search?: string;
  status?: string;
  position?: string;
  sort?: string;
  page?: string;
};

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (!isSupabaseConfigured()) return null;

  const user = await getSessionUser();
  if (!user) return null;

  // Finance has no RLS read path to players; showing the page would render an
  // unexplained empty table, so refuse it explicitly instead.
  if (!canViewPlayers(user.roles)) {
    return (
      <EmptyState
        title="No access to player records"
        description="Your role does not include access to player profiles."
      />
    );
  }

  const params = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Players</h1>
          <p className="text-sm text-[var(--foreground-muted)]">
            Academy roster and player profiles.
          </p>
        </div>

        {canCreatePlayers(user.roles) ? (
          <Link href="/dashboard/players/new">
            <Button>Add player</Button>
          </Link>
        ) : null}
      </div>

      <Suspense fallback={<FiltersFallback />}>
        <PlayerFilters />
      </Suspense>

      <Suspense key={JSON.stringify(params)} fallback={<TableFallback />}>
        <PlayerTable params={params} canCreate={canCreatePlayers(user.roles)} />
      </Suspense>
    </div>
  );
}

async function PlayerTable({
  params,
  canCreate,
}: {
  params: SearchParams;
  canCreate: boolean;
}) {
  const page = Number(params.page ?? "1");

  const { players, total, pageCount, perPage } = await listPlayers({
    search: params.search,
    status: (params.status as PlayerStatus | "all") || "all",
    position: (params.position as BasketballPosition | "all") || "all",
    sort: (params.sort as PlayerSort) || "name",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  });

  if (players.length === 0) {
    const isFiltered = Boolean(
      params.search ||
        (params.status && params.status !== "all") ||
        (params.position && params.position !== "all"),
    );

    return (
      <EmptyState
        title={isFiltered ? "No players match those filters" : "No players yet"}
        description={
          isFiltered
            ? "Try clearing the search or choosing a different status."
            : "Players you add will appear here with their profile, team, and status."
        }
        action={
          !isFiltered && canCreate ? (
            <Link href="/dashboard/players/new">
              <Button>Add the first player</Button>
            </Link>
          ) : isFiltered ? (
            <Link href="/dashboard/players">
              <Button variant="outline">Clear filters</Button>
            </Link>
          ) : undefined
        }
      />
    );
  }

  const currentPage = Number.isFinite(page) && page > 0 ? page : 1;
  const rangeStart = (currentPage - 1) * perPage + 1;
  const rangeEnd = Math.min(currentPage * perPage, total);

  return (
    <div className="flex flex-col gap-3">
      <Card className="overflow-hidden">
        <Table>
          <caption className="sr-only">
            Academy players, {total} total
          </caption>
          <TableHeader>
            <tr>
              <TableHead>Name</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Jersey</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Registered</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {players.map((player) => (
              <TableRow key={player.id}>
                <TableCell>
                  <Link
                    href={`/dashboard/players/${player.id}`}
                    className="font-medium hover:underline"
                  >
                    {playerFullName(player)}
                  </Link>
                  {player.email ? (
                    <span className="block text-xs text-[var(--foreground-muted)]">
                      {player.email}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>{calculateAge(player.date_of_birth)}</TableCell>
                <TableCell>
                  {player.position ? POSITION_ABBR[player.position] : "—"}
                </TableCell>
                <TableCell>
                  {player.jersey_number ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge tone={statusTone(player.status)}>
                    {PLAYER_STATUS_LABELS[player.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-[var(--foreground-muted)]">
                  {formatDate(player.registration_date)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--foreground-muted)]">
          Showing {rangeStart}–{rangeEnd} of {total}
        </p>

        {pageCount > 1 ? (
          <nav aria-label="Pagination" className="flex items-center gap-2">
            <PageLink
              params={params}
              page={currentPage - 1}
              disabled={currentPage <= 1}
            >
              Previous
            </PageLink>
            <span className="text-sm text-[var(--foreground-muted)]">
              Page {currentPage} of {pageCount}
            </span>
            <PageLink
              params={params}
              page={currentPage + 1}
              disabled={currentPage >= pageCount}
            >
              Next
            </PageLink>
          </nav>
        ) : null}
      </div>
    </div>
  );
}

function PageLink({
  params,
  page,
  disabled,
  children,
}: {
  params: SearchParams;
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <Button variant="outline" size="sm" disabled>
        {children}
      </Button>
    );
  }

  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (params.position) query.set("position", params.position);
  if (params.sort) query.set("sort", params.sort);
  query.set("page", String(page));

  return (
    <Link href={`/dashboard/players?${query.toString()}`}>
      <Button variant="outline" size="sm">
        {children}
      </Button>
    </Link>
  );
}

function FiltersFallback() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

function TableFallback() {
  return (
    <Card className="p-4" aria-busy="true">
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </Card>
  );
}
