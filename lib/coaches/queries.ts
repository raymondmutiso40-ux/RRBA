import { createClient } from "@/lib/supabase/server";
import type { AccountStatus, Tables } from "@/lib/supabase/types";

/**
 * The coaching staff directory.
 *
 * "A coach" is not a table — it is a profile holding the coach role, so every
 * read here starts from user_roles rather than from a coaches table that does
 * not exist. That also means the directory answers a question the team pages
 * cannot: who holds the role but is not assigned to anything.
 *
 * Assignment itself stays on the team page. team_coaches is a relationship
 * between a team and a coach, and giving it two homes would mean two places to
 * keep the history rules straight.
 */

export type Profile = Tables<"profiles">;

export type CoachSummary = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: AccountStatus;
  /** Teams currently coached — an ended assignment does not count. */
  teams: { id: string; name: string; is_lead: boolean }[];
  /** Training sessions with this coach named on them. */
  session_count: number;
  upcoming_count: number;
};

export type CoachListParams = {
  search?: string;
  /** Off by default: an archived or suspended coach is rarely the question. */
  includeInactive?: boolean;
};

/** Profile ids holding the coach role. */
async function coachIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string[]> {
  const { data } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "coach");

  return [...new Set((data ?? []).map((row) => row.user_id))];
}

export async function listCoaches(
  params: CoachListParams = {},
): Promise<CoachSummary[]> {
  const supabase = await createClient();

  const ids = await coachIds(supabase);
  if (ids.length === 0) return [];

  let profileQuery = supabase
    .from("profiles")
    .select("id, full_name, email, phone, status")
    .in("id", ids);

  if (!params.includeInactive) {
    profileQuery = profileQuery.eq("status", "active");
  }

  const search = (params.search ?? "").replace(/[%,()]/g, " ").trim();
  if (search) {
    profileQuery = profileQuery.or(
      [`full_name.ilike.%${search}%`, `email.ilike.%${search}%`].join(","),
    );
  }

  const now = new Date().toISOString();

  const [profilesResult, assignmentsResult, sessionsResult] = await Promise.all([
    profileQuery.order("full_name"),
    supabase
      .from("team_coaches")
      .select("coach_id, is_lead, teams (id, name)")
      .in("coach_id", ids)
      .is("unassigned_at", null),
    supabase
      .from("events")
      .select("coach_id, starts_at")
      .eq("event_type", "training")
      .in("coach_id", ids),
  ]);

  if (profilesResult.error) {
    throw new Error(`Could not load coaches: ${profilesResult.error.message}`);
  }

  type JoinedAssignment = {
    coach_id: string;
    is_lead: boolean;
    teams: { id: string; name: string } | null;
  };

  const teamsByCoach = new Map<
    string,
    { id: string; name: string; is_lead: boolean }[]
  >();

  for (const row of (assignmentsResult.data ??
    []) as unknown as JoinedAssignment[]) {
    if (!row.teams) continue;
    const list = teamsByCoach.get(row.coach_id) ?? [];
    list.push({ ...row.teams, is_lead: row.is_lead });
    teamsByCoach.set(row.coach_id, list);
  }

  const sessionsByCoach = new Map<string, { total: number; upcoming: number }>();

  for (const row of sessionsResult.data ?? []) {
    if (!row.coach_id) continue;
    const tally = sessionsByCoach.get(row.coach_id) ?? { total: 0, upcoming: 0 };
    tally.total += 1;
    if (row.starts_at >= now) tally.upcoming += 1;
    sessionsByCoach.set(row.coach_id, tally);
  }

  return (profilesResult.data ?? []).map((profile) => {
    const tally = sessionsByCoach.get(profile.id);
    return {
      ...profile,
      teams: teamsByCoach.get(profile.id) ?? [],
      session_count: tally?.total ?? 0,
      upcoming_count: tally?.upcoming ?? 0,
    };
  });
}

export type CoachTeam = {
  assignment_id: string;
  team_id: string;
  name: string;
  age_group: string;
  is_lead: boolean;
  assigned_at: string;
  player_count: number;
};

export type CoachSession = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
  team_name: string | null;
};

export type CoachDetail = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: AccountStatus;
  created_at: string;
  is_coach: boolean;
  teams: CoachTeam[];
  upcoming: CoachSession[];
  recent: CoachSession[];
  session_count: number;
};

export async function getCoach(id: string): Promise<CoachDetail | null> {
  const supabase = await createClient();

  const [profileResult, rolesResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, phone, status, created_at")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", id),
  ]);

  if (profileResult.error) {
    throw new Error(`Could not load coach: ${profileResult.error.message}`);
  }
  if (!profileResult.data) return null;

  const now = new Date().toISOString();

  const [assignmentsResult, upcomingResult, recentResult] = await Promise.all([
    supabase
      .from("team_coaches")
      .select("id, team_id, is_lead, assigned_at, teams (name, age_group)")
      .eq("coach_id", id)
      .is("unassigned_at", null)
      .order("is_lead", { ascending: false }),
    supabase
      .from("events")
      .select("id, title, starts_at, ends_at, status, teams (name)")
      .eq("event_type", "training")
      .eq("coach_id", id)
      .gte("starts_at", now)
      .neq("status", "cancelled")
      .order("starts_at", { ascending: true })
      .limit(10),
    supabase
      .from("events")
      .select("id, title, starts_at, ends_at, status, teams (name)")
      .eq("event_type", "training")
      .eq("coach_id", id)
      .lt("starts_at", now)
      .order("starts_at", { ascending: false })
      .limit(10),
  ]);

  type JoinedAssignment = {
    id: string;
    team_id: string;
    is_lead: boolean;
    assigned_at: string;
    teams: { name: string; age_group: string } | null;
  };

  const assignments = (assignmentsResult.data ??
    []) as unknown as JoinedAssignment[];

  // Roster sizes for the teams this coach actually holds, in one round trip.
  const teamIds = assignments.map((row) => row.team_id);
  const rosterSizes = new Map<string, number>();

  if (teamIds.length > 0) {
    const { data } = await supabase
      .from("team_players")
      .select("team_id")
      .in("team_id", teamIds)
      .is("left_at", null);

    for (const row of data ?? []) {
      rosterSizes.set(row.team_id, (rosterSizes.get(row.team_id) ?? 0) + 1);
    }
  }

  type JoinedEvent = {
    id: string;
    title: string;
    starts_at: string;
    ends_at: string;
    status: string;
    teams: { name: string } | null;
  };

  const toSession = (row: JoinedEvent): CoachSession => ({
    id: row.id,
    title: row.title,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    status: row.status,
    team_name: row.teams?.name ?? null,
  });

  const { count } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "training")
    .eq("coach_id", id);

  return {
    ...profileResult.data,
    is_coach: (rolesResult.data ?? []).some((row) => row.role === "coach"),
    teams: assignments
      .filter((row) => row.teams)
      .map((row) => ({
        assignment_id: row.id,
        team_id: row.team_id,
        name: row.teams!.name,
        age_group: row.teams!.age_group,
        is_lead: row.is_lead,
        assigned_at: row.assigned_at,
        player_count: rosterSizes.get(row.team_id) ?? 0,
      })),
    upcoming: ((upcomingResult.data ?? []) as unknown as JoinedEvent[]).map(
      toSession,
    ),
    recent: ((recentResult.data ?? []) as unknown as JoinedEvent[]).map(
      toSession,
    ),
    session_count: count ?? 0,
  };
}
