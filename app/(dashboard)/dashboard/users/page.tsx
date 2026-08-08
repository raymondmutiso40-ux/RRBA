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
import { ROLE_LABELS, canManageUsers } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { listUsers } from "@/lib/admin/queries";
import type { AccountStatus, AppRole } from "@/lib/supabase/types";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Users & roles" };

type SearchParams = { status?: string; role?: string; search?: string };

const STATUS_TABS: { value: AccountStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
];

function statusTone(status: AccountStatus) {
  if (status === "active") return "success" as const;
  if (status === "pending") return "warning" as const;
  if (status === "suspended") return "danger" as const;
  return "neutral" as const;
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (!isSupabaseConfigured()) return null;

  const user = await getSessionUser();
  if (!user) return null;

  if (!canManageUsers(user.roles)) {
    return (
      <EmptyState
        title="No access to user management"
        description="Only academy administrators can view and change user roles."
      />
    );
  }

  const params = await searchParams;
  const active = (params.status as AccountStatus | "all") || "all";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Users &amp; roles</h1>
        <p className="text-sm text-[var(--foreground-muted)]">
          Everyone who has signed up. New accounts start pending with no role
          and reach nothing until you grant one.
        </p>
      </div>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const isActive = active === tab.value;
          return (
            <Link
              key={tab.value}
              href={`/dashboard/users?status=${tab.value}`}
              aria-current={isActive ? "page" : undefined}
              className={
                "rounded-lg px-3 py-1.5 text-sm transition-colors " +
                (isActive
                  ? "bg-[var(--surface-muted)] font-medium text-[var(--foreground)]"
                  : "text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)]")
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <Suspense key={JSON.stringify(params)} fallback={<TableFallback />}>
        <UserTable status={active} role={params.role as AppRole | undefined} />
      </Suspense>
    </div>
  );
}

async function UserTable({
  status,
  role,
}: {
  status: AccountStatus | "all";
  role?: AppRole;
}) {
  const users = await listUsers({ status, role: role ?? "all" });

  if (users.length === 0) {
    return (
      <EmptyState
        title="No accounts match"
        description="Try a different status filter."
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      <Table>
        <caption className="sr-only">User accounts, {users.length} total</caption>
        <TableHeader>
          <tr>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Roles</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Joined</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {users.map((account) => (
            <TableRow key={account.id}>
              <TableCell>
                <Link
                  href={`/dashboard/users/${account.id}`}
                  className="font-medium hover:underline"
                >
                  {account.full_name || "—"}
                </Link>
              </TableCell>
              <TableCell className="text-[var(--foreground-muted)]">
                {account.email}
              </TableCell>
              <TableCell>
                {account.roles.length === 0 ? (
                  <span className="text-xs text-[var(--foreground-muted)]">
                    No role
                  </span>
                ) : (
                  <span className="flex flex-wrap gap-1">
                    {account.roles.map((granted) => (
                      <Badge key={granted} tone="brand">
                        {ROLE_LABELS[granted]}
                      </Badge>
                    ))}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <Badge tone={statusTone(account.status)}>
                  {account.status}
                </Badge>
              </TableCell>
              <TableCell className="text-[var(--foreground-muted)]">
                {formatDate(account.created_at)}
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
