import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";
import type { MatchFilter } from "@/lib/matches/labels";

/**
 * Fixture and box-score reads.
 *
 * Matches share the events table with training, so every query here filters on
 * event_type = 'match' — the mirror image of lib/activity/queries.ts, which
 * filters on 'training' so the two calendars never bleed into each other.
 *
 * A fixture is one row; the box score is player_match_stats keyed by
 * (event_id, player_id). Nothing is denormalised onto the event: the team's
 * final score is what the coach entered, not the sum of the box score, because
 * a partially recorded box score would otherwise silently rewrite the result.
 * The detail page shows both and lets the coach see the discrepancy.
 */

export type Event = Tables<"events">;
export type MatchStats = Tables<"player_match_stats">;

const MATCH = "match" as const;

export type MatchSummary = Event & {
  team_name: string | null;
  coach_name: string | null;
  /** How many players have a stat line recorded. */
  stat_lines: number;
};

export type MatchListParams = {
  filter?: MatchFilter;
  teamId?: string;
  limit?: number;
};

const DEFAULT_LIMIT = 100;

export async function listMatches(
  params: MatchListParams = {},
): Promise<MatchSummary[]> {
  const supabase = await createClient();
  const filter = params.filter ?? "upcoming";
  const now = new Date().toISOString();

  let query = supabase
    .from("events")
    .select("*, teams (name), profiles (full_name), player_match_stats (id)")
    .eq("event_type", MATCH)
    .limit(params.limit ?? DEFAULT_LIMIT);

  if (params.teamId) query = query.eq("team_id", params.teamId);

  if (filter === "upcoming") {
    query = query.gte("starts_at", now).neq("status", "cancelled");
  } else if (filter === "played" || filter === "unrecorded") {
    query = query.lt("starts_at", now);
  }

  const { data, error } = await query.order("starts_at", {
    ascending: filter === "upcoming",
  });

  if (error) throw new Error(`Could not load fixtures: ${error.message}`);

  type Joined = Event & {
    teams: { name: string } | null;
    profiles: { full_name: string } | null;
    player_match_stats: { id: string }[] | null;
  };

  const matches = ((data ?? []) as unknown as Joined[]).map((row) => {
    const { teams, profiles, player_match_stats, ...event } = row;
    return {
      ...event,
      team_name: teams?.name ?? null,
      coach_name: profiles?.full_name ?? null,
      stat_lines: (player_match_stats ?? []).length,
    };
  });

  // "Needs a result" is a question about the row's contents rather than a
  // column, so it is resolved here rather than in the query.
  return filter === "unrecorded"
    ? matches.filter(
        (match) => match.status !== "cancelled" && match.result === null,
      )
    : matches;
}

export type MatchDetail = Event & {
  team_name: string | null;
  coach_name: string | null;
};

export async function getMatch(id: string): Promise<MatchDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("events")
    .select("*, teams (name), profiles (full_name)")
    .eq("id", id)
    .eq("event_type", MATCH)
    .maybeSingle();

  if (error) throw new Error(`Could not load the match: ${error.message}`);
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

export type BoxScoreEntry = {
  player_id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
  /** null when nobody has recorded a line for this player yet. */
  stats: MatchStats | null;
  /** True when the player was called up rather than being on the roster. */
  is_call_up: boolean;
};

/**
 * Who appears on the box score for one match.
 *
 * Same two-source rule as a training register, and for the same reason: an
 * explicit event_participants list wins where one exists — that is what a
 * matchday squad is — and otherwise the team's current roster stands in, which
 * is what a coach means without doing extra work.
 *
 * A player with a recorded stat line always appears, even if they have since
 * left the team. Dropping them would hide a record of a game they played in.
 */
export async function getMatchBoxScore(
  eventId: string,
  teamId: string | null,
): Promise<BoxScoreEntry[]> {
  const supabase = await createClient();

  const [squadResult, statsResult] = await Promise.all([
    supabase
      .from("event_participants")
      .select("player_id, players (first_name, last_name, jersey_number)")
      .eq("event_id", eventId),
    supabase.from("player_match_stats").select("*").eq("event_id", eventId),
  ]);

  const statsByPlayer = new Map(
    (statsResult.data ?? []).map((row) => [row.player_id, row]),
  );

  type PlayerBits = {
    first_name: string;
    last_name: string;
    jersey_number: number | null;
  };

  const squad = new Map<string, PlayerBits & { is_call_up: boolean }>();

  type JoinedParticipant = { player_id: string; players: PlayerBits | null };

  for (const row of (squadResult.data ?? []) as unknown as JoinedParticipant[]) {
    if (!row.players) continue;
    squad.set(row.player_id, { ...row.players, is_call_up: true });
  }

  if (squad.size === 0 && teamId) {
    const { data } = await supabase
      .from("team_players")
      .select("player_id, players (first_name, last_name, jersey_number)")
      .eq("team_id", teamId)
      .is("left_at", null);

    type JoinedMember = { player_id: string; players: PlayerBits | null };

    for (const row of (data ?? []) as unknown as JoinedMember[]) {
      if (!row.players) continue;
      squad.set(row.player_id, { ...row.players, is_call_up: false });
    }
  }

  const orphanIds = [...statsByPlayer.keys()].filter((id) => !squad.has(id));

  if (orphanIds.length > 0) {
    const { data } = await supabase
      .from("players")
      .select("id, first_name, last_name, jersey_number")
      .in("id", orphanIds);

    for (const player of data ?? []) {
      squad.set(player.id, {
        first_name: player.first_name,
        last_name: player.last_name,
        jersey_number: player.jersey_number,
        is_call_up: true,
      });
    }
  }

  return [...squad.entries()]
    .map(([playerId, player]) => ({
      player_id: playerId,
      first_name: player.first_name,
      last_name: player.last_name,
      jersey_number: player.jersey_number,
      is_call_up: player.is_call_up,
      stats: statsByPlayer.get(playerId) ?? null,
    }))
    .sort((a, b) => {
      // Squad numbers first where they exist — that is how a coach reads a
      // team sheet — then everyone else alphabetically.
      if (a.jersey_number !== null && b.jersey_number !== null) {
        return a.jersey_number - b.jersey_number;
      }
      if (a.jersey_number !== null) return -1;
      if (b.jersey_number !== null) return 1;
      return a.last_name.localeCompare(b.last_name);
    });
}

export type MatchRecord = {
  played: number;
  won: number;
  lost: number;
  drawn: number;
  pointsFor: number;
  pointsAgainst: number;
};

export type MatchesSummary = MatchRecord & {
  upcomingCount: number;
  awaitingResult: number;
};

/** Headline figures for the fixture list. */
export async function getMatchesSummary(options: { teamId?: string } = {}) {
  const supabase = await createClient();
  const now = new Date().toISOString();

  let playedQuery = supabase
    .from("events")
    .select("result, final_score_team, final_score_opp, status, starts_at")
    .eq("event_type", MATCH)
    .neq("status", "cancelled")
    .lt("starts_at", now);

  let upcomingQuery = supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", MATCH)
    .neq("status", "cancelled")
    .gte("starts_at", now);

  if (options.teamId) {
    playedQuery = playedQuery.eq("team_id", options.teamId);
    upcomingQuery = upcomingQuery.eq("team_id", options.teamId);
  }

  const [played, upcoming] = await Promise.all([playedQuery, upcomingQuery]);

  const summary: MatchesSummary = {
    played: 0,
    won: 0,
    lost: 0,
    drawn: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    upcomingCount: upcoming.count ?? 0,
    awaitingResult: 0,
  };

  for (const row of played.data ?? []) {
    if (row.result === null) {
      summary.awaitingResult += 1;
      continue;
    }

    summary.played += 1;
    if (row.result === "win") summary.won += 1;
    else if (row.result === "loss") summary.lost += 1;
    else summary.drawn += 1;

    summary.pointsFor += row.final_score_team ?? 0;
    summary.pointsAgainst += row.final_score_opp ?? 0;
  }

  return summary;
}

export type PlayerMatchLine = MatchStats & {
  event_id: string;
  starts_at: string;
  opponent: string | null;
  result: Event["result"];
  final_score_team: number | null;
  final_score_opp: number | null;
};

/**
 * One player's stat lines, newest first — for their own player page.
 *
 * Reads through the event so the line can be labelled with who it was against;
 * player_match_stats on its own only knows an event id.
 */
export async function getPlayerMatchLines(
  playerId: string,
  limit = 20,
): Promise<PlayerMatchLine[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("player_match_stats")
    .select(
      "*, events!inner (starts_at, opponent, result, final_score_team, final_score_opp, event_type)",
    )
    .eq("player_id", playerId)
    .eq("events.event_type", MATCH)
    .order("created_at", { ascending: false })
    .limit(limit);

  type Joined = MatchStats & {
    events: {
      starts_at: string;
      opponent: string | null;
      result: Event["result"];
      final_score_team: number | null;
      final_score_opp: number | null;
    } | null;
  };

  return ((data ?? []) as unknown as Joined[])
    .filter((row) => row.events)
    .map((row) => {
      const { events, ...stats } = row;
      return {
        ...stats,
        starts_at: events!.starts_at,
        opponent: events!.opponent,
        result: events!.result,
        final_score_team: events!.final_score_team,
        final_score_opp: events!.final_score_opp,
      };
    })
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
}

/** Active teams a fixture can be arranged for, narrowed for a coach. */
export async function getPlayableTeams(options: {
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

/** Players who can be added to a matchday squad, excluding those already on it. */
export async function getSquadCandidates(eventId: string) {
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
