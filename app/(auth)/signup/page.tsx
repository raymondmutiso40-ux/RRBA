import Link from "next/link";
import type { Metadata } from "next";

import { SignUpForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Create account",
};

export default function SignUpPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
        <p className="text-sm text-[var(--foreground-muted)]">
          Register to request access to the RRBA platform.
        </p>
      </div>

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
