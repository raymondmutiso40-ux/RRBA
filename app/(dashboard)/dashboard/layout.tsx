import Link from "next/link";
import { redirect } from "next/navigation";

import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { SetupRequired } from "@/components/setup-required";
import { getSessionUser } from "@/lib/auth/session";
import { navigationForRoles } from "@/lib/auth/navigation";
import { ROLE_LABELS, primaryRole } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getInitials } from "@/lib/utils";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // On a fresh clone there are no credentials to authenticate against, so
  // show setup guidance rather than letting the client constructor throw.
  if (!isSupabaseConfigured()) return <SetupRequired />;

  const user = await getSessionUser();

  // Middleware already redirected anonymous visitors. This second check
  // covers the case it cannot see: a signed-in account whose profile is
  // pending or suspended.
  if (!user) redirect("/login");

  const sections = navigationForRoles(user.roles);
  const role = primaryRole(user.roles);

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-[var(--border-color)] bg-[var(--surface)] lg:h-dvh lg:w-64 lg:border-r lg:border-b-0">
        <div className="flex items-center gap-2.5 border-b border-[var(--border-color)] px-5 py-4">
          <span
            className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--primary)] text-sm font-bold text-[var(--primary-foreground)]"
            aria-hidden="true"
          >
            RR
          </span>
          <span className="text-sm font-semibold tracking-tight">
            Runda Ridge
            <span className="block text-xs font-normal text-[var(--foreground-muted)]">
              Basketball Academy
            </span>
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {user.roles.length > 0 ? (
            <SidebarNav sections={sections} />
          ) : (
            <p className="px-5 py-4 text-sm text-[var(--foreground-muted)]">
              Your account is awaiting role assignment.
            </p>
          )}
        </div>

        <div className="border-t border-[var(--border-color)] p-3">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <span
              className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--surface-muted)] text-xs font-medium"
              aria-hidden="true"
            >
              {getInitials(user.fullName || user.email)}
            </span>
            <span className="min-w-0 text-sm">
              <span className="block truncate font-medium">
                {user.fullName || user.email}
              </span>
              <span className="block truncate text-xs text-[var(--foreground-muted)]">
                {role ? ROLE_LABELS[role] : "No role assigned"}
              </span>
            </span>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-[var(--border-color)] bg-[var(--surface)] px-6 py-3">
          <Link
            href="/"
            className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
          >
            View public site
          </Link>
        </header>

        <main id="main" className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
