"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { authLoginSchema } from "@/lib/validation/schemas";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const parsed = authLoginSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
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
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) {
      // Deliberately generic: distinguishing "no such user" from "wrong
      // password" tells an attacker which emails are registered.
      setFormError("Incorrect email or password.");
      setLoading(false);
      return;
    }

    // Only allow same-origin relative paths — an attacker-supplied absolute
    // URL here would turn login into an open redirect.
    const next = searchParams.get("next");
    const destination =
      next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

    router.replace(destination);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <Input
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        placeholder="coach@rrba.co.ke"
        required
        error={fieldErrors.email}
      />

      <Input
        name="password"
        type="password"
        label="Password"
        autoComplete="current-password"
        required
        error={fieldErrors.password}
      />

      <Button type="submit" loading={loading} className="mt-1 w-full">
        Sign in
      </Button>
    </form>
  );
}
