import { createClient } from "@/lib/supabase/server";
import type { ApplicationStatus, Tables } from "@/lib/supabase/types";

export type Application = Tables<"applications">;

export type ApplicationListParams = {
  status?: ApplicationStatus | "all";
  search?: string;
  page?: number;
  perPage?: number;
};

export type ApplicationListResult = {
  applications: Application[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
};

export const DEFAULT_PER_PAGE = 20;

/**
 * Review queue. RLS restricts reads to staff, so no role filter here.
 * Defaults to pending, since that is the only actionable state.
 */
export async function listApplications(
  params: ApplicationListParams = {},
): Promise<ApplicationListResult> {
  const supabase = await createClient();

  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(100, Math.max(1, params.perPage ?? DEFAULT_PER_PAGE));

  let query = supabase.from("applications").select("*", { count: "exact" });

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  const search = params.search?.trim();
  if (search) {
    const escaped = search.replace(/[%,()]/g, " ").trim();
    if (escaped) {
      query = query.or(
        [
          `player_first_name.ilike.%${escaped}%`,
          `player_last_name.ilike.%${escaped}%`,
          `guardian_name.ilike.%${escaped}%`,
          `guardian_phone.ilike.%${escaped}%`,
        ].join(","),
      );
    }
  }

  const from = (page - 1) * perPage;
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + perPage - 1);

  if (error) {
    throw new Error(`Could not load applications: ${error.message}`);
  }

  const total = count ?? 0;

  return {
    applications: data ?? [],
    total,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function getApplication(id: string): Promise<Application | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("applications")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load application: ${error.message}`);
  }

  return data;
}

/** Count of applications awaiting a decision, for the nav badge. */
export async function countPendingApplications(): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  if (error) return 0;
  return count ?? 0;
}
