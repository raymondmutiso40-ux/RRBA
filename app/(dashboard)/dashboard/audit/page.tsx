import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
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
import { canViewAuditLog } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { listAuditLog } from "@/lib/admin/queries";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit log" };

type SearchParams = { entity?: string; page?: string };

/** Entities worth filtering by, in the order they matter to an operator. */
const ENTITY_FILTERS = [
  { value: "all", label: "Everything" },
  { value: "user_roles", label: "Roles" },
  { value: "profiles", label: "Accounts" },
  { value: "players", label: "Players" },
  { value: "applications", label: "Applications" },
  { value: "teams", label: "Teams" },
];

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (!isSupabaseConfigured()) return null;

  const user = await getSessionUser();
  if (!user) return null;

  if (!canViewAuditLog(user.roles)) {
    return (
      <EmptyState
        title="No access to the audit log"
        description="Only academy administrators can read the audit trail."
      />
    );
  }

  const params = await searchParams;
  const entity = params.entity ?? "all";
  const page = Number.parseInt(params.page ?? "1", 10) || 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-[var(--foreground-muted)]">
          Every privileged change, appended in order. Entries cannot be edited
          or deleted, including by administrators.
        </p>
      </div>

      <nav aria-label="Filter by area" className="flex flex-wrap gap-2">
        {ENTITY_FILTERS.map((filter) => {
          const isActive = entity === filter.value;
          return (
            <Link
              key={filter.value}
              href={`/dashboard/audit?entity=${filter.value}`}
              aria-current={isActive ? "page" : undefined}
              className={
                "rounded-lg px-3 py-1.5 text-sm transition-colors " +
                (isActive
                  ? "bg-[var(--surface-muted)] font-medium text-[var(--foreground)]"
                  : "text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)]")
              }
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      <Suspense key={`${entity}-${page}`} fallback={<TableFallback />}>
        <AuditTable entity={entity} page={page} />
      </Suspense>
    </div>
  );
}

async function AuditTable({
  entity,
  page,
}: {
  entity: string;
  page: number;
}) {
  const result = await listAuditLog({ entity, page });

  if (result.entries.length === 0) {
    return (
      <EmptyState
        title="Nothing recorded yet"
        description="Privileged changes will appear here as they happen."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden">
        <Table>
          <caption className="sr-only">
            Audit entries, {result.total} total
          </caption>
          <TableHeader>
            <tr>
              <TableHead>When</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>Detail</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {result.entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="whitespace-nowrap text-[var(--foreground-muted)]">
                  {formatDateTime(entry.created_at)}
                </TableCell>
                <TableCell>{entry.actor_name ?? "System"}</TableCell>
                <TableCell>
                  <Badge tone={entry.action.includes("delete") ? "danger" : "neutral"}>
                    {entry.action}
                  </Badge>
                </TableCell>
                <TableCell className="text-[var(--foreground-muted)]">
                  {entry.entity}
                </TableCell>
                <TableCell className="max-w-72 truncate text-[var(--foreground-muted)]">
                  {describeMetadata(entry.metadata)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {result.pageCount > 1 ? (
        <nav
          aria-label="Audit log pages"
          className="flex items-center justify-between text-sm"
        >
          <span className="text-[var(--foreground-muted)]">
            Page {result.page} of {result.pageCount}
          </span>
          <span className="flex gap-3">
            {result.page > 1 ? (
              <Link
                href={`/dashboard/audit?entity=${entity}&page=${result.page - 1}`}
                className="hover:underline"
              >
                ← Newer
              </Link>
            ) : null}
            {result.page < result.pageCount ? (
              <Link
                href={`/dashboard/audit?entity=${entity}&page=${result.page + 1}`}
                className="hover:underline"
              >
                Older →
              </Link>
            ) : null}
          </span>
        </nav>
      ) : null}
    </div>
  );
}

/** Renders the metadata jsonb as a short, readable summary. */
function describeMetadata(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") return "—";
  const entries = Object.entries(metadata as Record<string, unknown>);
  if (entries.length === 0) return "—";

  return entries
    .map(([key, value]) => `${key.replace(/_/g, " ")}: ${String(value)}`)
    .join(", ");
}

function TableFallback() {
  return (
    <Card className="p-4" aria-busy="true">
      <div className="flex flex-col gap-3">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </Card>
  );
}
