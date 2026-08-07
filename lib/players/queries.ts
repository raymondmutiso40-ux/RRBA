import { createClient } from "@/lib/supabase/server";
import type {
  BasketballPosition,
  PlayerStatus,
  Tables,
} from "@/lib/supabase/types";

export type Player = Tables<"players">;
export type PlayerMedical = Tables<"player_medical">;
export type Guardian = Tables<"guardians">;

export type PlayerSort = "name" | "recent" | "status" | "age";

export type PlayerListParams = {
  search?: string;
  status?: PlayerStatus | "all";
  position?: BasketballPosition | "all";
  sort?: PlayerSort;
  page?: number;
  perPage?: number;
};

export type PlayerListResult = {
  players: Player[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
};

export const DEFAULT_PER_PAGE = 20;

/**
 * Roster list. RLS narrows the rows: admins see everyone, coaches see only
 * players on teams they coach, so no role filter is applied here.
 */
export async function listPlayers(
  params: PlayerListParams = {},
): Promise<PlayerListResult> {
  const supabase = await createClient();

  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(100, Math.max(1, params.perPage ?? DEFAULT_PER_PAGE));

  let query = supabase.from("players").select("*", { count: "exact" });

  const search = params.search?.trim();
  if (search) {
    const escaped = search.replace(/[%,()]/g, " ").trim();
    if (escaped) {
      query = query.or(
        [
          `first_name.ilike.%${escaped}%`,
          `last_name.ilike.%${escaped}%`,
          `email.ilike.%${escaped}%`,
          `phone.ilike.%${escaped}%`,
        ].join(","),
      );
    }
  }

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  if (params.position && params.position !== "all") {
    query = query.eq("position", params.position);
  }

  switch (params.sort) {
    case "recent":
      query = query.order("created_at", { ascending: false });
      break;
    case "status":
      query = query
        .order("status", { ascending: true })
        .order("last_name", { ascending: true });
      break;
    case "age":
      query = query.order("date_of_birth", { ascending: true });
      break;
    default:
      query = query
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true });
  }

  const from = (page - 1) * perPage;
  const { data, error, count } = await query.range(from, from + perPage - 1);

  if (error) {
    throw new Error(`Could not load players: ${error.message}`);
  }

  const total = count ?? 0;

  return {
    players: data ?? [],
    total,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
  };
}

/** Single player. Returns null when missing or hidden by RLS. */
export async function getPlayer(id: string): Promise<Player | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load player: ${error.message}`);
  }

  return data;
}

/**
 * Medical record. Call only behind canViewMedical — RLS also blocks it, but
 * gating in the page keeps finance from seeing an unexplained error.
 */
export async function getPlayerMedical(
  playerId: string,
): Promise<PlayerMedical | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("player_medical")
    .select("*")
    .eq("player_id", playerId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data;
}

export type PlayerGuardian = Guardian & {
  is_primary: boolean;
  can_collect: boolean;
};

export async function getPlayerGuardians(
  playerId: string,
): Promise<PlayerGuardian[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("player_guardians")
    .select("is_primary, can_collect, guardians (*)")
    .eq("player_id", playerId)
    .order("is_primary", { ascending: false });

  if (error) {
    return [];
  }

  type Joined = {
    is_primary: boolean;
    can_collect: boolean;
    guardians: Guardian | null;
  };

  return ((data ?? []) as unknown as Joined[])
    .filter((row): row is Joined & { guardians: Guardian } =>
      Boolean(row.guardians),
    )
    .map((row) => ({
      ...row.guardians,
      is_primary: row.is_primary,
      can_collect: row.can_collect,
    }));
}

export type PlayerTeam = {
  team_id: string;
  name: string;
  age_group: string;
  joined_at: string;
  left_at: string | null;
};

export async function getPlayerTeams(playerId: string): Promise<PlayerTeam[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("team_players")
    .select("team_id, joined_at, left_at, teams (name, age_group)")
    .eq("player_id", playerId)
    .order("joined_at", { ascending: false });

  if (error) {
    return [];
  }

  type Joined = {
    team_id: string;
    joined_at: string;
    left_at: string | null;
    teams: { name: string; age_group: string } | null;
  };

  return ((data ?? []) as unknown as Joined[]).map((row) => ({
    team_id: row.team_id,
    name: row.teams?.name ?? "Unknown team",
    age_group: row.teams?.age_group ?? "—",
    joined_at: row.joined_at,
    left_at: row.left_at,
  }));
}

/** Status counts for the roster summary tiles. */
export async function getPlayerStatusCounts(): Promise<
  Record<PlayerStatus, number>
> {
  const supabase = await createClient();

  const counts: Record<PlayerStatus, number> = {
    applicant: 0,
    active: 0,
    inactive: 0,
    graduated: 0,
    withdrawn: 0,
  };

  const { data, error } = await supabase.from("players").select("status");

  if (error || !data) {
    return counts;
  }

  for (const row of data as { status: PlayerStatus }[]) {
    counts[row.status] += 1;
  }

  return counts;
}
