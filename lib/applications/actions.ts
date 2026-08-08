"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  applicationReviewSchema,
  applicationSchema,
} from "@/lib/validation/schemas";
import type { ApplicationActionState } from "@/lib/applications/action-state";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullable(formData: FormData, key: string): string | null {
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
 * Public enrolment submission.
 *
 * The only action an anonymous visitor can invoke. It writes nothing but the
 * applicant's own details: status, reviewer and created_player_id are left to
 * their defaults, and the RLS insert policy rejects the row if any of them is
 * set, so a crafted request cannot self-approve.
 */
export async function submitApplicationAction(
  _prev: ApplicationActionState,
  formData: FormData,
): Promise<ApplicationActionState> {
  const parsed = applicationSchema.safeParse({
    playerFirstName: text(formData, "playerFirstName"),
    playerLastName: text(formData, "playerLastName"),
    dateOfBirth: text(formData, "dateOfBirth"),
    gender: text(formData, "gender") || "undisclosed",
    position: nullable(formData, "position"),
    school: text(formData, "school"),
    previousExperience: text(formData, "previousExperience"),
    guardianName: text(formData, "guardianName"),
    guardianRelationship: text(formData, "guardianRelationship") || "parent",
    guardianPhone: text(formData, "guardianPhone"),
    guardianEmail: text(formData, "guardianEmail"),
    guardianAltPhone: text(formData, "guardianAltPhone"),
    programInterest: text(formData, "programInterest"),
    medicalNotes: text(formData, "medicalNotes"),
    heardAboutUs: text(formData, "heardAboutUs"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  const v = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.from("applications").insert({
    player_first_name: v.playerFirstName,
    player_last_name: v.playerLastName,
    date_of_birth: v.dateOfBirth,
    gender: v.gender,
    position: v.position ?? null,
    school: v.school || null,
    previous_experience: v.previousExperience || null,
    guardian_name: v.guardianName,
    guardian_relationship: v.guardianRelationship,
    guardian_phone: v.guardianPhone,
    guardian_email: v.guardianEmail || null,
    guardian_alt_phone: v.guardianAltPhone || null,
    program_interest: v.programInterest || null,
    medical_notes: v.medicalNotes || null,
    heard_about_us: v.heardAboutUs || null,
  });

  if (error) {
    return {
      ok: false,
      message: "Could not submit the application. Please try again.",
    };
  }

  revalidatePath("/dashboard/applications");

  return {
    ok: true,
    message:
      "Application received. We will be in touch to arrange a first session.",
  };
}

/**
 * Approves an application, creating the player, guardian and link rows.
 *
 * The work happens in the approve_application SQL function so all the inserts
 * share one transaction — a partial failure here would otherwise leave a
 * player with no guardian attached.
 */
export async function approveApplicationAction(
  _prev: ApplicationActionState,
  formData: FormData,
): Promise<ApplicationActionState> {
  const user = await requireStaff();

  const parsed = applicationReviewSchema.safeParse({
    applicationId: text(formData, "applicationId"),
    teamId: nullable(formData, "teamId"),
    reviewNotes: text(formData, "reviewNotes"),
  });

  if (!parsed.success) {
    return { ok: false, message: "Invalid review submission." };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("approve_application", {
    target_application: parsed.data.applicationId,
    assign_team: parsed.data.teamId ?? null,
    notes: parsed.data.reviewNotes || null,
  });

  if (error) {
    // The function raises a readable message for the cases that matter:
    // already reviewed, or not staff.
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard/applications");
  revalidatePath("/dashboard/players");

  return {
    ok: true,
    message: `Approved by ${user.fullName || user.email}. The player record has been created.`,
  };
}

/** Declines an application. The row is kept as a record of the decision. */
export async function declineApplicationAction(
  _prev: ApplicationActionState,
  formData: FormData,
): Promise<ApplicationActionState> {
  const user = await requireStaff();

  const parsed = applicationReviewSchema.safeParse({
    applicationId: text(formData, "applicationId"),
    reviewNotes: text(formData, "reviewNotes"),
  });

  if (!parsed.success) {
    return { ok: false, message: "Invalid review submission." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("applications")
    .update({
      status: "declined",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_notes: parsed.data.reviewNotes || null,
    })
    // Guard on the current status so two reviewers cannot both decide.
    .eq("id", parsed.data.applicationId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, message: error.message };

  // Nothing updated means it was already decided by someone else.
  if (!data) {
    return {
      ok: false,
      message: "This application has already been reviewed.",
    };
  }

  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "application.decline",
    entity: "applications",
    entity_id: parsed.data.applicationId,
  });

  revalidatePath("/dashboard/applications");

  return { ok: true, message: "Application declined." };
}
