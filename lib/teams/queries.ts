import { createClient } from "@/lib/supabase/server";
import type { Gender, Tables } from "@/lib/supabase/types";

export type Team = Tables<"teams">;
export type Season = Tables<"seasons">;

/** A team row plus the counts the list view needs. */
export type TeamSummary = Team & {
  player_count: number;
  coach_count: number;
  season_name: string | null;
};

export type TeamListParams = {
  search?: string;
  gender?: Gender | "all";
  includeInactive?: boolean;
};

/**
 * Teams with their current roster and coaching counts.
 *
 * Counts come from a single embedded aggregate per relation rather than a
 * query per team, so the list stays one round trip however many teams exist.
 */
export async function listTeams(
  params: TeamListParams = {},
): Promise<TeamSummary[]> {
  const supabase = await createClient();

  let query = supabase
    .from("teams")
    .select(
      "*, seasons (name), team_players (id, left_at), team_coaches (id, unassigned_at)",
    );

  if (!params.includeInactive) {
    query = query.eq("is_active", true);
  }

  if (params.gender && params.gender !== "all") {
    query = query.eq("gender", params.gender);
  }

  const search = params.search?.trim();
  if (search) {
    const escaped = search.replace(/[%,()]/g, " ").trim();
    if (escaped) {
      query = query.or(
        [`name.ilike.%${escaped}%`, `age_group.ilike.%${escaped}%`].join(","),
      );
    }
  }

  const { data, error } = await query.order("name");

  if (error) {
    throw new Error(`Could not load teams: ${error.message}`);
  }

  type Joined = Team & {
    seasons: { name: string } | null;
    team_players: { id: string; left_at: string | null }[] | null;
    team_coaches: { id: string; unassigned_at: string | null }[] | null;
  };

  return ((data ?? []) as unknown as Joined[]).map((row) => {
    const { seasons, team_players, team_coaches, ...team } = row;
    return {
      ...team,
      season_name: seasons?.name ?? null,
      // Only current membership counts — the join tables keep history.
      player_count: (team_players ?? []).filter((m) => m.left_at === null).length,
      coach_count: (team_coaches ?? []).filter((c) => c.unassigned_at === null)
        .length,
    };
  });
}

export async function getTeam(id: string): Promise<Team | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Could not load team: ${error.message}`);
  return data;
}

export type RosterEntry = {
  membership_id: string;
  player_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  jersey_number: number | null;
  position: string | null;
  status: string;
  joined_at: string;
  left_at: string | null;
};

/** Current roster by default; past members are kept for history. */
export async function getTeamRoster(
  teamId: string,
  options: { includePast?: boolean } = {},
): Promise<RosterEntry[]> {
  const supabase = await createClient();

  let query = supabase
    .from("team_players")
    .select(
      "id, player_id, joined_at, left_at, players (first_name, last_name, date_of_birth, jersey_number, position, status)",
    )
    .eq("team_id", teamId);

  if (!options.includePast) {
    query = query.is("left_at", null);
  }

  const { data, error } = await query.order("joined_at", { ascending: false });

  if (error) return [];

  type Joined = {
    id: string;
    player_id: string;
    joined_at: string;
    left_at: string | null;
    players: {
      first_name: string;
      last_name: string;
      date_of_birth: string;
      jersey_number: number | null;
      position: string | null;
      status: string;
    } | null;
  };

  return ((data ?? []) as unknown as Joined[])
    .filter((row): row is Joined & { players: NonNullable<Joined["players"]> } =>
      Boolean(row.players),
    )
    .map((row) => ({
      membership_id: row.id,
      player_id: row.player_id,
      joined_at: row.joined_at,
      left_at: row.left_at,
      ...row.players,
    }))
    .sort((a, b) => a.last_name.localeCompare(b.last_name));
}

export type TeamCoach = {
  assignment_id: string;
  coach_id: string;
  full_name: string;
  email: string;
  is_lead: boolean;
  assigned_at: string;
};

export async function getTeamCoaches(teamId: string): Promise<TeamCoach[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("team_coaches")
    .select("id, coach_id, is_lead, assigned_at, profiles (full_name, email)")
    .eq("team_id", teamId)
    .is("unassigned_at", null)
    .order("is_lead", { ascending: false });

  if (error) return [];

  type Joined = {
    id: string;
    coach_id: string;
    is_lead: boolean;
    assigned_at: string;
    profiles: { full_name: string; email: string } | null;
  };

  return ((data ?? []) as unknown as Joined[]).map((row) => ({
    assignment_id: row.id,
    coach_id: row.coach_id,
    is_lead: row.is_lead,
    assigned_at: row.assigned_at,
    full_name: row.profiles?.full_name ?? "Unknown",
    email: row.profiles?.email ?? "",
  }));
}

/** Active players not currently on this team, for the add-to-roster picker. */
export async function getAssignablePlayers(teamId: string) {
  const supabase = await createClient();

  const [playersResult, membershipResult] = await Promise.all([
    supabase
      .from("players")
      .select("id, first_name, last_name, date_of_birth")
      .in("status", ["active", "applicant"])
      .order("last_name"),
    supabase
      .from("team_players")
      .select("player_id")
      .eq("team_id", teamId)
      .is("left_at", null),
  ]);

  const taken = new Set(
    (membershipResult.data ?? []).map((row) => row.player_id),
  );

  return (playersResult.data ?? []).filter((player) => !taken.has(player.id));
}

/** Profiles holding the coach role, minus those already on this team. */
export async function getAssignableCoaches(teamId: string) {
  const supabase = await createClient();

  const [rolesResult, assignedResult] = await Promise.all([
    supabase.from("user_roles").select("user_id").eq("role", "coach"),
    supabase
      .from("team_coaches")
      .select("coach_id")
      .eq("team_id", teamId)
      .is("unassigned_at", null),
  ]);

  const coachIds = (rolesResult.data ?? []).map((row) => row.user_id);
  if (coachIds.length === 0) return [];

  const alreadyOn = new Set((assignedResult.data ?? []).map((r) => r.coach_id));
  const candidates = coachIds.filter((id) => !alreadyOn.has(id));
  if (candidates.length === 0) return [];

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", candidates)
    .eq("status", "active")
    .order("full_name");

  return data ?? [];
}

export async function listSeasons(): Promise<Season[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .order("starts_on", { ascending: false });

  if (error) return [];
  return data ?? [];
}
