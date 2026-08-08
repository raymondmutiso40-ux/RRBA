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
import { canManageFinance, canViewFinance } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getFinanceSummary, listInvoices } from "@/lib/finance/queries";
import {
  INVOICE_FILTERS,
  INVOICE_FILTER_LABELS,
  INVOICE_STATUS_LABELS,
  invoiceStatusTone,
  isInvoiceFilter,
  type InvoiceFilter,
} from "@/lib/finance/labels";
import { formatCurrency, formatDate } from "@/lib/utils";

import { InvoiceFilters } from "./invoice-filters";

export const metadata: Metadata = { title: "Invoices" };

type SearchParams = { filter?: string; search?: string };

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (!isSupabaseConfigured()) return null;

  const user = await getSessionUser();
  if (!user) return null;

  if (!canViewFinance(user.roles)) {
    return (
      <EmptyState
        title="No access to billing"
        description="Invoices are visible to administrators and finance staff."
      />
    );
  }

  const params = await searchParams;
  const filter: InvoiceFilter = isInvoiceFilter(params.filter)
    ? params.filter
    : "outstanding";
  const search = params.search?.trim() ?? "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-sm text-[var(--foreground-muted)]">
            What each family has been billed, and what is still owed.
          </p>
        </div>

        {canManageFinance(user.roles) ? (
          <Link href="/dashboard/invoices/new">
            <Button>Raise invoice</Button>
          </Link>
        ) : null}
      </div>

      <Suspense fallback={<SummaryFallback />}>
        <FinanceSummaryTiles />
      </Suspense>

      <nav aria-label="Filter invoices" className="flex flex-wrap gap-2">
        {INVOICE_FILTERS.map((option) => {
          const query = new URLSearchParams();
          if (option !== "outstanding") query.set("filter", option);
          if (search) query.set("search", search);
          const queryString = query.toString();
          const href = queryString
            ? `/dashboard/invoices?${queryString}`
            : "/dashboard/invoices";

          return (
            <Link
              key={option}
              href={href}
              aria-current={option === filter ? "page" : undefined}
              className={
                "rounded-lg px-3 py-1.5 text-sm transition-colors " +
                (option === filter
                  ? "bg-[var(--surface-muted)] font-medium"
                  : "text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)]")
              }
            >
              {INVOICE_FILTER_LABELS[option]}
            </Link>
          );
        })}
      </nav>

      <InvoiceFilters />

      <Suspense key={`${filter}:${search}`} fallback={<TableFallback />}>
        <InvoiceTable
          filter={filter}
          search={search}
          canCreate={canManageFinance(user.roles)}
        />
      </Suspense>
    </div>
  );
}

async function FinanceSummaryTiles() {
  const summary = await getFinanceSummary();

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Tile
        label="Outstanding"
        value={formatCurrency(summary.outstanding, summary.currency)}
        hint="Issued and part-paid invoices"
      />
      <Tile
        label="Overdue"
        value={formatCurrency(summary.overdue, summary.currency)}
        hint={
          summary.overdueCount === 1
            ? "1 invoice past its due date"
            : `${summary.overdueCount} invoices past their due date`
        }
        tone={summary.overdue > 0 ? "danger" : undefined}
      />
      <Tile
        label="Collected this month"
        value={formatCurrency(summary.collectedThisMonth, summary.currency)}
        hint="Confirmed payments only"
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

async function InvoiceTable({
  filter,
  search,
  canCreate,
}: {
  filter: InvoiceFilter;
  search: string;
  canCreate: boolean;
}) {
  const invoices = await listInvoices({ filter, search });

  if (invoices.length === 0) {
    return (
      <EmptyState
        title={search ? "Nothing matches that search" : "No invoices here"}
        description={
          search
            ? "Try an invoice number, or part of a player's name."
            : "Raising an invoice bills one player for one fee. What is owed is worked out from the payments recorded against it."
        }
        action={
          canCreate && !search ? (
            <Link href="/dashboard/invoices/new">
              <Button>Raise the first invoice</Button>
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      <Table>
        <caption className="sr-only">Invoices, {invoices.length} shown</caption>
        <TableHeader>
          <tr>
            <TableHead>Invoice</TableHead>
            <TableHead>Player</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Billed</TableHead>
            <TableHead>Paid</TableHead>
            <TableHead>Balance</TableHead>
            <TableHead>Status</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell>
                <Link
                  href={`/dashboard/invoices/${invoice.id}`}
                  className="font-medium hover:underline"
                >
                  {invoice.invoice_number}
                </Link>
                <span className="block text-xs text-[var(--foreground-muted)]">
                  {invoice.description}
                </span>
              </TableCell>
              <TableCell>
                <Link
                  href={`/dashboard/players/${invoice.player_id}`}
                  className="hover:underline"
                >
                  {invoice.player_name}
                </Link>
              </TableCell>
              <TableCell
                className={
                  invoice.is_overdue
                    ? "text-[var(--color-danger)]"
                    : "text-[var(--foreground-muted)]"
                }
              >
                {formatDate(invoice.due_on)}
              </TableCell>
              <TableCell className="tabular-nums">
                {formatCurrency(invoice.amount_due, invoice.currency)}
              </TableCell>
              <TableCell className="tabular-nums text-[var(--foreground-muted)]">
                {formatCurrency(invoice.amount_paid, invoice.currency)}
              </TableCell>
              <TableCell className="font-medium tabular-nums">
                {formatCurrency(invoice.balance, invoice.currency)}
              </TableCell>
              <TableCell>
                <Badge tone={invoiceStatusTone(invoice.status, invoice.is_overdue)}>
                  {invoice.is_overdue && invoice.status !== "void"
                    ? "Overdue"
                    : INVOICE_STATUS_LABELS[invoice.status]}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
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
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </Card>
  );
}
