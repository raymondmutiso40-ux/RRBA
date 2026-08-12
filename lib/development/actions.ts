"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth/session";
import {
  canAssessPlayer,
  canAssessPlayers,
  canEditAssessment,
} from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import { getCoachedPlayerIds } from "@/lib/development/queries";
import {
  assessmentSchema,
  assessmentScoreSchema,
  developmentNoteSchema,
} from "@/lib/validation/schemas";
import type { DevelopmentActionState } from "@/lib/development/action-state";
import type { TablesInsert } from "@/lib/supabase/types";

/**
 * Development mutations — assessments, their scores, and coach notes.
 *
 * The authority model is per-player: assessments_coach_write and
 * development_notes_coach_write both check coaches_player(player_id), so a
 * coach may only write about somebody on a team they currently coach. Each
 * action resolves that before writing, so a hand-crafted POST gets the same
 * answer as the UI.
 *
 * An assessment and its scores are two tables, and there is no transaction
 * across a PostgREST call. The order is deliberate: the parent row first, then
 * the scores. If the scores fail, what survives is an assessment with no marks
 * — visible, obviously incomplete, and fixable by editing it. The reverse order
 * is not possible, and deleting the parent to "roll back" would need a delete
 * policy coaches do not have.
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

type ParsedScores =
  | { ok: true; rows: { metricId: string; score: number }[] }
  | { ok: false; fieldErrors: Record<string, string> };

/**
 * Reads the marks off the form.
 *
 * A blank skill is skipped rather than defaulted. Not every session gives a
 * coach a view of everything — marking a player's vertical jump on a day nobody
 * jumped would be an invention, and a null simply means the question was not
 * answered, which is what the report shows.
 */
function readScores(formData: FormData): ParsedScores {
  const rows: { metricId: string; score: number }[] = [];
  const fieldErrors: Record<string, string> = {};

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("score:") || typeof value !== "string") continue;
    if (value === "") continue;

    const metricId = key.slice("score:".length);
    const parsed = assessmentScoreSchema.safeParse({
      metricId,
      score: Number(value),
    });

    if (!parsed.success) {
      fieldErrors[metricId] = parsed.error.issues[0]?.message ?? "1–10";
      continue;
    }

    rows.push(parsed.data);
  }

  return Object.keys(fieldErrors).length > 0
    ? { ok: false, fieldErrors }
    : { ok: true, rows };
}

// ---------------------------------------------------------------------------
// Assessments
// ---------------------------------------------------------------------------

export async function createAssessmentAction(
  _prev: DevelopmentActionState,
  formData: FormData,
): Promise<DevelopmentActionState> {
  const user = await requireStaff();

  if (!canAssessPlayers(user.roles)) {
    return { ok: false, message: "Your role does not include assessments." };
  }

  const parsed = assessmentSchema.safeParse({
    playerId: text(formData, "playerId"),
    assessedOn: text(formData, "assessedOn"),
    eventId: nullableText(formData, "eventId"),
    summary: text(formData, "summary"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  const v = parsed.data;
  const coachedPlayerIds = await getCoachedPlayerIds(user.id);

  if (!canAssessPlayer(user.roles, v.playerId, coachedPlayerIds)) {
    return {
      ok: false,
      message: "You can only assess players on teams you coach.",
    };
  }

  const scores = readScores(formData);
  if (!scores.ok) {
    return {
      ok: false,
      message: "Every mark must be a whole number from 1 to 10.",
      fieldErrors: scores.fieldErrors,
    };
  }

  if (scores.rows.length === 0) {
    return { ok: false, message: "Score at least one skill." };
  }

  const supabase = await createClient();

  const { data: assessment, error } = await supabase
    .from("assessments")
    .insert({
      player_id: v.playerId,
      // Read from the session rather than the form: assessments_coach_update
      // keys off assessed_by, so letting a form set it would let somebody file
      // an assessment under a colleague's name.
      assessed_by: user.id,
      event_id: v.eventId ?? null,
      assessed_on: v.assessedOn,
      summary: v.summary || null,
    })
    .select("id")
    .single();

  if (error || !assessment) {
    return {
      ok: false,
      message: error?.message ?? "Could not save the assessment.",
    };
  }

  const scoreRows: TablesInsert<"assessment_scores">[] = scores.rows.map(
    (row) => ({
      assessment_id: assessment.id,
      metric_id: row.metricId,
      score: row.score,
    }),
  );

  const { error: scoreError } = await supabase
    .from("assessment_scores")
    .insert(scoreRows);

  if (scoreError) {
    return {
      ok: false,
      message:
        `The assessment was saved but its marks were not: ${scoreError.message}. ` +
        "Open it and enter them again.",
    };
  }

  await recordAudit({
    action: "assessment.create",
    entity: "assessments",
    entityId: assessment.id,
    metadata: { player_id: v.playerId, skills: scoreRows.length },
  });

  revalidatePath("/dashboard/development");
  revalidatePath(`/dashboard/development/${v.playerId}`);
  redirect(`/dashboard/development/${v.playerId}`);
}

export async function updateAssessmentAction(
  _prev: DevelopmentActionState,
  formData: FormData,
): Promise<DevelopmentActionState> {
  const user = await requireStaff();

  if (!canAssessPlayers(user.roles)) {
    return { ok: false, message: "Your role does not include assessments." };
  }

  const assessmentId = text(formData, "assessmentId");
  if (!assessmentId) {
    return { ok: false, message: "Missing assessment reference." };
  }

  const parsed = assessmentSchema.safeParse({
    playerId: text(formData, "playerId"),
    assessedOn: text(formData, "assessedOn"),
    eventId: nullableText(formData, "eventId"),
    summary: text(formData, "summary"),
  });

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
    .from("assessments")
    .select("id, player_id, assessed_by")
    .eq("id", assessmentId)
    .maybeSingle();

  if (!existing) {
    return { ok: false, message: "That assessment no longer exists." };
  }

  const coachedPlayerIds = await getCoachedPlayerIds(user.id);

  if (
    !canEditAssessment(
      user.roles,
      existing.assessed_by,
      user.id,
      existing.player_id,
      coachedPlayerIds,
    )
  ) {
    return {
      ok: false,
      message:
        "You can only change an assessment you wrote, for a player you coach.",
    };
  }

  const scores = readScores(formData);
  if (!scores.ok) {
    return {
      ok: false,
      message: "Every mark must be a whole number from 1 to 10.",
      fieldErrors: scores.fieldErrors,
    };
  }

  const { error } = await supabase
    .from("assessments")
    .update({
      assessed_on: v.assessedOn,
      event_id: v.eventId ?? null,
      summary: v.summary || null,
    })
    .eq("id", assessmentId);

  if (error) return { ok: false, message: error.message };

  if (scores.rows.length > 0) {
    const { error: scoreError } = await supabase
      .from("assessment_scores")
      .upsert(
        scores.rows.map((row) => ({
          assessment_id: assessmentId,
          metric_id: row.metricId,
          score: row.score,
        })),
        { onConflict: "assessment_id,metric_id" },
      );

    if (scoreError) return { ok: false, message: scoreError.message };
  }

  await recordAudit({
    action: "assessment.update",
    entity: "assessments",
    entityId: assessmentId,
    metadata: { player_id: existing.player_id, skills: scores.rows.length },
  });

  revalidatePath("/dashboard/development");
  revalidatePath(`/dashboard/development/${existing.player_id}`);
  redirect(`/dashboard/development/${existing.player_id}`);
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

/**
 * Adds an observation between formal assessments.
 *
 * coach_id comes from the session, not the form: development_notes_coach_write
 * requires `coach_id = auth.uid()`, so a note always carries the name of whoever
 * actually wrote it.
 */
export async function addDevelopmentNoteAction(
  _prev: DevelopmentActionState,
  formData: FormData,
): Promise<DevelopmentActionState> {
  const user = await requireStaff();

  if (!canAssessPlayers(user.roles)) {
    return { ok: false, message: "Your role does not include development." };
  }

  const parsed = developmentNoteSchema.safeParse({
    playerId: text(formData, "playerId"),
    note: text(formData, "note"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  const v = parsed.data;
  const coachedPlayerIds = await getCoachedPlayerIds(user.id);

  if (!canAssessPlayer(user.roles, v.playerId, coachedPlayerIds)) {
    return {
      ok: false,
      message: "You can only write notes on players from teams you coach.",
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("development_notes").insert({
    player_id: v.playerId,
    coach_id: user.id,
    note: v.note,
  });

  if (error) return { ok: false, message: error.message };

  await recordAudit({
    action: "development.note",
    entity: "development_notes",
    entityId: v.playerId,
    metadata: { player_id: v.playerId },
  });

  revalidatePath(`/dashboard/development/${v.playerId}`);
  return { ok: true, message: "Note added." };
}
