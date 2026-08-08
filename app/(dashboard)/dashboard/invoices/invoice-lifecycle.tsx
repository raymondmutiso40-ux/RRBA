"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { issueInvoiceAction, voidInvoiceAction } from "@/lib/finance/actions";
import {
  emptyFinanceActionState,
  type FinanceActionState,
} from "@/lib/finance/action-state";
import type { InvoiceStatus } from "@/lib/supabase/types";

/**
 * The two decisions a human makes about an invoice: send it, or cancel it.
 *
 * Everything between those — part paid, paid — is derived from the payment
 * ledger, so there is deliberately no control for it here.
 */
export function InvoiceLifecycle({
  invoiceId,
  status,
  hasConfirmedPayments,
}: {
  invoiceId: string;
  status: InvoiceStatus;
  /** Voiding is refused while money is attached; say so before they try. */
  hasConfirmedPayments: boolean;
}) {
  const [issueState, issueAction, issuing] = useActionState<
    FinanceActionState,
    FormData
  >(issueInvoiceAction, emptyFinanceActionState);

  const [voidState, voidFormAction, voiding] = useActionState<
    FinanceActionState,
    FormData
  >(voidInvoiceAction, emptyFinanceActionState);

  const feedback = issueState.message ? issueState : voidState;

  if (status === "void") {
    return (
      <p className="text-sm text-[var(--foreground-muted)]">
        This invoice has been voided. It no longer counts towards what the
        academy is owed.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {feedback.message ? (
        <Alert tone={feedback.ok ? "success" : "danger"}>
          {feedback.message}
        </Alert>
      ) : null}

      {status === "draft" ? (
        <form action={issueAction} className="flex flex-col gap-2">
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <p className="text-sm text-[var(--foreground-muted)]">
            This is still a draft. Issuing it sets today as the invoice date and
            makes it payable.
          </p>
          <div>
            <Button type="submit" loading={issuing} disabled={voiding}>
              Issue invoice
            </Button>
          </div>
        </form>
      ) : null}

      <details className="rounded-lg border border-[var(--border-color)] p-4">
        <summary className="cursor-pointer text-sm font-medium">
          Void this invoice
        </summary>

        {hasConfirmedPayments ? (
          <p className="mt-3 text-sm text-[var(--foreground-muted)]">
            Confirmed payments are attached to this invoice. Reverse them first —
            voiding it now would leave money pointing at a cancelled document.
          </p>
        ) : (
          <form action={voidFormAction} className="mt-3 flex flex-col gap-3">
            <input type="hidden" name="invoiceId" value={invoiceId} />
            <Textarea
              name="reason"
              label="Reason"
              rows={2}
              maxLength={500}
              hint="Recorded in the audit log. Optional, but worth a line."
              placeholder="e.g. Raised against the wrong player"
            />
            <div>
              <Button
                type="submit"
                variant="danger"
                loading={voiding}
                disabled={issuing}
              >
                Void invoice
              </Button>
            </div>
          </form>
        )}
      </details>
    </div>
  );
}
