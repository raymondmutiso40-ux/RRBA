"use client";

import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { recordPaymentAction } from "@/lib/finance/actions";
import {
  emptyFinanceActionState,
  type FinanceActionState,
} from "@/lib/finance/action-state";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/finance/labels";
import { formatCurrency } from "@/lib/utils";

export type PayableInvoice = {
  id: string;
  invoice_number: string;
  player_name: string;
  balance: number;
  currency: string;
};

/**
 * Records money received against an invoice.
 *
 * Which invoice it settles is a required choice, not a guess: the ledger has no
 * unallocated-cash concept, so a payment always belongs to exactly one invoice.
 * The action re-checks the amount against the live balance — the figures shown
 * here are for guidance and may be a moment stale.
 */
export function RecordPaymentForm({
  invoices,
  fixedInvoiceId,
  today,
}: {
  invoices: PayableInvoice[];
  /** Set on an invoice's own page, where the target is not in question. */
  fixedInvoiceId?: string;
  /** Today in YYYY-MM-DD, resolved on the server so it matches the database. */
  today: string;
}) {
  const [state, formAction, isPending] = useActionState<
    FinanceActionState,
    FormData
  >(recordPaymentAction, emptyFinanceActionState);

  const [selectedId, setSelectedId] = useState(fixedInvoiceId ?? "");

  const selected = invoices.find((invoice) => invoice.id === selectedId);
  const err = (name: string) => state.fieldErrors?.[name];

  if (invoices.length === 0) {
    return (
      <p className="text-sm text-[var(--foreground-muted)]">
        Nothing is currently awaiting payment.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.message ? (
        <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {fixedInvoiceId ? (
          <input type="hidden" name="invoiceId" value={fixedInvoiceId} />
        ) : (
          <Select
            name="invoiceId"
            label="Invoice"
            required
            className="sm:col-span-2"
            value={selectedId}
            onChange={(event) => setSelectedId(event.currentTarget.value)}
            error={err("invoiceId")}
          >
            <option value="">Select an invoice</option>
            {invoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.invoice_number} — {invoice.player_name} (
                {formatCurrency(invoice.balance, invoice.currency)} owed)
              </option>
            ))}
          </Select>
        )}

        <Input
          name="amount"
          type="number"
          label="Amount received"
          required
          min={1}
          step="0.01"
          inputMode="decimal"
          max={selected ? selected.balance : undefined}
          defaultValue={selected ? selected.balance : ""}
          hint={
            selected
              ? `${formatCurrency(selected.balance, selected.currency)} still owed`
              : "The balance is filled in once you pick an invoice."
          }
          // Remounts when the invoice changes so the prefilled amount follows it.
          key={selectedId}
          error={err("amount")}
        />

        <Select
          name="method"
          label="Method"
          required
          defaultValue="mpesa"
          error={err("method")}
        >
          {PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>
              {PAYMENT_METHOD_LABELS[method]}
            </option>
          ))}
        </Select>

        <Input
          name="paidOn"
          type="date"
          label="Date received"
          required
          max={today}
          defaultValue={today}
          error={err("paidOn")}
        />

        <Input
          name="reference"
          label="Reference"
          maxLength={200}
          placeholder="M-Pesa code, slip number…"
          hint="What you would quote if the family queried this payment."
          error={err("reference")}
        />

        <Input
          name="payerName"
          label="Paid by"
          maxLength={160}
          hint="Optional — useful when it is not the registered guardian."
          error={err("payerName")}
        />

        <Input
          name="payerPhone"
          label="Payer phone"
          maxLength={20}
          error={err("payerPhone")}
        />

        <Textarea
          name="notes"
          label="Notes"
          rows={2}
          maxLength={1000}
          className="sm:col-span-2"
          error={err("notes")}
        />

        <input type="hidden" name="currency" value={selected?.currency ?? "KES"} />

        <label className="flex items-start gap-2.5 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="isConfirmed"
            defaultChecked
            className="mt-0.5 size-4 rounded border-[var(--border-color)]"
          />
          <span>
            Money is in hand
            <span className="block text-xs text-[var(--foreground-muted)]">
              Only confirmed payments reduce the balance. Leave this off for a
              transfer you have been told about but not yet seen — it will sit as
              pending until somebody confirms it.
            </span>
          </span>
        </label>
      </div>

      <div>
        <Button type="submit" loading={isPending}>
          Record payment
        </Button>
      </div>
    </form>
  );
}
