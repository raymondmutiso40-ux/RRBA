/**
 * Display vocabulary for player development.
 *
 * Skills are rows in skill_metrics, not columns, so their labels come from the
 * database — the academy can add a thirteenth skill without a deploy. Only the
 * things the database does not carry live here: how a category is written out,
 * and how a 1–10 mark is rendered.
 */

export const SCORE_MIN = 1;
export const SCORE_MAX = 10;

/**
 * The form field carrying one skill's mark.
 *
 * There is one input per skill_metrics row, so the form's shape is data rather
 * than a fixed list — the action walks the entries looking for this prefix
 * instead of knowing the skills in advance.
 */
export function scoreFieldName(metricId: string): string {
  return `score:${metricId}`;
}

/** The categories the seeded metrics use, in the order they are shown. */
export const SKILL_CATEGORY_ORDER = ["technical", "athletic", "mental"] as const;

const SKILL_CATEGORY_LABELS: Record<string, string> = {
  technical: "Technical",
  athletic: "Athletic",
  mental: "Mental",
};

/**
 * A category's display name.
 *
 * Falls back to the stored value rather than to "Unknown": categories are free
 * text on skill_metrics, so one added by an administrator should read as itself
 * instead of disappearing behind a label this file happens not to know.
 */
export function skillCategoryLabel(category: string): string {
  return SKILL_CATEGORY_LABELS[category] ?? category;
}

/** Sorts categories into the known order, with any others after them. */
export function compareCategories(a: string, b: string): number {
  const known = SKILL_CATEGORY_ORDER as readonly string[];
  const ia = known.indexOf(a);
  const ib = known.indexOf(b);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.localeCompare(b);
}

/** How full a score's meter is drawn, as a percentage of the track. */
export function scoreFraction(score: number): number {
  return Math.max(0, Math.min(1, (score - 0) / SCORE_MAX));
}

/**
 * A change between two assessments, as a signed string.
 *
 * Returns null when there is nothing to compare against, which the caller
 * renders as blank rather than as "0" — no previous assessment is not the same
 * as no change.
 */
export function formatDelta(
  current: number,
  previous: number | null,
): string | null {
  if (previous === null) return null;
  const delta = current - previous;
  if (delta === 0) return "no change";
  return delta > 0 ? `+${delta}` : String(delta);
}

export function deltaTone(
  current: number,
  previous: number | null,
): "success" | "danger" | "neutral" {
  if (previous === null || current === previous) return "neutral";
  return current > previous ? "success" : "danger";
}

/** The average of a set of marks, or null when nothing was scored. */
export function averageScore(scores: number[]): number | null {
  if (scores.length === 0) return null;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

export function formatScore(value: number | null): string {
  return value === null ? "—" : value.toFixed(1);
}
