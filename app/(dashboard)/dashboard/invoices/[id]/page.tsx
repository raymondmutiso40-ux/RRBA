import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
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
  canManageFinance,
  canRecordPayments,
  canReversePayments,
  canViewFinance,
} from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getInvoice } from "@/lib/finance/queries";
import {
  INVOICE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATE_LABELS,
  invoiceStatusTone,
  paymentStateTone,
} from "@/lib/finance/labels";
import { formatCurrency, formatDate } from "@/lib/utils";

import { InvoiceLifecycle } from "../invoice-lifecycle";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  if (!isSupabaseConfigured()) return { title: "Invoice" };
  const { id } = await params;
  const invoice = await getInvoice(id);
  return { title: invoice ? invoice.invoice_number : "Invoice" };
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
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

  const { id } = await params;
  const invoice = await getInvoice(id);

  // RLS gives finance and admins every invoice, so a miss here means the
  // invoice genuinely does not exist rather than that it is hidden.
  if (!invoice) notFound();

  const manage = canManageFinance(user.roles);
  const takePayments = canRecordPayments(user.roles);
  const hasConfirmedPayments = invoice.payments.some(
    (payment) => payment.state === "confirmed",
  );
  const settled = invoice.balance <= 0;
  const payable =
    invoice.status !== "draft" && invoice.status !== "void" && !settled;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link
          href="/dashboard/invoices"
          className="text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
        >
          ← Invoices
        </Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {invoice.invoice_number}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--foreground-muted)]">
            <Badge tone={invoiceStatusTone(invoice.status, invoice.is_overdue)}>
              {INVOICE_STATUS_LABELS[invoice.status]}
            </Badge>
            {invoice.is_overdue ? <Badge tone="danger">Overdue</Badge> : null}
            <Link
              href={`/dashboard/players/${invoice.player_id}`}
              className="hover:underline"
            >
              {invoice.player_name}
            </Link>
            <span>· due {formatDate(invoice.due_on)}</span>
          </div>
        </div>

        {manage && invoice.status === "draft" ? (
          <Link href={`/dashboard/invoices/${invoice.id}/edit`}>
            <Button variant="outline">Edit draft</Button>
          </Link>
        ) : null}
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Invoice</CardTitle>
            <CardDescription>{invoice.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Field label="Billed">
                {formatCurrency(invoice.amount_due, invoice.currency)}
              </Field>
              <Field label="Received">
                {formatCurrency(invoice.amount_paid, invoice.currency)}
              </Field>
              <Field label="Invoice date">{formatDate(invoice.issued_on)}</Field>
              <Field label="Due date">{formatDate(invoice.due_on)}</Field>
              {invoice.period_start || invoice.period_end ? (
                <Field label="Covers">
                  {invoice.period_start ? formatDate(invoice.period_start) : "—"}
                  {" → "}
                  {invoice.period_end ? formatDate(invoice.period_end) : "—"}
                </Field>
              ) : null}
              {invoice.fee_type_name ? (
                <Field label="Standard fee">{invoice.fee_type_name}</Field>
              ) : null}
              {invoice.created_by_name ? (
                <Field label="Raised by">{invoice.created_by_name}</Field>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Balance</CardTitle>
            <CardDescription>
              Worked out from confirmed payments, never stored.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p
              className={
                "text-3xl font-semibold tabular-nums " +
                (invoice.is_overdue ? "text-[var(--color-danger)]" : "")
              }
            >
              {formatCurrency(invoice.balance, invoice.currency)}
            </p>
            <p className="mt-1 text-sm text-[var(--foreground-muted)]">
              {settled
                ? "Settled in full."
                : `of ${formatCurrency(invoice.amount_due, invoice.currency)} still owed`}
            </p>
          </CardContent>
        </Card>
      </div>

      {payable && takePayments ? (
        <Card>
          <CardHeader>
            <CardTitle>Record a payment</CardTitle>
            <CardDescription>
              A receipt number is allocated automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RecordPaymentForm
              fixedInvoiceId={invoice.id}
              today={today}
              invoices={[
                {
                  id: invoice.id,
                  invoice_number: invoice.invoice_number,
                  player_name: invoice.player_name,
                  balance: invoice.balance,
                  currency: invoice.currency,
                },
              ]}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Payments</CardTitle>
          <CardDescription>
            Pending payments are on record but do not reduce the balance until
            they are confirmed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoice.payments.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--border-color)] p-6 text-center text-sm text-[var(--foreground-muted)]">
              Nothing received against this invoice yet.
            </p>
          ) : (
            <Table>
              <caption className="sr-only">
                Payments against {invoice.invoice_number}
              </caption>
              <TableHeader>
                <tr>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>State</TableHead>
                  {takePayments ? (
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  ) : null}
                </tr>
              </TableHeader>
              <TableBody>
                {invoice.payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">
                      {payment.receipt_number}
                      {payment.reference ? (
                        <span className="block text-xs text-[var(--foreground-muted)]">
                          {payment.reference}
                        </span>
                      ) : null}
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
                    {takePayments ? (
                      <TableCell className="text-right">
                        <PaymentStateControls
                          paymentId={payment.id}
                          state={payment.state}
                          canReverse={canReversePayments(user.roles)}
                        />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {manage ? (
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
            <CardDescription>
              Part paid and paid look after themselves — they follow the payments
              above. Issuing and voiding are the decisions left to you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InvoiceLifecycle
              invoiceId={invoice.id}
              status={invoice.status}
              hasConfirmedPayments={hasConfirmedPayments}
            />
          </CardContent>
        </Card>
      ) : null}
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
      <dd className="mt-0.5 text-sm tabular-nums">{children}</dd>
    </div>
  );
}
