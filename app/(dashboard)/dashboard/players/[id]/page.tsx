import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import {
  canEditPlayers,
  canViewMedical,
  canViewPlayers,
} from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  getPlayer,
  getPlayerGuardians,
  getPlayerMedical,
  getPlayerTeams,
} from "@/lib/players/queries";
import {
  DOMINANT_HAND_LABELS,
  GENDER_LABELS,
  PLAYER_STATUS_LABELS,
  POSITION_LABELS,
  playerFullName,
  statusTone,
} from "@/lib/players/labels";
import { getPlayerMatchLines } from "@/lib/matches/queries";
import { PlayerMatchRecord } from "@/components/matches/player-match-record";
import { calculateAge, formatDate, getInitials } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  if (!isSupabaseConfigured()) return { title: "Player" };

  const { id } = await params;
  const player = await getPlayer(id);

  return { title: player ? playerFullName(player) : "Player" };
}

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured()) return null;

  const user = await getSessionUser();
  if (!user || !canViewPlayers(user.roles)) return notFound();

  const { id } = await params;
  const player = await getPlayer(id);

  // RLS hides players outside the viewer's scope, so "not visible" and
  // "does not exist" are indistinguishable here — both are a 404.
  if (!player) return notFound();

  const [teams, guardians, matchLines] = await Promise.all([
    getPlayerTeams(player.id),
    getPlayerGuardians(player.id),
    getPlayerMatchLines(player.id),
  ]);

  // Medical data is fetched only for roles allowed to see it. Finance staff
  // reach the profile but never trigger this query.
  const medical = canViewMedical(user.roles)
    ? await getPlayerMedical(player.id)
    : null;

  const currentTeam = teams.find((team) => team.left_at === null);
  const fullName = playerFullName(player);

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link
          href="/dashboard/players"
          className="text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
        >
          ← Players
        </Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span
            className="grid size-14 shrink-0 place-items-center rounded-full bg-[var(--surface-muted)] text-lg font-semibold"
            aria-hidden="true"
          >
            {getInitials(fullName)}
          </span>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {fullName}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--foreground-muted)]">
              <Badge tone={statusTone(player.status)}>
                {PLAYER_STATUS_LABELS[player.status]}
              </Badge>
              <span>{player.date_of_birth ? `${calculateAge(player.date_of_birth)} years old` : "Age not set"}</span>
              {currentTeam ? <span>· {currentTeam.name}</span> : null}
              {player.jersey_number !== null ? (
                <span>· #{player.jersey_number}</span>
              ) : null}
            </div>
          </div>
        </div>

        {canEditPlayers(user.roles) ? (
          <Link href={`/dashboard/players/${player.id}/edit`}>
            <Button variant="outline">Edit profile</Button>
          </Link>
        ) : null}
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Player details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Field label="Date of birth">
                {player.date_of_birth ? formatDate(player.date_of_birth) : "—"}
              </Field>
              <Field label="Gender">{GENDER_LABELS[player.gender]}</Field>
              <Field label="Position">
                {player.position ? POSITION_LABELS[player.position] : "—"}
              </Field>
              <Field label="Jersey number">
                {player.jersey_number ?? "—"}
              </Field>
              <Field label="Height">
                {player.height_cm ? `${player.height_cm} cm` : "—"}
              </Field>
              <Field label="Weight">
                {player.weight_kg ? `${player.weight_kg} kg` : "—"}
              </Field>
              <Field label="Dominant hand">
                {player.dominant_hand
                  ? (DOMINANT_HAND_LABELS[player.dominant_hand] ??
                    player.dominant_hand)
                  : "—"}
              </Field>
              <Field label="Registered">
                {formatDate(player.registration_date)}
              </Field>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Field label="Email">{player.email ?? "—"}</Field>
              <Field label="Phone">{player.phone ?? "—"}</Field>
              <Field label="Address" className="sm:col-span-2">
                {player.address ?? "—"}
              </Field>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Guardians</CardTitle>
            <CardDescription>
              Parents and guardians linked to this player.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {guardians.length === 0 ? (
              <p className="text-sm text-[var(--foreground-muted)]">
                No guardians linked yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {guardians.map((guardian) => (
                  <li key={guardian.id} className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {guardian.full_name}
                      {guardian.is_primary ? (
                        <Badge tone="brand">Primary</Badge>
                      ) : null}
                    </span>
                    <span className="text-sm text-[var(--foreground-muted)]">
                      {guardian.relationship} · {guardian.phone}
                      {guardian.email ? ` · ${guardian.email}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Teams</CardTitle>
            <CardDescription>
              Current and past squads, most recent first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {teams.length === 0 ? (
              <p className="text-sm text-[var(--foreground-muted)]">
                Not assigned to a team yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {teams.map((team) => (
                  <li key={team.team_id} className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {team.name}
                      {team.left_at === null ? (
                        <Badge tone="success">Current</Badge>
                      ) : null}
                    </span>
                    <span className="text-sm text-[var(--foreground-muted)]">
                      {team.age_group} · joined {formatDate(team.joined_at)}
                      {team.left_at ? ` · left ${formatDate(team.left_at)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {canViewMedical(user.roles) ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Medical &amp; emergency</CardTitle>
              <CardDescription>
                Restricted to administrators and assigned coaches.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {medical ? (
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Cleared to play">
                    {medical.cleared_to_play ? (
                      <Badge tone="success">Cleared</Badge>
                    ) : (
                      <Badge tone="warning">Not cleared</Badge>
                    )}
                  </Field>
                  <Field label="Blood group">
                    {medical.blood_group ?? "—"}
                  </Field>
                  <Field label="Last physical">
                    {medical.last_physical_on
                      ? formatDate(medical.last_physical_on)
                      : "—"}
                  </Field>
                  <Field label="Allergies">{medical.allergies ?? "—"}</Field>
                  <Field label="Chronic conditions">
                    {medical.chronic_conditions ?? "—"}
                  </Field>
                  <Field label="Medications">
                    {medical.medications ?? "—"}
                  </Field>
                  <Field label="Emergency contact">
                    {medical.emergency_contact_name
                      ? `${medical.emergency_contact_name}${
                          medical.emergency_contact_phone
                            ? ` · ${medical.emergency_contact_phone}`
                            : ""
                        }`
                      : "—"}
                  </Field>
                  <Field label="Doctor">
                    {medical.doctor_name
                      ? `${medical.doctor_name}${
                          medical.doctor_phone
                            ? ` · ${medical.doctor_phone}`
                            : ""
                        }`
                      : "—"}
                  </Field>
                  <Field label="Insurance">
                    {medical.insurance_provider ?? "—"}
                  </Field>
                </dl>
              ) : (
                <p className="text-sm text-[var(--foreground-muted)]">
                  No medical record on file for this player.
                </p>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Match record</CardTitle>
          <CardDescription>
            Averages across the games this player has a box score for, and the
            lines behind them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PlayerMatchRecord lines={matchLines} />
        </CardContent>
      </Card>

      {player.notes ? (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{player.notes}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs tracking-wide text-[var(--foreground-muted)] uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}
