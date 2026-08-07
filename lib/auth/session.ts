import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/supabase/types";
import { isAdmin, isStaff } from "@/lib/auth/permissions";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  avatarPath: string | null;
  roles: AppRole[];
  authUser: User;
};

/**
 * Resolves the current user together with their profile and granted roles.
 *
 * Returns null when there is no session, when the profile row has not been
 * created yet, or when the account is not active — a suspended user holds a
 * valid token but must not reach the app.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [profileResult, rolesResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email, avatar_path, status")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  const profile = profileResult.data;
  if (!profile || profile.status !== "active") return null;

  return {
    id: user.id,
    email: profile.email,
    fullName: profile.full_name,
    avatarPath: profile.avatar_path,
    roles: (rolesResult.data ?? []).map((row) => row.role),
    authUser: user,
  };
}

/** Requires a signed-in, active user. Throws otherwise. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("Authentication required.");
  return user;
}

/** Requires a staff role. Throws otherwise. */
export async function requireStaff(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isStaff(user.roles)) throw new Error("Staff access required.");
  return user;
}

/** Requires an admin role. Throws otherwise. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isAdmin(user.roles)) throw new Error("Administrator access required.");
  return user;
}
