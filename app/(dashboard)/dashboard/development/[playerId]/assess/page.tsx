import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { EmptyState } from "@/components/ui/empty-state";
import { requireStaff } from "@/lib/auth/session";
import {
  canAssessPlayer,
  canAssessPlayers,
  canEditAssessment,
} from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getPlayer } from "@/lib/players/queries";
import {
  getAssessment,
  getCoachedPlayerIds,
  getPlayerDevelopment,
  listSkillMetrics,
} from "@/lib/development/queries";
import { playerFullName } from "@/lib/players/labels";

import { AssessmentForm } from "../../assessment-form";

export const metadata: Metadata = { title: "Record assessment" };

type SearchParams = { edit?: string };

export default async function AssessPlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ playerId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  if (!isSupabaseConfigured()) notFound();

  const user = await requireStaff();

  if (!canAssessPlayers(user.roles)) {
    return (
      <EmptyState
        title="Not allowed"
        description="Only administrators and coaches can record assessments."
        action={
          <Link href="/dashboard/development" className="text-sm underline">
            Back to development
          </Link>
        }
      />
    );
  }

  const { playerId } = await params;
  const player = await getPlayer(playerId);

  if (!player) notFound();

  const coachedPlayerIds = await getCoachedPlayerIds(user.id);

  if (!canAssessPlayer(user.roles, player.id, coachedPlayerIds)) {
    return (
      <EmptyState
        title="Not one of your players"
        description="You can only assess players on a team you currently coach. An administrator assigns coaches from the team page."
        action={
          <Link
            href={`/dashboard/development/${player.id}`}
            className="text-sm underline"
          >
            Back to their record
          </Link>
        }
      />
    );
  }

  const { edit } = await searchParams;

  const [metrics, existing, history] = await Promise.all([
    listSkillMetrics(),
    edit ? getAssessment(edit) : Promise.resolve(null),
    getPlayerDevelopment(player.id),
  ]);

  if (edit && !existing) notFound();

  if (
    existing &&
    !canEditAssessment(
      user.roles,
      existing.assessed_by,
      user.id,
      player.id,
      coachedPlayerIds,
    )
  ) {
    return (
      <EmptyState
        title="Not your assessment"
        description="You can only correct an assessment you wrote yourself. Record a new one instead — the history keeps both."
        action={
          <Link
            href={`/dashboard/development/${player.id}`}
            className="text-sm underline"
          >
            Back to their record
          </Link>
        }
      />
    );
  }

  // While correcting an assessment the useful comparison is the one before it;
  // while recording a new one it is the most recent.
  const reference = existing
    ? history.assessments.find(
        (assessment) => assessment.assessed_on < existing.assessed_on,
      )
    : history.assessments[0];

  const previousScores = new Map(
    (reference?.scores ?? []).map((score) => [score.metric_id, score.score]),
  );

  const fullName = playerFullName(player);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href={`/dashboard/development/${player.id}`}
          className="text-sm text-[var(--foreground-muted)] hover:underline"
        >
          ← {fullName}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {existing ? "Edit assessment" : "Record assessment"}
        </h1>
      </div>

      <AssessmentForm
        playerId={player.id}
        playerName={fullName}
        metrics={metrics}
        assessment={existing ?? undefined}
        previousScores={previousScores}
      />
    </div>
  );
}
