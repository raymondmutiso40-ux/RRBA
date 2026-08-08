import type { Gender } from "@/lib/supabase/types";

/** Categories a team can be listed under, in the order they appear in forms. */
export const TEAM_GENDERS: Gender[] = [
  "male",
  "female",
  "other",
  "undisclosed",
];

export const TEAM_GENDER_LABELS: Record<Gender, string> = {
  male: "Boys",
  female: "Girls",
  other: "Mixed",
  undisclosed: "Unspecified",
};

/**
 * Suggestions only — age_group is free text in the schema so the academy can
 * name its groups however it likes. These populate a datalist.
 */
export const AGE_GROUP_SUGGESTIONS = [
  "U8",
  "U10",
  "U12",
  "U14",
  "U16",
  "U18",
  "Senior",
];

/** Renders the optional min/max age bounds as a short human-readable range. */
export function teamAgeRange(team: {
  min_age: number | null;
  max_age: number | null;
}): string {
  const { min_age: min, max_age: max } = team;
  if (min != null && max != null) return `Ages ${min}–${max}`;
  if (min != null) return `Ages ${min} and up`;
  if (max != null) return `Up to age ${max}`;
  return "No age limits set";
}
