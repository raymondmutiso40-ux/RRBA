import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { EmptyState } from "@/components/ui/empty-state";
import { requireStaff } from "@/lib/auth/session";
import { canManageFinance } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getBillablePlayers, listFeeTypes } from "@/lib/finance/queries";

import { InvoiceForm } from "../invoice-form";

export const metadata: Metadata = { title: "Raise invoice" };

type SearchParams = { player?: string };

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (!isSupabaseConfigured()) notFound();

  const user = await requireStaff();

  if (!canManageFinance(user.roles)) {
    return (
      <EmptyState
        title="Not allowed"
        description="Only administrators and finance staff can raise invoices."
        action={
          <Link href="/dashboard/invoices" className="text-sm underline">
            Back to invoices
          </Link>
        }
      />
    );
  }

  const [{ player }, players, feeTypes] = await Promise.all([
    searchParams,
    getBillablePlayers(),
    listFeeTypes(),
  ]);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/dashboard/invoices"
          className="text-sm text-[var(--foreground-muted)] hover:underline"
        >
          ← Invoices
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Raise invoice</h1>
      </div>

      <InvoiceForm
        players={players}
        feeTypes={feeTypes}
        defaultPlayerId={player}
      />
    </div>
  );
}
