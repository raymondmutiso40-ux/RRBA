import { forwardRef, useId } from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends React.ComponentProps<"input"> {
  label?: string;
  /** Shown below the field and wired to aria-describedby. */
  hint?: string;
  /** Shown below the field, announced assertively, and sets aria-invalid. */
  error?: string;
}

/**
 * Text input with its label, hint, and error message wired together for
 * screen readers. Using this instead of a bare <input> is what keeps forms
 * accessible by default rather than by remembering to add aria attributes.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const hintId = hint ? `${inputId}-hint` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label ? (
          <label htmlFor={inputId} className="text-sm font-medium">
            {label}
            {props.required ? (
              <span className="ml-0.5 text-[var(--color-danger)]" aria-hidden="true">
                *
              </span>
            ) : null}
          </label>
        ) : null}

        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={cn(hintId, errorId) || undefined}
          className={cn(
            "h-10 w-full rounded-lg border bg-[var(--surface)] px-3 text-sm",
            "placeholder:text-[var(--foreground-muted)]",
            "disabled:cursor-not-allowed disabled:opacity-60",
            error
              ? "border-[var(--color-danger)]"
              : "border-[var(--border-color)]",
            className,
          )}
          {...props}
        />

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

Input.displayName = "Input";
