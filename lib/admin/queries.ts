import { createClient } from "@/lib/supabase/server";
import type { AccountStatus, AppRole, Tables } from "@/lib/supabase/types";

export type Profile = Tables<"profiles">;
export type AuditEntry = Tables<"audit_log">;

/** A user account with the roles granted to it. */
export type ManagedUser = Profile & { roles: AppRole[] };

export type UserListParams = {
  search?: string;
  status?: AccountStatus | "all";
  role?: AppRole | "all";
};

/**
 * All user accounts with their roles.
 *
 * Roles are fetched in one query and joined in memory rather than embedded,
 * because a filter on the embedded relation would drop users who have no
 * roles at all — exactly the pending accounts an admin most needs to see.
 */
export async function listUsers(
  params: UserListParams = {},
): Promise<ManagedUser[]> {
  const supabase = await createClient();

  let query = supabase.from("profiles").select("*");

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  const search = params.search?.trim();
  if (search) {
    const escaped = search.replace(/[%,()]/g, " ").trim();
    if (escaped) {
      query = query.or(
        [`full_name.ilike.%${escaped}%`, `email.ilike.%${escaped}%`].join(","),
      );
    }
  }

  const [profilesResult, rolesResult] = await Promise.all([
    query.order("created_at", { ascending: false }),
    supabase.from("user_roles").select("user_id, role"),
  ]);

  if (profilesResult.error) {
    throw new Error(`Could not load users: ${profilesResult.error.message}`);
  }

  const rolesByUser = new Map<string, AppRole[]>();
  for (const row of rolesResult.data ?? []) {
    const list = rolesByUser.get(row.user_id) ?? [];
    list.push(row.role);
    rolesByUser.set(row.user_id, list);
  }

  const users: ManagedUser[] = (profilesResult.data ?? []).map((profile) => ({
    ...profile,
    roles: rolesByUser.get(profile.id) ?? [],
  }));

  if (params.role && params.role !== "all") {
    return users.filter((user) => user.roles.includes(params.role as AppRole));
  }

  return users;
}

export async function getUser(id: string): Promise<ManagedUser | null> {
  const supabase = await createClient();

  const [profileResult, rolesResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", id),
  ]);

  if (profileResult.error) {
    throw new Error(`Could not load user: ${profileResult.error.message}`);
  }
  if (!profileResult.data) return null;

  return {
    ...profileResult.data,
    roles: (rolesResult.data ?? []).map((row) => row.role),
  };
}

/**
 * How many active super admins exist.
 *
 * The UI uses this to disable the controls that would lock the academy out;
 * the database refuses them regardless via the guard triggers.
 */
export async function countActiveSuperAdmins(): Promise<number> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("count_active_super_admins", {
    exclude_grant: undefined,
  });

  if (error || typeof data !== "number") return 0;
  return data;
}

export type AuditListParams = {
  entity?: string;
  action?: string;
  page?: number;
  perPage?: number;
};

export type AuditListResult = {
  entries: (AuditEntry & { actor_name: string | null })[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
};

export const AUDIT_PER_PAGE = 50;

/** Audit trail, newest first. Readable only by admins per RLS. */
export async function listAuditLog(
  params: AuditListParams = {},
): Promise<AuditListResult> {
  const supabase = await createClient();

  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(200, Math.max(1, params.perPage ?? AUDIT_PER_PAGE));

  let query = supabase
    .from("audit_log")
    .select("*, profiles!audit_log_actor_id_fkey (full_name)", {
      count: "exact",
    });

  if (params.entity && params.entity !== "all") {
    query = query.eq("entity", params.entity);
  }
  if (params.action && params.action !== "all") {
    query = query.eq("action", params.action);
  }

  const from = (page - 1) * perPage;
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + perPage - 1);

  if (error) {
    throw new Error(`Could not load the audit log: ${error.message}`);
  }

  type Joined = AuditEntry & { profiles: { full_name: string } | null };

  const entries = ((data ?? []) as unknown as Joined[]).map((row) => {
    const { profiles, ...entry } = row;
    return { ...entry, actor_name: profiles?.full_name ?? null };
  });

  const total = count ?? 0;

  return {
    entries,
    total,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
  };
}
