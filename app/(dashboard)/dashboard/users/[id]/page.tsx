import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getSessionUser } from "@/lib/auth/session";
import { canGrantRole, canManageUsers } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { countActiveSuperAdmins, getUser } from "@/lib/admin/queries";
import { findLinkCandidates, getAccountLink } from "@/lib/identity/queries";
import { createClient } from "@/lib/supabase/server";
import { ACCOUNT_STATUSES, APP_ROLES } from "@/lib/validation/schemas";
import { formatDate, formatDateTime } from "@/lib/utils";

import { AccountLinkControls } from "../account-link-controls";
import { UserRoleControls } from "../user-role-controls";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  if (!isSupabaseConfigured()) return { title: "User" };
  const { id } = await params;
  const account = await getUser(id);
  return { title: account ? account.full_name || account.email : "User" };
}

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ link?: string }>;
}) {
  if (!isSupabaseConfigured()) return null;

  const actor = await getSessionUser();
  if (!actor) return null;

  if (!canManageUsers(actor.roles)) {
    return (
      <EmptyState
        title="No access to user management"
        description="Only academy administrators can view and change user roles."
      />
    );
  }

  const { id } = await params;
  const account = await getUser(id);
  if (!account) notFound();

  // The grant rows carry the ids needed to revoke individually.
  const supabase = await createClient();
  const { data: grants } = await supabase
    .from("user_roles")
    .select("id, role, granted_at")
    .eq("user_id", account.id)
    .order("granted_at");

  const superAdminCount = await countActiveSuperAdmins();

  const grantable = APP_ROLES.filter((role) =>
    canGrantRole(actor.roles, role),
  );

  const searchTerm = (await searchParams).link?.trim() ?? "";
  const linked = await getAccountLink(account.id);

  // Candidates are only worth fetching while there is nothing linked.
  const candidates = linked
    ? []
    : await findLinkCandidates({ email: account.email, search: searchTerm });

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link
          href="/dashboard/users"
          className="text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
        >
          ← Users &amp; roles
        </Link>
      </nav>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {account.full_name || account.email}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--foreground-muted)]">
          <Badge
            tone={
              account.status === "active"
                ? "success"
                : account.status === "pending"
                  ? "warning"
                  : "neutral"
            }
          >
            {account.status}
          </Badge>
          <span>{account.email}</span>
          <span>· joined {formatDate(account.created_at)}</span>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-3">
              <Field label="Full name">{account.full_name || "—"}</Field>
              <Field label="Email">{account.email}</Field>
              <Field label="Phone">{account.phone || "—"}</Field>
              <Field label="Last updated">
                {formatDateTime(account.updated_at)}
              </Field>
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Access</CardTitle>
            <CardDescription>
              Roles decide what this person can see and change. They are
              enforced in the database, not just the interface.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UserRoleControls
              userId={account.id}
              grants={grants ?? []}
              grantable={grantable}
              status={account.status}
              statuses={ACCOUNT_STATUSES}
              isSelf={actor.id === account.id}
              isLastSuperAdmin={
                account.roles.includes("super_admin") && superAdminCount <= 1
              }
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Linked record</CardTitle>
          <CardDescription>
            Which player or family this login belongs to. Roles decide what kind
            of thing somebody can see; this decides whose. Without it their own
            pages are empty, because the database has no way to tell that this
            account and that child are related.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AccountLinkControls
            userId={account.id}
            email={account.email}
            linked={linked}
            candidates={candidates}
            searchTerm={searchTerm}
          />
        </CardContent>
      </Card>
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
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}
