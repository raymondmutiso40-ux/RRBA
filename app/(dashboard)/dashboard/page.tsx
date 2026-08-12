import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";

import { ClaimAdminCard } from "@/components/dashboard/claim-admin-card";
import { StatTile } from "@/components/dashboard/stat-tile";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionUser } from "@/lib/auth/session";
import { getBootstrapState } from "@/lib/auth/bootstrap";
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  canAssessPlayers,
  canViewFinance,
  canViewMatches,
  canViewTraining,
  isAdmin,
  isStaff,
} from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  countUnassessedPlayers,
  getAcademyCounts,
} from "@/lib/dashboard/queries";
import { countPendingApplications } from "@/lib/applications/queries";
import { getTrainingSummary, listSessions } from "@/lib/activity/queries";
import { getMatchesSummary, listMatches } from "@/lib/matches/queries";
import { getFinanceSummary } from "@/lib/finance/queries";
import { getMyIdentity, getMyInvoices, getMySchedule } from "@/lib/me/queries";
import { formatTime } from "@/lib/activity/labels";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { AppRole } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * The dashboard.
 *
 * Role-shaped rather than one page with things hidden: staff get the academy's
 * position and what is waiting on them, a family gets their own week. The two
 * share no queries, so a parent's dashboard cannot accidentally sum the
 * academy's money.
 *
 * Nothing is invented to fill a tile. Every figure has an authority in a
 * feature area and is read from it, so a tile and the page it links to always
 * agree — and a brand-new academy shows honest zeroes rather than a demo.
 */
export default async function DashboardPage() {
  // The layout renders its own setup notice; pages render in parallel with
  // layouts, so this page needs the same guard to avoid throwing.
  if (!isSupabaseConfigured()) return null;

  const user = await getSessionUser();
  if (!user) return null;

  const roles = user.roles;
  const firstName = user.fullName?.split(/\s+/)[0] ?? "there";

  // An active account with no roles can still be the first admin — reachable
  // if the account was activated by hand before any role was granted.
  const bootstrap =
    roles.length === 0
      ? await getBootstrapState(user.email)
      : { available: false as const, reason: "admin_exists" as const };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome, {firstName}
        </h1>
        <p className="text-sm text-[var(--foreground-muted)]">
          {roles.length === 0
            ? "Your account is set up and waiting for a role."
            : isStaff(roles)
              ? "Where the academy stands today."
              : "Your family's week at the academy."}
        </p>
      </div>

      {bootstrap.available ? <ClaimAdminCard email={user.email} /> : null}

      {roles.length === 0 && !bootstrap.available ? (
        <Alert tone="warning">
          <p className="font-medium">Awaiting role assignment</p>
          <p className="mt-1">
            An academy administrator needs to grant your role before you can
            access academy data. You&apos;ll see your dashboard here once that
            is done.
          </p>
        </Alert>
      ) : null}

      {isStaff(roles) ? (
        <Suspense fallback={<OverviewFallback />}>
          <StaffOverview roles={roles} />
        </Suspense>
      ) : null}

      {!isStaff(roles) && roles.length > 0 ? (
        <Suspense fallback={<OverviewFallback />}>
          <FamilyOverview userId={user.id} />
        </Suspense>
      ) : null}

      {roles.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Your access</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {roles.map((role) => (
              <div key={role} className="flex flex-col gap-0.5">
                <p className="text-sm font-medium">{ROLE_LABELS[role]}</p>
                <p className="text-sm text-[var(--foreground-muted)]">
                  {ROLE_DESCRIPTIONS[role]}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

async function StaffOverview({ roles }: { roles: AppRole[] }) {
  const showAcademy = canViewTraining(roles) || isAdmin(roles);
  const showMoney = canViewFinance(roles);

  const [counts, applications, training, matches, finance, unassessed] =
    await Promise.all([
      showAcademy ? getAcademyCounts() : null,
      countPendingApplications(),
      showAcademy ? getTrainingSummary() : null,
      canViewMatches(roles) ? getMatchesSummary() : null,
      showMoney ? getFinanceSummary() : null,
      canAssessPlayers(roles) ? countUnassessedPlayers() : null,
    ]);

  const attention: { label: string; count: number; href: string }[] = [];

  if (applications > 0) {
    attention.push({
      label:
        applications === 1
          ? "enrolment application waiting on a decision"
          : "enrolment applications waiting on a decision",
      count: applications,
      href: "/dashboard/applications",
    });
  }

  if (training && training.unmarkedThisMonth > 0) {
    attention.push({
      label:
        training.unmarkedThisMonth === 1
          ? "session this month with no register marked"
          : "sessions this month with no register marked",
      count: training.unmarkedThisMonth,
      href: "/dashboard/training?filter=unmarked",
    });
  }

  if (matches && matches.awaitingResult > 0) {
    attention.push({
      label:
        matches.awaitingResult === 1
          ? "played fixture with no result recorded"
          : "played fixtures with no result recorded",
      count: matches.awaitingResult,
      href: "/dashboard/matches?filter=unrecorded",
    });
  }

  if (finance && finance.overdueCount > 0) {
    attention.push({
      label:
        finance.overdueCount === 1 ? "invoice past its due date" : "invoices past their due date",
      count: finance.overdueCount,
      href: "/dashboard/invoices?filter=overdue",
    });
  }

  if (unassessed && unassessed > 0) {
    attention.push({
      label:
        unassessed === 1
          ? "player with no assessment on record"
          : "players with no assessment on record",
      count: unassessed,
      href: "/dashboard/development?filter=unassessed",
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {counts || finance ? (
        <section className="flex flex-col gap-3">
          <h2 className="sr-only">Academy at a glance</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {counts ? (
              <>
                <StatTile
                  label="Active players"
                  value={counts.activePlayers}
                  hint={
                    counts.applicants > 0
                      ? `${counts.applicants} awaiting enrolment`
                      : undefined
                  }
                  href="/dashboard/players"
                />
                <StatTile
                  label="Teams"
                  value={counts.activeTeams}
                  href="/dashboard/teams"
                />
              </>
            ) : null}

            {training ? (
              <StatTile
                label="Upcoming sessions"
                value={training.upcomingCount}
                hint={`${training.markedThisMonth} marked this month`}
                href="/dashboard/training"
              />
            ) : null}

            {matches ? (
              <StatTile
                label="Season record"
                value={`${matches.won}–${matches.lost}${matches.drawn > 0 ? `–${matches.drawn}` : ""}`}
                hint={
                  matches.upcomingCount > 0
                    ? `${matches.upcomingCount} fixture${matches.upcomingCount === 1 ? "" : "s"} to come`
                    : "won–lost"
                }
                href="/dashboard/matches"
              />
            ) : null}

            {finance ? (
              <>
                <StatTile
                  label="Outstanding"
                  value={formatCurrency(finance.outstanding, finance.currency)}
                  hint="across issued invoices"
                  href="/dashboard/invoices"
                />
                <StatTile
                  label="Overdue"
                  value={formatCurrency(finance.overdue, finance.currency)}
                  tone={finance.overdue > 0 ? "attention" : "neutral"}
                  hint={`${finance.overdueCount} invoice${finance.overdueCount === 1 ? "" : "s"}`}
                  href="/dashboard/invoices?filter=overdue"
                />
                <StatTile
                  label="Collected this month"
                  value={formatCurrency(
                    finance.collectedThisMonth,
                    finance.currency,
                  )}
                  hint="confirmed payments"
                  href="/dashboard/payments"
                />
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Needs attention</CardTitle>
          <CardDescription>
            Everything below is something a person has to decide or record.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {attention.length === 0 ? (
            <p className="text-sm text-[var(--foreground-muted)]">
              Nothing outstanding. Registers are marked, results are in, and no
              applications are waiting.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {attention.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 rounded-lg border border-[var(--border-color)] px-4 py-3 text-sm transition-colors hover:bg-[var(--surface-muted)]"
                  >
                    <span className="text-lg font-semibold tabular-nums">
                      {item.count}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {canViewTraining(roles) ? (
        <Suspense fallback={<Skeleton className="h-48 w-full" />}>
          <WhatIsNext showMatches={canViewMatches(roles)} />
        </Suspense>
      ) : null}
    </div>
  );
}

/** The next few things on the calendar, sessions and fixtures together. */
async function WhatIsNext({ showMatches }: { showMatches: boolean }) {
  const [sessions, matches] = await Promise.all([
    listSessions({ filter: "upcoming", limit: 5 }),
    showMatches ? listMatches({ filter: "upcoming", limit: 5 }) : [],
  ]);

  const items = [
    ...sessions.map((session) => ({
      id: session.id,
      kind: "Training" as const,
      title: session.title,
      team: session.team_name,
      startsAt: session.starts_at,
      href: `/dashboard/training/${session.id}`,
    })),
    ...matches.map((match) => ({
      id: match.id,
      kind: "Match" as const,
      title: match.opponent ?? match.title,
      team: match.team_name,
      startsAt: match.starts_at,
      href: `/dashboard/matches/${match.id}`,
    })),
  ]
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 6);

  return (
    <Card>
      <CardHeader>
        <CardTitle>What&apos;s next</CardTitle>
        <CardDescription>
          The next sessions and fixtures on the calendar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-[var(--foreground-muted)]">
            Nothing scheduled. Sessions and fixtures appear here once they are
            on the calendar.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <Link
                  href={item.href}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border-color)] px-4 py-3 transition-colors hover:bg-[var(--surface-muted)]"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Badge tone={item.kind === "Match" ? "brand" : "neutral"}>
                      {item.kind}
                    </Badge>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {item.title}
                      </span>
                      <span className="block text-xs text-[var(--foreground-muted)]">
                        {item.team ?? "Academy-wide"}
                      </span>
                    </span>
                  </span>
                  <span className="text-right text-sm">
                    {formatDate(item.startsAt)}
                    <span className="block text-xs text-[var(--foreground-muted)]">
                      {formatTime(item.startsAt)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Player & guardian
// ---------------------------------------------------------------------------

/**
 * The family's own dashboard.
 *
 * Everything hangs off the profile link an administrator makes. Without one
 * the queries genuinely cannot tell who the account is, so the page says so
 * and points at the person who can fix it rather than rendering empty cards.
 */
async function FamilyOverview({ userId }: { userId: string }) {
  const identity = await getMyIdentity(userId);

  if (identity.kind === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your account is not connected yet</CardTitle>
          <CardDescription>
            Your login works, but it has not been matched to your family&apos;s
            records — so there is nothing to show here yet. An academy
            administrator connects the two, and this page fills in once they do.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const [schedule, invoices] = await Promise.all([
    getMySchedule(identity.players, { limit: 3 }),
    getMyInvoices(identity.players),
  ]);

  const owed = invoices.reduce((total, invoice) => total + invoice.balance, 0);
  const overdue = invoices.filter((invoice) => invoice.is_overdue);
  const currency = invoices[0]?.currency ?? "KES";
  const next = schedule[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label={identity.kind === "guardian" ? "Players" : "Your teams"}
          value={
            identity.kind === "guardian"
              ? identity.players.length
              : (identity.players[0]?.teams.length ?? 0)
          }
          href="/dashboard/me"
        />
        <StatTile
          label="Next session"
          value={next ? formatDate(next.starts_at) : "—"}
          hint={next ? `${formatTime(next.starts_at)} · ${next.team_name ?? ""}` : "nothing scheduled"}
          href="/dashboard/my-schedule"
        />
        <StatTile
          label="Balance due"
          value={formatCurrency(owed, currency)}
          tone={overdue.length > 0 ? "attention" : "neutral"}
          hint={
            overdue.length > 0
              ? `${overdue.length} overdue`
              : owed > 0
                ? "not yet due"
                : "nothing owed"
          }
          href="/dashboard/my-fees"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming up</CardTitle>
          <CardDescription>
            The next sessions for {identity.kind === "guardian" ? "your family" : "your teams"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {schedule.length === 0 ? (
            <p className="text-sm text-[var(--foreground-muted)]">
              Nothing scheduled yet. Sessions appear here once the coach puts
              them on the calendar.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {schedule.map((session) => (
                <li
                  key={session.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border-color)] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {session.title}
                    </p>
                    <p className="text-xs text-[var(--foreground-muted)]">
                      {session.player_names.join(", ") ||
                        session.team_name ||
                        "Academy-wide"}
                      {session.location ? ` · ${session.location}` : ""}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    {formatDate(session.starts_at)}
                    <span className="block text-xs text-[var(--foreground-muted)]">
                      {formatTime(session.starts_at)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/dashboard/my-schedule">
              <Button variant="outline" size="sm">
                Full schedule
              </Button>
            </Link>
            <Link href="/dashboard/me">
              <Button variant="ghost" size="sm">
                {identity.kind === "guardian" ? "My family" : "My profile"}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function OverviewFallback() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
