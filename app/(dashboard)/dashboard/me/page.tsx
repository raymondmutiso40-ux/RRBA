import Link from "next/link";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NoChildren, NotLinked } from "@/components/me/not-linked";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getMyAttendance, getMyIdentity } from "@/lib/me/queries";
import {
  ATTENDANCE_STATUS_LABELS,
  attendanceRate,
  formatRate,
  rateTone,
} from "@/lib/activity/labels";
import { POSITION_LABELS, PLAYER_STATUS_LABELS } from "@/lib/players/labels";
import { calculateAge } from "@/lib/utils";
import type { BasketballPosition, PlayerStatus } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "My profile" };

export default async function MyProfilePage() {
  if (!isSupabaseConfigured()) return null;

  const user = await getSessionUser();
  if (!user) return null;

  const identity = await getMyIdentity(user.id);

  if (identity.kind === null) return <NotLinked what="profile" />;
  if (identity.players.length === 0) return <NoChildren />;

  const attendance = await getMyAttendance(identity.players);
  const isGuardian = identity.kind === "guardian";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isGuardian ? "My family" : "My profile"}
        </h1>
        <p className="text-sm text-[var(--foreground-muted)]">
          {isGuardian
            ? `Linked to ${identity.guardianName}. ${
                identity.players.length === 1
                  ? "One player"
                  : `${identity.players.length} players`
              } on your record.`
            : "Your record as the academy holds it."}
        </p>
      </div>

      {identity.players.map((player) => {
        const tally = attendance.get(player.id);
        const rate = tally ? attendanceRate(tally.counts) : null;

        return (
          <Card key={player.id}>
            <CardHeader>
              <CardTitle>
                {player.first_name} {player.last_name}
              </CardTitle>
              <CardDescription>
                {calculateAge(player.date_of_birth)} years old
                {player.jersey_number !== null
                  ? ` · shirt #${player.jersey_number}`
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <dl className="grid gap-3 sm:grid-cols-3">
                <Field label="Status">
                  <Badge tone="neutral">
                    {PLAYER_STATUS_LABELS[player.status as PlayerStatus] ??
                      player.status}
                  </Badge>
                </Field>
                <Field label="Position">
                  {player.position
                    ? (POSITION_LABELS[player.position as BasketballPosition] ??
                      player.position)
                    : "—"}
                </Field>
                <Field label="Attendance">
                  {tally ? (
                    <Badge tone={rateTone(rate)}>{formatRate(rate)}</Badge>
                  ) : (
                    <span className="text-sm text-[var(--foreground-muted)]">
                      Nothing recorded yet
                    </span>
                  )}
                </Field>
              </dl>

              <div>
                <p className="text-xs tracking-wide text-[var(--foreground-muted)] uppercase">
                  Teams
                </p>
                {player.teams.length === 0 ? (
                  <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                    Not on a team yet.
                  </p>
                ) : (
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {player.teams.map((team) => (
                      <li key={team.id}>
                        <Badge tone="brand">
                          {team.name} · {team.age_group}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {tally ? (
                <div>
                  <p className="text-xs tracking-wide text-[var(--foreground-muted)] uppercase">
                    Sessions
                  </p>
                  <dl className="mt-1 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {(["present", "late", "excused", "absent"] as const).map(
                      (status) => (
                        <div key={status}>
                          <dt className="text-xs text-[var(--foreground-muted)]">
                            {ATTENDANCE_STATUS_LABELS[status]}
                          </dt>
                          <dd className="text-lg font-semibold tabular-nums">
                            {tally.counts[status]}
                          </dd>
                        </div>
                      ),
                    )}
                  </dl>
                </div>
              ) : null}
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle>Something wrong?</CardTitle>
          <CardDescription>
            Contact the academy to correct anything on this page. Records are
            changed by staff so that the register and fees stay consistent.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 text-sm">
          <Link href="/dashboard/my-schedule" className="underline">
            My schedule
          </Link>
          <Link href="/dashboard/my-fees" className="underline">
            My fees
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-[var(--foreground-muted)] uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  );
}
