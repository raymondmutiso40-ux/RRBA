"use client";

import { useActionState, useRef } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addDevelopmentNoteAction } from "@/lib/development/actions";
import {
  emptyDevelopmentActionState,
  type DevelopmentActionState,
} from "@/lib/development/action-state";

/**
 * An observation between formal assessments.
 *
 * Deliberately just a box and a button: the value of a note is that writing one
 * costs nothing, so a coach records what they noticed on the day rather than
 * waiting for the next assessment and reconstructing it.
 */
export function DevelopmentNoteForm({ playerId }: { playerId: string }) {
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, isPending] = useActionState<
    DevelopmentActionState,
    FormData
  >(async (prev, formData) => {
    const result = await addDevelopmentNoteAction(prev, formData);
    // Clearing on success only — a failed submit keeps what was typed, since
    // losing a paragraph to a network error would be worse than a stale box.
    if (result.ok) formRef.current?.reset();
    return result;
  }, emptyDevelopmentActionState);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="playerId" value={playerId} />

      {state.message ? (
        <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>
      ) : null}

      <Textarea
        name="note"
        label="Add a note"
        rows={3}
        maxLength={2000}
        required
        placeholder="What you noticed, and what it means for their next session."
        error={state.fieldErrors?.note}
      />

      <div>
        <Button type="submit" loading={isPending}>
          Add note
        </Button>
      </div>
    </form>
  );
}
