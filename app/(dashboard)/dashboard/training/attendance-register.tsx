"use client";

import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { markAttendanceAction } from "@/lib/activity/actions";
import {
  emptyActivityActionState,
  type ActivityActionState,
} from "@/lib/activity/action-state";
import {
  ATTENDANCE_STATUSES,
  ATTENDANCE_STATUS_LABELS,
} from "@/lib/activity/labels";
import type { RegisterEntry } from "@/lib/activity/queries";
import type { AttendanceStatus } from "@/lib/supabase/types";
import { formatDateTime } from "@/lib/utils";

/**
 * The register for one session.
 *
 * Marked in the browser and submitted once, rather than a request per child: a
 * coach with a phone on a court is going down a list of fifteen names, and
 * fifteen round trips is fifteen chances to lose one.
 *
 * An unmarked row is left unmarked. It is tempting to default everyone to absent
 * and let the coach tick the present ones, but "nobody said" and "did not turn
 * up" are different facts, and only one of them should count against a player's
 * attendance record.
 */
export function AttendanceRegister({
  eventId,
  entries,
  canMark,
  isCancelled,
}: {
  eventId: string;
  entries: RegisterEntry[];
  canMark: boolean;
  isCancelled: boolean;
}) {
  const [state, formAction, isPending] = useActionState<
    ActivityActionState,
    FormData
  >(markAttendanceAction, emptyActivityActionState);

  // Seeded from what is already saved, so re-marking starts where it left off.
  const [marks, setMarks] = useState<Record<string, AttendanceStatus | "">>(() =>
    Object.fromEntries(
      entries.map((entry) => [entry.player_id, entry.status ?? ""]),
    ),
  );

  function setAll(status: AttendanceStatus) {
    setMarks(
      Object.fromEntries(entries.map((entry) => [entry.player_id, status])),
    );
  }

  const markedCount = entries.filter(
    (entry) => marks[entry.player_id] !== "",
  ).length;

  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[var(--border-color)] p-6 text-center text-sm text-[var(--foreground-muted)]">
        Nobody is expected at this session yet. Add players below, or put the
        session against a team to use its roster.
      </p>
    );
  }

  if (!canMark) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-[var(--foreground-muted)]">
          You can see this register but not change it — marking is limited to
          admins and the coaches of this team.
        </p>
        <RegisterList entries={entries} marks={marks} />
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="eventId" value={eventId} />

      {state.message ? (
        <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>
      ) : null}

      {isCancelled ? (
        <Alert tone="warning">
          This session is cancelled, so the register cannot be saved. Reopen it
          first if it went ahead after all.
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--foreground-muted)]">
          {markedCount} of {entries.length} marked
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAll("present")}
          >
            All present
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setAll("absent")}
          >
            All absent
          </Button>
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {entries.map((entry) => (
          <li
            key={entry.player_id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border-color)] p-3"
          >
            <div className="min-w-40">
              <p className="text-sm font-medium">
                {entry.last_name}, {entry.first_name}
                {entry.jersey_number !== null ? (
                  <span className="ml-1.5 text-xs text-[var(--foreground-muted)]">
                    #{entry.jersey_number}
                  </span>
                ) : null}
              </p>
              {entry.is_call_up ? (
                <Badge tone="info" className="mt-1">
                  Called up
                </Badge>
              ) : null}
              {entry.marked_at ? (
                <p className="mt-0.5 text-xs text-[var(--foreground-muted)]">
                  Marked {formatDateTime(entry.marked_at)}
                </p>
              ) : null}
            </div>

            <fieldset className="flex flex-wrap gap-1.5">
              <legend className="sr-only">
                Attendance for {entry.first_name} {entry.last_name}
              </legend>
              {ATTENDANCE_STATUSES.map((status) => {
                const checked = marks[entry.player_id] === status;
                return (
                  <label
                    key={status}
                    className={
                      "cursor-pointer rounded-lg border px-2.5 py-1 text-xs transition-colors " +
                      (checked
                        ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : "border-[var(--border-color)] hover:bg-[var(--surface-muted)]")
                    }
                  >
                    <input
                      type="radio"
                      name={`status:${entry.player_id}`}
                      value={status}
                      checked={checked}
                      onChange={() =>
                        setMarks((current) => ({
                          ...current,
                          [entry.player_id]: status,
                        }))
                      }
                      className="sr-only"
                    />
                    {ATTENDANCE_STATUS_LABELS[status]}
                  </label>
                );
              })}
            </fieldset>
          </li>
        ))}
      </ul>

      <div>
        <Button
          type="submit"
          loading={isPending}
          disabled={isCancelled || markedCount === 0}
        >
          Save register
        </Button>
      </div>
    </form>
  );
}

/** The same names without the controls, for somebody who may only look. */
function RegisterList({
  entries,
  marks,
}: {
  entries: RegisterEntry[];
  marks: Record<string, AttendanceStatus | "">;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {entries.map((entry) => {
        const status = marks[entry.player_id];
        return (
          <li
            key={entry.player_id}
            className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-color)] p-3 text-sm"
          >
            <span>
              {entry.last_name}, {entry.first_name}
            </span>
            <span className="text-[var(--foreground-muted)]">
              {status ? ATTENDANCE_STATUS_LABELS[status] : "Not marked"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
