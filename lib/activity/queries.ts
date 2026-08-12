import { createClient } from "@/lib/supabase/server";
import type { AttendanceStatus, Tables } from "@/lib/supabase/types";
import type { SessionFilter } from "@/lib/activity/labels";

export type Event = Tables<"events">;
export type Attendance = Tables<"attendance">;

/**
 * Training and attendance reads.
 *
 * Every query here filters on event_type = 'training'. Matches live in the
 * same events table, so without that filter the training calendar would start
 * showing fixtures the moment the matches milestone lands.
 */

const TRAINING = "training" as const;

export type SessionSummary = Event & {
  team_name: string | null;
  coach_name: string | null;
  /** Registers already marked, and how many players were expected. */
  marked_count: number;
  expected_count: number;
};

export type SessionListParams = {
  filter?: SessionFilter;
  teamId?: string;
  limit?: number;
};

const DEFAULT_LIMIT = 100;

/**
 * Training sessions with enough context for the list.
 *
 * The expected head-count is deliberately two different things depending on the
 * session: an explicit call-up list where one exists, otherwise the team's
 * current roster. See getSessionRegister for why.
 */
export async function listSessions(
  params: SessionListParams = {},
): Promise<SessionSummary[]> {
  const supabase = await createClient();
  const filter = params.filter ?? "upcoming";
  const now = new Date().toISOString();

  let query = supabase
    .from("events")
    // The profiles embed must name its foreign key. events reaches profiles
    // twice — coach_id and created_by — and PostgREST refuses an ambiguous
    // embed outright (PGRST201) rather than guessing, which this function then
    // throws on. The coach is the one worth showing; who created the row is an
    // audit detail.
    .select(
      "*, teams (name), profiles!events_coach_id_fkey (full_name), " +
        "attendance (id), event_participants (id)",
    )
    .eq("event_type", TRAINING)
    .limit(params.limit ?? DEFAULT_LIMIT);

  if (params.teamId) {
    query = query.eq("team_id", params.teamId);
  }

  if (filter === "upcoming") {
    query = query.gte("starts_at", now).neq("status", "cancelled");
  } else if (filter === "past" || filter === "unmarked") {
    query = query.lt("starts_at", now);
  }

  // Upcoming reads forwards from today; everything else newest first.
  const { data, error } = await query.order("starts_at", {
    ascending: filter === "upcoming",
  });

  if (error) {
    throw new Error(`Could not load training sessions: ${error.message}`);
  }

  type Joined = Event & {
    teams: { name: string } | null;
    profiles: { full_name: string } | null;
    attendance: { id: string }[] | null;
    event_participants: { id: string }[] | null;
  };

  const rows = (data ?? []) as unknown as Joined[];

  // Roster sizes for team sessions without an explicit call-up list.
  const teamIds = [
    ...new Set(
      rows
        .filter(
          (row) =>
            row.team_id !== null && (row.event_participants ?? []).length === 0,
        )
        .map((row) => row.team_id as string),
    ),
  ];

  const rosterSizes = await rosterSizesFor(supabase, teamIds);

  const sessions = rows.map((row) => {
    const { teams, profiles, attendance, event_participants, ...event } = row;
    const calledUp = (event_participants ?? []).length;

    return {
      ...event,
      team_name: teams?.name ?? null,
      coach_name: profiles?.full_name ?? null,
      marked_count: (attendance ?? []).length,
      expected_count:
        calledUp > 0
          ? calledUp
          : event.team_id
            ? (rosterSizes.get(event.team_id) ?? 0)
            : 0,
    };
  });

  // "Needs a register" is a question about a session's attendance rather than
  // a column, so it is resolved once the counts above are known.
  return filter === "unmarked"
    ? sessions.filter(
        (session) =>
          session.status !== "cancelled" && session.marked_count === 0,
      )
    : sessions;
}

async function rosterSizesFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  teamIds: string[],
): Promise<Map<string, number>> {
  if (teamIds.length === 0) return new Map();

  const { data } = await supabase
    .from("team_players")
    .select("team_id")
    .in("team_id", teamIds)
    .is("left_at", null);

  const sizes = new Map<string, number>();
  for (const row of data ?? []) {
    sizes.set(row.team_id, (sizes.get(row.team_id) ?? 0) + 1);
  }
  return sizes;
}

export type SessionDetail = Event & {
  team_name: string | null;
  coach_name: string | null;
};

export async function getSession(id: string): Promise<SessionDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("events")
    // Named foreign key, for the same reason as listSessions above.
    .select("*, teams (name), profiles!events_coach_id_fkey (full_name)")
    .eq("id", id)
    .eq("event_type", TRAINING)
    .maybeSingle();

  if (error) throw new Error(`Could not load the session: ${error.message}`);
  if (!data) return null;

  type Joined = Event & {
    teams: { name: string } | null;
    profiles: { full_name: string } | null;
  };

  const { teams, profiles, ...event } = data as unknown as Joined;

  return {
    ...event,
    team_name: teams?.name ?? null,
    coach_name: profiles?.full_name ?? null,
  };
}

export type RegisterEntry = {
  player_id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
  /** null when nobody has marked this player for this session yet. */
  status: AttendanceStatus | null;
  notes: string | null;
  marked_at: string | null;
  /** True when the player was called up rather than being on the roster. */
  is_call_up: boolean;
};

/**
 * Who to show on the register for one session.
 *
 * Two sources, in order of authority:
 *
 *  1. event_participants, when the session has any. An explicit call-up list
 *     overrides the roster — that is the point of it, whether the coach is
 *     running a session for a subset of the squad or guesting a player from
 *     another team.
 *  2. Otherwise the team's current roster, which is what a coach means by
 *     "my Tuesday session" without doing any extra work.
 *
 * A session with no team and no call-ups therefore has an empty register, and
 * the page says so rather than looking broken.
 */
export async function getSessionRegister(
  eventId: string,
  teamId: string | null,
): Promise<RegisterEntry[]> {
  const supabase = await createClient();

  const [participantsResult, attendanceResult] = await Promise.all([
    supabase
      .from("event_participants")
      .select(
        "player_id, players (first_name, last_name, jersey_number)",
      )
      .eq("event_id", eventId),
    supabase
      .from("attendance")
      .select("player_id, status, notes, marked_at")
      .eq("event_id", eventId),
  ]);

  const marks = new Map(
    (attendanceResult.data ?? []).map((row) => [row.player_id, row]),
  );

  type PlayerBits = {
    first_name: string;
    last_name: string;
    jersey_number: number | null;
  };

  const roster = new Map<string, PlayerBits & { is_call_up: boolean }>();

  type JoinedParticipant = {
    player_id: string;
    players: PlayerBits | null;
  };

  for (const row of (participantsResult.data ?? []) as unknown as JoinedParticipant[]) {
    if (!row.players) continue;
    roster.set(row.player_id, { ...row.players, is_call_up: true });
  }

  if (roster.size === 0 && teamId) {
    const { data } = await supabase
      .from("team_players")
      .select("player_id, players (first_name, last_name, jersey_number)")
      .eq("team_id", teamId)
      .is("left_at", null);

    type JoinedMember = {
      player_id: string;
      players: PlayerBits | null;
    };

    for (const row of (data ?? []) as unknown as JoinedMember[]) {
      if (!row.players) continue;
      roster.set(row.player_id, { ...row.players, is_call_up: false });
    }
  }

  // A player marked but no longer on the roster still belongs on the register —
  // dropping them would hide a record somebody deliberately made.
  const orphanIds = [...marks.keys()].filter((id) => !roster.has(id));

  if (orphanIds.length > 0) {
    const { data } = await supabase
      .from("players")
      .select("id, first_name, last_name, jersey_number")
      .in("id", orphanIds);

    for (const player of data ?? []) {
      roster.set(player.id, {
        first_name: player.first_name,
        last_name: player.last_name,
        jersey_number: player.jersey_number,
        is_call_up: true,
      });
    }
  }

  return [...roster.entries()]
    .map(([playerId, player]) => {
      const mark = marks.get(playerId);
      return {
        player_id: playerId,
        first_name: player.first_name,
        last_name: player.last_name,
        jersey_number: player.jersey_number,
        is_call_up: player.is_call_up,
        status: mark?.status ?? null,
        notes: mark?.notes ?? null,
        marked_at: mark?.marked_at ?? null,
      };
    })
    .sort((a, b) => a.last_name.localeCompare(b.last_name));
}

/** Teams the signed-in coach currently coaches, for scoping and pickers. */
export async function getCoachedTeamIds(coachId: string): Promise<string[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("team_coaches")
    .select("team_id")
    .eq("coach_id", coachId)
    .is("unassigned_at", null);

  return (data ?? []).map((row) => row.team_id);
}

/** Active teams a session can be scheduled for, narrowed for a coach. */
export async function getSchedulableTeams(options: {
  limitToTeamIds?: string[] | null;
}) {
  const supabase = await createClient();

  let query = supabase
    .from("teams")
    .select("id, name, age_group")
    .eq("is_active", true);

  if (options.limitToTeamIds) {
    if (options.limitToTeamIds.length === 0) return [];
    query = query.in("id", options.limitToTeamIds);
  }

  const { data } = await query.order("name");
  return data ?? [];
}

/** Players who can be called up to a session, excluding those already on it. */
export async function getCallUpCandidates(eventId: string) {
  const supabase = await createClient();

  const [playersResult, participantsResult] = await Promise.all([
    supabase
      .from("players")
      .select("id, first_name, last_name")
      .in("status", ["active", "applicant"])
      .order("last_name"),
    supabase
      .from("event_participants")
      .select("player_id")
      .eq("event_id", eventId),
  ]);

  const taken = new Set(
    (participantsResult.data ?? []).map((row) => row.player_id),
  );

  return (playersResult.data ?? []).filter((player) => !taken.has(player.id));
}

export type AttendanceCounts = {
  present: number;
  late: number;
  absent: number;
  excused: number;
};

export type PlayerAttendanceRow = {
  player_id: string;
  first_name: string;
  last_name: string;
  counts: AttendanceCounts;
  total: number;
};

/**
 * Attendance record per player across training sessions.
 *
 * Counted in the application rather than in SQL. The alternative is a view, and
 * a view would have to encode the "late still counts as attended, excused is
 * not counted at all" judgement in the database — which is presentation policy,
 * not a fact about the data, and belongs next to the code that shows it.
 */
export async function getAttendanceByPlayer(options: {
  teamId?: string;
  since?: string;
} = {}): Promise<PlayerAttendanceRow[]> {
  const supabase = await createClient();

  let sessionQuery = supabase
    .from("events")
    .select("id")
    .eq("event_type", TRAINING)
    .neq("status", "cancelled");

  if (options.teamId) sessionQuery = sessionQuery.eq("team_id", options.teamId);
  if (options.since) sessionQuery = sessionQuery.gte("starts_at", options.since);

  const { data: sessions } = await sessionQuery;
  const sessionIds = (sessions ?? []).map((row) => row.id);

  if (sessionIds.length === 0) return [];

  const { data: marks } = await supabase
    .from("attendance")
    .select("player_id, status, players (first_name, last_name)")
    .in("event_id", sessionIds);

  type Joined = {
    player_id: string;
    status: AttendanceStatus;
    players: { first_name: string; last_name: string } | null;
  };

  const byPlayer = new Map<string, PlayerAttendanceRow>();

  for (const row of (marks ?? []) as unknown as Joined[]) {
    const existing = byPlayer.get(row.player_id) ?? {
      player_id: row.player_id,
      first_name: row.players?.first_name ?? "Unknown",
      last_name: row.players?.last_name ?? "player",
      counts: { present: 0, late: 0, absent: 0, excused: 0 },
      total: 0,
    };

    existing.counts[row.status] += 1;
    existing.total += 1;
    byPlayer.set(row.player_id, existing);
  }

  return [...byPlayer.values()].sort((a, b) =>
    a.last_name.localeCompare(b.last_name),
  );
}

export type TrainingSummary = {
  upcomingCount: number;
  /** Both register figures are scoped to this calendar month. */
  unmarkedThisMonth: number;
  markedThisMonth: number;
};

/** Headline numbers for the attendance overview. */
export async function getTrainingSummary(): Promise<TrainingSummary> {
  const supabase = await createClient();

  const now = new Date();
  const monthStart = new Date(now);
  monthStart.setDate(1);

  const [upcoming, past] = await Promise.all([
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", TRAINING)
      .neq("status", "cancelled")
      .gte("starts_at", now.toISOString()),
    supabase
      .from("events")
      .select("id, starts_at, attendance (id)")
      .eq("event_type", TRAINING)
      .neq("status", "cancelled")
      .lt("starts_at", now.toISOString())
      .gte("starts_at", monthStart.toISOString()),
  ]);

  type Joined = { id: string; starts_at: string; attendance: { id: string }[] | null };
  const pastSessions = (past.data ?? []) as unknown as Joined[];

  return {
    upcomingCount: upcoming.count ?? 0,
    unmarkedThisMonth: pastSessions.filter(
      (session) => (session.attendance ?? []).length === 0,
    ).length,
    markedThisMonth: pastSessions.filter(
      (session) => (session.attendance ?? []).length > 0,
    ).length,
  };
}
