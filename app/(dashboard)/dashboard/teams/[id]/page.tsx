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
import { EmptyState } from "@/components/ui/empty-state";
import { getSessionUser } from "@/lib/auth/session";
import {
  canAssignCoaches,
  canManageRoster,
  canManageTeams,
  canViewTeams,
} from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  getAssignableCoaches,
  getAssignablePlayers,
  getTeam,
  getTeamCoaches,
  getTeamRoster,
} from "@/lib/teams/queries";
import { TEAM_GENDER_LABELS, teamAgeRange } from "@/lib/teams/labels";

import { TeamCoaches } from "../team-coaches";
import { TeamRoster } from "../team-roster";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  if (!isSupabaseConfigured()) return { title: "Team" };
  const { id } = await params;
  const team = await getTeam(id);
  return { title: team ? team.name : "Team" };
}

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured()) return null;

  const user = await getSessionUser();
  if (!user) return null;

  if (!canViewTeams(user.roles)) {
    return (
      <EmptyState
        title="No access to teams"
        description="Your role does not include access to team records."
      />
    );
  }

  const { id } = await params;
  const team = await getTeam(id);

  // RLS hides nothing here — every authenticated user may read teams — so a
  // miss genuinely means the team does not exist.
  if (!team) notFound();

  const manageRoster = canManageRoster(user.roles);
  const manageCoaches = canAssignCoaches(user.roles);

  // Only fetch the pickers for someone who can actually use them.
  const [roster, coaches, assignablePlayers, assignableCoaches] =
    await Promise.all([
      getTeamRoster(team.id),
      getTeamCoaches(team.id),
      manageRoster ? getAssignablePlayers(team.id) : Promise.resolve([]),
      manageCoaches ? getAssignableCoaches(team.id) : Promise.resolve([]),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link
          href="/dashboard/teams"
          className="text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
        >
          ← Teams
        </Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{team.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--foreground-muted)]">
            <Badge tone={team.is_active ? "success" : "neutral"}>
              {team.is_active ? "Active" : "Inactive"}
            </Badge>
            <span>{team.age_group}</span>
            <span>· {TEAM_GENDER_LABELS[team.gender]}</span>
            <span>· {roster.length} players</span>
          </div>
        </div>

        {canManageTeams(user.roles) ? (
          <Link href={`/dashboard/teams/${team.id}/edit`}>
            <Button variant="outline">Edit team</Button>
          </Link>
        ) : null}
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-3">
              <Field label="Age group">{team.age_group}</Field>
              <Field label="Age range">{teamAgeRange(team)}</Field>
              <Field label="Category">{TEAM_GENDER_LABELS[team.gender]}</Field>
              {team.description ? (
                <Field label="About">{team.description}</Field>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Coaching staff</CardTitle>
            <CardDescription>
              A coach can only see and manage players on the teams they are
              assigned to.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TeamCoaches
              teamId={team.id}
              coaches={coaches}
              assignable={assignableCoaches}
              canManage={manageCoaches}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Roster</CardTitle>
          <CardDescription>
            Removing a player ends their spell with the team but keeps the
            record, so past rosters stay intact.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TeamRoster
            teamId={team.id}
            roster={roster}
            assignable={assignablePlayers}
            canManage={manageRoster}
          />
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
      <dd className="mt-0.5 text-sm whitespace-pre-wrap">{children}</dd>
    </div>
  );
}
