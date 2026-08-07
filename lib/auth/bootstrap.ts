import { createClient } from "@/lib/supabase/server";

/**
 * First-admin bootstrap.
 *
 * Granting super_admin cannot go through the normal path: inserting into
 * user_roles requires is_admin(), so the very first administrator has no one
 * able to create them. This module closes that gap without opening a backdoor.
 *
 * Three conditions must all hold, and each is re-checked server-side inside
 * the action itself — never trusted from the client:
 *
 *   1. BOOTSTRAP_ADMIN_EMAIL is set. Unset means the bootstrap is switched
 *      off entirely. A deployment that grants admin to whoever arrives first
 *      is a race against strangers on a public URL, so there is no
 *      "first signup wins" fallback.
 *   2. No active super_admin exists yet. The moment one does, this
 *      permanently stops working.
 *   3. The caller's authenticated email matches the configured address.
 *      Compared against auth.users, not profiles.email.
 */

export type BootstrapBlockedReason =
  | "not_configured"
  | "admin_exists"
  | "email_mismatch"
  | "lookup_failed";

export type BootstrapState =
  | { available: true; configuredEmail: string }
  | { available: false; reason: BootstrapBlockedReason };

/** The configured bootstrap address, normalised, or null when switched off. */
export function getConfiguredBootstrapEmail(): string | null {
  const raw = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  return raw ? raw : null;
}

export async function hasAnyAdmin(): Promise<boolean | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_any_admin");

  if (error) return null;
  return data === true;
}

/**
 * Whether `email` may claim the first super_admin role right now.
 *
 * Pass the address from the authenticated session (auth.users), not from the
 * profiles row.
 */
export async function getBootstrapState(
  email: string | null,
): Promise<BootstrapState> {
  const configuredEmail = getConfiguredBootstrapEmail();
  if (!configuredEmail) return { available: false, reason: "not_configured" };

  const adminExists = await hasAnyAdmin();
  if (adminExists === null) return { available: false, reason: "lookup_failed" };
  if (adminExists) return { available: false, reason: "admin_exists" };

  if (!email || email.trim().toLowerCase() !== configuredEmail) {
    return { available: false, reason: "email_mismatch" };
  }

  return { available: true, configuredEmail };
}
