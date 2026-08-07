import Link from "next/link";

import { ClaimAdminCard } from "@/components/dashboard/claim-admin-card";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { Alert } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BootstrapState } from "@/lib/auth/bootstrap";
import type { AccountStatus } from "@/lib/supabase/types";

const STATUS_COPY: Record<
  Exclude<AccountStatus, "active">,
  { title: string; body: string }
> = {
  pending: {
    title: "Your account is awaiting approval",
    body:
      "An academy administrator needs to activate your account and assign a " +
      "role before you can use the dashboard.",
  },
  suspended: {
    title: "Your account is suspended",
    body: "Contact an academy administrator to have access restored.",
  },
  archived: {
    title: "Your account is archived",
    body: "Contact an academy administrator if you believe this is a mistake.",
  },
};

/**
 * Shown to a signed-in account that is not active yet.
 *
 * This renders rather than redirects on purpose: the proxy sends any
 * authenticated visitor from /login to /dashboard, so redirecting back to
 * /login from here would bounce between the two forever.
 */
export function AccountPending({
  email,
  status,
  bootstrap,
}: {
  email: string;
  status: Exclude<AccountStatus, "active">;
  bootstrap: BootstrapState;
}) {
  const copy = STATUS_COPY[status];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-5 p-6">
      {bootstrap.available ? (
        <ClaimAdminCard email={email} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{copy.title}</CardTitle>
            <CardDescription>Signed in as {email}</CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-[var(--foreground-muted)]">{copy.body}</p>

            {/* The very first deploy has no admin to do the approving, so the
                owner needs to be told how to switch the bootstrap on. */}
            {status === "pending" && bootstrap.reason === "not_configured" ? (
              <Alert tone="warning">
                <span className="block font-medium">
                  No administrator exists yet
                </span>
                Set{" "}
                <code className="font-mono text-xs">BOOTSTRAP_ADMIN_EMAIL</code>{" "}
                to this address in your server environment, redeploy, then
                reload this page to claim admin access.
              </Alert>
            ) : null}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between gap-4 text-sm">
        <Link
          href="/"
          className="text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
        >
          Back to the public site
        </Link>
        <div className="w-32">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
