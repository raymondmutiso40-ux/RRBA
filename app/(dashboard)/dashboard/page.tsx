import type { Metadata } from "next";

import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, isStaff } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * M0 dashboard.
 *
 * Deliberately shows no statistics yet. Every tile in the target design
 * (total players, outstanding fees, attendance) needs real rows behind it —
 * inventing placeholder numbers here would make an empty academy look
 * populated. Tiles arrive with the milestones that create their data.
 */
export default async function DashboardPage() {
  // The layout renders its own setup notice; pages render in parallel with
  // layouts, so this page needs the same guard to avoid throwing.
  if (!isSupabaseConfigured()) return null;

  const user = await getSessionUser();
  if (!user) return null;

  const roles = user.roles;
  const firstName = user.fullName?.split(/\s+/)[0] ?? "there";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome, {firstName}
        </h1>
        <p className="text-sm text-[var(--foreground-muted)]">
          {roles.length > 0
            ? "Foundation is in place. Academy features arrive next."
            : "Your account is set up and waiting for a role."}
        </p>
      </div>

      {roles.length === 0 ? (
        <Alert tone="warning">
          <p className="font-medium">Awaiting role assignment</p>
          <p className="mt-1">
            An academy administrator needs to grant your role before you can
            access academy data. You&apos;ll see your dashboard here once that
            is done.
          </p>
        </Alert>
      ) : null}

      {roles.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Your access</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {roles.map((role) => (
              <div key={role} className="flex flex-col gap-0.5">
                <p className="text-sm font-medium">{ROLE_LABELS[role]}</p>
                <p className="text-sm text-[var(--foreground-muted)]">
                  {ROLE_DESCRIPTIONS[role]}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>What&apos;s next</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-2 text-sm text-[var(--foreground-muted)]">
            <li>
              <span className="font-medium text-[var(--foreground)]">
                M1 — Public website.
              </span>{" "}
              Landing page, programs, teams, coaches, gallery, contact.
            </li>
            <li>
              <span className="font-medium text-[var(--foreground)]">
                M2 — Users &amp; roles.
              </span>{" "}
              Admin screens for granting the six roles.
            </li>
            <li>
              <span className="font-medium text-[var(--foreground)]">
                M3 — Players.
              </span>{" "}
              Profiles, guardians, documents, medical records.
            </li>
            {isStaff(roles) ? (
              <li>
                <span className="font-medium text-[var(--foreground)]">
                  M4–M8.
                </span>{" "}
                Teams, training, attendance, development, matches, finance.
              </li>
            ) : null}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
