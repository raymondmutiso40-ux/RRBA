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
import { canManageUsers } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { listCoaches } from "@/lib/coaches/queries";

import { CoachSearch } from "./coach-search";

export const metadata: Metadata = { title: "Coaches" };

type SearchParams = { search?: string; inactive?: string };

export default async function CoachesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (!isSupabaseConfigured()) return null;

  const user = await getSessionUser();
  if (!user) return null;

  // Kept to admins, matching the nav. profiles_staff_read would allow any
  // staff member to read this, so widening it later is a product decision
  // rather than a schema change.
  if (!canManageUsers(user.roles)) {
    return (
      <EmptyState
        title="No access to the coaching staff"
        description="The coach directory is visible to academy administrators."
      />
    );
  }

  const params = await searchParams;
  const showInactive = params.inactive === "1";
  const search = params.search?.trim() ?? "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Coaches</h1>
          <p className="text-sm text-[var(--foreground-muted)]">
            Everyone holding the coach role, and what they are responsible for.
          </p>
        </div>

        <Link href="/dashboard/users?role=coach">
          <Button variant="outline">Manage roles</Button>
        </Link>
      </div>

      <CoachSearch />

      <nav aria-label="Filter coaches" className="flex gap-2">
        <Link
          href={search ? `/dashboard/coaches?search=${encodeURIComponent(search)}` : "/dashboard/coaches"}
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
          href={
            search
              ? `/dashboard/coaches?inactive=1&search=${encodeURIComponent(search)}`
              : "/dashboard/coaches?inactive=1"
          }
          aria-current={showInactive ? "page" : undefined}
          className={
            "rounded-lg px-3 py-1.5 text-sm transition-colors " +
            (showInactive
              ? "bg-[var(--surface-muted)] font-medium"
              : "text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)]")
          }
        >
          All accounts
        </Link>
      </nav>

      <Suspense key={`${search}:${showInactive}`} fallback={<TableFallback />}>
        <CoachTable search={search} includeInactive={showInactive} />
      </Suspense>
    </div>
  );
}

async function CoachTable({
  search,
  includeInactive,
}: {
  search: string;
  includeInactive: boolean;
}) {
  const coaches = await listCoaches({ search, includeInactive });

  if (coaches.length === 0) {
    return (
      <EmptyState
        title={search ? "Nothing matches that search" : "No coaches yet"}
        description={
          search
            ? "Try part of a name or email address."
            : "Somebody becomes a coach by being granted the coach role, under Users & roles. They can then be assigned to teams."
        }
        action={
          !search ? (
            <Link href="/dashboard/users">
              <Button>Go to users &amp; roles</Button>
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      <Table>
        <caption className="sr-only">Coaching staff, {coaches.length} shown</caption>
        <TableHeader>
          <tr>
            <TableHead>Coach</TableHead>
            <TableHead>Teams</TableHead>
            <TableHead>Sessions</TableHead>
            <TableHead>Upcoming</TableHead>
            <TableHead>Account</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {coaches.map((coach) => (
            <TableRow key={coach.id}>
              <TableCell>
                <Link
                  href={`/dashboard/coaches/${coach.id}`}
                  className="font-medium hover:underline"
                >
                  {coach.full_name || coach.email}
                </Link>
                <span className="block text-xs text-[var(--foreground-muted)]">
                  {coach.email}
                </span>
              </TableCell>
              <TableCell>
                {coach.teams.length === 0 ? (
                  <span className="text-sm text-[var(--foreground-muted)]">
                    Unassigned
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {coach.teams.map((team) => (
                      <Badge
                        key={team.id}
                        tone={team.is_lead ? "brand" : "neutral"}
                      >
                        {team.name}
                        {team.is_lead ? " · lead" : ""}
                      </Badge>
                    ))}
                  </div>
                )}
              </TableCell>
              <TableCell className="tabular-nums">
                {coach.session_count}
              </TableCell>
              <TableCell className="tabular-nums">
                {coach.upcoming_count}
              </TableCell>
              <TableCell>
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
