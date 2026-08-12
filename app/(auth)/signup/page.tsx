import Link from "next/link";
import type { Metadata } from "next";

import { Alert } from "@/components/ui/alert";

import { SignUpForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Create account",
};

/**
 * Staff account creation.
 *
 * No longer linked from the public site. A parent enrolling a child registers
 * by applying — /apply creates their account as part of the application, which
 * is also what attaches them to the child. Signing up here would leave a parent
 * with a login attached to nothing, which is exactly the split that flow was
 * built to remove, so the page says so rather than letting them find out later.
 */
export default function SignUpPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
        <p className="text-sm text-[var(--foreground-muted)]">
          For academy staff and coaches.
        </p>
      </div>

      <Alert>
        <p className="font-medium">Enrolling a child?</p>
        <p className="mt-1">
          <Link href="/apply" className="font-medium underline hover:no-underline">
            Apply to join
          </Link>{" "}
          instead — the application creates your parent account and links you to
          your child. Registering here would not.
        </p>
      </Alert>

      <SignUpForm />

      <p className="text-sm text-[var(--foreground-muted)]">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-[var(--primary)] hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
