"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth/session";
import {
  canAssignCoaches,
  canManageRoster,
  canManageTeams,
} from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  coachAssignSchema,
  coachUnassignSchema,
  rosterAddSchema,
  rosterRemoveSchema,
  teamSchema,
} from "@/lib/validation/schemas";
import type { TeamActionState } from "@/lib/teams/action-state";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value === "" ? null : value;
}

function nullableNumber(formData: FormData, key: string): number | null {
  const value = text(formData, key);
  if (value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

function readTeamForm(formData: FormData) {
  return {
    name: text(formData, "name"),
    ageGroup: text(formData, "ageGroup"),
    gender: text(formData, "gender") || "undisclosed",
    seasonId: nullableText(formData, "seasonId"),
    description: text(formData, "description"),
    minAge: nullableNumber(formData, "minAge"),
    maxAge: nullableNumber(formData, "maxAge"),
    isActive: formData.get("isActive") !== null,
  };
}

/** Postgres unique_violation — the name is already used in that season. */
const UNIQUE_VIOLATION = "23505";

export async function createTeamAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const user = await requireStaff();

  if (!canManageTeams(user.roles)) {
    return { ok: false, message: "Only administrators can create teams." };
  }

  const parsed = teamSchema.safeParse(readTeamForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  const v = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("teams")
    .insert({
      name: v.name,
      age_group: v.ageGroup,
      gender: v.gender,
      season_id: v.seasonId ?? null,
      description: v.description || null,
      min_age: v.minAge ?? null,
      max_age: v.maxAge ?? null,
      is_active: v.isActive ?? true,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === UNIQUE_VIOLATION) {
      return {
        ok: false,
        message: "A team with that name already exists in this season.",
        fieldErrors: { name: "Already in use" },
      };
    }
    return { ok: false, message: error?.message ?? "Could not create the team." };
  }

  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "team.create",
    entity: "teams",
    entity_id: data.id,
    metadata: { name: v.name },
  });

  revalidatePath("/dashboard/teams");
  redirect(`/dashboard/teams/${data.id}`);
}

export async function updateTeamAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const user = await requireStaff();

  if (!canManageTeams(user.roles)) {
    return { ok: false, message: "Only administrators can edit teams." };
  }

  const teamId = text(formData, "teamId");
  if (!teamId) return { ok: false, message: "Missing team reference." };

  const parsed = teamSchema.safeParse(readTeamForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  const v = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("teams")
    .update({
      name: v.name,
      age_group: v.ageGroup,
      gender: v.gender,
      season_id: v.seasonId ?? null,
      description: v.description || null,
      min_age: v.minAge ?? null,
      max_age: v.maxAge ?? null,
      is_active: v.isActive ?? true,
    })
    .eq("id", teamId)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return {
        ok: false,
        message: "A team with that name already exists in this season.",
        fieldErrors: { name: "Already in use" },
      };
    }
    return { ok: false, message: error.message };
  }

  // No row back means RLS filtered the update out.
  if (!data) {
    return { ok: false, message: "You do not have permission to edit this team." };
  }

  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "team.update",
    entity: "teams",
    entity_id: teamId,
    metadata: { name: v.name },
  });

  revalidatePath("/dashboard/teams");
  revalidatePath(`/dashboard/teams/${teamId}`);
  redirect(`/dashboard/teams/${teamId}`);
}

/**
 * Adds a player to a team's roster.
 *
 * team_players has no unique constraint on (team_id, player_id) because the
 * table records history — a player may legitimately rejoin a team later. So
 * the duplicate check has to happen here: reject only when an *open* spell
 * already exists.
 */
export async function addToRosterAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const user = await requireStaff();

  if (!canManageRoster(user.roles)) {
    return { ok: false, message: "Only administrators can change rosters." };
  }

  const parsed = rosterAddSchema.safeParse({
    teamId: text(formData, "teamId"),
    playerId: text(formData, "playerId"),
  });

  if (!parsed.success) {
    return { ok: false, message: "Select a player to add." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("team_players")
    .select("id")
    .eq("team_id", parsed.data.teamId)
    .eq("player_id", parsed.data.playerId)
    .is("left_at", null)
    .maybeSingle();

  if (existing) {
    return { ok: false, message: "That player is already on this roster." };
  }

  const { error } = await supabase.from("team_players").insert({
    team_id: parsed.data.teamId,
    player_id: parsed.data.playerId,
  });

  if (error) return { ok: false, message: error.message };

  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "roster.add",
    entity: "team_players",
    entity_id: parsed.data.teamId,
    metadata: { player_id: parsed.data.playerId },
  });

  revalidatePath(`/dashboard/teams/${parsed.data.teamId}`);
  return { ok: true, message: "Player added to the roster." };
}

/**
 * Ends a player's spell with a team.
 *
 * Sets left_at rather than deleting the row, so past rosters stay answerable —
 * "who played U16 last season" is a question the academy will ask.
 */
export async function removeFromRosterAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const user = await requireStaff();

  if (!canManageRoster(user.roles)) {
    return { ok: false, message: "Only administrators can change rosters." };
  }

  const parsed = rosterRemoveSchema.safeParse({
    teamId: text(formData, "teamId"),
    membershipId: text(formData, "membershipId"),
  });

  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("team_players")
    .update({ left_at: new Date().toISOString().slice(0, 10) })
    .eq("id", parsed.data.membershipId)
    .is("left_at", null)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "That player has already left." };

  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "roster.remove",
    entity: "team_players",
    entity_id: parsed.data.membershipId,
  });

  revalidatePath(`/dashboard/teams/${parsed.data.teamId}`);
  return { ok: true, message: "Player removed from the roster." };
}

export async function assignCoachAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const user = await requireStaff();

  if (!canAssignCoaches(user.roles)) {
    return { ok: false, message: "Only administrators can assign coaches." };
  }

  const parsed = coachAssignSchema.safeParse({
    teamId: text(formData, "teamId"),
    coachId: text(formData, "coachId"),
    isLead: formData.get("isLead") !== null,
  });

  if (!parsed.success) return { ok: false, message: "Select a coach to assign." };

  const supabase = await createClient();

  // unique (team_id, coach_id) covers the whole history, so a coach returning
  // to a team needs the existing row reopened rather than a new one inserted.
  const { data: previous } = await supabase
    .from("team_coaches")
    .select("id, unassigned_at")
    .eq("team_id", parsed.data.teamId)
    .eq("coach_id", parsed.data.coachId)
    .maybeSingle();

  if (previous && previous.unassigned_at === null) {
    return { ok: false, message: "That coach is already assigned to this team." };
  }

  const { error } = previous
    ? await supabase
        .from("team_coaches")
        .update({ unassigned_at: null, is_lead: parsed.data.isLead ?? false })
        .eq("id", previous.id)
    : await supabase.from("team_coaches").insert({
        team_id: parsed.data.teamId,
        coach_id: parsed.data.coachId,
        is_lead: parsed.data.isLead ?? false,
      });

  if (error) return { ok: false, message: error.message };

  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "team.assign_coach",
    entity: "team_coaches",
    entity_id: parsed.data.teamId,
    metadata: { coach_id: parsed.data.coachId },
  });

  revalidatePath(`/dashboard/teams/${parsed.data.teamId}`);
  return { ok: true, message: "Coach assigned." };
}

export async function unassignCoachAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const user = await requireStaff();

  if (!canAssignCoaches(user.roles)) {
    return { ok: false, message: "Only administrators can change coaches." };
  }

  const parsed = coachUnassignSchema.safeParse({
    teamId: text(formData, "teamId"),
    assignmentId: text(formData, "assignmentId"),
  });

  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("team_coaches")
    .update({ unassigned_at: new Date().toISOString() })
    .eq("id", parsed.data.assignmentId)
    .is("unassigned_at", null)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "That coach is already unassigned." };

  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "team.unassign_coach",
    entity: "team_coaches",
    entity_id: parsed.data.assignmentId,
  });

  revalidatePath(`/dashboard/teams/${parsed.data.teamId}`);
  return { ok: true, message: "Coach unassigned." };
}
