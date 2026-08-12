import Link from "next/link";
import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSessionUser } from "@/lib/auth/session";
import { canManageWebsite } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  isStalePublication,
  listWebsiteCoaches,
  listWebsiteSquads,
} from "@/lib/website/queries";

import { SquadVisibilityToggle } from "./squad-visibility";

export const metadata: Metadata = { title: "Public website" };

/**
 * What the public site shows.
 *
 * The academy's advertisement is otherwise hard-coded copy in
 * lib/content/site.ts. The two things that change term to term — who coaches
 * here and which squads are running — are database-backed, and this is where an
 * administrator decides which of those rows a visitor may see.
 *
 * Both are opt-in and off by default, so this page reads as a list of things
 * that are *not* public until someone says otherwise.
 */
export default async function WebsitePage() {
  if (!isSupabaseConfigured()) return null;

  const user = await getSessionUser();
  if (!user) return null;

  if (!canManageWebsite(user.roles)) {
    return (
      <EmptyState
        title="No access to the public website"
        description="Editing what the website shows is limited to academy administrators."
      />
    );
  }

  const [coaches, squads] = await Promise.all([
    listWebsiteCoaches(),
    listWebsiteSquads(),
  ]);

  const publishedCoaches = coaches.filter((coach) => coach.publishedAt !== null);
  const publicSquads = squads.filter((squad) => squad.isPublic);
  const stale = coaches.filter(isStalePublication);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Public website
          </h1>
          <p className="text-sm text-[var(--foreground-muted)]">
            {publishedCoaches.length} of {coaches.length}{" "}
            {coaches.length === 1 ? "coach" : "coaches"} and{" "}
            {publicSquads.length} of {squads.length}{" "}
            {squads.length === 1 ? "squad" : "squads"} are shown to visitors.
          </p>
        </div>

        <Link href="/" target="_blank">
          <Button variant="outline">
            View the site
            <ExternalLink aria-hidden="true" />
          </Button>
        </Link>
      </div>

      <Alert>
        <p className="font-medium">Nothing here is public until you publish it</p>
        <p className="mt-1">
          A coach appears on the site only once their profile is written and
          published, and a squad only once it is switched on. Contact details are
          never published — no email or phone number from an account reaches the
          public site.
        </p>
      </Alert>

      {stale.length > 0 ? (
        <Alert tone="warning">
          <p className="font-medium">
            {stale.length === 1
              ? "A published profile belongs to someone who is no longer an active coach"
              : `${stale.length} published profiles belong to people who are no longer active coaches`}
          </p>
          <p className="mt-1">
            Removing a role or suspending an account does not take a profile off
            the website — the public page has no way to check either. Take these
            down here:{" "}
            {stale.map((coach, index) => (
              <span key={coach.id}>
                {index > 0 ? ", " : ""}
                <Link
                  href={`/dashboard/website/coaches/${coach.id}`}
                  className="underline hover:no-underline"
                >
                  {coach.displayName}
                </Link>
              </span>
            ))}
            .
          </p>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Coach profiles</CardTitle>
          <CardDescription>
            The biography shown at{" "}
            <Link href="/coaches" className="underline hover:no-underline">
              /coaches
            </Link>
            . The public name is separate from the account name, so a coach can
            be listed as they are known on the court.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {coaches.length === 0 ? (
            <EmptyState
              title="No coaches to publish"
              description="Grant somebody the coach role under Users & roles and their profile can be written here."
              action={
                <Link href="/dashboard/users">
                  <Button>Go to users &amp; roles</Button>
                </Link>
              }
            />
          ) : (
            <Table>
              <caption className="sr-only">
                Coach profiles, {coaches.length} shown
              </caption>
              <TableHeader>
                <tr>
                  <TableHead>Coach</TableHead>
                  <TableHead>Shown as</TableHead>
                  <TableHead>Headline</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Website</TableHead>
                  <TableHead>
                    <span className="sr-only">Edit</span>
                  </TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {coaches.map((coach) => (
                  <TableRow key={coach.id}>
                    <TableCell>
                      <span className="font-medium">
                        {coach.fullName || coach.email}
                      </span>
                      <span className="block text-xs text-[var(--foreground-muted)]">
                        {coach.email}
                        {!coach.isCoach ? " · no longer a coach" : ""}
                        {coach.status !== "active"
                          ? ` · account ${coach.status}`
                          : ""}
                      </span>
                    </TableCell>
                    <TableCell>
                      {coach.hasProfile ? (
                        coach.displayName
                      ) : (
                        <span className="text-[var(--foreground-muted)]">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-56 truncate text-[var(--foreground-muted)]">
                      {coach.headline || "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {coach.hasProfile ? coach.sortOrder : "—"}
                    </TableCell>
                    <TableCell>
                      {isStalePublication(coach) ? (
                        <Badge tone="danger">Published — take down</Badge>
                      ) : coach.publishedAt !== null ? (
                        <Badge tone="success">Published</Badge>
                      ) : coach.hasProfile ? (
                        <Badge tone="warning">Draft</Badge>
                      ) : (
                        <Badge>Not written</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link href={`/dashboard/website/coaches/${coach.id}`}>
                        <Button variant="outline" size="sm">
                          {coach.hasProfile ? "Edit" : "Write"}
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Squads</CardTitle>
          <CardDescription>
            Which active teams appear at{" "}
            <Link href="/teams" className="underline hover:no-underline">
              /teams
            </Link>
            . Only the squad&apos;s name, age group and description are shown —
            never the roster.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {squads.length === 0 ? (
            <EmptyState
              title="No active teams"
              description="Create a team and it can be shown on the website."
              action={
                <Link href="/dashboard/teams">
                  <Button>Go to teams</Button>
                </Link>
              }
            />
          ) : (
            <Table>
              <caption className="sr-only">
                Active squads, {squads.length} shown
              </caption>
              <TableHeader>
                <tr>
                  <TableHead>Squad</TableHead>
                  <TableHead>Age group</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Website</TableHead>
                  <TableHead>
                    <span className="sr-only">Show or hide</span>
                  </TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {squads.map((squad) => (
                  <TableRow key={squad.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/teams/${squad.id}`}
                        className="font-medium hover:underline"
                      >
                        {squad.name}
                      </Link>
                    </TableCell>
                    <TableCell>{squad.ageGroup}</TableCell>
                    <TableCell className="max-w-64 truncate text-[var(--foreground-muted)]">
                      {squad.description || (
                        <span className="text-[var(--foreground-muted)]">
                          No description
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {squad.isPublic ? (
                        <Badge tone="success">Shown</Badge>
                      ) : (
                        <Badge>Hidden</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <SquadVisibilityToggle
                        teamId={squad.id}
                        name={squad.name}
                        isPublic={squad.isPublic}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
