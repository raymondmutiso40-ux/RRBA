import { coachIds } from "@/lib/coaches/queries";
import { createClient } from "@/lib/supabase/server";
import type { AccountStatus } from "@/lib/supabase/types";

/**
 * Reads for the public-website admin area.
 *
 * The counterpart to lib/site/queries.ts: that module reads what the public can
 * see, this one reads the same tables as an administrator, drafts included. The
 * split is deliberate — a query written for the admin screen must never end up
 * rendering a public page, because it returns unpublished rows.
 *
 * "A coach" is a profile holding the coach role rather than a table, so the
 * list starts from user_roles by way of coachIds(), the same as the staff
 * directory.
 */

export type WebsiteCoach = {
  /** The profile id, and the primary key of the public profile row. */
  id: string;
  /** Account name, shown so an admin can tell whose profile this is. */
  fullName: string;
  email: string;
  /** Still holds the coach role. */
  isCoach: boolean;
  status: AccountStatus;
  /** False when no public profile row exists yet. */
  hasProfile: boolean;
  displayName: string;
  headline: string;
  bio: string | null;
  sortOrder: number;
  publishedAt: string | null;
};

/**
 * A profile that is on the public site while its owner is no longer an active
 * coach — role revoked, or account suspended or archived.
 *
 * Revoking a role does not unpublish anything: coach_public_profiles is read by
 * anon on published_at alone, and it has to be, since anon cannot see
 * user_roles to check. So this is the state the admin screen must surface
 * rather than hide.
 */
export function isStalePublication(coach: WebsiteCoach): boolean {
  return (
    coach.publishedAt !== null && (!coach.isCoach || coach.status !== "active")
  );
}

export type WebsiteSquad = {
  id: string;
  name: string;
  ageGroup: string;
  description: string | null;
  isPublic: boolean;
};

/**
 * Every coach whose profile an administrator may write, plus every profile that
 * already exists.
 *
 * Those two sets are not the same, and the difference is the point. Starting
 * only from current coaches would drop a profile the moment its owner lost the
 * role or was suspended — while the row stays published and the public page
 * keeps rendering it, because the anonymous read policy tests published_at and
 * nothing else. The profile would be live and simultaneously unreachable from
 * the only screen that can take it down.
 *
 * So the union is loaded, and isStalePublication() marks the ones that need
 * attention. Somebody who is not an active coach *and* has no profile is left
 * out: there is nothing to fix and no reason to offer to advertise them.
 */
export async function listWebsiteCoaches(): Promise<WebsiteCoach[]> {
  const supabase = await createClient();

  // Unfiltered: only admins reach this module, and every row is one that is
  // either published or drafted — including any whose owner has moved on.
  const [ids, publicResult] = await Promise.all([
    coachIds(supabase),
    supabase
      .from("coach_public_profiles")
      .select("coach_id, display_name, headline, bio, sort_order, published_at"),
  ]);

  // Raised rather than treated as "no profiles". A swallowed error here would
  // open the editor with the fallback values in every field, and saving that
  // form would overwrite a real biography with a blank one.
  if (publicResult.error) {
    throw new Error(
      `Could not load coach profiles: ${publicResult.error.message}`,
    );
  }

  const published = new Map(
    (publicResult.data ?? []).map((row) => [row.coach_id, row]),
  );

  const roleHolders = new Set(ids);
  const everyone = [...new Set([...ids, ...published.keys()])];
  if (everyone.length === 0) return [];

  const profilesResult = await supabase
    .from("profiles")
    .select("id, full_name, email, status")
    .in("id", everyone)
    .order("full_name");

  if (profilesResult.error) {
    throw new Error(`Could not load coaches: ${profilesResult.error.message}`);
  }

  const coaches = (profilesResult.data ?? [])
    .map((profile) => {
      const profileRow = published.get(profile.id);
      return {
        id: profile.id,
        fullName: profile.full_name,
        email: profile.email,
        isCoach: roleHolders.has(profile.id),
        status: profile.status,
        hasProfile: profileRow != null,
        // Falls back to the account name so the form opens with something
        // sensible rather than an empty required field.
        displayName: profileRow?.display_name ?? profile.full_name,
        headline: profileRow?.headline ?? "",
        bio: profileRow?.bio ?? null,
        sortOrder: profileRow?.sort_order ?? 0,
        publishedAt: profileRow?.published_at ?? null,
      };
    })
    .filter(
      (coach) =>
        coach.hasProfile || (coach.isCoach && coach.status === "active"),
    );

  // Published first, then by the order they appear on the site, so the list
  // reads in the same order a visitor sees.
  return coaches.sort((a, b) => {
    if ((a.publishedAt === null) !== (b.publishedAt === null)) {
      return a.publishedAt === null ? 1 : -1;
    }
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.displayName.localeCompare(b.displayName);
  });
}

export async function getWebsiteCoach(
  coachId: string,
): Promise<WebsiteCoach | null> {
  // One coach is rare enough a call that filtering the list is cheaper than a
  // second pair of queries that could drift from it.
  const coaches = await listWebsiteCoaches();
  return coaches.find((coach) => coach.id === coachId) ?? null;
}

/**
 * Active teams, with their publication flag.
 *
 * Inactive teams are left out: is_public only has an effect alongside
 * is_active (see the teams_public_read policy), so a toggle on a retired team
 * would do nothing visible and read as broken.
 */
export async function listWebsiteSquads(): Promise<WebsiteSquad[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("teams")
    .select("id, name, age_group, description, is_public")
    .eq("is_active", true)
    .order("age_group")
    .order("name");

  if (error) throw new Error(`Could not load teams: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    ageGroup: row.age_group,
    description: row.description,
    isPublic: row.is_public,
  }));
}
