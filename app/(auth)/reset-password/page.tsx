import Link from "next/link";
import type { Metadata } from "next";

import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Reset password",
};

export default function ResetPasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
        <p className="text-sm text-[var(--foreground-muted)]">
          We&apos;ll email you a link to choose a new password.
        </p>
      </div>

      <ResetPasswordForm />

      <p className="text-sm text-[var(--foreground-muted)]">
        Remembered it?{" "}
        <Link
          href="/login"
          className="font-medium text-[var(--primary)] hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
