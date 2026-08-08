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
import { isStaff } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { listApplications } from "@/lib/applications/queries";
import {
  APPLICATION_STATUS_LABELS,
  applicantFullName,
  applicationStatusTone,
} from "@/lib/applications/labels";
import type { ApplicationStatus } from "@/lib/supabase/types";
import { calculateAge, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Applications" };

type SearchParams = { status?: string; search?: string; page?: string };

const STATUS_TABS: { value: ApplicationStatus | "all"; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "declined", label: "Declined" },
  { value: "all", label: "All" },
];

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (!isSupabaseConfigured()) return null;

  const user = await getSessionUser();
  if (!user) return null;

  if (!isStaff(user.roles)) {
    return (
      <EmptyState
        title="No access to applications"
        description="Only academy staff can review enrolment applications."
      />
    );
  }

  const params = await searchParams;
  const active = (params.status as ApplicationStatus | "all") || "pending";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
        <p className="text-sm text-[var(--foreground-muted)]">
          Enrolment requests from the public site. Approving one creates the
          player and guardian records.
        </p>
      </div>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const isActive = active === tab.value;
          return (
            <Link
              key={tab.value}
              href={`/dashboard/applications?status=${tab.value}`}
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
        <ApplicationTable params={params} status={active} />
      </Suspense>
    </div>
  );
}

async function ApplicationTable({
  params,
  status,
}: {
  params: SearchParams;
  status: ApplicationStatus | "all";
}) {
  const page = Number(params.page ?? "1");

  const { applications, total } = await listApplications({
    status,
    search: params.search,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  });

  if (applications.length === 0) {
    return (
      <EmptyState
        title={
          status === "pending"
            ? "No applications waiting"
            : "Nothing to show here"
        }
        description={
          status === "pending"
            ? "New enrolment requests from the public site will appear here."
            : "Try a different status filter."
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Card className="overflow-hidden">
        <Table>
          <caption className="sr-only">
            Enrolment applications, {total} total
          </caption>
          <TableHeader>
            <tr>
              <TableHead>Player</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Guardian</TableHead>
              <TableHead>Programme</TableHead>
              <TableHead>Received</TableHead>
              <TableHead>Status</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {applications.map((application) => (
              <TableRow key={application.id}>
                <TableCell>
                  <Link
                    href={`/dashboard/applications/${application.id}`}
                    className="font-medium hover:underline"
                  >
                    {applicantFullName(application)}
                  </Link>
                </TableCell>
                <TableCell>{calculateAge(application.date_of_birth)}</TableCell>
                <TableCell>
                  {application.guardian_name}
                  <span className="block text-xs text-[var(--foreground-muted)]">
                    {application.guardian_phone}
                  </span>
                </TableCell>
                <TableCell className="text-[var(--foreground-muted)]">
                  {application.program_interest ?? "—"}
                </TableCell>
                <TableCell className="text-[var(--foreground-muted)]">
                  {formatDate(application.created_at)}
                </TableCell>
                <TableCell>
                  <Badge tone={applicationStatusTone(application.status)}>
                    {APPLICATION_STATUS_LABELS[application.status]}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <p className="text-sm text-[var(--foreground-muted)]">
        {total} application{total === 1 ? "" : "s"}
      </p>
    </div>
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
