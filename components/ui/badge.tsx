import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      tone: {
        neutral:
          "bg-[var(--surface-muted)] text-[var(--foreground-muted)] " +
          "border border-[var(--border-color)]",
        brand: "bg-[var(--color-brand-100)] text-[var(--color-brand-800)]",
        success: "bg-[color-mix(in_oklch,var(--color-success)_18%,transparent)] text-[var(--color-success)]",
        warning: "bg-[color-mix(in_oklch,var(--color-warning)_20%,transparent)] text-[var(--color-warning)]",
        danger: "bg-[color-mix(in_oklch,var(--color-danger)_15%,transparent)] text-[var(--color-danger)]",
        info: "bg-[color-mix(in_oklch,var(--color-info)_15%,transparent)] text-[var(--color-info)]",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
