"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { authUpdatePasswordSchema } from "@/lib/validation/schemas";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldError(undefined);

    const formData = new FormData(event.currentTarget);
    const password = formData.get("password");
    const confirm = formData.get("confirmPassword");

    const parsed = authUpdatePasswordSchema.safeParse({ password });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }

    if (password !== confirm) {
      setFieldError("Passwords do not match");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });

    if (error) {
      setFormError(
        "That reset link is invalid or has expired. Request a new one.",
      );
      setLoading(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <Input
        name="password"
        type="password"
        label="New password"
        autoComplete="new-password"
        hint="At least 8 characters, including a letter and a number."
        required
        error={fieldError}
      />

      <Input
        name="confirmPassword"
        type="password"
        label="Confirm new password"
        autoComplete="new-password"
        required
      />

      <Button type="submit" loading={loading} className="mt-1 w-full">
        Update password
      </Button>
    </form>
  );
}
