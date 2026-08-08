import type { Metadata } from "next";

import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getSessionUser } from "@/lib/auth/session";
import { canManageFeeTypes, canViewFinance } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { listFeeTypes } from "@/lib/finance/queries";

import { FeeTypeManager } from "./fee-type-manager";

export const metadata: Metadata = { title: "Fees" };

export default async function FeesPage() {
  if (!isSupabaseConfigured()) return null;

  const user = await getSessionUser();
  if (!user) return null;

  if (!canViewFinance(user.roles)) {
    return (
      <EmptyState
        title="No access to fees"
        description="The fee catalogue is visible to administrators and finance staff."
      />
    );
  }

  // Retired fees are shown here — this is the page where they are restored.
  const feeTypes = await listFeeTypes({ includeInactive: true });

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Fees</h1>
        <p className="text-sm text-[var(--foreground-muted)]">
          Standard charges the academy bills. Nothing is owed until an invoice is
          raised from one, and changing an amount here never alters an invoice
          already issued.
        </p>
      </div>

      <Card>
        <CardContent className="pt-5">
          <FeeTypeManager
            feeTypes={feeTypes}
            canManage={canManageFeeTypes(user.roles)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
