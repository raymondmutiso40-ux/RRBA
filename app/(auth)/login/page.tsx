import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";

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
        <p>
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-[var(--primary)] hover:underline"
          >
            Create one
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
