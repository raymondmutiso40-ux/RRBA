"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { authRequestResetSchema } from "@/lib/validation/schemas";

export function ResetPasswordForm() {
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldError(undefined);

    const formData = new FormData(event.currentTarget);
    const parsed = authRequestResetSchema.safeParse({
      email: formData.get("email"),
    });

    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Enter a valid email");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
    });

    // Always report success. Revealing whether an address is registered would
    // let anyone enumerate the academy's user accounts.
    setSubmitted(true);
    setLoading(false);
  }

  if (submitted) {
    return (
      <Alert tone="success">
        <p className="font-medium">Check your email</p>
        <p className="mt-1">
          If an account exists for that address, we&apos;ve sent a reset link.
        </p>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <Input
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        placeholder="you@example.com"
        required
        error={fieldError}
      />

      <Button type="submit" loading={loading} className="w-full">
        Send reset link
      </Button>
    </form>
  );
}
