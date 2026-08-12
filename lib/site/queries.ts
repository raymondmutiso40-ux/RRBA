import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Reads for the public site.
 *
 * Every query here runs for a visitor with no session, against the two
 * surfaces migration 011 opened to `anon`: published rows of
 * coach_public_profiles, and teams flagged is_public. Nothing else in the
 * schema is readable without signing in, so this module cannot leak a player,
 * a fee or a phone number even if it tried.
 *
 * The functions return empty arrays instead of throwing. A landing page that
 * 500s because the database is unreachable is worse than one that falls back
 * to its hard-coded copy — the whole point of the public site is that it is
 * the academy's advertisement, so it has to render. Callers treat "empty" as
 * "nothing published yet" and say so.
 */

export type PublicCoach = {
  id: string;
  displayName: string;
  headline: string;
  bio: string | null;
};

export type PublicSquad = {
  id: string;
  name: string;
  ageGroup: string;
  description: string | null;
  minAge: number | null;
  maxAge: number | null;
};

export async function listPublicCoaches(): Promise<PublicCoach[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();

  // No filter on published_at: the read policy is
  // `using (published_at is not null)`, so a draft is already unreachable for
  // an anonymous caller. Adding it here would matter for an admin browsing the
  // public page, who can see drafts through their own policy.
  const { data, error } = await supabase
    .from("coach_public_profiles")
    .select("coach_id, display_name, headline, bio")
    .not("published_at", "is", null)
    .order("sort_order", { ascending: true })
    .order("display_name", { ascending: true });

  if (error) return [];

  return (data ?? []).map((row) => ({
    id: row.coach_id,
    displayName: row.display_name,
    headline: row.headline,
    bio: row.bio,
  }));
}

export async function listPublicSquads(): Promise<PublicSquad[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();

  // is_public and is_active are both re-stated for the same reason as above:
  // they are the anonymous policy, but an admin reading this page holds
  // teams_read_authenticated (using true) and would otherwise see the
  // unpublished ones and think they were live.
  const { data, error } = await supabase
    .from("teams")
    .select("id, name, age_group, description, min_age, max_age")
    .eq("is_public", true)
    .eq("is_active", true)
    .order("age_group", { ascending: true })
    .order("name", { ascending: true });

  if (error) return [];

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    ageGroup: row.age_group,
    description: row.description,
    minAge: row.min_age,
    maxAge: row.max_age,
  }));
}

/** "Ages 10–13", or null when the squad records no range. */
export function ageRangeLabel(squad: PublicSquad): string | null {
  if (squad.minAge != null && squad.maxAge != null) {
    return `Ages ${squad.minAge}–${squad.maxAge}`;
  }
  if (squad.minAge != null) return `Ages ${squad.minAge}+`;
  if (squad.maxAge != null) return `Up to ${squad.maxAge}`;
  return null;
}
