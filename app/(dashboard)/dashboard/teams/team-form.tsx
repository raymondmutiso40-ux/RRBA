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
import { createTeamAction, updateTeamAction } from "@/lib/teams/actions";
import {
  emptyTeamActionState,
  type TeamActionState,
} from "@/lib/teams/action-state";
import {
  AGE_GROUP_SUGGESTIONS,
  TEAM_GENDERS,
  TEAM_GENDER_LABELS,
} from "@/lib/teams/labels";
import type { Season, Team } from "@/lib/teams/queries";

/**
 * Create and edit form for a team.
 *
 * One component drives both actions so the field set and validation messages
 * cannot drift apart. The server action re-validates everything — the
 * attributes here are for fast feedback, not enforcement.
 */
export function TeamForm({
  team,
  seasons,
}: {
  team?: Team;
  seasons: Season[];
}) {
  const isEditing = Boolean(team);

  const [state, formAction, isPending] = useActionState<
    TeamActionState,
    FormData
  >(isEditing ? updateTeamAction : createTeamAction, emptyTeamActionState);

  const err = (name: string) => state.fieldErrors?.[name];

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {team ? <input type="hidden" name="teamId" value={team.id} /> : null}

      {state.message && !state.ok ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Team details</CardTitle>
          <CardDescription>
            The name and age group appear throughout the dashboard and on the
            public site.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Input
            name="name"
            label="Team name"
            required
            maxLength={120}
            placeholder="e.g. Runda Ridge U14"
            defaultValue={team?.name ?? ""}
            error={err("name")}
          />

          <Input
            name="ageGroup"
            label="Age group"
            required
            maxLength={80}
            list="age-group-options"
            placeholder="e.g. U14"
            hint="Free text — name your groups however you like."
            defaultValue={team?.age_group ?? ""}
            error={err("ageGroup")}
          />
          <datalist id="age-group-options">
            {AGE_GROUP_SUGGESTIONS.map((group) => (
              <option key={group} value={group} />
            ))}
          </datalist>

          <Select
            name="gender"
            label="Category"
            defaultValue={team?.gender ?? "undisclosed"}
            error={err("gender")}
          >
            {TEAM_GENDERS.map((gender) => (
              <option key={gender} value={gender}>
                {TEAM_GENDER_LABELS[gender]}
              </option>
            ))}
          </Select>

          <Select
            name="seasonId"
            label="Season"
            hint="Optional. Teams can span seasons."
            defaultValue={team?.season_id ?? ""}
            error={err("seasonId")}
          >
            <option value="">No season</option>
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
                {season.is_current ? " (current)" : ""}
              </option>
            ))}
          </Select>

          <Input
            name="minAge"
            type="number"
            label="Minimum age"
            min={4}
            max={30}
            defaultValue={team?.min_age ?? ""}
            error={err("minAge")}
          />
          <Input
            name="maxAge"
            type="number"
            label="Maximum age"
            min={4}
            max={30}
            defaultValue={team?.max_age ?? ""}
            error={err("maxAge")}
          />

          <Textarea
            name="description"
            label="Description"
            rows={3}
            maxLength={2000}
            className="sm:col-span-2"
            defaultValue={team?.description ?? ""}
            error={err("description")}
          />

          <label className="flex items-center gap-2.5 text-sm sm:col-span-2">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={team?.is_active ?? true}
              className="size-4 rounded border-[var(--border-color)]"
            />
            <span>
              Active
              <span className="block text-xs text-[var(--foreground-muted)]">
                Inactive teams stay on record but are hidden from the default
                list.
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={isPending}>
          {isEditing ? "Save changes" : "Create team"}
        </Button>
        <Link href={team ? `/dashboard/teams/${team.id}` : "/dashboard/teams"}>
          <Button type="button" variant="ghost">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
