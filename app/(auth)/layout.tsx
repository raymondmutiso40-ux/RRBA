import Link from "next/link";

import { SetupRequired } from "@/components/setup-required";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // NEXT_PUBLIC_ values are inlined at build time, so without them the auth
  // forms cannot reach Supabase at all. Show setup steps instead of a form
  // that is guaranteed to fail on submit.
  if (!isSupabaseConfigured()) return <SetupRequired />;

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Form column */}
      <main
        id="main"
        className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16"
      >
        <div className="mx-auto w-full max-w-sm">
          <Link
            href="/"
            className="mb-10 inline-flex items-center gap-2.5 font-semibold tracking-tight"
          >
            <span
              className="grid size-9 place-items-center rounded-lg bg-[var(--primary)] text-sm font-bold text-[var(--primary-foreground)]"
              aria-hidden="true"
            >
              RR
            </span>
            <span>
              Runda Ridge
              <span className="block text-xs font-normal text-[var(--foreground-muted)]">
                Basketball Academy
              </span>
            </span>
          </Link>

          {children}
        </div>
      </main>

      {/* Brand column — decorative, hidden on small screens */}
      <aside
        className="relative hidden overflow-hidden bg-[var(--color-ink-900)] lg:block"
        aria-hidden="true"
      >
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(circle at 30% 20%, var(--color-brand-700), transparent 55%)," +
              "radial-gradient(circle at 70% 80%, var(--color-brand-900), transparent 60%)",
          }}
        />
        <div className="relative flex h-full flex-col justify-end gap-3 p-16">
          <p className="text-3xl leading-tight font-semibold text-white">
            Develop players.
            <br />
            Build a program.
          </p>
          <p className="max-w-sm text-sm text-[var(--color-ink-300)]">
            Track training, attendance, development, and fees in one place.
          </p>
        </div>
      </aside>
    </div>
  );
}
