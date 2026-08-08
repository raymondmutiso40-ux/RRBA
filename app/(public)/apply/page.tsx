import Link from "next/link";
import type { Metadata } from "next";

import { academy } from "@/lib/content/site";

import { ApplicationForm } from "./application-form";

export const metadata: Metadata = {
  title: "Apply to join",
  description: `Apply for a place at ${academy.name}. Tell us about your child and we will arrange a first session.`,
};

export default function ApplyPage() {
  return (
    <>
      <header className="border-b border-[var(--border-color)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <span
              className="grid size-9 place-items-center rounded-lg bg-[var(--primary)] text-sm font-bold text-[var(--primary-foreground)]"
              aria-hidden="true"
            >
              {academy.initials}
            </span>
            <span className="text-sm">
              {academy.shortName}
              <span className="block text-xs font-normal text-[var(--foreground-muted)]">
                Basketball Academy
              </span>
            </span>
          </Link>
          <Link
            href="/"
            className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
          >
            Back to site
          </Link>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <div className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Apply to join the academy
          </h1>
          <p className="mt-3 text-lg text-[var(--foreground-muted)]">
            Tell us about your child and we will be in touch to arrange a first
            session and find the right age group. No account needed.
          </p>
        </div>

        <ApplicationForm />
      </main>

      <footer className="border-t border-[var(--border-color)]">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <p className="text-sm text-[var(--foreground-muted)]">
            © {new Date().getFullYear()} {academy.name}
          </p>
        </div>
      </footer>
    </>
  );
}
