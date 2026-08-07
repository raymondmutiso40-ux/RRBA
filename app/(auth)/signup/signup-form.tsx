"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { authSignUpSchema } from "@/lib/validation/schemas";

export function SignUpForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const parsed = authSignUpSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
      fullName: formData.get("fullName"),
    });

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setLoading(true);

    const supabase = createClient();

    // No role is passed here, by design. Roles are granted by an admin — if
    // signup could set its own role, anyone could self-register as an admin.
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { full_name: parsed.data.fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setFormError(error.message);
      setLoading(false);
      return;
    }

    setSubmitted(true);
    setLoading(false);
  }

  if (submitted) {
    return (
      <Alert tone="success">
        <p className="font-medium">Check your email</p>
        <p className="mt-1">
          We sent a confirmation link. After confirming, an academy administrator
          will assign your role before you can access the dashboard.
        </p>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <Input
        name="fullName"
        label="Full name"
        autoComplete="name"
        placeholder="Jane Wanjiku"
        required
        error={fieldErrors.fullName}
      />

      <Input
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        placeholder="you@example.com"
        required
        error={fieldErrors.email}
      />

      <Input
        name="password"
        type="password"
        label="Password"
        autoComplete="new-password"
        hint="At least 8 characters, including a letter and a number."
        required
        error={fieldErrors.password}
      />

      <Button type="submit" loading={loading} className="mt-1 w-full">
        Create account
      </Button>

      <p className="text-xs text-[var(--foreground-muted)]">
        New accounts have no access until an administrator assigns a role.
      </p>
    </form>
  );
}
