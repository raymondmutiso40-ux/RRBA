"use client";

import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  approveApplicationAction,
  declineApplicationAction,
} from "@/lib/applications/actions";
import {
  emptyApplicationActionState,
  type ApplicationActionState,
} from "@/lib/applications/action-state";

type TeamOption = { id: string; name: string; age_group: string };

/**
 * Approve / decline controls for one application.
 *
 * Decline is behind a confirm step: approving is recoverable by editing the
 * created player, but declining is a decision the applicant may be told about,
 * so it should not happen on a stray click.
 */
export function ApplicationReview({
  applicationId,
  teams,
}: {
  applicationId: string;
  teams: TeamOption[];
}) {
  const [approveState, approve, approving] = useActionState<
    ApplicationActionState,
    FormData
  >(approveApplicationAction, emptyApplicationActionState);

  const [declineState, decline, declining] = useActionState<
    ApplicationActionState,
    FormData
  >(declineApplicationAction, emptyApplicationActionState);

  const [confirmDecline, setConfirmDecline] = useState(false);

  const state = approveState.message ? approveState : declineState;
  const busy = approving || declining;

  if (state.ok) {
    return <Alert tone="success">{state.message}</Alert>;
  }

  return (
    <div className="flex flex-col gap-4">
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}

      <form action={approve} className="flex flex-col gap-4">
        <input type="hidden" name="applicationId" value={applicationId} />

        <Select
          name="teamId"
          label="Assign to team"
          hint="Optional. Can be set later from the player's profile."
          defaultValue=""
        >
          <option value="">No team yet</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name} · {team.age_group}
            </option>
          ))}
        </Select>

        <Textarea
          name="reviewNotes"
          label="Review notes"
          rows={2}
          maxLength={2000}
          hint="Internal only. Not shown to the applicant."
        />

        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={approving} disabled={busy}>
            Approve &amp; create player
          </Button>

          {!confirmDecline ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setConfirmDecline(true)}
            >
              Decline
            </Button>
          ) : null}
        </div>
      </form>

      {confirmDecline ? (
        <form
          action={decline}
          className="flex flex-col gap-3 rounded-lg border border-[var(--color-danger)] p-4"
        >
          <input type="hidden" name="applicationId" value={applicationId} />
          <p className="text-sm font-medium">Decline this application?</p>
          <p className="text-sm text-[var(--foreground-muted)]">
            The record is kept so the decision stays on file, but no player will
            be created.
          </p>
          <Textarea
            name="reviewNotes"
            label="Reason (optional)"
            rows={2}
            maxLength={2000}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="danger"
              loading={declining}
              disabled={busy}
            >
              Confirm decline
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setConfirmDecline(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
