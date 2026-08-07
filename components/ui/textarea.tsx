import { forwardRef, useId } from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, hint, error, id, ...props }, ref) => {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const hintId = hint ? `${fieldId}-hint` : undefined;
    const errorId = error ? `${fieldId}-error` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label ? (
          <label htmlFor={fieldId} className="text-sm font-medium">
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

        <textarea
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={cn(hintId, errorId) || undefined}
          className={cn(
            "min-h-20 w-full rounded-lg border bg-[var(--surface)] px-3 py-2 text-sm",
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

Textarea.displayName = "Textarea";
