"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth/session";
import { canGrantRole, canManageUsers } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import type { AccountStatus } from "@/lib/supabase/types";
import {
  accountStatusSchema,
  grantRoleSchema,
  revokeRoleSchema,
} from "@/lib/validation/schemas";

import type { AdminActionState } from "./action-state";

/**
 * Maps a database error onto the field or message a user should see.
 *
 * The guard triggers raise insufficient_privilege with a sentence written for
 * the operator, so it is passed through rather than replaced. These are the
 * lockout and escalation refusals, and the reason matters.
 */
function describeError(error: { code?: string; message: string }): string {
  if (error.code === "42501" || /insufficient_privilege/i.test(error.message)) {
    return error.message.replace(/^.*?:\s*/, "").trim() || "Not permitted.";
  }
  if (error.code === "23505" || error.code === "23514") {
    return "That change was rejected by the database.";
  }
  return error.message;
}

export async function grantRoleAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const actor = await requireStaff();

  if (!canManageUsers(actor.roles)) {
    return { ok: false, message: "Only administrators can change roles." };
  }

  const parsed = grantRoleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { ok: false, message: "Select a role to grant." };
  }

  const { userId, role } = parsed.data;

  if (!canGrantRole(actor.roles, role)) {
    return {
      ok: false,
      message: "Only a super admin can grant the super admin role.",
    };
  }

  const supabase = await createClient();

  // unique (user_id, role) makes a duplicate grant an error rather than a
  // no-op, so it is checked first to give a clearer message.
  const { data: existing } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", role)
    .maybeSingle();

  if (existing) {
    return { ok: false, message: "That user already has this role." };
  }

  const { error } = await supabase.from("user_roles").insert({
    user_id: userId,
    role,
    granted_by: actor.id,
  });

  if (error) {
    return { ok: false, message: describeError(error) };
  }

  await recordAudit({
    action: "role.granted",
    entity: "user_roles",
    entityId: userId,
    metadata: { role },
  });

  revalidatePath("/dashboard/users");
  revalidatePath(`/dashboard/users/${userId}`);

  return { ok: true, message: `Granted ${role.replace(/_/g, " ")}.` };
}

export async function revokeRoleAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const actor = await requireStaff();

  if (!canManageUsers(actor.roles)) {
    return { ok: false, message: "Only administrators can change roles." };
  }

  const parsed = revokeRoleSchema.safeParse({
    userId: formData.get("userId"),
    roleId: formData.get("roleId"),
  });

  if (!parsed.success) {
    return { ok: false, message: "Could not identify the role to revoke." };
  }

  const { userId, roleId } = parsed.data;
  const supabase = await createClient();

  const { data: grant } = await supabase
    .from("user_roles")
    .select("role")
    .eq("id", roleId)
    .maybeSingle();

  if (!grant) {
    return { ok: false, message: "That role has already been removed." };
  }

  if (!canGrantRole(actor.roles, grant.role)) {
    return {
      ok: false,
      message: "Only a super admin can revoke the super admin role.",
    };
  }

  const { error } = await supabase
    .from("user_roles")
    .delete()
    .eq("id", roleId);

  if (error) {
    return { ok: false, message: describeError(error) };
  }

  await recordAudit({
    action: "role.revoked",
    entity: "user_roles",
    entityId: userId,
    metadata: { role: grant.role },
  });

  revalidatePath("/dashboard/users");
  revalidatePath(`/dashboard/users/${userId}`);

  return { ok: true, message: `Removed ${grant.role.replace(/_/g, " ")}.` };
}

export async function setAccountStatusAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const actor = await requireStaff();

  if (!canManageUsers(actor.roles)) {
    return {
      ok: false,
      message: "Only administrators can change account status.",
    };
  }

  const parsed = accountStatusSchema.safeParse({
    userId: formData.get("userId"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { ok: false, message: "Select a valid account status." };
  }

  const { userId, status } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ status: status as AccountStatus })
    .eq("id", userId);

  if (error) {
    return { ok: false, message: describeError(error) };
  }

  await recordAudit({
    action: "account.status_changed",
    entity: "profiles",
    entityId: userId,
    metadata: { status },
  });

  revalidatePath("/dashboard/users");
  revalidatePath(`/dashboard/users/${userId}`);

  return { ok: true, message: `Account set to ${status}.` };
}
