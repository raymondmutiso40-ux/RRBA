"use client";

import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { setPaymentStateAction } from "@/lib/finance/actions";
import {
  emptyFinanceActionState,
  type FinanceActionState,
} from "@/lib/finance/action-state";
import type { PaymentState } from "@/lib/supabase/types";

/**
 * Lifecycle buttons for one payment.
 *
 * Only the legal next steps are offered, mirroring the transitions the action
 * enforces: a pending payment is confirmed or written off, a confirmed one can
 * be reversed by an admin, and a reversal is the end of the line. The invoice
 * status looks after itself — the database trigger recomputes it from the
 * confirmed payments whenever one of these lands.
 */
export function PaymentStateControls({
  paymentId,
  state,
  canReverse,
  showFeedback = true,
}: {
  paymentId: string;
  state: PaymentState;
  canReverse: boolean;
  /** Off when the parent already renders shared feedback for the table. */
  showFeedback?: boolean;
}) {
  const [result, formAction, isPending] = useActionState<
    FinanceActionState,
    FormData
  >(setPaymentStateAction, emptyFinanceActionState);

  // Which button was pressed, so only that one shows the spinner.
  const [submitted, setSubmitted] = useState<PaymentState | null>(null);

  const options: { next: PaymentState; label: string; variant: "primary" | "outline" | "danger" }[] =
    [];

  if (state === "pending") {
    options.push({ next: "confirmed", label: "Confirm", variant: "primary" });
    options.push({ next: "failed", label: "Mark failed", variant: "outline" });
  } else if (state === "failed") {
    options.push({ next: "confirmed", label: "Confirm", variant: "outline" });
  } else if (state === "confirmed" && canReverse) {
    options.push({ next: "reversed", label: "Reverse", variant: "danger" });
  }

  if (options.length === 0) {
    return (
      <span className="text-xs text-[var(--foreground-muted)]">
        {state === "reversed" ? "Reversed" : "—"}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {options.map((option) => (
          <form key={option.next} action={formAction}>
            <input type="hidden" name="paymentId" value={paymentId} />
            <input type="hidden" name="state" value={option.next} />
            <Button
              type="submit"
              size="sm"
              variant={option.variant}
              disabled={isPending}
              loading={isPending && submitted === option.next}
              onClick={() => setSubmitted(option.next)}
            >
              {option.label}
            </Button>
          </form>
        ))}
      </div>

      {showFeedback && result.message ? (
        <Alert tone={result.ok ? "success" : "danger"} className="text-xs">
          {result.message}
        </Alert>
      ) : null}
    </div>
  );
}
