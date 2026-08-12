import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";
import { averageScore, compareCategories } from "@/lib/development/labels";

/**
 * Development reads — assessments, skill scores, and coach notes.
 *
 * Two things shape every query here:
 *
 *  1. Skills are rows, not columns. A score is (assessment_id, metric_id,
 *     score), so "ball handling over time" is a filter rather than a schema
 *     change, and the academy can add a thirteenth skill by inserting one row.
 *  2. RLS decides whose records come back. assessments_read and
 *     development_notes_read already narrow to the caller's own children, the
 *     players they coach, or everything for an admin — so a bug here shows
 *     somebody too little rather than too much.
 */

export type SkillMetric = Tables<"skill_metrics">;
export type Assessment = Tables<"assessments">;
export type DevelopmentNote = Tables<"development_notes">;

/** The assessable skills, in the order the form and the report show them. */
export async function listSkillMetrics(): Promise<SkillMetric[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("skill_metrics")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  if (error) throw new Error(`Could not load the skills: ${error.message}`);

  return (data ?? []).sort((a, b) => {
    const byCategory = compareCategories(a.category, b.category);
    return byCategory !== 0 ? byCategory : a.sort_order - b.sort_order;
  });
}

/** Players on teams this coach currently coaches — the ones they may assess. */
export async function getCoachedPlayerIds(coachId: string): Promise<string[]> {
  const supabase = await createClient();

  const { data: teams } = await supabase
    .from("team_coaches")
    .select("team_id")
    .eq("coach_id", coachId)
    .is("unassigned_at", null);

  const teamIds = (teams ?? []).map((row) => row.team_id);
  if (teamIds.length === 0) return [];

  const { data } = await supabase
    .from("team_players")
    .select("player_id")
    .in("team_id", teamIds)
    .is("left_at", null);

  return [...new Set((data ?? []).map((row) => row.player_id))];
}

export type DevelopmentRow = {
  player_id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
  team_name: string | null;
  assessment_count: number;
  last_assessed_on: string | null;
  /** Mean of every skill scored in the most recent assessment. */
  latest_average: number | null;
  /** The same figure from the assessment before it, for the trend. */
  previous_average: number | null;
  note_count: number;
};

export type DevelopmentListParams = {
  teamId?: string;
  /** Only players with no assessment on record. */
  unassessedOnly?: boolean;
};

/**
 * The development overview: every visible player and where they stand.
 *
 * Built from the players list outward rather than from assessments inward, so a
 * player who has never been assessed still appears — they are precisely the
 * ones a coach needs to find, and an assessment-first query would hide them.
 */
export async function listDevelopment(
  params: DevelopmentListParams = {},
): Promise<DevelopmentRow[]> {
  const supabase = await createClient();

  let playerQuery = supabase
    .from("players")
    .select("id, first_name, last_name, jersey_number")
    .in("status", ["active", "applicant"]);

  if (params.teamId) {
    const { data: members } = await supabase
      .from("team_players")
      .select("player_id")
      .eq("team_id", params.teamId)
      .is("left_at", null);

    const ids = (members ?? []).map((row) => row.player_id);
    if (ids.length === 0) return [];
    playerQuery = playerQuery.in("id", ids);
  }

  const { data: players, error } = await playerQuery.order("last_name");

  if (error) throw new Error(`Could not load players: ${error.message}`);
  if ((players ?? []).length === 0) return [];

  const playerIds = (players ?? []).map((player) => player.id);

  const [assessmentsResult, notesResult, membershipResult] = await Promise.all([
    supabase
      .from("assessments")
      .select("id, player_id, assessed_on, assessment_scores (score)")
      .in("player_id", playerIds)
      .order("assessed_on", { ascending: false }),
    supabase
      .from("development_notes")
      .select("player_id")
      .in("player_id", playerIds),
    supabase
      .from("team_players")
      .select("player_id, teams (name)")
      .in("player_id", playerIds)
      .is("left_at", null),
  ]);

  type JoinedAssessment = {
    id: string;
    player_id: string;
    assessed_on: string;
    assessment_scores: { score: number }[] | null;
  };

  // Newest first from the query, so the first two seen per player are the
  // latest and the one before it.
  const byPlayer = new Map<string, JoinedAssessment[]>();

  for (const row of (assessmentsResult.data ??
    []) as unknown as JoinedAssessment[]) {
    const list = byPlayer.get(row.player_id) ?? [];
    list.push(row);
    byPlayer.set(row.player_id, list);
  }

  const noteCounts = new Map<string, number>();
  for (const row of notesResult.data ?? []) {
    noteCounts.set(row.player_id, (noteCounts.get(row.player_id) ?? 0) + 1);
  }

  type JoinedMembership = {
    player_id: string;
    teams: { name: string } | null;
  };

  const teamNames = new Map<string, string>();
  for (const row of (membershipResult.data ??
    []) as unknown as JoinedMembership[]) {
    if (row.teams && !teamNames.has(row.player_id)) {
      teamNames.set(row.player_id, row.teams.name);
    }
  }

  const rows = (players ?? []).map((player) => {
    const assessments = byPlayer.get(player.id) ?? [];
    const latest = assessments[0];
    const previous = assessments[1];

    const meanOf = (assessment: JoinedAssessment | undefined) =>
      assessment
        ? averageScore((assessment.assessment_scores ?? []).map((s) => s.score))
        : null;

    return {
      player_id: player.id,
      first_name: player.first_name,
      last_name: player.last_name,
      jersey_number: player.jersey_number,
      team_name: teamNames.get(player.id) ?? null,
      assessment_count: assessments.length,
      last_assessed_on: latest?.assessed_on ?? null,
      latest_average: meanOf(latest),
      previous_average: meanOf(previous),
      note_count: noteCounts.get(player.id) ?? 0,
    };
  });

  return params.unassessedOnly
    ? rows.filter((row) => row.assessment_count === 0)
    : rows;
}

export type AssessmentScore = {
  metric_id: string;
  score: number;
};

export type AssessmentDetail = Assessment & {
  assessor_name: string | null;
  scores: AssessmentScore[];
  average: number | null;
};

export type PlayerDevelopment = {
  assessments: AssessmentDetail[];
  notes: (DevelopmentNote & { coach_name: string | null })[];
};

/**
 * One player's full development record, newest first.
 *
 * Assessments and their scores come back together: a report that showed an
 * assessment without its marks would be an empty row, and there are only ever a
 * handful per player.
 */
export async function getPlayerDevelopment(
  playerId: string,
): Promise<PlayerDevelopment> {
  const supabase = await createClient();

  const [assessmentsResult, notesResult] = await Promise.all([
    supabase
      .from("assessments")
      .select(
        "*, profiles (full_name), assessment_scores (metric_id, score)",
      )
      .eq("player_id", playerId)
      .order("assessed_on", { ascending: false }),
    supabase
      .from("development_notes")
      .select("*, profiles (full_name)")
      .eq("player_id", playerId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  type JoinedAssessment = Assessment & {
    profiles: { full_name: string } | null;
    assessment_scores: AssessmentScore[] | null;
  };

  const assessments = ((assessmentsResult.data ??
    []) as unknown as JoinedAssessment[]).map((row) => {
    const { profiles, assessment_scores, ...assessment } = row;
    const scores = assessment_scores ?? [];
    return {
      ...assessment,
      assessor_name: profiles?.full_name ?? null,
      scores,
      average: averageScore(scores.map((score) => score.score)),
    };
  });

  type JoinedNote = DevelopmentNote & {
    profiles: { full_name: string } | null;
  };

  const notes = ((notesResult.data ?? []) as unknown as JoinedNote[]).map(
    (row) => {
      const { profiles, ...note } = row;
      return { ...note, coach_name: profiles?.full_name ?? null };
    },
  );

  return { assessments, notes };
}

/** A single assessment, for the edit form. */
export async function getAssessment(
  id: string,
): Promise<AssessmentDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("assessments")
    .select("*, profiles (full_name), assessment_scores (metric_id, score)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Could not load the assessment: ${error.message}`);
  if (!data) return null;

  type Joined = Assessment & {
    profiles: { full_name: string } | null;
    assessment_scores: AssessmentScore[] | null;
  };

  const { profiles, assessment_scores, ...assessment } = data as unknown as Joined;
  const scores = assessment_scores ?? [];

  return {
    ...assessment,
    assessor_name: profiles?.full_name ?? null,
    scores,
    average: averageScore(scores.map((score) => score.score)),
  };
}

export type SkillTrendPoint = {
  assessed_on: string;
  score: number;
};

/**
 * Each skill's history for one player, oldest first.
 *
 * Keyed by metric id so the report can walk skill_metrics in its own order and
 * look each one up, rather than depending on what happened to be scored.
 */
export function skillTrends(
  assessments: AssessmentDetail[],
): Map<string, SkillTrendPoint[]> {
  const trends = new Map<string, SkillTrendPoint[]>();

  // getPlayerDevelopment returns newest first; a trend reads the other way.
  for (const assessment of [...assessments].reverse()) {
    for (const score of assessment.scores) {
      const points = trends.get(score.metric_id) ?? [];
      points.push({ assessed_on: assessment.assessed_on, score: score.score });
      trends.set(score.metric_id, points);
    }
  }

  return trends;
}
