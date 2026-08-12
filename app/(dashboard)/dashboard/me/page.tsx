import Link from "next/link";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NoChildren, NotLinked } from "@/components/me/not-linked";
import { ScoreMeter } from "@/components/development/score-meter";
import { PlayerMatchRecord } from "@/components/matches/player-match-record";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getMyAttendance, getMyIdentity } from "@/lib/me/queries";
import { getPlayerMatchLines } from "@/lib/matches/queries";
import {
  getPlayerDevelopment,
  listSkillMetrics,
} from "@/lib/development/queries";
import {
  SCORE_MAX,
  compareCategories,
  formatScore,
  skillCategoryLabel,
} from "@/lib/development/labels";
import {
  ATTENDANCE_STATUS_LABELS,
  attendanceRate,
  formatRate,
  rateTone,
} from "@/lib/activity/labels";
import { POSITION_LABELS, PLAYER_STATUS_LABELS } from "@/lib/players/labels";
import { calculateAge, formatDate } from "@/lib/utils";
import type { BasketballPosition, PlayerStatus } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "My profile" };

export default async function MyProfilePage() {
  if (!isSupabaseConfigured()) return null;

  const user = await getSessionUser();
  if (!user) return null;

  const identity = await getMyIdentity(user.id);

  if (identity.kind === null) return <NotLinked what="profile" />;
  if (identity.players.length === 0) return <NoChildren />;

  const isGuardian = identity.kind === "guardian";

  /*
   * The development and match records come back through the family's own RLS
   * path — assessments_read and player_match_stats_read both admit
   * is_player() and guards_player() — so this is the same data a coach sees,
   * read under the family's own permission rather than handed to them.
   */
  const [attendance, metrics, records] = await Promise.all([
    getMyAttendance(identity.players),
    listSkillMetrics(),
    Promise.all(
      identity.players.map(async (player) => ({
        playerId: player.id,
        development: await getPlayerDevelopment(player.id),
        matchLines: await getPlayerMatchLines(player.id, 10),
      })),
    ),
  ]);

  const recordsByPlayer = new Map(
    records.map((record) => [record.playerId, record]),
  );

  const categories = [...new Set(metrics.map((metric) => metric.category))].sort(
    compareCategories,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isGuardian ? "My family" : "My profile"}
        </h1>
        <p className="text-sm text-[var(--foreground-muted)]">
          {isGuardian
            ? `Linked to ${identity.guardianName}. ${
                identity.players.length === 1
                  ? "One player"
                  : `${identity.players.length} players`
              } on your record.`
            : "Your record as the academy holds it."}
        </p>
      </div>

      {identity.players.map((player) => {
        const tally = attendance.get(player.id);
        const rate = tally ? attendanceRate(tally.counts) : null;

        const record = recordsByPlayer.get(player.id);
        const latest = record?.development.assessments[0];
        const previous = record?.development.assessments[1];

        const latestScores = new Map(
          (latest?.scores ?? []).map((score) => [score.metric_id, score.score]),
        );
        const previousScores = new Map(
          (previous?.scores ?? []).map((score) => [
            score.metric_id,
            score.score,
          ]),
        );

        return (
          <Card key={player.id}>
            <CardHeader>
              <CardTitle>
                {player.first_name} {player.last_name}
              </CardTitle>
              <CardDescription>
                {calculateAge(player.date_of_birth)} years old
                {player.jersey_number !== null
                  ? ` · shirt #${player.jersey_number}`
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <dl className="grid gap-3 sm:grid-cols-3">
                <Field label="Status">
                  <Badge tone="neutral">
                    {PLAYER_STATUS_LABELS[player.status as PlayerStatus] ??
                      player.status}
                  </Badge>
                </Field>
                <Field label="Position">
                  {player.position
                    ? (POSITION_LABELS[player.position as BasketballPosition] ??
                      player.position)
                    : "—"}
                </Field>
                <Field label="Attendance">
                  {tally ? (
                    <Badge tone={rateTone(rate)}>{formatRate(rate)}</Badge>
                  ) : (
                    <span className="text-sm text-[var(--foreground-muted)]">
                      Nothing recorded yet
                    </span>
                  )}
                </Field>
              </dl>

              <div>
                <p className="text-xs tracking-wide text-[var(--foreground-muted)] uppercase">
                  Teams
                </p>
                {player.teams.length === 0 ? (
                  <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                    Not on a team yet.
                  </p>
                ) : (
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {player.teams.map((team) => (
                      <li key={team.id}>
                        <Badge tone="brand">
                          {team.name} · {team.age_group}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {tally ? (
                <div>
                  <p className="text-xs tracking-wide text-[var(--foreground-muted)] uppercase">
                    Sessions
                  </p>
                  <dl className="mt-1 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {(["present", "late", "excused", "absent"] as const).map(
                      (status) => (
                        <div key={status}>
                          <dt className="text-xs text-[var(--foreground-muted)]">
                            {ATTENDANCE_STATUS_LABELS[status]}
                          </dt>
                          <dd className="text-lg font-semibold tabular-nums">
                            {tally.counts[status]}
                          </dd>
                        </div>
                      ),
                    )}
                  </dl>
                </div>
              ) : null}

              <div className="border-t border-[var(--border-color)] pt-4">
                <p className="flex flex-wrap items-baseline gap-2 text-xs tracking-wide text-[var(--foreground-muted)] uppercase">
                  Development
                  {latest ? (
                    <span className="normal-case">
                      · assessed {formatDate(latest.assessed_on)} ·{" "}
                      {formatScore(latest.average)}/{SCORE_MAX} average
                    </span>
                  ) : null}
                </p>

                {latest ? (
                  <>
                    <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {categories.map((category) => (
                        <section key={category} className="flex flex-col gap-3">
                          <h3 className="text-xs font-medium text-[var(--foreground-muted)]">
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
                    </div>

                    {latest.summary ? (
                      <p className="mt-4 text-sm whitespace-pre-wrap">
                        {latest.summary}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-[var(--foreground-muted)]">
                      Assessed by {latest.assessor_name ?? "a coach"}.
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                    No assessment yet. Coaches record these periodically across
                    twelve skills, and the marks appear here once they do.
                  </p>
                )}
              </div>

              <div className="border-t border-[var(--border-color)] pt-4">
                <p className="text-xs tracking-wide text-[var(--foreground-muted)] uppercase">
                  Match record
                </p>
                <div className="mt-3">
                  <PlayerMatchRecord
                    lines={record?.matchLines ?? []}
                    linkToMatch={false}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle>Something wrong?</CardTitle>
          <CardDescription>
            Contact the academy to correct anything on this page. Records are
            changed by staff so that the register and fees stay consistent.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 text-sm">
          <Link href="/dashboard/my-schedule" className="underline">
            My schedule
          </Link>
          <Link href="/dashboard/my-fees" className="underline">
            My fees
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-[var(--foreground-muted)] uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  );
}
