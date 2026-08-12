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
import { createMatchAction, updateMatchAction } from "@/lib/matches/actions";
import {
  emptyMatchActionState,
  type MatchActionState,
} from "@/lib/matches/action-state";
import type { MatchDetail } from "@/lib/matches/queries";

type PlayableTeam = {
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
 * Arrange or edit a fixture.
 *
 * No score fields here. A fixture is arranged before it is played, so the
 * result is recorded from the match page afterwards — putting the two on one
 * form would ask a coach for a scoreline that does not exist yet.
 *
 * The team list is already narrowed by the server to teams the user may
 * arrange for. Unlike a training session there is no "no team" option at all:
 * events_coach_write refuses a coach any event with a null team_id, and a
 * fixture nobody is playing in is not a fixture.
 */
export function MatchForm({
  match,
  teams,
  defaultTeamId,
}: {
  match?: MatchDetail;
  teams: PlayableTeam[];
  defaultTeamId?: string;
}) {
  const isEditing = Boolean(match);

  const [state, formAction, isPending] = useActionState<
    MatchActionState,
    FormData
  >(isEditing ? updateMatchAction : createMatchAction, emptyMatchActionState);

  const err = (name: string) => state.fieldErrors?.[name];

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {match ? <input type="hidden" name="eventId" value={match.id} /> : null}

      {state.message && !state.ok ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Fixture</CardTitle>
          <CardDescription>
            Who is playing, against whom, and when. The box score is built from
            the team&apos;s roster once the fixture exists.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Select
            name="teamId"
            label="Team"
            required
            defaultValue={match?.team_id ?? defaultTeamId ?? ""}
            error={err("teamId")}
          >
            <option value="">Select a team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name} ({team.age_group})
              </option>
            ))}
          </Select>

          <Select
            name="isHome"
            label="Venue"
            required
            defaultValue={match?.is_home === false ? "away" : "home"}
            error={err("isHome")}
          >
            <option value="home">Home</option>
            <option value="away">Away</option>
          </Select>

          <Input
            name="opponent"
            label="Opponent"
            required
            maxLength={120}
            placeholder="e.g. Nairobi Kings"
            defaultValue={match?.opponent ?? ""}
            error={err("opponent")}
          />

          <Input
            name="competition"
            label="Competition"
            maxLength={200}
            placeholder="e.g. Nairobi Youth League"
            hint="Optional — a friendly needs no competition."
            defaultValue={match?.competition ?? ""}
            error={err("competition")}
          />

          <Input
            name="startsAt"
            type="datetime-local"
            label="Tip-off"
            required
            defaultValue={toLocalInput(match?.starts_at)}
            error={err("startsAt")}
          />

          <Input
            name="endsAt"
            type="datetime-local"
            label="Expected end"
            required
            defaultValue={toLocalInput(match?.ends_at)}
            error={err("endsAt")}
          />

          <Input
            name="location"
            label="Venue"
            maxLength={200}
            className="sm:col-span-2"
            placeholder="e.g. Runda Ridge court"
            defaultValue={match?.location ?? ""}
            error={err("location")}
          />

          <Input
            name="title"
            label="Title"
            maxLength={200}
            className="sm:col-span-2"
            hint="Optional — left blank, the fixture is named after the opponent."
            defaultValue={match?.title ?? ""}
            error={err("title")}
          />

          <Textarea
            name="description"
            label="Notes"
            rows={3}
            maxLength={2000}
            className="sm:col-span-2"
            hint="Optional — travel arrangements, the game plan, anything the squad needs."
            defaultValue={match?.description ?? ""}
            error={err("description")}
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={isPending}>
          {isEditing ? "Save changes" : "Arrange fixture"}
        </Button>
        <Link
          href={match ? `/dashboard/matches/${match.id}` : "/dashboard/matches"}
        >
          <Button type="button" variant="ghost">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
