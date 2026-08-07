import { cn } from "@/lib/utils";

/**
 * Loading placeholder. Marked aria-hidden — the surrounding region should
 * carry aria-busy so assistive tech announces the load once, not per bar.
 */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-md bg-[var(--surface-muted)]",
        className,
      )}
      {...props}
    />
  );
}
