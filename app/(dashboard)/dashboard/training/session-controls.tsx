"use client";

import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  addCallUpAction,
  removeCallUpAction,
  setSessionStatusAction,
} from "@/lib/activity/actions";
import {
  emptyActivityActionState,
  type ActivityActionState,
} from "@/lib/activity/action-state";
import type { RegisterEntry } from "@/lib/activity/queries";
import type { EventStatus } from "@/lib/supabase/types";

/** Completing or cancelling a session. */
export function SessionStatusControls({
  eventId,
  status,
}: {
  eventId: string;
  status: EventStatus;
}) {
  const [state, formAction, isPending] = useActionState<
    ActivityActionState,
    FormData
  >(setSessionStatusAction, emptyActivityActionState);

  const [submitted, setSubmitted] = useState<EventStatus | null>(null);

  const options: { next: EventStatus; label: string; variant: "primary" | "outline" | "ghost" }[] =
    [];

  if (status === "scheduled") {
    options.push({ next: "completed", label: "Mark completed", variant: "primary" });
    options.push({ next: "cancelled", label: "Cancel session", variant: "outline" });
  } else {
    // Reopening covers both a premature completion and a cancelled session that
    // went ahead anyway, so the register can still be marked.
    options.push({ next: "scheduled", label: "Reopen session", variant: "outline" });
    if (status === "cancelled") {
      options.push({ next: "completed", label: "Mark completed", variant: "ghost" });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {state.message ? (
        <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <form key={option.next} action={formAction}>
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="status" value={option.next} />
            <Button
              type="submit"
              size="sm"
              variant={option.variant}
              disabled={isPending}
              loading={isPending && submitted === option.next}
              onClick={() => setSubmitted(option.next)}
            >
              {option.label}
            </Button>
          </form>
        ))}
      </div>

      <p className="text-xs text-[var(--foreground-muted)]">
        Cancelling keeps the session and any register already marked against it.
        Cancelled sessions are left out of attendance rates rather than deleted.
      </p>
    </div>
  );
}

type Candidate = {
  id: string;
  first_name: string;
  last_name: string;
};

/**
 * Call-ups for one session.
 *
 * Worth being explicit about the consequence: with no call-ups the register is
 * the team's roster, and the first call-up makes the explicit list
 * authoritative instead. A coach adding one guest would otherwise appear to
 * lose their whole squad, so the warning below fires before that happens.
 */
export function SessionCallUps({
  eventId,
  entries,
  candidates,
  usesRoster,
}: {
  eventId: string;
  entries: RegisterEntry[];
  candidates: Candidate[];
  /** True while the register is coming from the team roster. */
  usesRoster: boolean;
}) {
  const [addState, addAction, adding] = useActionState<
    ActivityActionState,
    FormData
  >(addCallUpAction, emptyActivityActionState);

  const [removeState, removeAction, removing] = useActionState<
    ActivityActionState,
    FormData
  >(removeCallUpAction, emptyActivityActionState);

  const feedback = addState.message ? addState : removeState;
  const callUps = entries.filter((entry) => entry.is_call_up);

  return (
    <div className="flex flex-col gap-4">
      {feedback.message ? (
        <Alert tone={feedback.ok ? "success" : "danger"}>
          {feedback.message}
        </Alert>
      ) : null}

      {usesRoster ? (
        <Alert tone="warning">
          This register is currently the team&apos;s roster. Calling up one player
          replaces that with an explicit list, so you would then need to add
          everyone who is expected.
        </Alert>
      ) : null}

      <form action={addAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="eventId" value={eventId} />
        <div className="min-w-56 flex-1">
          <Select
            name="playerId"
            label="Call up a player"
            required
            disabled={candidates.length === 0}
          >
            <option value="">
              {candidates.length === 0
                ? "No available players"
                : "Select a player"}
            </option>
            {candidates.map((player) => (
              <option key={player.id} value={player.id}>
                {player.last_name}, {player.first_name}
              </option>
            ))}
          </Select>
        </div>
        <Button
          type="submit"
          loading={adding}
          disabled={candidates.length === 0 || removing}
        >
          Add
        </Button>
      </form>

      {callUps.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {callUps.map((entry) => (
            <li
              key={entry.player_id}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-color)] px-3 py-2 text-sm"
            >
              <span>
                {entry.last_name}, {entry.first_name}
              </span>
              <form action={removeAction}>
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="playerId" value={entry.player_id} />
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  disabled={adding || removing}
                >
                  Remove
                </Button>
              </form>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
