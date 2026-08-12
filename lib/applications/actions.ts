"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth/session";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getSiteUrl, isServiceRoleConfigured } from "@/lib/supabase/config";
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
 * Public enrolment submission — the application *and* the parent's login.
 *
 * Applying used to leave the parent with no account, so enrolling meant doing
 * the job twice: this form, then /signup, then an administrator joining the two
 * by hand. One form now does all of it. The account is created here; approving
 * the application is what grants the guardian role and attaches the child (see
 * approve_application in migration 012).
 *
 * Three things this deliberately does not do:
 *
 *  - It does not say whether an email is already registered. A repeat parent
 *    enrolling a second child and a stranger probing for members get the same
 *    reply, so the form cannot be used to enumerate accounts.
 *  - It does not grant a role or activate the account. Both wait for staff
 *    approval, exactly as they did when an admin did this by hand, so anyone
 *    can create an account but nobody can self-enrol.
 *  - It does not fail the application when the account cannot be created. An
 *    enrolment is worth more than a login: the application is still recorded
 *    and the reply says what happened.
 */
export async function submitApplicationAction(
  _prev: ApplicationActionState,
  formData: FormData,
): Promise<ApplicationActionState> {
  const parsed = applicationSchema.safeParse({
    password: text(formData, "password"),
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

  const account = await resolveApplicantAccount(v.guardianEmail, {
    password: v.password,
    fullName: v.guardianName,
  });

  if (account.kind === "error") {
    return { ok: false, message: account.message };
  }

  // Everything the applicant typed, and nothing else. status, reviewed_by and
  // created_player_id are left to their defaults so the row cannot arrive
  // pre-approved.
  const row = {
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
    guardian_email: v.guardianEmail,
    guardian_alt_phone: v.guardianAltPhone || null,
    program_interest: v.programInterest || null,
    medical_notes: v.medicalNotes || null,
    heard_about_us: v.heardAboutUs || null,
  };

  // With an account to attach, the insert goes through the service role: the
  // public policy forbids submitted_by precisely so that a request cannot name
  // an account, which leaves the server as the only thing that may set it.
  // Without one, the ordinary anonymous path applies and RLS checks the row.
  const { error } = account.profileId
    ? await createAdminClient()
        .from("applications")
        .insert({ ...row, submitted_by: account.profileId })
    : await supabase.from("applications").insert(row);

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
      account.kind === "created"
        ? "Application received. Check your email for a link to confirm your " +
          "account — once the coach approves the application you will be able " +
          "to sign in and follow your child's progress."
        : "Application received. We will be in touch to arrange a first session.",
  };
}

type ApplicantAccount =
  /** A login was created or matched. profileId is null when signup returned no user. */
  | { kind: "created" | "existing" | "skipped"; profileId: string | null }
  /** Signup itself failed, and the applicant needs to know why. */
  | { kind: "error"; message: string };

/**
 * Finds or creates the login behind an application.
 *
 * An address that already has an account is reused rather than rejected — a
 * parent enrolling a second child is the common case, and refusing them would
 * be a dead end mid-enrolment. The existing password is neither checked nor
 * changed: this only establishes which account the application belongs to, and
 * that account gains nothing until staff approve.
 *
 * The lookup needs the service role, because profiles is readable only by staff
 * and the applicant is nobody yet. Where the key is absent the step is skipped
 * rather than failed, and the application is still taken.
 */
async function resolveApplicantAccount(
  email: string,
  details: { password: string; fullName: string },
): Promise<ApplicantAccount> {
  if (!isServiceRoleConfigured()) return { kind: "skipped", profileId: null };

  const { data: existing, error: lookupError } = await createAdminClient()
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  // A failed lookup must not conclude the address is free. Attaching nothing is
  // recoverable by hand; a duplicate account is not.
  if (lookupError) return { kind: "skipped", profileId: null };
  if (existing) return { kind: "existing", profileId: existing.id };

  // The ordinary client rather than the admin one, so this is the same signup
  // /signup performs and sends the same confirmation email. No role is passed:
  // handle_new_user creates the profile as pending with none, which is what
  // keeps enrolment from being self-service.
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password: details.password,
    options: {
      data: { full_name: details.fullName },
      emailRedirectTo: `${getSiteUrl()}/auth/callback`,
    },
  });

  if (error) {
    return { kind: "error", message: `Could not create your account: ${error.message}` };
  }

  return { kind: "created", profileId: data.user?.id ?? null };
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
