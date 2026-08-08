import type {
  FeeInterval,
  InvoiceStatus,
  PaymentMethod,
  PaymentState,
} from "@/lib/supabase/types";

export const FEE_INTERVAL_LABELS: Record<FeeInterval, string> = {
  one_time: "One-off",
  monthly: "Monthly",
  termly: "Per term",
  annual: "Annual",
};

export const FEE_INTERVALS: FeeInterval[] = [
  "monthly",
  "termly",
  "annual",
  "one_time",
];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  partially_paid: "Part paid",
  paid: "Paid",
  void: "Void",
};

export const INVOICE_STATUSES: InvoiceStatus[] = [
  "draft",
  "issued",
  "partially_paid",
  "paid",
  "void",
];

/**
 * Which slice of the ledger a list is showing.
 *
 * Two of these are not statuses at all: "outstanding" spans issued and
 * part-paid, and "overdue" depends on payments and the date, so only
 * invoice_balances can answer it. Declared here rather than in queries.ts so
 * the filter UI can import it without reaching into server-only code.
 */
export type InvoiceFilter = "all" | "outstanding" | "overdue" | InvoiceStatus;

export const INVOICE_FILTER_LABELS: Record<InvoiceFilter, string> = {
  outstanding: "Outstanding",
  overdue: "Overdue",
  all: "All",
  draft: "Drafts",
  issued: "Issued",
  partially_paid: "Part paid",
  paid: "Paid",
  void: "Void",
};

/** Order of the filter tabs, busiest view first. */
export const INVOICE_FILTERS: InvoiceFilter[] = [
  "outstanding",
  "overdue",
  "draft",
  "paid",
  "all",
];

export function isInvoiceFilter(value: string | undefined): value is InvoiceFilter {
  return value !== undefined && value in INVOICE_FILTER_LABELS;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  mpesa: "M-Pesa",
  bank_transfer: "Bank transfer",
  cheque: "Cheque",
  card: "Card",
  other: "Other",
};

export const PAYMENT_METHODS: PaymentMethod[] = [
  "mpesa",
  "cash",
  "bank_transfer",
  "cheque",
  "card",
  "other",
];

export const PAYMENT_STATE_LABELS: Record<PaymentState, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  failed: "Failed",
  reversed: "Reversed",
};

/** Badge tone per invoice state, so a list reads at a glance. */
export function invoiceStatusTone(
  status: InvoiceStatus,
  isOverdue = false,
): "success" | "warning" | "danger" | "neutral" | "brand" {
  if (status === "paid") return "success";
  if (status === "void") return "neutral";
  if (isOverdue) return "danger";
  if (status === "partially_paid") return "warning";
  if (status === "issued") return "brand";
  return "neutral";
}

export function paymentStateTone(
  state: PaymentState,
): "success" | "warning" | "danger" | "neutral" {
  if (state === "confirmed") return "success";
  if (state === "pending") return "warning";
  if (state === "failed" || state === "reversed") return "danger";
  return "neutral";
}
