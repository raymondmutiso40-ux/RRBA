"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { setSquadVisibilityAction } from "@/lib/website/actions";
import {
  emptyWebsiteActionState,
  type WebsiteActionState,
} from "@/lib/website/action-state";

/**
 * Shows or hides one squad on the public site.
 *
 * A form rather than a checkbox: the change is a write to the database, and a
 * control that looks like a preference toggle invites the reader to expect a
 * separate save step. Success needs no message — the badge beside it changes,
 * which is the answer — so only failures are announced.
 */
export function SquadVisibilityToggle({
  teamId,
  name,
  isPublic,
}: {
  teamId: string;
  name: string;
  isPublic: boolean;
}) {
  const [state, formAction, isPending] = useActionState<
    WebsiteActionState,
    FormData
  >(setSquadVisibilityAction, emptyWebsiteActionState);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="isPublic" value={isPublic ? "false" : "true"} />

      <Button
        type="submit"
        variant={isPublic ? "outline" : "primary"}
        size="sm"
        loading={isPending}
      >
        {isPublic ? "Hide" : "Show on site"}
        <span className="sr-only"> — {name}</span>
      </Button>

      {!state.ok && state.message ? (
        <p role="alert" className="text-xs text-[var(--color-danger)]">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
