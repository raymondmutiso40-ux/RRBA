import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Shown when a collection is legitimately empty — distinct from a loading
 * skeleton and from an error. Always offers the next action where one exists,
 * so an empty table is never a dead end.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border " +
          "border-dashed border-[var(--border-color)] px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="text-[var(--foreground-muted)]" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <p className="font-medium">{title}</p>
        {description ? (
          <p className="max-w-sm text-sm text-[var(--foreground-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
