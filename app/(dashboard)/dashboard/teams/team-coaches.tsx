"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { assignCoachAction, unassignCoachAction } from "@/lib/teams/actions";
import {
  emptyTeamActionState,
  type TeamActionState,
} from "@/lib/teams/action-state";
import type { TeamCoach } from "@/lib/teams/queries";
import { formatDate } from "@/lib/utils";

type AssignableCoach = { id: string; full_name: string; email: string };

/** Coaching staff for one team. Assignment is admin-only, per RLS. */
export function TeamCoaches({
  teamId,
  coaches,
  assignable,
  canManage,
  canViewDirectory = false,
}: {
  teamId: string;
  coaches: TeamCoach[];
  assignable: AssignableCoach[];
  canManage: boolean;
  /** The coach directory is admin-only, so only admins get the name as a link. */
  canViewDirectory?: boolean;
}) {
  const [assignState, assign, assigning] = useActionState<
    TeamActionState,
    FormData
  >(assignCoachAction, emptyTeamActionState);

  const [unassignState, unassign, unassigning] = useActionState<
    TeamActionState,
    FormData
  >(unassignCoachAction, emptyTeamActionState);

  const feedback = assignState.message ? assignState : unassignState;

  return (
    <div className="flex flex-col gap-4">
      {feedback.message ? (
        <Alert tone={feedback.ok ? "success" : "danger"}>
          {feedback.message}
        </Alert>
      ) : null}

      {canManage ? (
        <form
          action={assign}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border-color)] p-4"
        >
          <input type="hidden" name="teamId" value={teamId} />
          <div className="min-w-56 flex-1">
            <Select
              name="coachId"
              label="Assign a coach"
              required
              disabled={assignable.length === 0}
              hint={
                assignable.length === 0
                  ? "Grant someone the coach role first, under Users & roles."
                  : undefined
              }
            >
              <option value="">
                {assignable.length === 0
                  ? "No available coaches"
                  : "Select a coach"}
              </option>
              {assignable.map((coach) => (
                <option key={coach.id} value={coach.id}>
                  {coach.full_name || coach.email}
                </option>
              ))}
            </Select>
          </div>

          <label className="flex items-center gap-2 pb-2.5 text-sm">
            <input
              type="checkbox"
              name="isLead"
              className="size-4 rounded border-[var(--border-color)]"
            />
            Lead coach
          </label>

          <Button
            type="submit"
            loading={assigning}
            disabled={assignable.length === 0 || unassigning}
          >
            Assign
          </Button>
        </form>
      ) : null}

      {coaches.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--border-color)] p-6 text-center text-sm text-[var(--foreground-muted)]">
          No coaches assigned to this team yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {coaches.map((coach) => (
            <li
              key={coach.assignment_id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border-color)] px-4 py-3"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {canViewDirectory ? (
                    <Link
                      href={`/dashboard/coaches/${coach.coach_id}`}
                      className="hover:underline"
                    >
                      {coach.full_name}
                    </Link>
                  ) : (
                    coach.full_name
                  )}
                  {coach.is_lead ? <Badge tone="brand">Lead</Badge> : null}
                </p>
                <p className="text-xs text-[var(--foreground-muted)]">
                  {coach.email} · since {formatDate(coach.assigned_at)}
                </p>
              </div>

              {canManage ? (
                <form action={unassign}>
                  <input type="hidden" name="teamId" value={teamId} />
                  <input
                    type="hidden"
                    name="assignmentId"
                    value={coach.assignment_id}
                  />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    disabled={assigning || unassigning}
                  >
                    Unassign
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
