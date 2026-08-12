import type { Metadata } from "next";

import { AuthErrorNotice } from "@/components/auth/auth-error-notice";
import { UpdatePasswordForm } from "./update-password-form";

export const metadata: Metadata = {
  title: "Choose a new password",
};

export default function UpdatePasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          Choose a new password
        </h1>
        <p className="text-sm text-[var(--foreground-muted)]">
          Enter a new password for your account.
        </p>
      </div>

      {/*
        Reachable with a failed link too: Supabase redirects to redirect_to even
        when verification fails, so this page can load with an error fragment
        and no session behind it.
      */}
      <AuthErrorNotice />

      <UpdatePasswordForm />
    </div>
  );
}
