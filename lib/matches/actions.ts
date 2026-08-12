"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth/session";
import {
  canManageMatch,
  canRecordMatchStats,
  canViewMatches,
} from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import { getCoachedTeamIds } from "@/lib/activity/queries";
import { STAT_COLUMNS, statFieldName } from "@/lib/matches/labels";
import {
  callUpSchema,
  matchResultSchema,
  matchSchema,
  playerMatchStatsSchema,
  sessionStatusSchema,
} from "@/lib/validation/schemas";
import type { MatchActionState } from "@/lib/matches/action-state";
import type { TablesInsert } from "@/lib/supabase/types";

/**
 * Fixture and box-score mutations.
 *
 * A match is a row in the events table, so the authority model is the one
 * training already uses: per-team rather than per-role, because
 * events_coach_write only lets a coach touch events for a team they currently
 * coach. Each action re-resolves that before writing, so a hand-crafted POST
 * gets the same answer as the UI.
 *
 * Every write filters on event_type = 'match'. Without it, an id belonging to a
 * training session would be editable through the fixture actions, which would
 * let somebody put an opponent and a scoreline on a Tuesday practice.
 */

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value === "" ? null : value;
}

/** A numeric form field, where blank means "not recorded" rather than zero. */
function optionalNumber(formData: FormData, key: string): number | null {
  const value = text(formData, key);
  if (value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function collectFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

/**
 * A datetime-local field submits "2026-08-08T17:30" with no zone. Passing that
 * to Postgres timestamptz would have it read as UTC rather than as the time the
 * coach typed, so it goes through Date to pick up the server's offset.
 */
function toTimestamp(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function readMatchForm(formData: FormData) {
  return {
    teamId: text(formData, "teamId"),
    opponent: text(formData, "opponent"),
    competition: text(formData, "competition"),
    isHome: text(formData, "isHome") === "home",
    title: text(formData, "title"),
    description: text(formData, "description"),
    startsAt: text(formData, "startsAt"),
    endsAt: text(formData, "endsAt"),
    location: text(formData, "location"),
    coachId: nullableText(formData, "coachId"),
  };
}

/**
 * What the fixture is called when the coach does not name it.
 *
 * events.title is NOT NULL and the list is read by title, so a blank one would
 * render an anonymous row. "vs Nairobi Kings" is what a coach would have typed
 * anyway, so it is filled in rather than demanded.
 */
function defaultTitle(opponent: string, isHome: boolean): string {
  return `${isHome ? "vs" : "away to"} ${opponent}`.slice(0, 200);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

export async function createMatchAction(
  _prev: MatchActionState,
  formData: FormData,
): Promise<MatchActionState> {
  const user = await requireStaff();

  if (!canViewMatches(user.roles)) {
    return { ok: false, message: "Your role does not include matches." };
  }

  const parsed = matchSchema.safeParse(readMatchForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  const v = parsed.data;
  const coachedTeamIds = await getCoachedTeamIds(user.id);

  if (!canManageMatch(user.roles, v.teamId, coachedTeamIds)) {
    return {
      ok: false,
      message: "You can only arrange fixtures for teams you coach.",
      fieldErrors: { teamId: "Not one of your teams" },
    };
  }

  const startsAt = toTimestamp(v.startsAt);
  const endsAt = toTimestamp(v.endsAt);

  if (!startsAt || !endsAt) {
    return {
      ok: false,
      message: "Check the start and end times.",
      fieldErrors: { startsAt: "Invalid date or time" },
    };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("events")
    .insert({
      event_type: "match",
      team_id: v.teamId,
      title: v.title || defaultTitle(v.opponent, v.isHome),
      description: v.description || null,
      starts_at: startsAt,
      ends_at: endsAt,
      location: v.location || null,
      opponent: v.opponent,
      competition: v.competition || null,
      is_home: v.isHome,
      coach_id: v.coachId ?? user.id,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      message: error?.message ?? "Could not arrange the fixture.",
    };
  }

  await recordAudit({
    action: "match.create",
    entity: "events",
    entityId: data.id,
    metadata: { opponent: v.opponent, team_id: v.teamId, starts_at: startsAt },
  });

  revalidatePath("/dashboard/matches");
  redirect(`/dashboard/matches/${data.id}`);
}

export async function updateMatchAction(
  _prev: MatchActionState,
  formData: FormData,
): Promise<MatchActionState> {
  const user = await requireStaff();

  if (!canViewMatches(user.roles)) {
    return { ok: false, message: "Your role does not include matches." };
  }

  const eventId = text(formData, "eventId");
  if (!eventId) return { ok: false, message: "Missing fixture reference." };

  const parsed = matchSchema.safeParse(readMatchForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  const v = parsed.data;
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("events")
    .select("team_id")
    .eq("id", eventId)
    .eq("event_type", "match")
    .maybeSingle();

  if (!existing) return { ok: false, message: "That fixture no longer exists." };

  const coachedTeamIds = await getCoachedTeamIds(user.id);

  // Both ends need checking: a coach must not be able to move a fixture off
  // their own team, nor take over one belonging to a team they do not coach.
  if (
    !canManageMatch(user.roles, existing.team_id, coachedTeamIds) ||
    !canManageMatch(user.roles, v.teamId, coachedTeamIds)
  ) {
    return {
      ok: false,
      message: "You can only edit fixtures for teams you coach.",
      fieldErrors: { teamId: "Not one of your teams" },
    };
  }

  const startsAt = toTimestamp(v.startsAt);
  const endsAt = toTimestamp(v.endsAt);

  if (!startsAt || !endsAt) {
    return {
      ok: false,
      message: "Check the start and end times.",
      fieldErrors: { startsAt: "Invalid date or time" },
    };
  }

  const { data, error } = await supabase
    .from("events")
    .update({
      team_id: v.teamId,
      title: v.title || defaultTitle(v.opponent, v.isHome),
      description: v.description || null,
      starts_at: startsAt,
      ends_at: endsAt,
      location: v.location || null,
      opponent: v.opponent,
      competition: v.competition || null,
      is_home: v.isHome,
      coach_id: v.coachId ?? null,
    })
    .eq("id", eventId)
    .eq("event_type", "match")
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!data) {
    return {
      ok: false,
      message: "You do not have permission to edit this fixture.",
    };
  }

  await recordAudit({
    action: "match.update",
    entity: "events",
    entityId: eventId,
    metadata: { opponent: v.opponent, starts_at: startsAt },
  });

  revalidatePath("/dashboard/matches");
  revalidatePath(`/dashboard/matches/${eventId}`);
  redirect(`/dashboard/matches/${eventId}`);
}

/**
 * Marks a fixture completed or cancelled.
 *
 * Cancelling keeps the row and anything already recorded against it. A called-
 * off fixture is a fact about the season, and the box score of a game that was
 * abandoned at half time is still a record somebody made deliberately.
 */
export async function setMatchStatusAction(
  _prev: MatchActionState,
  formData: FormData,
): Promise<MatchActionState> {
  const user = await requireStaff();

  if (!canViewMatches(user.roles)) {
    return { ok: false, message: "Your role does not include matches." };
  }

  const parsed = sessionStatusSchema.safeParse({
    eventId: text(formData, "eventId"),
    status: text(formData, "status"),
  });

  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("events")
    .select("team_id, status, title")
    .eq("id", parsed.data.eventId)
    .eq("event_type", "match")
    .maybeSingle();

  if (!existing) return { ok: false, message: "That fixture no longer exists." };

  const coachedTeamIds = await getCoachedTeamIds(user.id);

  if (!canManageMatch(user.roles, existing.team_id, coachedTeamIds)) {
    return {
      ok: false,
      message: "You can only change fixtures for teams you coach.",
    };
  }

  if (existing.status === parsed.data.status) {
    return { ok: false, message: `That fixture is already ${parsed.data.status}.` };
  }

  const { data, error } = await supabase
    .from("events")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.eventId)
    .eq("event_type", "match")
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!data) {
    return { ok: false, message: "You do not have permission to change this." };
  }

  await recordAudit({
    action: `match.${parsed.data.status}`,
    entity: "events",
    entityId: parsed.data.eventId,
    metadata: { title: existing.title, from: existing.status },
  });

  revalidatePath("/dashboard/matches");
  revalidatePath(`/dashboard/matches/${parsed.data.eventId}`);

  return {
    ok: true,
    message:
      parsed.data.status === "cancelled"
        ? "Fixture cancelled."
        : `Fixture marked ${parsed.data.status}.`,
  };
}

/**
 * Records the final score.
 *
 * The win/loss/draw is derived from the two numbers by the schema rather than
 * chosen on the form — it is the same fact stated twice, and letting the two
 * disagree would put a contradiction in the database.
 *
 * Recording a result also completes the fixture. A game with a score on it has
 * been played, and leaving it 'scheduled' would keep it in the upcoming list.
 */
export async function recordMatchResultAction(
  _prev: MatchActionState,
  formData: FormData,
): Promise<MatchActionState> {
  const user = await requireStaff();

  if (!canViewMatches(user.roles)) {
    return { ok: false, message: "Your role does not include matches." };
  }

  const teamScore = optionalNumber(formData, "finalScoreTeam");
  const oppScore = optionalNumber(formData, "finalScoreOpp");

  const parsed = matchResultSchema.safeParse({
    eventId: text(formData, "eventId"),
    finalScoreTeam: teamScore,
    finalScoreOpp: oppScore,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Enter both scores as whole numbers.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  const v = parsed.data;
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("events")
    .select("team_id, title, opponent")
    .eq("id", v.eventId)
    .eq("event_type", "match")
    .maybeSingle();

  if (!existing) return { ok: false, message: "That fixture no longer exists." };

  const coachedTeamIds = await getCoachedTeamIds(user.id);

  if (!canManageMatch(user.roles, existing.team_id, coachedTeamIds)) {
    return {
      ok: false,
      message: "You can only record results for teams you coach.",
    };
  }

  const { data, error } = await supabase
    .from("events")
    .update({
      final_score_team: v.finalScoreTeam,
      final_score_opp: v.finalScoreOpp,
      result: v.result,
      status: "completed",
    })
    .eq("id", v.eventId)
    .eq("event_type", "match")
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!data) {
    return { ok: false, message: "You do not have permission to record this." };
  }

  await recordAudit({
    action: "match.result",
    entity: "events",
    entityId: v.eventId,
    metadata: {
      opponent: existing.opponent,
      score: `${v.finalScoreTeam}-${v.finalScoreOpp}`,
      result: v.result,
    },
  });

  revalidatePath("/dashboard/matches");
  revalidatePath(`/dashboard/matches/${v.eventId}`);

  return { ok: true, message: `Result recorded — ${v.result}.` };
}

// ---------------------------------------------------------------------------
// Box scores
// ---------------------------------------------------------------------------

const STAT_TO_COLUMN = {
  minutes_played: "minutesPlayed",
  points: "points",
  rebounds: "rebounds",
  assists: "assists",
  steals: "steals",
  blocks: "blocks",
  turnovers: "turnovers",
  fouls: "fouls",
  fg_made: "fgMade",
  fg_attempts: "fgAttempts",
  three_made: "threeMade",
  three_attempts: "threeAttempts",
  ft_made: "ftMade",
  ft_attempts: "ftAttempts",
} as const;

/**
 * Saves the whole box score in one go.
 *
 * The form posts one field per player per column, so a coach fills in the grid
 * and submits once rather than firing a request per player. Upserted on
 * (event_id, player_id): re-submitting a corrected line overwrites the previous
 * one instead of failing on the unique constraint.
 *
 * A player whose entire row is blank is skipped rather than saved as zeroes.
 * Nobody said what they did, which is not the same as saying they did nothing —
 * and a row of zeroes would drag their season averages down.
 */
export async function saveBoxScoreAction(
  _prev: MatchActionState,
  formData: FormData,
): Promise<MatchActionState> {
  const user = await requireStaff();

  const eventId = text(formData, "eventId");
  if (!eventId) return { ok: false, message: "Missing fixture reference." };

  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, team_id, status, title")
    .eq("id", eventId)
    .eq("event_type", "match")
    .maybeSingle();

  if (!event) return { ok: false, message: "That fixture no longer exists." };

  const coachedTeamIds = await getCoachedTeamIds(user.id);

  if (!canRecordMatchStats(user.roles, event.team_id, coachedTeamIds)) {
    return {
      ok: false,
      message: event.team_id
        ? "You can only record stats for teams you coach."
        : "Only an administrator can record stats for a fixture with no team.",
    };
  }

  const playerIds = formData
    .getAll("playerId")
    .filter((value): value is string => typeof value === "string");

  const rows: TablesInsert<"player_match_stats">[] = [];
  const fieldErrors: Record<string, string> = {};

  for (const playerId of playerIds) {
    const raw: Record<string, number | null> = {};
    let hasAnyFigure = false;

    for (const column of STAT_COLUMNS) {
      const value = optionalNumber(formData, statFieldName(playerId, column.key));
      if (value !== null) hasAnyFigure = true;
      raw[STAT_TO_COLUMN[column.key]] = value;
    }

    if (!hasAnyFigure) continue;

    const parsed = playerMatchStatsSchema.safeParse({
      eventId,
      playerId,
      ...raw,
    });

    if (!parsed.success) {
      // Keyed by player so the grid can point at the offending row rather than
      // saying "something is wrong" about a table of 150 inputs.
      const first = parsed.error.issues[0];
      fieldErrors[playerId] = first?.message ?? "Check these figures.";
      continue;
    }

    const v = parsed.data;
    rows.push({
      event_id: eventId,
      player_id: v.playerId,
      minutes_played: v.minutesPlayed,
      points: v.points,
      rebounds: v.rebounds,
      assists: v.assists,
      steals: v.steals,
      blocks: v.blocks,
      turnovers: v.turnovers,
      fouls: v.fouls,
      fg_attempts: v.fgAttempts,
      fg_made: v.fgMade,
      three_attempts: v.threeAttempts,
      three_made: v.threeMade,
      ft_attempts: v.ftAttempts,
      ft_made: v.ftMade,
    });
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: "Some figures were not valid. Nothing was saved.",
      fieldErrors,
    };
  }

  if (rows.length === 0) {
    return { ok: false, message: "Nothing to save — no figures were entered." };
  }

  const { error } = await supabase
    .from("player_match_stats")
    .upsert(rows, { onConflict: "event_id,player_id" });

  if (error) return { ok: false, message: error.message };

  // Flags the fixture as having a box score, so the list can show which games
  // still need one without counting rows in a second table.
  await supabase
    .from("events")
    .update({ stats_recorded: true })
    .eq("id", eventId)
    .eq("event_type", "match");

  await recordAudit({
    action: "match.stats",
    entity: "events",
    entityId: eventId,
    metadata: { title: event.title, players: rows.length },
  });

  revalidatePath("/dashboard/matches");
  revalidatePath(`/dashboard/matches/${eventId}`);

  return {
    ok: true,
    message:
      rows.length === 1
        ? "Box score saved for 1 player."
        : `Box score saved for ${rows.length} players.`,
  };
}

// ---------------------------------------------------------------------------
// Matchday squad
// ---------------------------------------------------------------------------

/**
 * Adds a player to the matchday squad.
 *
 * Same rule as a training call-up, and the same consequence: until the first
 * one exists the box score is built from the team's roster, and adding one
 * makes the explicit squad authoritative instead.
 */
export async function addSquadMemberAction(
  _prev: MatchActionState,
  formData: FormData,
): Promise<MatchActionState> {
  const user = await requireStaff();

  const parsed = callUpSchema.safeParse({
    eventId: text(formData, "eventId"),
    playerId: text(formData, "playerId"),
  });

  if (!parsed.success) return { ok: false, message: "Select a player." };

  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("team_id")
    .eq("id", parsed.data.eventId)
    .eq("event_type", "match")
    .maybeSingle();

  if (!event) return { ok: false, message: "That fixture no longer exists." };

  const coachedTeamIds = await getCoachedTeamIds(user.id);

  if (!canManageMatch(user.roles, event.team_id, coachedTeamIds)) {
    return {
      ok: false,
      message: "You can only change fixtures for teams you coach.",
    };
  }

  const { error } = await supabase.from("event_participants").insert({
    event_id: parsed.data.eventId,
    player_id: parsed.data.playerId,
    added_by: user.id,
  });

  if (error) {
    // unique (event_id, player_id) — already in the squad.
    if (error.code === "23505") {
      return { ok: false, message: "That player is already in the squad." };
    }
    return { ok: false, message: error.message };
  }

  await recordAudit({
    action: "match.squad_add",
    entity: "event_participants",
    entityId: parsed.data.eventId,
    metadata: { player_id: parsed.data.playerId },
  });

  revalidatePath(`/dashboard/matches/${parsed.data.eventId}`);
  return { ok: true, message: "Player added to the squad." };
}

/**
 * Removes a player from the matchday squad.
 *
 * Deleting is right here where it is wrong for a stat line: a squad is a plan,
 * not a record of what happened. Any stats already recorded for that player
 * survive, and the box score keeps showing them for exactly that reason.
 */
export async function removeSquadMemberAction(
  _prev: MatchActionState,
  formData: FormData,
): Promise<MatchActionState> {
  const user = await requireStaff();

  const parsed = callUpSchema.safeParse({
    eventId: text(formData, "eventId"),
    playerId: text(formData, "playerId"),
  });

  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("team_id")
    .eq("id", parsed.data.eventId)
    .eq("event_type", "match")
    .maybeSingle();

  if (!event) return { ok: false, message: "That fixture no longer exists." };

  const coachedTeamIds = await getCoachedTeamIds(user.id);

  if (!canManageMatch(user.roles, event.team_id, coachedTeamIds)) {
    return {
      ok: false,
      message: "You can only change fixtures for teams you coach.",
    };
  }

  const { error } = await supabase
    .from("event_participants")
    .delete()
    .eq("event_id", parsed.data.eventId)
    .eq("player_id", parsed.data.playerId);

  if (error) return { ok: false, message: error.message };

  await recordAudit({
    action: "match.squad_remove",
    entity: "event_participants",
    entityId: parsed.data.eventId,
    metadata: { player_id: parsed.data.playerId },
  });

  revalidatePath(`/dashboard/matches/${parsed.data.eventId}`);
  return { ok: true, message: "Player removed from the squad." };
}
