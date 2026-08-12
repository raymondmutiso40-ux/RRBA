import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ScoreMeter } from "@/components/development/score-meter";
import { getSessionUser } from "@/lib/auth/session";
import {
  canAssessPlayer,
  canAssessPlayers,
  canEditAssessment,
} from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getPlayer } from "@/lib/players/queries";
import {
  getCoachedPlayerIds,
  getPlayerDevelopment,
  listSkillMetrics,
} from "@/lib/development/queries";
import {
  SCORE_MAX,
  compareCategories,
  formatScore,
  skillCategoryLabel,
} from "@/lib/development/labels";
import { playerFullName } from "@/lib/players/labels";
import { formatDate, formatDateTime } from "@/lib/utils";

import { DevelopmentNoteForm } from "../note-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ playerId: string }>;
}): Promise<Metadata> {
  if (!isSupabaseConfigured()) return { title: "Development" };
  const { playerId } = await params;
  const player = await getPlayer(playerId);
  return { title: player ? `${playerFullName(player)} — development` : "Development" };
}

export default async function PlayerDevelopmentPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  if (!isSupabaseConfigured()) return null;

  const user = await getSessionUser();
  if (!user) return null;

  if (!canAssessPlayers(user.roles)) {
    return (
      <EmptyState
        title="No access to development"
        description="Player development is visible to administrators and coaches."
      />
    );
  }

  const { playerId } = await params;
  const player = await getPlayer(playerId);

  // RLS hides players outside the viewer's scope, so "not visible" and "does
  // not exist" are indistinguishable here — both are a 404.
  if (!player) notFound();

  const [{ assessments, notes }, metrics, coachedPlayerIds] = await Promise.all([
    getPlayerDevelopment(player.id),
    listSkillMetrics(),
    getCoachedPlayerIds(user.id),
  ]);

  const canWrite = canAssessPlayer(user.roles, player.id, coachedPlayerIds);

  const latest = assessments[0];
  const previous = assessments[1];

  const latestScores = new Map(
    (latest?.scores ?? []).map((score) => [score.metric_id, score.score]),
  );
  const previousScores = new Map(
    (previous?.scores ?? []).map((score) => [score.metric_id, score.score]),
  );

  const categories = [...new Set(metrics.map((metric) => metric.category))].sort(
    compareCategories,
  );

  const fullName = playerFullName(player);

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link
          href="/dashboard/development"
          className="text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
        >
          ← Development
        </Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{fullName}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--foreground-muted)]">
            {latest ? (
              <>
                <Badge tone="brand">
                  {formatScore(latest.average)}/{SCORE_MAX} average
                </Badge>
                <span>· last assessed {formatDate(latest.assessed_on)}</span>
                <span>
                  · {assessments.length} assessment
                  {assessments.length === 1 ? "" : "s"} on record
                </span>
              </>
            ) : (
              <span>No assessment on record yet.</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href={`/dashboard/players/${player.id}`}>
            <Button variant="ghost">Player profile</Button>
          </Link>
          {canWrite ? (
            <Link href={`/dashboard/development/${player.id}/assess`}>
              <Button>Record assessment</Button>
            </Link>
          ) : null}
        </div>
      </header>

      {!canWrite ? (
        <p className="text-sm text-[var(--foreground-muted)]">
          You are reading this record. Only a coach of one of this player&apos;s
          current teams can add to it.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Skills</CardTitle>
          <CardDescription>
            {latest
              ? previous
                ? `The assessment of ${formatDate(latest.assessed_on)}, with the change since ${formatDate(previous.assessed_on)}.`
                : `The assessment of ${formatDate(latest.assessed_on)}. A second one will show the change.`
              : "Nothing scored yet. The twelve skills below are what an assessment covers."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-3">
          {categories.map((category) => (
            <section key={category} className="flex flex-col gap-3">
              <h3 className="text-xs font-medium tracking-wide text-[var(--foreground-muted)] uppercase">
                {skillCategoryLabel(category)}
              </h3>
              {metrics
                .filter((metric) => metric.category === category)
                .map((metric) => (
                  <ScoreMeter
                    key={metric.id}
                    label={metric.label}
                    score={latestScores.get(metric.id) ?? null}
                    previous={previousScores.get(metric.id) ?? null}
                  />
                ))}
            </section>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Assessment history</CardTitle>
            <CardDescription>
              Every assessment on record, newest first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {assessments.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[var(--border-color)] p-6 text-center text-sm text-[var(--foreground-muted)]">
                No assessments yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {assessments.map((assessment) => {
                  const editable = canEditAssessment(
                    user.roles,
                    assessment.assessed_by,
                    user.id,
                    player.id,
                    coachedPlayerIds,
                  );

                  return (
                    <li
                      key={assessment.id}
                      className="flex flex-col gap-1 rounded-lg border border-[var(--border-color)] px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium">
                          {formatDate(assessment.assessed_on)}
                          <span className="ml-2 font-normal text-[var(--foreground-muted)]">
                            {formatScore(assessment.average)}/{SCORE_MAX} across{" "}
                            {assessment.scores.length} skill
                            {assessment.scores.length === 1 ? "" : "s"}
                          </span>
                        </span>
                        {editable ? (
                          <Link
                            href={`/dashboard/development/${player.id}/assess?edit=${assessment.id}`}
                            className="text-sm underline"
                          >
                            Edit
                          </Link>
                        ) : null}
                      </div>
                      <p className="text-xs text-[var(--foreground-muted)]">
                        by {assessment.assessor_name ?? "a former coach"}
                      </p>
                      {assessment.summary ? (
                        <p className="mt-1 text-sm whitespace-pre-wrap">
                          {assessment.summary}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Coach notes</CardTitle>
            <CardDescription>
              Observations between formal assessments.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {canWrite ? <DevelopmentNoteForm playerId={player.id} /> : null}

            {notes.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[var(--border-color)] p-6 text-center text-sm text-[var(--foreground-muted)]">
                No notes yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {notes.map((note) => (
                  <li
                    key={note.id}
                    className="rounded-lg border border-[var(--border-color)] px-4 py-3"
                  >
                    <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                    <p className="mt-1.5 text-xs text-[var(--foreground-muted)]">
                      {note.coach_name ?? "A former coach"} ·{" "}
                      {formatDateTime(note.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
