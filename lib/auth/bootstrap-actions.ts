"use server";

import { revalidatePath } from "next/cache";

import { getBootstrapState } from "@/lib/auth/bootstrap";
import type { BootstrapActionState } from "@/lib/auth/bootstrap";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/**
 * Grants the first super_admin role to the configured bootstrap address.
 *
 * Every precondition is re-verified here. The UI only decides whether to show
 * the button; this action decides whether the grant actually happens, since a
 * server action is a public endpoint that anyone can invoke directly.
 */
export async function claimSuperAdminAction(
  _prevState: BootstrapActionState,
  _formData: FormData,
): Promise<BootstrapActionState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { ok: false, message: "Sign in before claiming admin access." };
  }

  const state = await getBootstrapState(user.email);

  if (!state.available) {
    switch (state.reason) {
      case "not_configured":
        return {
          ok: false,
          message:
            "Admin bootstrap is switched off. Set BOOTSTRAP_ADMIN_EMAIL and redeploy.",
        };
      case "admin_exists":
        return {
          ok: false,
          message:
            "This academy already has an administrator. Ask them to grant your role.",
        };
      case "email_mismatch":
        return {
          ok: false,
          message: "This account is not the configured bootstrap address.",
        };
      case "lookup_failed":
        return {
          ok: false,
          message: "Could not verify administrator status. Try again shortly.",
        };
    }
  }

  // Service role is required and sufficient here: user_roles INSERT demands
  // is_admin(), and no admin exists yet by definition.
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return {
      ok: false,
      message:
        "SUPABASE_SERVICE_ROLE_KEY is missing on the server. Add it and redeploy.",
    };
  }

  const { error: roleError } = await admin
    .from("user_roles")
    .insert({ user_id: user.id, role: "super_admin", granted_by: user.id });

  // Unique (user_id, role) — a double submit is a success, not a failure.
  if (roleError && roleError.code !== "23505") {
    return { ok: false, message: `Could not grant the role: ${roleError.message}` };
  }

  const { error: statusError } = await admin
    .from("profiles")
    .update({ status: "active" })
    .eq("id", user.id);

  if (statusError) {
    return {
      ok: false,
      message: `Role granted, but activating the account failed: ${statusError.message}`,
    };
  }

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "bootstrap.claim_super_admin",
    entity: "user_roles",
    entity_id: user.id,
    metadata: { email: user.email, via: "first_admin_bootstrap" },
  });

  revalidatePath("/dashboard", "layout");

  return { ok: true, message: "You are now a super admin." };
}
