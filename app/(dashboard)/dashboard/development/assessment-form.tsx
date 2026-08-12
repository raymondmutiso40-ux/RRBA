"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createAssessmentAction,
  updateAssessmentAction,
} from "@/lib/development/actions";
import {
  emptyDevelopmentActionState,
  type DevelopmentActionState,
} from "@/lib/development/action-state";
import {
  SCORE_MAX,
  SCORE_MIN,
  compareCategories,
  scoreFieldName,
  skillCategoryLabel,
} from "@/lib/development/labels";
import type {
  AssessmentDetail,
  SkillMetric,
} from "@/lib/development/queries";

/**
 * Record or correct an assessment.
 *
 * One input per skill_metrics row rather than a fixed set of fields — the
 * academy can add a thirteenth skill by inserting a row, and this form picks it
 * up without a change.
 *
 * Every mark may be left blank. Not every session gives a coach a view of
 * everything, and a blank means the question was not answered, which the report
 * shows as such. Defaulting to a middle score would put a judgement in the
 * record that nobody made.
 */
export function AssessmentForm({
  playerId,
  playerName,
  metrics,
  assessment,
  previousScores,
}: {
  playerId: string;
  playerName: string;
  metrics: SkillMetric[];
  /** Present when correcting an existing assessment. */
  assessment?: AssessmentDetail;
  /** The previous assessment's marks, shown as context while scoring. */
  previousScores?: Map<string, number>;
}) {
  const isEditing = Boolean(assessment);

  const [state, formAction, isPending] = useActionState<
    DevelopmentActionState,
    FormData
  >(
    isEditing ? updateAssessmentAction : createAssessmentAction,
    emptyDevelopmentActionState,
  );

  const err = (name: string) => state.fieldErrors?.[name];

  const currentScores = new Map(
    (assessment?.scores ?? []).map((score) => [score.metric_id, score.score]),
  );

  // Grouped so the form reads the way a coach thinks — technical, then
  // athletic, then mental — rather than as twelve undifferentiated rows.
  const categories = [...new Set(metrics.map((metric) => metric.category))].sort(
    compareCategories,
  );

  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const localToday = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="playerId" value={playerId} />
      {assessment ? (
        <input type="hidden" name="assessmentId" value={assessment.id} />
      ) : null}

      {state.message && !state.ok ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Assessment</CardTitle>
          <CardDescription>
            {isEditing
              ? `Correcting the assessment of ${playerName}.`
              : `A snapshot of ${playerName} on one day. Recorded over time, these become the development record.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Input
            name="assessedOn"
            type="date"
            label="Assessed on"
            required
            max={localToday}
            defaultValue={assessment?.assessed_on ?? localToday}
            error={err("assessedOn")}
          />

          <Textarea
            name="summary"
            label="Summary"
            rows={3}
            maxLength={2000}
            className="sm:col-span-2"
            hint="Optional — what stood out, and what to work on next."
            defaultValue={assessment?.summary ?? ""}
            error={err("summary")}
          />
        </CardContent>
      </Card>

      {categories.map((category) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle>{skillCategoryLabel(category)}</CardTitle>
            <CardDescription>
              Marked out of {SCORE_MAX}. Leave a skill blank if you did not see
              it.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {metrics
              .filter((metric) => metric.category === category)
              .map((metric) => {
                const previous = previousScores?.get(metric.id);

                return (
                  <Input
                    key={metric.id}
                    name={scoreFieldName(metric.id)}
                    type="number"
                    inputMode="numeric"
                    min={SCORE_MIN}
                    max={SCORE_MAX}
                    step={1}
                    label={metric.label}
                    hint={
                      previous === undefined
                        ? undefined
                        : `Last time: ${previous}/${SCORE_MAX}`
                    }
                    defaultValue={currentScores.get(metric.id) ?? ""}
                    error={err(metric.id)}
                  />
                );
              })}
          </CardContent>
        </Card>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={isPending}>
          {isEditing ? "Save changes" : "Save assessment"}
        </Button>
        <Link href={`/dashboard/development/${playerId}`}>
          <Button type="button" variant="ghost">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
