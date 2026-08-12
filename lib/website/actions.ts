"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth/session";
import { canManageWebsite } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  coachPublicProfileSchema,
  squadVisibilitySchema,
} from "@/lib/validation/schemas";
import type { WebsiteActionState } from "@/lib/website/action-state";

/**
 * Server actions for the public website.
 *
 * Each one re-checks canManageWebsite before touching anything. That check is
 * not what protects the data — coach_public_profiles_admin_all and the teams
 * write policies do that — but returning a clear refusal beats letting RLS
 * silently filter the write and reporting success for nothing.
 *
 * Every write is audited. Publishing a name and biography to the open internet
 * is exactly the kind of act the academy will later want attributed.
 */

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
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
 * Refreshes the admin screen and the public pages the change is visible on.
 *
 * The public pages read cookies through the Supabase client and so render per
 * request today, which makes these calls no-ops. They are here so that adding
 * caching to the public site later cannot leave a stale biography up.
 */
function revalidatePublicSite(extra?: string) {
  revalidatePath("/dashboard/website");
  if (extra) revalidatePath(extra);
  revalidatePath("/coaches");
  revalidatePath("/teams");
}

/**
 * Creates or updates a coach's biography.
 *
 * Never changes publication state: the payload omits published_at, so an
 * upsert onto an existing row leaves it exactly as it was. Editing the text of
 * a live profile updates the live profile; editing a draft leaves it a draft.
 */
export async function saveCoachProfileAction(
  _prev: WebsiteActionState,
  formData: FormData,
): Promise<WebsiteActionState> {
  const user = await requireStaff();

  if (!canManageWebsite(user.roles)) {
    return {
      ok: false,
      message: "Only administrators can edit the public website.",
    };
  }

  const coachId = text(formData, "coachId");
  if (!coachId) return { ok: false, message: "Missing coach reference." };

  const sortOrderRaw = text(formData, "sortOrder");
  const parsed = coachPublicProfileSchema.safeParse({
    displayName: text(formData, "displayName"),
    headline: text(formData, "headline"),
    bio: text(formData, "bio"),
    sortOrder: sortOrderRaw === "" ? null : Number(sortOrderRaw),
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

  // The coach_id is a profile id, and the FK only proves the profile exists —
  // a player's id would satisfy it just as well. So creating a row requires the
  // target to actually hold the coach role. Editing an existing one does not:
  // that is how a profile whose owner has since lost the role stays correctable
  // instead of frozen.
  const { data: existing } = await supabase
    .from("coach_public_profiles")
    .select("coach_id")
    .eq("coach_id", coachId)
    .maybeSingle();

  if (!existing) {
    const { data: role } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", coachId)
      .eq("role", "coach")
      .maybeSingle();

    if (!role) {
      return {
        ok: false,
        message:
          "That account does not hold the coach role, so it cannot have a coach profile.",
      };
    }
  }

  const { data, error } = await supabase
    .from("coach_public_profiles")
    .upsert(
      {
        coach_id: coachId,
        display_name: v.displayName,
        headline: v.headline || "",
        bio: v.bio || null,
        sort_order: v.sortOrder ?? 0,
      },
      { onConflict: "coach_id" },
    )
    .select("coach_id, published_at")
    .maybeSingle();

  if (error) return { ok: false, message: error.message };

  // No row back means RLS filtered the write out.
  if (!data) {
    return {
      ok: false,
      message: "You do not have permission to edit this profile.",
    };
  }

  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "website.coach_profile_save",
    entity: "coach_public_profiles",
    entity_id: coachId,
    metadata: {
      display_name: v.displayName,
      published: data.published_at !== null,
    },
  });

  revalidatePublicSite(`/dashboard/website/coaches/${coachId}`);

  return {
    ok: true,
    message:
      data.published_at !== null
        ? "Saved. The profile is live on the website."
        : "Saved as a draft. Publish it to put it on the website.",
  };
}

/**
 * Puts a biography on the public site, or takes it down.
 *
 * Requires the row to exist already, so the first act for a coach is always
 * writing the profile and the second is deciding to publish it. Publishing
 * cannot be the thing that creates an empty page.
 */
export async function setCoachProfilePublishedAction(
  _prev: WebsiteActionState,
  formData: FormData,
): Promise<WebsiteActionState> {
  const user = await requireStaff();

  if (!canManageWebsite(user.roles)) {
    return {
      ok: false,
      message: "Only administrators can publish to the website.",
    };
  }

  const coachId = text(formData, "coachId");
  if (!coachId) return { ok: false, message: "Missing coach reference." };

  const publish = text(formData, "publish") === "true";
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("coach_public_profiles")
    .update({ published_at: publish ? new Date().toISOString() : null })
    .eq("coach_id", coachId)
    .select("coach_id")
    .maybeSingle();

  if (error) return { ok: false, message: error.message };

  if (!data) {
    return {
      ok: false,
      message: "Write the profile first — there is nothing to publish yet.",
    };
  }

  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: publish ? "website.coach_publish" : "website.coach_unpublish",
    entity: "coach_public_profiles",
    entity_id: coachId,
  });

  revalidatePublicSite(`/dashboard/website/coaches/${coachId}`);

  return {
    ok: true,
    message: publish
      ? "Published. The profile is now on the website."
      : "Unpublished. The profile is no longer on the website.",
  };
}

/** Shows or hides a squad on the public site. */
export async function setSquadVisibilityAction(
  _prev: WebsiteActionState,
  formData: FormData,
): Promise<WebsiteActionState> {
  const user = await requireStaff();

  if (!canManageWebsite(user.roles)) {
    return {
      ok: false,
      message: "Only administrators can change the public website.",
    };
  }

  const parsed = squadVisibilitySchema.safeParse({
    teamId: text(formData, "teamId"),
    isPublic: text(formData, "isPublic") === "true",
  });

  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("teams")
    .update({ is_public: parsed.data.isPublic })
    .eq("id", parsed.data.teamId)
    .select("id, name")
    .maybeSingle();

  if (error) return { ok: false, message: error.message };

  if (!data) {
    return {
      ok: false,
      message: "You do not have permission to change this team.",
    };
  }

  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: parsed.data.isPublic ? "website.squad_show" : "website.squad_hide",
    entity: "teams",
    entity_id: parsed.data.teamId,
    metadata: { name: data.name },
  });

  revalidatePublicSite();

  return {
    ok: true,
    message: parsed.data.isPublic
      ? `${data.name} is now shown on the website.`
      : `${data.name} is hidden from the website.`,
  };
}
