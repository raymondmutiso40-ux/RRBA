"use client";

import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { saveFeeTypeAction, toggleFeeTypeAction } from "@/lib/finance/actions";
import {
  emptyFinanceActionState,
  type FinanceActionState,
} from "@/lib/finance/action-state";
import {
  FEE_INTERVALS,
  FEE_INTERVAL_LABELS,
} from "@/lib/finance/labels";
import type { FeeType } from "@/lib/finance/queries";
import { formatCurrency } from "@/lib/utils";

/**
 * The fee catalogue.
 *
 * These are templates, not charges: nothing is owed until an invoice is raised
 * from one. Editing an amount therefore affects future invoices only — the
 * invoices already raised keep the figure they were issued with, which is why
 * amount_due is copied onto the invoice rather than read through fee_type_id.
 */
export function FeeTypeManager({
  feeTypes,
  canManage,
}: {
  feeTypes: FeeType[];
  canManage: boolean;
}) {
  const [saveState, saveAction, saving] = useActionState<
    FinanceActionState,
    FormData
  >(saveFeeTypeAction, emptyFinanceActionState);

  const [toggleState, toggleAction, toggling] = useActionState<
    FinanceActionState,
    FormData
  >(toggleFeeTypeAction, emptyFinanceActionState);

  // Which fee the form is editing, or null while adding a new one.
  const [editing, setEditing] = useState<FeeType | null>(null);

  const feedback = saveState.message ? saveState : toggleState;
  const err = (name: string) => saveState.fieldErrors?.[name];

  return (
    <div className="flex flex-col gap-6">
      {feedback.message ? (
        <Alert tone={feedback.ok ? "success" : "danger"}>
          {feedback.message}
        </Alert>
      ) : null}

      {canManage ? (
        <form
          action={saveAction}
          // Remounting on a different fee resets the defaultValues to it.
          key={editing?.id ?? "new"}
          className="flex flex-col gap-4 rounded-lg border border-[var(--border-color)] p-4"
        >
          {editing ? (
            <input type="hidden" name="feeTypeId" value={editing.id} />
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">
              {editing ? `Edit ${editing.name}` : "Add a fee"}
            </h2>
            {editing ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              name="name"
              label="Name"
              required
              maxLength={120}
              placeholder="e.g. Monthly training fee"
              defaultValue={editing?.name ?? ""}
              error={err("name")}
            />

            <Select
              name="interval"
              label="Charged"
              defaultValue={editing?.interval ?? "monthly"}
              error={err("interval")}
            >
              {FEE_INTERVALS.map((interval) => (
                <option key={interval} value={interval}>
                  {FEE_INTERVAL_LABELS[interval]}
                </option>
              ))}
            </Select>

            <Input
              name="amount"
              type="number"
              label="Amount"
              required
              min={1}
              step="0.01"
              inputMode="decimal"
              defaultValue={editing ? String(editing.amount) : ""}
              error={err("amount")}
            />

            <Input
              name="currency"
              label="Currency"
              required
              maxLength={3}
              className="uppercase"
              defaultValue={editing?.currency ?? "KES"}
              error={err("currency")}
            />

            <Textarea
              name="description"
              label="Description"
              rows={2}
              maxLength={1000}
              className="sm:col-span-2"
              hint="Internal note — the invoice carries its own description."
              defaultValue={editing?.description ?? ""}
              error={err("description")}
            />

            <label className="flex items-center gap-2.5 text-sm sm:col-span-2">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={editing?.is_active ?? true}
                className="size-4 rounded border-[var(--border-color)]"
              />
              <span>
                Available
                <span className="block text-xs text-[var(--foreground-muted)]">
                  Only available fees are offered when raising an invoice.
                </span>
              </span>
            </label>
          </div>

          <div>
            <Button type="submit" loading={saving} disabled={toggling}>
              {editing ? "Save fee" : "Add fee"}
            </Button>
          </div>
        </form>
      ) : null}

      {feeTypes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--border-color)] p-6 text-center text-sm text-[var(--foreground-muted)]">
          No fees defined yet. Invoices can still be raised with a one-off
          description and amount.
        </p>
      ) : (
        <Table>
          <caption className="sr-only">Fee catalogue, {feeTypes.length} fees</caption>
          <TableHeader>
            <tr>
              <TableHead>Fee</TableHead>
              <TableHead>Charged</TableHead>
              <TableHead>Amount</TableHead>
              {canManage ? (
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              ) : null}
            </tr>
          </TableHeader>
          <TableBody>
            {feeTypes.map((fee) => (
              <TableRow key={fee.id}>
                <TableCell>
                  <span className="font-medium">{fee.name}</span>
                  {!fee.is_active ? (
                    <Badge tone="neutral" className="ml-2">
                      Retired
                    </Badge>
                  ) : null}
                  {fee.description ? (
                    <span className="block text-xs text-[var(--foreground-muted)]">
                      {fee.description}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>{FEE_INTERVAL_LABELS[fee.interval]}</TableCell>
                <TableCell className="tabular-nums">
                  {formatCurrency(fee.amount, fee.currency)}
                </TableCell>
                {canManage ? (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing(fee)}
                      >
                        Edit
                      </Button>
                      <form action={toggleAction}>
                        <input type="hidden" name="feeTypeId" value={fee.id} />
                        <input
                          type="hidden"
                          name="isActive"
                          value={fee.is_active ? "false" : "true"}
                        />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          disabled={saving || toggling}
                        >
                          {fee.is_active ? "Retire" : "Restore"}
                        </Button>
                      </form>
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
