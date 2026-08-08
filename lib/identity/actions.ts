"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth/session";
import { canManageUsers } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import {
  accountLinkSchema,
  accountUnlinkSchema,
} from "@/lib/validation/schemas";
import type { IdentityActionState } from "@/lib/identity/action-state";

/**
 * Linking and unlinking an account to an academy record.
 *
 * This is the most consequential write in the admin area. Setting profile_id is
 * what turns is_player() and guards_player() true, and those two functions are
 * the whole basis of every self-service policy in the schema — a wrong link
 * does not show somebody the wrong page, it shows them another family's child.
 *
 * So: admin only, one link per account, and every link and unlink is audited.
 */

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Postgres unique_violation — profile_id is unique on both tables. */
const UNIQUE_VIOLATION = "23505";

export async function linkAccountAction(
  _prev: IdentityActionState,
  formData: FormData,
): Promise<IdentityActionState> {
  const actor = await requireStaff();

  if (!canManageUsers(actor.roles)) {
    return { ok: false, message: "Only administrators can link accounts." };
  }

  const parsed = accountLinkSchema.safeParse({
    userId: text(formData, "userId"),
    kind: text(formData, "kind"),
    recordId: text(formData, "recordId"),
  });

  if (!parsed.success) {
    return { ok: false, message: "Choose a record to link." };
  }

  const { userId, kind, recordId } = parsed.data;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return { ok: false, message: "That account no longer exists." };

  // One link per account. Allowing both would make "what does this person see"
  // a question with two answers, and unlinking is cheap.
  const [existingPlayer, existingGuardian] = await Promise.all([
    supabase.from("players").select("id").eq("profile_id", userId).maybeSingle(),
    supabase
      .from("guardians")
      .select("id")
      .eq("profile_id", userId)
      .maybeSingle(),
  ]);

  if (existingPlayer.data || existingGuardian.data) {
    return {
      ok: false,
      message:
        "This account is already linked. Unlink it first if the record is wrong.",
    };
  }

  const table = kind === "player" ? "players" : "guardians";

  // Refuse a record that somebody else already claims, rather than letting the
  // unique constraint surface as a raw database error.
  const { data: claimed } = await supabase
    .from(table)
    .select("profile_id")
    .eq("id", recordId)
    .maybeSingle();

  if (!claimed) return { ok: false, message: "That record no longer exists." };

  if (claimed.profile_id) {
    return {
      ok: false,
      message: "That record is already linked to a different account.",
    };
  }

  const { data, error } = await supabase
    .from(table)
    .update({ profile_id: userId })
    .eq("id", recordId)
    .is("profile_id", null)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return {
        ok: false,
        message: "That record was linked to another account a moment ago.",
      };
    }
    return { ok: false, message: error.message };
  }

  if (!data) {
    return {
      ok: false,
      message: "That record was linked to another account a moment ago.",
    };
  }

  await recordAudit({
    action: "account.link",
    entity: table,
    entityId: recordId,
    metadata: { user_id: userId, email: profile.email, kind },
  });

  revalidatePath(`/dashboard/users/${userId}`);
  revalidatePath("/dashboard/users");

  return {
    ok: true,
    message:
      kind === "guardian"
        ? "Account linked. They can now see their children's schedule and fees."
        : "Account linked. They can now see their own profile and schedule.",
  };
}

export async function unlinkAccountAction(
  _prev: IdentityActionState,
  formData: FormData,
): Promise<IdentityActionState> {
  const actor = await requireStaff();

  if (!canManageUsers(actor.roles)) {
    return { ok: false, message: "Only administrators can unlink accounts." };
  }

  const parsed = accountUnlinkSchema.safeParse({
    userId: text(formData, "userId"),
    kind: text(formData, "kind"),
    recordId: text(formData, "recordId"),
  });

  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const { userId, kind, recordId } = parsed.data;
  const table = kind === "player" ? "players" : "guardians";
  const supabase = await createClient();

  // Clearing the column rather than deleting anything: the academy record is
  // unaffected, only the account's claim on it goes.
  const { data, error } = await supabase
    .from(table)
    .update({ profile_id: null })
    .eq("id", recordId)
    .eq("profile_id", userId)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "That link is already gone." };

  await recordAudit({
    action: "account.unlink",
    entity: table,
    entityId: recordId,
    metadata: { user_id: userId, kind },
  });

  revalidatePath(`/dashboard/users/${userId}`);
  revalidatePath("/dashboard/users");

  return { ok: true, message: "Account unlinked." };
}
