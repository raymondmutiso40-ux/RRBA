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
  GENDERS,
  GENDER_LABELS,
  PLAYER_STATUSES,
  PLAYER_STATUS_LABELS,
  POSITIONS,
  POSITION_LABELS,
} from "@/lib/players/labels";
import {
  createPlayerAction,
  emptyPlayerActionState,
  updatePlayerAction,
  type PlayerActionState,
} from "@/lib/players/actions";
import type { Player } from "@/lib/players/queries";

type PlayerFormProps = {
  /** Existing player when editing; omitted when creating. */
  player?: Player;
};

/**
 * Create and edit form for a player.
 *
 * One component drives both actions so the field set, labels, and validation
 * messages cannot drift between adding and editing a player. The server action
 * re-validates everything — the `required` and `min`/`max` attributes here are
 * for fast feedback, not enforcement.
 */
export function PlayerForm({ player }: PlayerFormProps) {
  const isEditing = Boolean(player);

  const [state, formAction, isPending] = useActionState<
    PlayerActionState,
    FormData
  >(
    isEditing ? updatePlayerAction : createPlayerAction,
    emptyPlayerActionState,
  );

  const fieldError = (name: string) => state.fieldErrors?.[name];

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {player ? <input type="hidden" name="playerId" value={player.id} /> : null}

      {state.message && !state.ok ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Personal details</CardTitle>
          <CardDescription>
            Name and date of birth are required. Everything else can be filled
            in later.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Input
            name="firstName"
            label="First name"
            required
            maxLength={100}
            autoComplete="given-name"
            defaultValue={player?.first_name ?? ""}
            error={fieldError("firstName")}
          />
          <Input
            name="lastName"
            label="Last name"
            required
            maxLength={100}
            autoComplete="family-name"
            defaultValue={player?.last_name ?? ""}
            error={fieldError("lastName")}
          />
          <Input
            name="dateOfBirth"
            type="date"
            label="Date of birth"
            required
            defaultValue={player?.date_of_birth ?? ""}
            error={fieldError("dateOfBirth")}
          />
          <Select
            name="gender"
            label="Gender"
            defaultValue={player?.gender ?? "undisclosed"}
            error={fieldError("gender")}
          >
            {GENDERS.map((gender) => (
              <option key={gender} value={gender}>
                {GENDER_LABELS[gender]}
              </option>
            ))}
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
          <CardDescription>
            For younger players this is usually a guardian&apos;s contact.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Input
            name="email"
            type="email"
            label="Email"
            autoComplete="email"
            defaultValue={player?.email ?? ""}
            error={fieldError("email")}
          />
          <Input
            name="phone"
            type="tel"
            label="Phone"
            hint="e.g. +254 712 345678"
            autoComplete="tel"
            defaultValue={player?.phone ?? ""}
            error={fieldError("phone")}
          />
          <Textarea
            name="address"
            label="Address"
            rows={2}
            maxLength={500}
            className="sm:col-span-2"
            defaultValue={player?.address ?? ""}
            error={fieldError("address")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Basketball profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Select
            name="position"
            label="Position"
            defaultValue={player?.position ?? ""}
            error={fieldError("position")}
          >
            <option value="">Not assigned</option>
            {POSITIONS.map((position) => (
              <option key={position} value={position}>
                {POSITION_LABELS[position]}
              </option>
            ))}
          </Select>
          <Input
            name="jerseyNumber"
            type="number"
            label="Jersey number"
            min={0}
            max={99}
            defaultValue={player?.jersey_number ?? ""}
            error={fieldError("jerseyNumber")}
          />
          <Select
            name="dominantHand"
            label="Dominant hand"
            defaultValue={player?.dominant_hand ?? ""}
            error={fieldError("dominantHand")}
          >
            <option value="">Not recorded</option>
            <option value="right">Right</option>
            <option value="left">Left</option>
            <option value="ambidextrous">Ambidextrous</option>
          </Select>
          <Input
            name="heightCm"
            type="number"
            label="Height (cm)"
            min={80}
            max={260}
            defaultValue={player?.height_cm ?? ""}
            error={fieldError("heightCm")}
          />
          <Input
            name="weightKg"
            type="number"
            step="0.1"
            label="Weight (kg)"
            min={20}
            max={300}
            defaultValue={player?.weight_kg ?? ""}
            error={fieldError("weightKg")}
          />
          <Select
            name="status"
            label="Status"
            defaultValue={player?.status ?? "applicant"}
            error={fieldError("status")}
          >
            {PLAYER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {PLAYER_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
          <Textarea
            name="notes"
            label="Notes"
            rows={3}
            maxLength={4000}
            hint="Visible to staff only."
            className="sm:col-span-2 lg:col-span-3"
            defaultValue={player?.notes ?? ""}
            error={fieldError("notes")}
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={isPending}>
          {isEditing ? "Save changes" : "Add player"}
        </Button>
        <Link
          href={
            player ? `/dashboard/players/${player.id}` : "/dashboard/players"
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
