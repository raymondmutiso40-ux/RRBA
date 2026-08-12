import Link from "next/link";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * One headline figure.
 *
 * A single current value is a stat tile, not a one-bar chart — the number is
 * the point, and a bar adds an axis the reader has to decode to recover it.
 *
 * The tile links wherever the figure came from. A number a reader cannot act
 * on is decoration, and "37 active players" is only useful if it takes you to
 * the thirty-seven.
 */
export function StatTile({
  label,
  value,
  hint,
  href,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  /** A short qualifier under the value — a period, a caveat, a breakdown. */
  hint?: string;
  href?: string;
  /** Draws attention to a figure that means somebody has something to do. */
  tone?: "neutral" | "attention";
}) {
  const body = (
    <>
      <p className="text-xs tracking-wide text-[var(--foreground-muted)] uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-3xl font-semibold tracking-tight tabular-nums",
          tone === "attention" && "text-[var(--primary)]",
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-[var(--foreground-muted)]">{hint}</p>
      ) : null}
    </>
  );

  if (!href) {
    return <Card className="p-4">{body}</Card>;
  }

  return (
    <Card className="transition-colors hover:bg-[var(--surface-muted)]">
      <Link href={href} className="block p-4">
        {body}
      </Link>
    </Card>
  );
}
