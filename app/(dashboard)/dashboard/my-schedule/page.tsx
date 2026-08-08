import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { NoChildren, NotLinked } from "@/components/me/not-linked";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getMyIdentity, getMySchedule } from "@/lib/me/queries";
import { formatDuration, formatTime } from "@/lib/activity/labels";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "My schedule" };

export default async function MySchedulePage() {
  if (!isSupabaseConfigured()) return null;

  const user = await getSessionUser();
  if (!user) return null;

  const identity = await getMyIdentity(user.id);

  if (identity.kind === null) return <NotLinked what="schedule" />;
  if (identity.players.length === 0) return <NoChildren />;

  const sessions = await getMySchedule(identity.players);
  const isGuardian = identity.kind === "guardian";
  const multiplePlayers = identity.players.length > 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">My schedule</h1>
        <p className="text-sm text-[var(--foreground-muted)]">
          {isGuardian
            ? "Upcoming training for your children's teams."
            : "Your upcoming training sessions."}
        </p>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          title="Nothing scheduled"
          description={
            identity.players.some((player) => player.teams.length > 0)
              ? "No training is on the calendar for your teams yet. It will appear here as soon as a coach schedules it."
              : "You are not on a team yet, and training is scheduled per team. The academy will add you to one."
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {sessions.map((session) => (
            <li key={session.id}>
              <Card>
                <CardContent className="flex flex-wrap items-start justify-between gap-4 pt-5">
                  <div>
                    <p className="font-medium">{session.title}</p>
                    <p className="mt-0.5 text-sm text-[var(--foreground-muted)]">
                      {session.team_name}
                      {session.location ? ` · ${session.location}` : ""}
                    </p>
                    {multiplePlayers && session.player_names.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {session.player_names.map((name) => (
                          <Badge key={name} tone="brand">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {formatDate(session.starts_at)}
                    </p>
                    <p className="text-sm text-[var(--foreground-muted)]">
                      {formatTime(session.starts_at)}
                    </p>
                    <p className="text-xs text-[var(--foreground-muted)]">
                      {formatDuration(session.starts_at, session.ends_at)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
