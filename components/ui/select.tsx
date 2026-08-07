import { forwardRef, useId } from "react";

import { cn } from "@/lib/utils";

export interface SelectProps extends React.ComponentProps<"select"> {
  label?: string;
  hint?: string;
  error?: string;
}

/**
 * Select with label, hint, and error wired for screen readers — same
 * contract as Input, so forms stay accessible without per-field aria work.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, hint, error, id, children, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;
    const hintId = hint ? `${selectId}-hint` : undefined;
    const errorId = error ? `${selectId}-error` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label ? (
          <label htmlFor={selectId} className="text-sm font-medium">
            {label}
            {props.required ? (
              <span
                className="ml-0.5 text-[var(--color-danger)]"
                aria-hidden="true"
              >
                *
              </span>
            ) : null}
          </label>
        ) : null}

        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={cn(hintId, errorId) || undefined}
          className={cn(
            "h-10 w-full rounded-lg border bg-[var(--surface)] px-3 text-sm",
            "disabled:cursor-not-allowed disabled:opacity-60",
            error
              ? "border-[var(--color-danger)]"
              : "border-[var(--border-color)]",
            className,
          )}
          {...props}
        >
          {children}
        </select>

        {hint && !error ? (
          <p id={hintId} className="text-xs text-[var(--foreground-muted)]">
            {hint}
          </p>
        ) : null}

        {error ? (
          <p
            id={errorId}
            role="alert"
            className="text-xs text-[var(--color-danger)]"
          >
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);

Select.displayName = "Select";
