"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth/session";
import {
  canManageFeeTypes,
  canManageFinance,
  canRecordPayments,
  canReversePayments,
} from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import {
  feeTypeSchema,
  feeTypeToggleSchema,
  invoiceActionSchema,
  invoiceSchema,
  invoiceVoidSchema,
  paymentRecordSchema,
  paymentStateSchema,
} from "@/lib/validation/schemas";
import type { FinanceActionState } from "@/lib/finance/action-state";
import type { PaymentState, TablesUpdate } from "@/lib/supabase/types";

/**
 * Finance mutations.
 *
 * Two invariants hold across this file:
 *
 *  - Nothing here writes a balance. invoices.amount_due is set once when the
 *    invoice is raised and never touched again; what is owed is always read
 *    back from the invoice_balances view.
 *  - Nothing here writes invoices.status for a payment-driven state. The
 *    trigger from migration 009 derives paid/partially_paid from the confirmed
 *    payments, so the only statuses this file sets are the human decisions:
 *    draft, issued, and void.
 */

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value === "" ? null : value;
}

/** Money fields arrive as strings; an unparseable one becomes NaN so the
 *  schema rejects it rather than silently inserting 0. */
function money(formData: FormData, key: string): number {
  const value = text(formData, key);
  return value === "" ? Number.NaN : Number(value);
}

function collectFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

/**
 * Rounding slack for money comparisons.
 *
 * Amounts are numeric(12,2) in Postgres but plain floats by the time they get
 * here, so an exact >= on a balance can reject a payment that settles an
 * invoice to the cent.
 */
const CENT = 0.005;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

function readInvoiceForm(formData: FormData) {
  return {
    playerId: text(formData, "playerId"),
    feeTypeId: nullableText(formData, "feeTypeId"),
    description: text(formData, "description"),
    amountDue: money(formData, "amountDue"),
    currency: text(formData, "currency") || "KES",
    periodStart: nullableText(formData, "periodStart"),
    periodEnd: nullableText(formData, "periodEnd"),
    issuedOn: text(formData, "issuedOn") || today(),
    dueOn: text(formData, "dueOn"),
  };
}

export async function createInvoiceAction(
  _prev: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const user = await requireStaff();

  if (!canManageFinance(user.roles)) {
    return { ok: false, message: "Only finance staff can raise invoices." };
  }

  const parsed = invoiceSchema.safeParse(readInvoiceForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  const v = parsed.data;
  // Issuing on creation is the common case — a draft is for an invoice whose
  // amount is still being worked out.
  const issueNow = formData.get("issueNow") !== null;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoices")
    // invoice_number is left to next_invoice_number(), so two people raising
    // an invoice at the same moment cannot collide on it.
    .insert({
      player_id: v.playerId,
      fee_type_id: v.feeTypeId ?? null,
      description: v.description,
      amount_due: v.amountDue,
      currency: v.currency,
      period_start: v.periodStart ?? null,
      period_end: v.periodEnd ?? null,
      issued_on: v.issuedOn ?? today(),
      due_on: v.dueOn,
      status: issueNow ? "issued" : "draft",
      created_by: user.id,
    })
    .select("id, invoice_number")
    .single();

  if (error || !data) {
    return {
      ok: false,
      message: error?.message ?? "Could not raise the invoice.",
    };
  }

  await recordAudit({
    action: issueNow ? "invoice.issue" : "invoice.create",
    entity: "invoices",
    entityId: data.id,
    metadata: {
      invoice_number: data.invoice_number,
      player_id: v.playerId,
      amount_due: v.amountDue,
    },
  });

  revalidatePath("/dashboard/invoices");
  redirect(`/dashboard/invoices/${data.id}`);
}

/**
 * Edits an invoice.
 *
 * Only a draft can be edited. Once an invoice has been issued the family has
 * seen those figures, and changing the amount underneath recorded payments
 * would make the ledger unexplainable — void it and raise a new one instead.
 */
export async function updateInvoiceAction(
  _prev: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const user = await requireStaff();

  if (!canManageFinance(user.roles)) {
    return { ok: false, message: "Only finance staff can edit invoices." };
  }

  const invoiceId = text(formData, "invoiceId");
  if (!invoiceId) return { ok: false, message: "Missing invoice reference." };

  const parsed = invoiceSchema.safeParse(readInvoiceForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  const v = parsed.data;
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!existing) {
    return { ok: false, message: "That invoice no longer exists." };
  }

  if (existing.status !== "draft") {
    return {
      ok: false,
      message:
        "Only a draft can be edited. Void this invoice and raise a new one instead.",
    };
  }

  const issueNow = formData.get("issueNow") !== null;

  const values: TablesUpdate<"invoices"> = {
    player_id: v.playerId,
    fee_type_id: v.feeTypeId ?? null,
    description: v.description,
    amount_due: v.amountDue,
    currency: v.currency,
    period_start: v.periodStart ?? null,
    period_end: v.periodEnd ?? null,
    issued_on: v.issuedOn ?? today(),
    due_on: v.dueOn,
  };

  if (issueNow) values.status = "issued";

  const { data, error } = await supabase
    .from("invoices")
    .update(values)
    .eq("id", invoiceId)
    // Re-checked in the statement itself, so a concurrent issue cannot slip
    // between the read above and this write.
    .eq("status", "draft")
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!data) {
    return {
      ok: false,
      message: "That invoice was issued while you were editing it.",
    };
  }

  await recordAudit({
    action: "invoice.update",
    entity: "invoices",
    entityId: invoiceId,
    metadata: { amount_due: v.amountDue, issued: issueNow },
  });

  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${invoiceId}`);
  redirect(`/dashboard/invoices/${invoiceId}`);
}

/** Moves a draft to issued — the point at which it becomes payable. */
export async function issueInvoiceAction(
  _prev: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const user = await requireStaff();

  if (!canManageFinance(user.roles)) {
    return { ok: false, message: "Only finance staff can issue invoices." };
  }

  const parsed = invoiceActionSchema.safeParse({
    invoiceId: text(formData, "invoiceId"),
  });
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoices")
    .update({ status: "issued", issued_on: today() })
    .eq("id", parsed.data.invoiceId)
    .eq("status", "draft")
    .select("id, invoice_number")
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!data) {
    return { ok: false, message: "Only a draft invoice can be issued." };
  }

  await recordAudit({
    action: "invoice.issue",
    entity: "invoices",
    entityId: data.id,
    metadata: { invoice_number: data.invoice_number },
  });

  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${data.id}`);
  return { ok: true, message: `${data.invoice_number} issued.` };
}

/**
 * Cancels an invoice.
 *
 * Refused while confirmed payments are attached: money has been received
 * against it, and voiding would leave that money pointing at a cancelled
 * document. Reverse the payments first, which is a deliberate, audited step.
 */
export async function voidInvoiceAction(
  _prev: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const user = await requireStaff();

  if (!canManageFinance(user.roles)) {
    return { ok: false, message: "Only finance staff can void invoices." };
  }

  const parsed = invoiceVoidSchema.safeParse({
    invoiceId: text(formData, "invoiceId"),
    reason: text(formData, "reason"),
  });
  if (!parsed.success) {
    return { ok: false, message: "Give a reason of 500 characters or fewer." };
  }

  const supabase = await createClient();

  const { data: confirmed } = await supabase
    .from("payments")
    .select("id")
    .eq("invoice_id", parsed.data.invoiceId)
    .eq("state", "confirmed")
    .limit(1);

  if (confirmed && confirmed.length > 0) {
    return {
      ok: false,
      message:
        "This invoice has confirmed payments. Reverse them before voiding it.",
    };
  }

  const { data, error } = await supabase
    .from("invoices")
    .update({ status: "void" })
    .eq("id", parsed.data.invoiceId)
    .neq("status", "void")
    .select("id, invoice_number")
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "That invoice is already void." };

  await recordAudit({
    action: "invoice.void",
    entity: "invoices",
    entityId: data.id,
    metadata: {
      invoice_number: data.invoice_number,
      reason: parsed.data.reason || null,
    },
  });

  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${data.id}`);
  return { ok: true, message: `${data.invoice_number} voided.` };
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

/**
 * Records a payment against an invoice.
 *
 * The invoice must be issued: a draft has not been sent to anybody, and the
 * status trigger deliberately ignores payment activity on drafts, so money
 * recorded against one would never show up in the balance.
 *
 * The amount may not exceed what is still owed. The schema has no concept of a
 * credit note, so an overpayment would sit in the ledger as money the academy
 * cannot account for — better to refuse it and let finance split the payment
 * or raise a second invoice.
 */
export async function recordPaymentAction(
  _prev: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const user = await requireStaff();

  if (!canRecordPayments(user.roles)) {
    return { ok: false, message: "Only finance staff can record payments." };
  }

  const parsed = paymentRecordSchema.safeParse({
    invoiceId: text(formData, "invoiceId"),
    amount: money(formData, "amount"),
    currency: text(formData, "currency") || "KES",
    method: text(formData, "method"),
    paidOn: text(formData, "paidOn") || today(),
    reference: text(formData, "reference"),
    payerName: text(formData, "payerName"),
    payerPhone: text(formData, "payerPhone"),
    notes: text(formData, "notes"),
    isConfirmed: formData.get("isConfirmed") !== null,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  const v = parsed.data;
  const supabase = await createClient();

  const [invoiceResult, balanceResult] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, player_id, status, currency")
      .eq("id", v.invoiceId)
      .maybeSingle(),
    supabase
      .from("invoice_balances")
      .select("balance")
      .eq("invoice_id", v.invoiceId)
      .maybeSingle(),
  ]);

  const invoice = invoiceResult.data;
  if (!invoice) {
    return { ok: false, message: "That invoice no longer exists." };
  }

  if (invoice.status === "draft") {
    return {
      ok: false,
      message: "Issue this invoice before recording a payment against it.",
    };
  }

  if (invoice.status === "void") {
    return { ok: false, message: "That invoice has been voided." };
  }

  if (v.currency !== invoice.currency) {
    return {
      ok: false,
      message: `This invoice is billed in ${invoice.currency}.`,
      fieldErrors: { currency: `Must be ${invoice.currency}` },
    };
  }

  const outstanding = Number(balanceResult.data?.balance ?? 0);

  if (outstanding <= 0) {
    return { ok: false, message: "That invoice is already settled in full." };
  }

  if (v.amount > outstanding + CENT) {
    return {
      ok: false,
      message: `That is more than the ${outstanding.toFixed(2)} ${invoice.currency} still owed.`,
      fieldErrors: { amount: `At most ${outstanding.toFixed(2)}` },
    };
  }

  // Cash over the counter is money in hand; a promised transfer is not, and
  // stays pending until somebody sees it land.
  const state: PaymentState = v.isConfirmed ? "confirmed" : "pending";

  const { data, error } = await supabase
    .from("payments")
    // receipt_number comes from next_receipt_number(); the invoice decides the
    // player, so a payment cannot be filed against the wrong family.
    .insert({
      invoice_id: invoice.id,
      player_id: invoice.player_id,
      amount: v.amount,
      currency: invoice.currency,
      method: v.method,
      state,
      paid_on: v.paidOn,
      reference: v.reference || null,
      payer_name: v.payerName || null,
      payer_phone: v.payerPhone || null,
      notes: v.notes || null,
      recorded_by: user.id,
    })
    .select("id, receipt_number")
    .single();

  if (error || !data) {
    return {
      ok: false,
      message: error?.message ?? "Could not record the payment.",
    };
  }

  await recordAudit({
    action: "payment.record",
    entity: "payments",
    entityId: data.id,
    metadata: {
      receipt_number: data.receipt_number,
      invoice_number: invoice.invoice_number,
      amount: v.amount,
      method: v.method,
      state,
    },
  });

  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${invoice.id}`);
  revalidatePath("/dashboard/payments");

  return {
    ok: true,
    message:
      state === "confirmed"
        ? `Receipt ${data.receipt_number} recorded.`
        : `Receipt ${data.receipt_number} recorded as pending.`,
  };
}

/**
 * Legal moves through the payment lifecycle.
 *
 * A payment can be settled or written off from pending, and a settled one can
 * be reversed. Nothing returns to pending, and a reversal is final — correcting
 * a reversal means recording the payment again, which leaves both events in the
 * ledger rather than making one disappear.
 */
const ALLOWED_TRANSITIONS: Record<PaymentState, PaymentState[]> = {
  pending: ["confirmed", "failed"],
  confirmed: ["reversed"],
  failed: ["confirmed"],
  reversed: [],
};

const STATE_VERB: Record<PaymentState, string> = {
  pending: "returned to pending",
  confirmed: "confirmed",
  failed: "marked as failed",
  reversed: "reversed",
};

/**
 * Moves a payment through its lifecycle.
 *
 * The invoice status is not touched here — the payments trigger recomputes it
 * from the confirmed rows, so confirming or reversing money automatically drags
 * the invoice between issued, partially_paid, and paid.
 */
export async function setPaymentStateAction(
  _prev: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const user = await requireStaff();

  if (!canRecordPayments(user.roles)) {
    return { ok: false, message: "Only finance staff can update payments." };
  }

  const parsed = paymentStateSchema.safeParse({
    paymentId: text(formData, "paymentId"),
    state: text(formData, "state"),
  });

  if (!parsed.success) return { ok: false, message: "Invalid request." };

  if (parsed.data.state === "reversed" && !canReversePayments(user.roles)) {
    return {
      ok: false,
      message: "Only an administrator can reverse a confirmed payment.",
    };
  }

  const supabase = await createClient();

  const { data: payment } = await supabase
    .from("payments")
    .select("id, receipt_number, state, invoice_id")
    .eq("id", parsed.data.paymentId)
    .maybeSingle();

  if (!payment) return { ok: false, message: "That payment no longer exists." };

  if (payment.state === parsed.data.state) {
    return {
      ok: false,
      message: `That payment is already ${STATE_VERB[parsed.data.state]}.`,
    };
  }

  if (!ALLOWED_TRANSITIONS[payment.state].includes(parsed.data.state)) {
    return {
      ok: false,
      message: `A ${payment.state} payment cannot be ${STATE_VERB[parsed.data.state]}.`,
    };
  }

  const { data, error } = await supabase
    .from("payments")
    .update({ state: parsed.data.state })
    .eq("id", payment.id)
    // Guards against two people acting on the same receipt at once.
    .eq("state", payment.state)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!data) {
    return { ok: false, message: "That payment changed while you were viewing it." };
  }

  await recordAudit({
    action: `payment.${parsed.data.state}`,
    entity: "payments",
    entityId: payment.id,
    metadata: {
      receipt_number: payment.receipt_number,
      from: payment.state,
      to: parsed.data.state,
    },
  });

  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${payment.invoice_id}`);

  return {
    ok: true,
    message: `${payment.receipt_number} ${STATE_VERB[parsed.data.state]}.`,
  };
}

// ---------------------------------------------------------------------------
// Fee types
// ---------------------------------------------------------------------------

function readFeeTypeForm(formData: FormData) {
  return {
    name: text(formData, "name"),
    description: text(formData, "description"),
    amount: money(formData, "amount"),
    currency: text(formData, "currency") || "KES",
    interval: text(formData, "interval") || "monthly",
    isActive: formData.get("isActive") !== null,
  };
}

/** Postgres unique_violation — fee_types.name is unique. */
const UNIQUE_VIOLATION = "23505";

export async function saveFeeTypeAction(
  _prev: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const user = await requireStaff();

  if (!canManageFeeTypes(user.roles)) {
    return { ok: false, message: "Only finance staff can manage fees." };
  }

  const parsed = feeTypeSchema.safeParse(readFeeTypeForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  const v = parsed.data;
  const feeTypeId = text(formData, "feeTypeId");
  const supabase = await createClient();

  const values = {
    name: v.name,
    description: v.description || null,
    amount: v.amount,
    currency: v.currency,
    interval: v.interval,
    is_active: v.isActive ?? true,
  };

  const { data, error } = feeTypeId
    ? await supabase
        .from("fee_types")
        .update(values)
        .eq("id", feeTypeId)
        .select("id")
        .maybeSingle()
    : await supabase.from("fee_types").insert(values).select("id").maybeSingle();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return {
        ok: false,
        message: "A fee with that name already exists.",
        fieldErrors: { name: "Already in use" },
      };
    }
    return { ok: false, message: error.message };
  }

  if (!data) {
    return { ok: false, message: "You do not have permission to change fees." };
  }

  await recordAudit({
    action: feeTypeId ? "fee_type.update" : "fee_type.create",
    entity: "fee_types",
    entityId: data.id,
    metadata: { name: v.name, amount: v.amount, interval: v.interval },
  });

  revalidatePath("/dashboard/fees");
  return {
    ok: true,
    message: feeTypeId ? `${v.name} updated.` : `${v.name} added.`,
  };
}

/**
 * Retires or restores a fee.
 *
 * Deactivating rather than deleting: invoices reference fee_type_id, and
 * dropping the row would blank the reason a historical invoice was raised.
 */
export async function toggleFeeTypeAction(
  _prev: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const user = await requireStaff();

  if (!canManageFeeTypes(user.roles)) {
    return { ok: false, message: "Only finance staff can manage fees." };
  }

  const parsed = feeTypeToggleSchema.safeParse({
    feeTypeId: text(formData, "feeTypeId"),
    isActive: text(formData, "isActive") === "true",
  });

  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("fee_types")
    .update({ is_active: parsed.data.isActive })
    .eq("id", parsed.data.feeTypeId)
    .select("id, name")
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "That fee no longer exists." };

  await recordAudit({
    action: parsed.data.isActive ? "fee_type.activate" : "fee_type.deactivate",
    entity: "fee_types",
    entityId: data.id,
    metadata: { name: data.name },
  });

  revalidatePath("/dashboard/fees");
  return {
    ok: true,
    message: parsed.data.isActive
      ? `${data.name} is available again.`
      : `${data.name} retired.`,
  };
}
