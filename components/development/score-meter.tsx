import {
  SCORE_MAX,
  deltaTone,
  formatDelta,
  scoreFraction,
} from "@/lib/development/labels";

/**
 * One skill's mark, drawn as a meter.
 *
 * A single value against a fixed limit is a meter, not a chart — and the fill
 * is one hue getting fuller rather than a red-amber-green scale. A 4 out of 10
 * in a twelve-year-old's vertical jump is a development area, not a fault, and
 * painting it red tells the player and their parents something the academy does
 * not mean. The track is a lighter step of the same brand ramp so the state
 * reads across the whole bar.
 *
 * The number is always rendered beside it, so colour is never the only channel
 * carrying the value.
 */
export function ScoreMeter({
  label,
  score,
  previous = null,
}: {
  label: string;
  /** null when this skill was not marked in the assessment being shown. */
  score: number | null;
  /** The same skill's mark in the previous assessment, where there is one. */
  previous?: number | null;
}) {
  const delta = score === null ? null : formatDelta(score, previous);
  const tone = score === null ? "neutral" : deltaTone(score, previous);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm">{label}</span>
        <span className="flex items-baseline gap-2">
          {delta ? (
            <span
              className={
                "text-xs " +
                (tone === "success"
                  ? "text-[var(--color-success)]"
                  : tone === "danger"
                    ? "text-[var(--color-danger)]"
                    : "text-[var(--foreground-muted)]")
              }
            >
              {delta}
            </span>
          ) : null}
          <span className="text-sm font-medium tabular-nums">
            {score === null ? "—" : `${score}/${SCORE_MAX}`}
          </span>
        </span>
      </div>

      {score === null ? (
        <div
          className="h-2 rounded-full bg-[var(--surface-muted)]"
          aria-hidden="true"
        />
      ) : (
        <div
          role="meter"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={SCORE_MAX}
          aria-label={`${label}: ${score} out of ${SCORE_MAX}`}
          className="h-2 overflow-hidden rounded-full bg-[var(--color-brand-100)]"
        >
          <div
            className="h-full rounded-full bg-[var(--color-brand-600)]"
            style={{ width: `${scoreFraction(score) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
