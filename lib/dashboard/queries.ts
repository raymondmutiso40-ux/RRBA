import { createClient } from "@/lib/supabase/server";

/**
 * Dashboard reads.
 *
 * Everything here is a composition of the reads the feature areas already own,
 * plus the two counts that only the dashboard asks for. Nothing recomputes a
 * figure that has an authority elsewhere — outstanding money is
 * getFinanceSummary's answer via invoice_balances, the season record is
 * getMatchesSummary's — so a tile can never disagree with the page it links to.
 *
 * Every count is RLS-scoped without doing anything about it. A coach's "active
 * players" is the players on their teams, because that is what players_* lets
 * them select; the same query gives an admin the whole academy. The dashboard
 * does not need to know which it is talking to.
 */

/** Active teams, and players by the two statuses worth a tile. */
export async function getAcademyCounts(): Promise<{
  activePlayers: number;
  applicants: number;
  activeTeams: number;
}> {
  const supabase = await createClient();

  const [active, applicants, teams] = await Promise.all([
    supabase
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("status", "applicant"),
    supabase
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
  ]);

  return {
    activePlayers: active.count ?? 0,
    applicants: applicants.count ?? 0,
    activeTeams: teams.count ?? 0,
  };
}

/**
 * Players on the books with no assessment on record.
 *
 * Counted as a set difference rather than by walking the development list: the
 * dashboard only needs the number, and listDevelopment loads every player's
 * assessments and notes to build a table nobody is looking at yet.
 */
export async function countUnassessedPlayers(): Promise<number> {
  const supabase = await createClient();

  const [playersResult, assessedResult] = await Promise.all([
    supabase.from("players").select("id").in("status", ["active", "applicant"]),
    supabase.from("assessments").select("player_id"),
  ]);

  const assessed = new Set(
    (assessedResult.data ?? []).map((row) => row.player_id),
  );

  return (playersResult.data ?? []).filter((player) => !assessed.has(player.id))
    .length;
}
