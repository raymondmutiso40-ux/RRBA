"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createInvoiceAction, updateInvoiceAction } from "@/lib/finance/actions";
import {
  emptyFinanceActionState,
  type FinanceActionState,
} from "@/lib/finance/action-state";
import { FEE_INTERVAL_LABELS } from "@/lib/finance/labels";
import type { FeeType, Invoice } from "@/lib/finance/queries";

type BillablePlayer = {
  id: string;
  first_name: string;
  last_name: string;
};

/**
 * Raise or edit an invoice.
 *
 * One component drives both actions so the field set cannot drift. Picking a
 * fee prefills the description and amount but does not lock them — a family
 * may be charged a pro-rated or discounted version of a standard fee, and the
 * fee_type_id still records which fee it was based on.
 */
export function InvoiceForm({
  invoice,
  players,
  feeTypes,
  defaultPlayerId,
}: {
  invoice?: Invoice;
  players: BillablePlayer[];
  feeTypes: FeeType[];
  defaultPlayerId?: string;
}) {
  const isEditing = Boolean(invoice);

  const [state, formAction, isPending] = useActionState<
    FinanceActionState,
    FormData
  >(isEditing ? updateInvoiceAction : createInvoiceAction, emptyFinanceActionState);

  // Controlled only so choosing a fee can prefill them; the user stays free to
  // type over the result.
  const [description, setDescription] = useState(invoice?.description ?? "");
  const [amount, setAmount] = useState(
    invoice ? String(invoice.amount_due) : "",
  );
  const [currency, setCurrency] = useState(invoice?.currency ?? "KES");

  const err = (name: string) => state.fieldErrors?.[name];

  function applyFeeType(feeTypeId: string) {
    const fee = feeTypes.find((candidate) => candidate.id === feeTypeId);
    if (!fee) return;
    setDescription(fee.name);
    setAmount(String(fee.amount));
    setCurrency(fee.currency);
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {invoice ? (
        <input type="hidden" name="invoiceId" value={invoice.id} />
      ) : null}

      {state.message && !state.ok ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Who and what for</CardTitle>
          <CardDescription>
            An invoice bills one player for one charge. Bill a family for two
            things by raising two invoices, so each can be paid off separately.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Select
            name="playerId"
            label="Player"
            required
            defaultValue={invoice?.player_id ?? defaultPlayerId ?? ""}
            error={err("playerId")}
          >
            <option value="">Select a player</option>
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.last_name}, {player.first_name}
              </option>
            ))}
          </Select>

          <Select
            name="feeTypeId"
            label="Based on fee"
            hint="Optional. Prefills the description and amount."
            defaultValue={invoice?.fee_type_id ?? ""}
            onChange={(event) => applyFeeType(event.currentTarget.value)}
            error={err("feeTypeId")}
          >
            <option value="">No standard fee</option>
            {feeTypes.map((fee) => (
              <option key={fee.id} value={fee.id}>
                {fee.name} — {FEE_INTERVAL_LABELS[fee.interval]}
              </option>
            ))}
          </Select>

          <Textarea
            name="description"
            label="Description"
            required
            rows={2}
            maxLength={1000}
            className="sm:col-span-2"
            placeholder="e.g. Monthly training fee — August 2026"
            hint="This is what the family sees on the invoice."
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
            error={err("description")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Amount and dates</CardTitle>
          <CardDescription>
            The amount is fixed once the invoice is issued. What is still owed is
            worked out from the payments recorded against it.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Input
            name="amountDue"
            type="number"
            label="Amount"
            required
            min={1}
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.currentTarget.value)}
            error={err("amountDue")}
          />

          <Input
            name="currency"
            label="Currency"
            required
            maxLength={3}
            className="uppercase"
            value={currency}
            onChange={(event) => setCurrency(event.currentTarget.value)}
            error={err("currency")}
          />

          <Input
            name="issuedOn"
            type="date"
            label="Invoice date"
            defaultValue={invoice?.issued_on ?? ""}
            hint="Defaults to today."
            error={err("issuedOn")}
          />

          <Input
            name="dueOn"
            type="date"
            label="Due date"
            required
            defaultValue={invoice?.due_on ?? ""}
            error={err("dueOn")}
          />

          <Input
            name="periodStart"
            type="date"
            label="Period from"
            hint="Optional — the months or term this charge covers."
            defaultValue={invoice?.period_start ?? ""}
            error={err("periodStart")}
          />

          <Input
            name="periodEnd"
            type="date"
            label="Period to"
            defaultValue={invoice?.period_end ?? ""}
            error={err("periodEnd")}
          />

          <label className="flex items-start gap-2.5 text-sm sm:col-span-2">
            <input
              type="checkbox"
              name="issueNow"
              // Unchecked when editing: the only invoice that can be edited is
              // a draft, and saving one should not quietly issue it.
              defaultChecked={!isEditing}
              className="mt-0.5 size-4 rounded border-[var(--border-color)]"
            />
            <span>
              {isEditing ? "Issue on save" : "Issue immediately"}
              <span className="block text-xs text-[var(--foreground-muted)]">
                An issued invoice is payable and counts towards what the academy
                is owed. Leave this off to keep it a draft — a draft can still be
                edited, and payments cannot be recorded against it.
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={isPending}>
          {isEditing ? "Save changes" : "Raise invoice"}
        </Button>
        <Link
          href={
            invoice ? `/dashboard/invoices/${invoice.id}` : "/dashboard/invoices"
          }
        >
          <Button type="button" variant="ghost">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
