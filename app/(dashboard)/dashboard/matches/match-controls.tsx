"use client";

import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  addSquadMemberAction,
  recordMatchResultAction,
  removeSquadMemberAction,
  setMatchStatusAction,
} from "@/lib/matches/actions";
import {
  emptyMatchActionState,
  type MatchActionState,
} from "@/lib/matches/action-state";
import type { BoxScoreEntry, MatchDetail } from "@/lib/matches/queries";
import type { EventStatus } from "@/lib/supabase/types";

/**
 * The final score.
 *
 * Only two numbers are asked for. Whether that is a win, a loss or a draw
 * follows from them, so the server derives it rather than offering a third
 * field that could be set to contradict the first two.
 */
export function MatchResultForm({
  match,
  teamName,
}: {
  match: MatchDetail;
  teamName: string;
}) {
  const [state, formAction, isPending] = useActionState<
    MatchActionState,
    FormData
  >(recordMatchResultAction, emptyMatchActionState);

  const err = (name: string) => state.fieldErrors?.[name];
  const hasResult = match.result !== null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="eventId" value={match.id} />

      {state.message ? (
        <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          name="finalScoreTeam"
          type="number"
          inputMode="numeric"
          min={0}
          max={500}
          required
          label={teamName}
          defaultValue={match.final_score_team ?? ""}
          error={err("finalScoreTeam")}
        />
        <Input
          name="finalScoreOpp"
          type="number"
          inputMode="numeric"
          min={0}
          max={500}
          required
          label={match.opponent ?? "Opponent"}
          defaultValue={match.final_score_opp ?? ""}
          error={err("finalScoreOpp")}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={isPending}>
          {hasResult ? "Update result" : "Record result"}
        </Button>
        <p className="text-xs text-[var(--foreground-muted)]">
          Recording a result also marks the fixture completed.
        </p>
      </div>
    </form>
  );
}

/** Completing or cancelling a fixture. */
export function MatchStatusControls({
  eventId,
  status,
}: {
  eventId: string;
  status: EventStatus;
}) {
  const [state, formAction, isPending] = useActionState<
    MatchActionState,
    FormData
  >(setMatchStatusAction, emptyMatchActionState);

  const [submitted, setSubmitted] = useState<EventStatus | null>(null);

  const options: {
    next: EventStatus;
    label: string;
    variant: "primary" | "outline" | "ghost";
  }[] = [];

  if (status === "scheduled") {
    options.push({ next: "completed", label: "Mark played", variant: "primary" });
    options.push({ next: "cancelled", label: "Call off", variant: "outline" });
  } else {
    options.push({ next: "scheduled", label: "Reopen fixture", variant: "outline" });
    if (status === "cancelled") {
      options.push({ next: "completed", label: "Mark played", variant: "ghost" });
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
        Calling off a fixture keeps it, along with anything already recorded
        against it — a game abandoned at half time still has a box score worth
        keeping.
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
 * The matchday squad.
 *
 * Same rule as a training call-up: with nobody named, the box score is the
 * team's roster, and naming the first player replaces that with an explicit
 * squad. A coach adding one guest would otherwise appear to lose the rest of
 * the team, so the warning fires before that happens.
 */
export function MatchSquad({
  eventId,
  entries,
  candidates,
  usesRoster,
}: {
  eventId: string;
  entries: BoxScoreEntry[];
  candidates: Candidate[];
  usesRoster: boolean;
}) {
  const [addState, addAction, adding] = useActionState<
    MatchActionState,
    FormData
  >(addSquadMemberAction, emptyMatchActionState);

  const [removeState, removeAction, removing] = useActionState<
    MatchActionState,
    FormData
  >(removeSquadMemberAction, emptyMatchActionState);

  const feedback = addState.message ? addState : removeState;
  const named = entries.filter((entry) => entry.is_call_up);

  return (
    <div className="flex flex-col gap-4">
      {feedback.message ? (
        <Alert tone={feedback.ok ? "success" : "danger"}>
          {feedback.message}
        </Alert>
      ) : null}

      {usesRoster ? (
        <Alert tone="warning">
          The box score is currently the team&apos;s whole roster. Naming one
          player replaces that with an explicit squad, so you would then need to
          add everyone who played.
        </Alert>
      ) : null}

      <form action={addAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="eventId" value={eventId} />
        <div className="min-w-56 flex-1">
          <Select
            name="playerId"
            label="Name a player"
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

      {named.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {named.map((entry) => (
            <li
              key={entry.player_id}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-color)] px-3 py-2 text-sm"
            >
              <span>
                {entry.last_name}, {entry.first_name}
                {entry.stats ? (
                  <span className="ml-2 text-xs text-[var(--foreground-muted)]">
                    has a stat line
                  </span>
                ) : null}
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
