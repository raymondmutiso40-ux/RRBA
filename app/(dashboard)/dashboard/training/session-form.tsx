"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createSessionAction,
  updateSessionAction,
} from "@/lib/activity/actions";
import {
  emptyActivityActionState,
  type ActivityActionState,
} from "@/lib/activity/action-state";
import type { SessionDetail } from "@/lib/activity/queries";

type SchedulableTeam = {
  id: string;
  name: string;
  age_group: string;
};

/**
 * Turns a stored timestamptz into the value a datetime-local input expects.
 *
 * The input has no concept of a zone, so it needs local wall-clock time — which
 * is also what the coach typed in the first place.
 */
function toLocalInput(value: string | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/**
 * Schedule or edit a training session.
 *
 * The team list is already narrowed by the server to teams the user may
 * schedule for, and "no team" only appears for admins — a coach posting a
 * team-less session would be refused by RLS, so it is not offered.
 */
export function SessionForm({
  session,
  teams,
  canScheduleTeamless,
  defaultTeamId,
}: {
  session?: SessionDetail;
  teams: SchedulableTeam[];
  canScheduleTeamless: boolean;
  defaultTeamId?: string;
}) {
  const isEditing = Boolean(session);

  const [state, formAction, isPending] = useActionState<
    ActivityActionState,
    FormData
  >(
    isEditing ? updateSessionAction : createSessionAction,
    emptyActivityActionState,
  );

  const err = (name: string) => state.fieldErrors?.[name];

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {session ? (
        <input type="hidden" name="eventId" value={session.id} />
      ) : null}

      {state.message && !state.ok ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Session details</CardTitle>
          <CardDescription>
            Who is training, when, and where. The register is built from the
            team&apos;s roster once the session exists.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Select
            name="teamId"
            label="Team"
            required={!canScheduleTeamless}
            className="sm:col-span-2"
            defaultValue={session?.team_id ?? defaultTeamId ?? ""}
            hint={
              canScheduleTeamless
                ? "A session with no team has no roster, so its register has to be built from call-ups."
                : undefined
            }
            error={err("teamId")}
          >
            {canScheduleTeamless ? (
              <option value="">No team — academy-wide</option>
            ) : (
              <option value="">Select a team</option>
            )}
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name} ({team.age_group})
              </option>
            ))}
          </Select>

          <Input
            name="title"
            label="Title"
            required
            maxLength={200}
            className="sm:col-span-2"
            placeholder="e.g. Tuesday skills session"
            defaultValue={session?.title ?? ""}
            error={err("title")}
          />

          <Input
            name="startsAt"
            type="datetime-local"
            label="Starts"
            required
            defaultValue={toLocalInput(session?.starts_at)}
            error={err("startsAt")}
          />

          <Input
            name="endsAt"
            type="datetime-local"
            label="Ends"
            required
            defaultValue={toLocalInput(session?.ends_at)}
            error={err("endsAt")}
          />

          <Input
            name="location"
            label="Location"
            maxLength={200}
            className="sm:col-span-2"
            placeholder="e.g. Main court"
            defaultValue={session?.location ?? ""}
            error={err("location")}
          />

          <Textarea
            name="description"
            label="Plan"
            rows={3}
            maxLength={2000}
            className="sm:col-span-2"
            hint="Optional — what you intend to work on."
            defaultValue={session?.description ?? ""}
            error={err("description")}
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={isPending}>
          {isEditing ? "Save changes" : "Schedule session"}
        </Button>
        <Link
          href={
            session ? `/dashboard/training/${session.id}` : "/dashboard/training"
          }
        >
          <Button type="button" variant="ghost">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
