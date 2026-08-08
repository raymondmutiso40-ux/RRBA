import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { PaymentStateControls } from "@/components/finance/payment-state-controls";
import { RecordPaymentForm } from "@/components/finance/record-payment-form";
import { getSessionUser } from "@/lib/auth/session";
import {
  canRecordPayments,
  canReversePayments,
  canViewFinance,
} from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getPayableInvoices, listPayments } from "@/lib/finance/queries";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATE_LABELS,
  paymentStateTone,
} from "@/lib/finance/labels";
import type { PaymentState } from "@/lib/supabase/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Payments" };

const STATE_TABS: (PaymentState | "all")[] = [
  "all",
  "pending",
  "confirmed",
  "failed",
  "reversed",
];

const STATE_TAB_LABELS: Record<PaymentState | "all", string> = {
  all: "All",
  pending: "Pending",
  confirmed: "Confirmed",
  failed: "Failed",
  reversed: "Reversed",
};

type SearchParams = { state?: string };

function isPaymentTab(value: string | undefined): value is PaymentState | "all" {
  return value !== undefined && (STATE_TABS as string[]).includes(value);
}

export default async function PaymentsPage({
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
        title="No access to payments"
        description="The payment ledger is visible to administrators and finance staff."
      />
    );
  }

  const params = await searchParams;
  const state = isPaymentTab(params.state) ? params.state : "all";
  const takePayments = canRecordPayments(user.roles);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="text-sm text-[var(--foreground-muted)]">
          Every shilling received, and which invoice it settled.
        </p>
      </div>

      {takePayments ? (
        <Card>
          <CardHeader>
            <CardTitle>Record a payment</CardTitle>
            <CardDescription>
              Choose the invoice the money settles. A receipt number is allocated
              automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Skeleton className="h-64 w-full" />}>
              <PaymentEntry />
            </Suspense>
          </CardContent>
        </Card>
      ) : null}

      <nav aria-label="Filter payments" className="flex flex-wrap gap-2">
        {STATE_TABS.map((option) => (
          <Link
            key={option}
            href={
              option === "all"
                ? "/dashboard/payments"
                : `/dashboard/payments?state=${option}`
            }
            aria-current={option === state ? "page" : undefined}
            className={
              "rounded-lg px-3 py-1.5 text-sm transition-colors " +
              (option === state
                ? "bg-[var(--surface-muted)] font-medium"
                : "text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)]")
            }
          >
            {STATE_TAB_LABELS[option]}
          </Link>
        ))}
      </nav>

      <Suspense key={state} fallback={<TableFallback />}>
        <PaymentTable
          state={state}
          canManage={takePayments}
          canReverse={canReversePayments(user.roles)}
        />
      </Suspense>
    </div>
  );
}

async function PaymentEntry() {
  const invoices = await getPayableInvoices();
  const today = new Date().toISOString().slice(0, 10);

  return <RecordPaymentForm invoices={invoices} today={today} />;
}

async function PaymentTable({
  state,
  canManage,
  canReverse,
}: {
  state: PaymentState | "all";
  canManage: boolean;
  canReverse: boolean;
}) {
  const payments = await listPayments({ state });

  if (payments.length === 0) {
    return (
      <EmptyState
        title={state === "all" ? "No payments yet" : `No ${state} payments`}
        description="Payments recorded against an invoice appear here, newest first."
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      <Table>
        <caption className="sr-only">Payments, {payments.length} shown</caption>
        <TableHeader>
          <tr>
            <TableHead>Receipt</TableHead>
            <TableHead>Player</TableHead>
            <TableHead>Invoice</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>State</TableHead>
            {canManage ? (
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            ) : null}
          </tr>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => (
            <TableRow key={payment.id}>
              <TableCell className="font-medium">
                {payment.receipt_number}
                {payment.reference ? (
                  <span className="block text-xs text-[var(--foreground-muted)]">
                    {payment.reference}
                  </span>
                ) : null}
              </TableCell>
              <TableCell>
                <Link
                  href={`/dashboard/players/${payment.player_id}`}
                  className="hover:underline"
                >
                  {payment.player_name}
                </Link>
              </TableCell>
              <TableCell>
                <Link
                  href={`/dashboard/invoices/${payment.invoice_id}`}
                  className="hover:underline"
                >
                  {payment.invoice_number}
                </Link>
              </TableCell>
              <TableCell className="text-[var(--foreground-muted)]">
                {formatDate(payment.paid_on)}
              </TableCell>
              <TableCell>{PAYMENT_METHOD_LABELS[payment.method]}</TableCell>
              <TableCell className="tabular-nums">
                {formatCurrency(payment.amount, payment.currency)}
              </TableCell>
              <TableCell>
                <Badge tone={paymentStateTone(payment.state)}>
                  {PAYMENT_STATE_LABELS[payment.state]}
                </Badge>
              </TableCell>
              {canManage ? (
                <TableCell className="text-right">
                  <PaymentStateControls
                    paymentId={payment.id}
                    state={payment.state}
                    canReverse={canReverse}
                  />
                </TableCell>
              ) : null}
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
