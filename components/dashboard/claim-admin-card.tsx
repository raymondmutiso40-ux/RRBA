"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  emptyBootstrapActionState,
  type BootstrapActionState,
} from "@/lib/auth/bootstrap-state";
import { claimSuperAdminAction } from "@/lib/auth/bootstrap-actions";

/**
 * One-time claim for the first super_admin. Rendered only when the server has
 * already confirmed this account is eligible; the action re-verifies anyway.
 */
export function ClaimAdminCard({ email }: { email: string }) {
  const [state, formAction, isPending] = useActionState<
    BootstrapActionState,
    FormData
  >(claimSuperAdminAction, emptyBootstrapActionState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Claim administrator access</CardTitle>
        <CardDescription>
          This academy has no administrator yet, and {email} is the configured
          bootstrap address.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {state.message ? (
          <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>
        ) : null}

        <p className="text-sm text-[var(--foreground-muted)]">
          Claiming makes you a super admin and activates your account. This
          works only once — afterwards every role is granted from inside the
          dashboard, and this card disappears for good.
        </p>
      </CardContent>

      <CardFooter>
        <form action={formAction}>
          <Button type="submit" disabled={isPending || state.ok}>
            {isPending ? "Claiming…" : "Claim admin access"}
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
