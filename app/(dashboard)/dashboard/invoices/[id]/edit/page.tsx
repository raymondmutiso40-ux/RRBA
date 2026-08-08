import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { EmptyState } from "@/components/ui/empty-state";
import { requireStaff } from "@/lib/auth/session";
import { canManageFinance } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  getBillablePlayers,
  getInvoice,
  listFeeTypes,
} from "@/lib/finance/queries";

import { InvoiceForm } from "../../invoice-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  if (!isSupabaseConfigured()) return { title: "Edit invoice" };
  const { id } = await params;
  const invoice = await getInvoice(id);
  return { title: invoice ? `Edit ${invoice.invoice_number}` : "Edit invoice" };
}

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured()) notFound();

  const user = await requireStaff();

  if (!canManageFinance(user.roles)) {
    return (
      <EmptyState
        title="Not allowed"
        description="Only administrators and finance staff can edit invoices."
        action={
          <Link href="/dashboard/invoices" className="text-sm underline">
            Back to invoices
          </Link>
        }
      />
    );
  }

  const { id } = await params;
  const invoice = await getInvoice(id);

  if (!invoice) notFound();

  // Editing an issued invoice would change figures the family has already
  // seen, and the action refuses it — so do not offer the form at all.
  if (invoice.status !== "draft") {
    return (
      <EmptyState
        title={`${invoice.invoice_number} has been issued`}
        description="An issued invoice cannot be edited. Void it and raise a replacement if the amount is wrong."
        action={
          <Link
            href={`/dashboard/invoices/${invoice.id}`}
            className="text-sm underline"
          >
            Back to the invoice
          </Link>
        }
      />
    );
  }

  const [players, feeTypes] = await Promise.all([
    getBillablePlayers(),
    listFeeTypes(),
  ]);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href={`/dashboard/invoices/${invoice.id}`}
          className="text-sm text-[var(--foreground-muted)] hover:underline"
        >
          ← {invoice.invoice_number}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Edit draft</h1>
      </div>

      <InvoiceForm invoice={invoice} players={players} feeTypes={feeTypes} />
    </div>
  );
}
