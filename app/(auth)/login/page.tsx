import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";

import { AuthErrorNotice } from "@/components/auth/auth-error-notice";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-[var(--foreground-muted)]">
          Access your RRBA academy dashboard.
        </p>
      </div>

      {/* Where a failed email link ends up, so this is where it gets explained. */}
      <AuthErrorNotice />

      {/* LoginForm reads ?next= via useSearchParams, which is only known at
          request time — Suspense lets the rest of the page prerender. */}
      <Suspense fallback={<LoginFormFallback />}>
        <LoginForm />
      </Suspense>

      <div className="flex flex-col gap-2 text-sm text-[var(--foreground-muted)]">
        <Link
          href="/reset-password"
          className="font-medium text-[var(--primary)] hover:underline"
        >
          Forgot your password?
        </Link>
        {/*
          Points at the application rather than /signup: for a parent those are
          now the same act, and the application is the one that also enrols a
          child. Staff accounts still come from /signup directly.
        */}
        <p>
          New to the academy?{" "}
          <Link
            href="/apply"
            className="font-medium text-[var(--primary)] hover:underline"
          >
            Apply to join
          </Link>
        </p>
      </div>
    </div>
  );
}

function LoginFormFallback() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
