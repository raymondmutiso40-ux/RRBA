import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NoChildren, NotLinked } from "@/components/me/not-linked";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getMyIdentity, getMyInvoices, getMyPayments } from "@/lib/me/queries";
import {
  INVOICE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATE_LABELS,
  invoiceStatusTone,
  paymentStateTone,
} from "@/lib/finance/labels";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "My fees" };

export default async function MyFeesPage() {
  if (!isSupabaseConfigured()) return null;

  const user = await getSessionUser();
  if (!user) return null;

  const identity = await getMyIdentity(user.id);

  if (identity.kind === null) return <NotLinked what="fees" />;
  if (identity.players.length === 0) return <NoChildren />;

  const [invoices, payments] = await Promise.all([
    getMyInvoices(identity.players),
    getMyPayments(identity.players),
  ]);

  const outstanding = invoices
    .filter((invoice) => invoice.status !== "void")
    .reduce((total, invoice) => total + invoice.balance, 0);

  const currency = invoices[0]?.currency ?? "KES";
  const multiplePlayers = identity.players.length > 1;
  const overdue = invoices.filter((invoice) => invoice.is_overdue);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">My fees</h1>
        <p className="text-sm text-[var(--foreground-muted)]">
          Invoices the academy has issued, and what has been received against
          them.
        </p>
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          title="Nothing billed yet"
          description="No invoices have been issued to you. Anything the academy bills will appear here, along with what has been paid."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-5">
              <p className="text-xs tracking-wide text-[var(--foreground-muted)] uppercase">
                Outstanding
              </p>
              <p
                className={
                  "mt-1 text-2xl font-semibold tabular-nums " +
                  (overdue.length > 0 ? "text-[var(--color-danger)]" : "")
                }
              >
                {formatCurrency(outstanding, currency)}
              </p>
              <p className="mt-1 text-xs text-[var(--foreground-muted)]">
                {outstanding <= 0
                  ? "Nothing owed — thank you."
                  : overdue.length > 0
                    ? `${overdue.length} invoice${overdue.length === 1 ? "" : "s"} past the due date`
                    : "Across all issued invoices"}
              </p>
            </Card>

            <Card className="p-5">
              <p className="text-xs tracking-wide text-[var(--foreground-muted)] uppercase">
                Invoices
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {invoices.length}
              </p>
              <p className="mt-1 text-xs text-[var(--foreground-muted)]">
                {payments.length} payment{payments.length === 1 ? "" : "s"}{" "}
                recorded
              </p>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
              <CardDescription>
                The balance is worked out from payments the academy has
                confirmed. If a payment you have made is missing, contact the
                office rather than paying again.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <Table>
                <caption className="sr-only">
                  Your invoices, {invoices.length} total
                </caption>
                <TableHeader>
                  <tr>
                    <TableHead>Invoice</TableHead>
                    {multiplePlayers ? <TableHead>For</TableHead> : null}
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
                        <span className="font-medium">
                          {invoice.invoice_number}
                        </span>
                        <span className="block text-xs text-[var(--foreground-muted)]">
                          {invoice.description}
                        </span>
                      </TableCell>
                      {multiplePlayers ? (
                        <TableCell>{invoice.player_name}</TableCell>
                      ) : null}
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
                        <Badge
                          tone={invoiceStatusTone(
                            invoice.status,
                            invoice.is_overdue,
                          )}
                        >
                          {invoice.is_overdue && invoice.status !== "void"
                            ? "Overdue"
                            : INVOICE_STATUS_LABELS[invoice.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {payments.length > 0 ? (
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Receipts</CardTitle>
                <CardDescription>
                  A pending payment is on record but has not been confirmed yet,
                  so it does not reduce the balance above.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <Table>
                  <caption className="sr-only">
                    Your payments, {payments.length} shown
                  </caption>
                  <TableHeader>
                    <tr>
                      <TableHead>Receipt</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>State</TableHead>
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
                        <TableCell className="text-[var(--foreground-muted)]">
                          {formatDate(payment.paid_on)}
                        </TableCell>
                        <TableCell>
                          {PAYMENT_METHOD_LABELS[payment.method]}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatCurrency(payment.amount, payment.currency)}
                        </TableCell>
                        <TableCell>
                          <Badge tone={paymentStateTone(payment.state)}>
                            {PAYMENT_STATE_LABELS[payment.state]}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
