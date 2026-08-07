import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva("rounded-lg border px-4 py-3 text-sm", {
  variants: {
    tone: {
      info: "border-[var(--border-color)] bg-[var(--surface-muted)] text-[var(--foreground)]",
      success:
        "border-[color-mix(in_oklch,var(--color-success)_35%,transparent)] " +
        "bg-[color-mix(in_oklch,var(--color-success)_12%,transparent)] text-[var(--color-success)]",
      warning:
        "border-[color-mix(in_oklch,var(--color-warning)_35%,transparent)] " +
        "bg-[color-mix(in_oklch,var(--color-warning)_12%,transparent)] text-[var(--color-warning)]",
      danger:
        "border-[color-mix(in_oklch,var(--color-danger)_35%,transparent)] " +
        "bg-[color-mix(in_oklch,var(--color-danger)_10%,transparent)] text-[var(--color-danger)]",
    },
  },
  defaultVariants: { tone: "info" },
});

export interface AlertProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof alertVariants> {}

export function Alert({ className, tone, ...props }: AlertProps) {
  // role="alert" so errors are announced when they appear mid-form.
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(alertVariants({ tone }), className)}
      {...props}
    />
  );
}
