"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth/session";
import {
  canManageSession,
  canMarkRegister,
  canRecordAttendance,
} from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import { getCoachedTeamIds } from "@/lib/activity/queries";
import {
  attendanceMarkSchema,
  callUpSchema,
  sessionStatusSchema,
  trainingSessionSchema,
} from "@/lib/validation/schemas";
import type { ActivityActionState } from "@/lib/activity/action-state";
import type { TablesInsert } from "@/lib/supabase/types";

/**
 * Training and attendance mutations.
 *
 * The authority model here is per-team, not per-role: a coach may only touch
 * sessions for a team they currently coach, which is exactly what
 * events_coach_write and attendance_coach_write enforce. Each action resolves
 * the actor's coached teams and checks against them before writing, so a
 * hand-crafted POST gets the same answer as the UI.
 *
 * Attendance is never deleted. A mistaken mark is corrected by upserting over
 * it, which is what the unique (event_id, player_id) constraint is there for.
 */

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value === "" ? null : value;
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

function readSessionForm(formData: FormData) {
  return {
    teamId: nullableText(formData, "teamId"),
    title: text(formData, "title"),
    description: text(formData, "description"),
    startsAt: text(formData, "startsAt"),
    endsAt: text(formData, "endsAt"),
    location: text(formData, "location"),
    coachId: nullableText(formData, "coachId"),
  };
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function createSessionAction(
  _prev: ActivityActionState,
  formData: FormData,
): Promise<ActivityActionState> {
  const user = await requireStaff();

  if (!canRecordAttendance(user.roles)) {
    return { ok: false, message: "Your role does not include training." };
  }

  const parsed = trainingSessionSchema.safeParse(readSessionForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  const v = parsed.data;
  const coachedTeamIds = await getCoachedTeamIds(user.id);

  if (!canManageSession(user.roles, v.teamId ?? null, coachedTeamIds)) {
    return {
      ok: false,
      message: v.teamId
        ? "You can only schedule sessions for teams you coach."
        : "Only an administrator can schedule a session with no team.",
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
      event_type: "training",
      team_id: v.teamId ?? null,
      title: v.title,
      description: v.description || null,
      starts_at: startsAt,
      ends_at: endsAt,
      location: v.location || null,
      // Defaults to whoever scheduled it, which is the coach in most cases.
      coach_id: v.coachId ?? user.id,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      message: error?.message ?? "Could not schedule the session.",
    };
  }

  await recordAudit({
    action: "session.create",
    entity: "events",
    entityId: data.id,
    metadata: { title: v.title, team_id: v.teamId ?? null, starts_at: startsAt },
  });

  revalidatePath("/dashboard/training");
  redirect(`/dashboard/training/${data.id}`);
}

export async function updateSessionAction(
  _prev: ActivityActionState,
  formData: FormData,
): Promise<ActivityActionState> {
  const user = await requireStaff();

  if (!canRecordAttendance(user.roles)) {
    return { ok: false, message: "Your role does not include training." };
  }

  const eventId = text(formData, "eventId");
  if (!eventId) return { ok: false, message: "Missing session reference." };

  const parsed = trainingSessionSchema.safeParse(readSessionForm(formData));
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
    .eq("event_type", "training")
    .maybeSingle();

  if (!existing) {
    return { ok: false, message: "That session no longer exists." };
  }

  const coachedTeamIds = await getCoachedTeamIds(user.id);

  // Both ends need checking: a coach must not be able to move a session off
  // their own team, nor take over one belonging to a team they do not coach.
  if (
    !canManageSession(user.roles, existing.team_id, coachedTeamIds) ||
    !canManageSession(user.roles, v.teamId ?? null, coachedTeamIds)
  ) {
    return {
      ok: false,
      message: "You can only edit sessions for teams you coach.",
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
      team_id: v.teamId ?? null,
      title: v.title,
      description: v.description || null,
      starts_at: startsAt,
      ends_at: endsAt,
      location: v.location || null,
      coach_id: v.coachId ?? null,
    })
    .eq("id", eventId)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!data) {
    return {
      ok: false,
      message: "You do not have permission to edit this session.",
    };
  }

  await recordAudit({
    action: "session.update",
    entity: "events",
    entityId: eventId,
    metadata: { title: v.title, starts_at: startsAt },
  });

  revalidatePath("/dashboard/training");
  revalidatePath(`/dashboard/training/${eventId}`);
  redirect(`/dashboard/training/${eventId}`);
}

/**
 * Marks a session completed or cancelled.
 *
 * Cancelling keeps the row: a cancelled session is a fact about the week, and
 * the attendance already marked against it stays readable. Cancelled sessions
 * are excluded from attendance rates rather than deleted.
 */
export async function setSessionStatusAction(
  _prev: ActivityActionState,
  formData: FormData,
): Promise<ActivityActionState> {
  const user = await requireStaff();

  if (!canRecordAttendance(user.roles)) {
    return { ok: false, message: "Your role does not include training." };
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
    .eq("event_type", "training")
    .maybeSingle();

  if (!existing) return { ok: false, message: "That session no longer exists." };

  const coachedTeamIds = await getCoachedTeamIds(user.id);

  if (!canManageSession(user.roles, existing.team_id, coachedTeamIds)) {
    return {
      ok: false,
      message: "You can only change sessions for teams you coach.",
    };
  }

  if (existing.status === parsed.data.status) {
    return { ok: false, message: `That session is already ${parsed.data.status}.` };
  }

  const { data, error } = await supabase
    .from("events")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.eventId)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!data) {
    return { ok: false, message: "You do not have permission to change this." };
  }

  await recordAudit({
    action: `session.${parsed.data.status}`,
    entity: "events",
    entityId: parsed.data.eventId,
    metadata: { title: existing.title, from: existing.status },
  });

  revalidatePath("/dashboard/training");
  revalidatePath(`/dashboard/training/${parsed.data.eventId}`);
  revalidatePath("/dashboard/attendance");

  return {
    ok: true,
    message:
      parsed.data.status === "cancelled"
        ? "Session cancelled."
        : `Session marked ${parsed.data.status}.`,
  };
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

/**
 * Saves the whole register in one go.
 *
 * The form posts one status per player as `status:<playerId>`, so a coach marks
 * everybody and submits once rather than firing a request per child. Upserted on
 * (event_id, player_id): re-submitting a corrected register overwrites the
 * previous marks instead of failing on the unique constraint or duplicating
 * history.
 *
 * marked_at is set explicitly because attendance has no updated_at trigger —
 * without it a correction would keep the timestamp of the original mark.
 */
export async function markAttendanceAction(
  _prev: ActivityActionState,
  formData: FormData,
): Promise<ActivityActionState> {
  const user = await requireStaff();

  if (!canRecordAttendance(user.roles)) {
    return { ok: false, message: "Your role does not include attendance." };
  }

  const eventId = text(formData, "eventId");
  if (!eventId) return { ok: false, message: "Missing session reference." };

  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, team_id, status, title")
    .eq("id", eventId)
    .eq("event_type", "training")
    .maybeSingle();

  if (!event) return { ok: false, message: "That session no longer exists." };

  const coachedTeamIds = await getCoachedTeamIds(user.id);

  if (!canMarkRegister(user.roles, event.team_id, coachedTeamIds)) {
    return {
      ok: false,
      message: event.team_id
        ? "You can only mark the register for teams you coach."
        : "Only an administrator can mark a session that belongs to no team.",
    };
  }

  if (event.status === "cancelled") {
    return {
      ok: false,
      message: "This session was cancelled. Reopen it before marking a register.",
    };
  }

  const markedAt = new Date().toISOString();
  const rows: TablesInsert<"attendance">[] = [];
  const invalid: string[] = [];

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("status:") || typeof value !== "string") continue;

    // An unanswered row posts an empty value and is left unmarked, rather than
    // being defaulted to absent — "nobody said" is not the same as "did not come".
    if (value === "") continue;

    const playerId = key.slice("status:".length);
    const parsed = attendanceMarkSchema.safeParse({
      playerId,
      status: value,
      notes: text(formData, `notes:${playerId}`),
    });

    if (!parsed.success) {
      invalid.push(playerId);
      continue;
    }

    rows.push({
      event_id: eventId,
      player_id: parsed.data.playerId,
      status: parsed.data.status,
      notes: parsed.data.notes || null,
      marked_by: user.id,
      marked_at: markedAt,
    });
  }

  if (invalid.length > 0) {
    return { ok: false, message: "Some marks were not valid. Nothing was saved." };
  }

  if (rows.length === 0) {
    return { ok: false, message: "Nothing to save — no players were marked." };
  }

  const { error } = await supabase
    .from("attendance")
    .upsert(rows, { onConflict: "event_id,player_id" });

  if (error) return { ok: false, message: error.message };

  await recordAudit({
    action: "attendance.mark",
    entity: "events",
    entityId: eventId,
    metadata: { title: event.title, marked: rows.length },
  });

  revalidatePath(`/dashboard/training/${eventId}`);
  revalidatePath("/dashboard/training");
  revalidatePath("/dashboard/attendance");

  return {
    ok: true,
    message:
      rows.length === 1
        ? "Register saved for 1 player."
        : `Register saved for ${rows.length} players.`,
  };
}

// ---------------------------------------------------------------------------
// Call-ups
// ---------------------------------------------------------------------------

/**
 * Adds a player to a session's expected list.
 *
 * The first call-up changes what the register means: until one exists the
 * register is the team's roster, and adding one makes the explicit list
 * authoritative. The page warns about that before the first call-up, since
 * otherwise a coach adding one guest would appear to lose the whole squad.
 */
export async function addCallUpAction(
  _prev: ActivityActionState,
  formData: FormData,
): Promise<ActivityActionState> {
  const user = await requireStaff();

  if (!canRecordAttendance(user.roles)) {
    return { ok: false, message: "Your role does not include training." };
  }

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
    .eq("event_type", "training")
    .maybeSingle();

  if (!event) return { ok: false, message: "That session no longer exists." };

  const coachedTeamIds = await getCoachedTeamIds(user.id);

  if (!canManageSession(user.roles, event.team_id, coachedTeamIds)) {
    return {
      ok: false,
      message: "You can only change sessions for teams you coach.",
    };
  }

  const { error } = await supabase.from("event_participants").insert({
    event_id: parsed.data.eventId,
    player_id: parsed.data.playerId,
    added_by: user.id,
  });

  if (error) {
    // unique (event_id, player_id) — already called up.
    if (error.code === "23505") {
      return { ok: false, message: "That player is already on this session." };
    }
    return { ok: false, message: error.message };
  }

  await recordAudit({
    action: "session.call_up",
    entity: "event_participants",
    entityId: parsed.data.eventId,
    metadata: { player_id: parsed.data.playerId },
  });

  revalidatePath(`/dashboard/training/${parsed.data.eventId}`);
  return { ok: true, message: "Player added to the session." };
}

/**
 * Removes a call-up.
 *
 * Deleting here is right where it is wrong for attendance: a call-up is a plan,
 * not a record of what happened. Any attendance already marked for that player
 * survives, and the register keeps showing them for exactly that reason.
 */
export async function removeCallUpAction(
  _prev: ActivityActionState,
  formData: FormData,
): Promise<ActivityActionState> {
  const user = await requireStaff();

  if (!canRecordAttendance(user.roles)) {
    return { ok: false, message: "Your role does not include training." };
  }

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
    .eq("event_type", "training")
    .maybeSingle();

  if (!event) return { ok: false, message: "That session no longer exists." };

  const coachedTeamIds = await getCoachedTeamIds(user.id);

  if (!canManageSession(user.roles, event.team_id, coachedTeamIds)) {
    return {
      ok: false,
      message: "You can only change sessions for teams you coach.",
    };
  }

  const { error } = await supabase
    .from("event_participants")
    .delete()
    .eq("event_id", parsed.data.eventId)
    .eq("player_id", parsed.data.playerId);

  if (error) return { ok: false, message: error.message };

  await recordAudit({
    action: "session.remove_call_up",
    entity: "event_participants",
    entityId: parsed.data.eventId,
    metadata: { player_id: parsed.data.playerId },
  });

  revalidatePath(`/dashboard/training/${parsed.data.eventId}`);
  return { ok: true, message: "Player removed from the session." };
}
