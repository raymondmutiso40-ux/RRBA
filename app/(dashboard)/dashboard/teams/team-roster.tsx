"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  addToRosterAction,
  removeFromRosterAction,
} from "@/lib/teams/actions";
import {
  emptyTeamActionState,
  type TeamActionState,
} from "@/lib/teams/action-state";
import type { RosterEntry } from "@/lib/teams/queries";
import { calculateAge, formatDate } from "@/lib/utils";

type AssignablePlayer = {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
};

/**
 * Roster management for one team.
 *
 * Removal ends the spell by setting left_at rather than deleting the row, so
 * "who played for this team last season" stays answerable.
 */
export function TeamRoster({
  teamId,
  roster,
  assignable,
  canManage,
}: {
  teamId: string;
  roster: RosterEntry[];
  assignable: AssignablePlayer[];
  canManage: boolean;
}) {
  const [addState, addAction, adding] = useActionState<
    TeamActionState,
    FormData
  >(addToRosterAction, emptyTeamActionState);

  const [removeState, removeAction, removing] = useActionState<
    TeamActionState,
    FormData
  >(removeFromRosterAction, emptyTeamActionState);

  const feedback = addState.message ? addState : removeState;

  return (
    <div className="flex flex-col gap-4">
      {feedback.message ? (
        <Alert tone={feedback.ok ? "success" : "danger"}>
          {feedback.message}
        </Alert>
      ) : null}

      {canManage ? (
        <form
          action={addAction}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border-color)] p-4"
        >
          <input type="hidden" name="teamId" value={teamId} />
          <div className="min-w-56 flex-1">
            <Select
              name="playerId"
              label="Add a player"
              required
              disabled={assignable.length === 0}
            >
              <option value="">
                {assignable.length === 0
                  ? "No available players"
                  : "Select a player"}
              </option>
              {assignable.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.last_name}, {player.first_name} (
                  {player.date_of_birth ? calculateAge(player.date_of_birth) : "—"})
                </option>
              ))}
            </Select>
          </div>
          <Button
            type="submit"
            loading={adding}
            disabled={assignable.length === 0 || removing}
          >
            Add to roster
          </Button>
        </form>
      ) : null}

      {roster.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--border-color)] p-6 text-center text-sm text-[var(--foreground-muted)]">
          No players on this roster yet.
        </p>
      ) : (
        <Table>
          <caption className="sr-only">
            Current roster, {roster.length} players
          </caption>
          <TableHeader>
            <tr>
              <TableHead>Player</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Jersey</TableHead>
              <TableHead>Joined</TableHead>
              {canManage ? (
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              ) : null}
            </tr>
          </TableHeader>
          <TableBody>
            {roster.map((entry) => (
              <TableRow key={entry.membership_id}>
                <TableCell>
                  <Link
                    href={`/dashboard/players/${entry.player_id}`}
                    className="font-medium hover:underline"
                  >
                    {entry.first_name} {entry.last_name}
                  </Link>
                  {entry.status !== "active" ? (
                    <Badge tone="neutral" className="ml-2">
                      {entry.status}
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell>{calculateAge(entry.date_of_birth)}</TableCell>
                <TableCell>{entry.jersey_number ?? "—"}</TableCell>
                <TableCell className="text-[var(--foreground-muted)]">
                  {formatDate(entry.joined_at)}
                </TableCell>
                {canManage ? (
                  <TableCell className="text-right">
                    <form action={removeAction}>
                      <input type="hidden" name="teamId" value={teamId} />
                      <input
                        type="hidden"
                        name="membershipId"
                        value={entry.membership_id}
                      />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        disabled={adding || removing}
                      >
                        Remove
                      </Button>
                    </form>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
