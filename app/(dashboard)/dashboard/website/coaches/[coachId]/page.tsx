import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getSessionUser } from "@/lib/auth/session";
import { canManageWebsite } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { formatDateTime } from "@/lib/utils";
import { getWebsiteCoach, isStalePublication } from "@/lib/website/queries";

import { CoachProfileForm, CoachPublishControls } from "./coach-profile-form";

export const metadata: Metadata = { title: "Coach profile" };

/**
 * Writes one coach's public biography.
 *
 * Two separate acts, in two separate cards: saving the text, and deciding
 * whether the world sees it. Collapsing them into one button would mean every
 * correction to a typo re-publishes, and would leave no way to draft a profile
 * for a coach who has not started yet.
 */
export default async function WebsiteCoachPage({
  params,
}: {
  params: Promise<{ coachId: string }>;
}) {
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

  const { coachId } = await params;
  const coach = await getWebsiteCoach(coachId);

  // Also the answer when the id belongs to someone who is not an active coach:
  // listWebsiteCoaches only returns those, so there is nothing to publish.
  if (!coach) notFound();

  const isPublished = coach.publishedAt !== null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/dashboard/website"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Public website
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {coach.fullName || coach.email}
          </h1>
          <p className="text-sm text-[var(--foreground-muted)]">
            {coach.email} · account name, never shown on the website
          </p>
        </div>

        {isStalePublication(coach) ? (
          <Badge tone="danger">Published — take down</Badge>
        ) : isPublished ? (
          <Badge tone="success">Published</Badge>
        ) : coach.hasProfile ? (
          <Badge tone="warning">Draft</Badge>
        ) : (
          <Badge>Not written</Badge>
        )}
      </div>

      {isStalePublication(coach) ? (
        <Alert tone="warning">
          <p className="font-medium">
            This profile is on the website, but the account behind it is not an
            active coach
          </p>
          <p className="mt-1">
            {!coach.isCoach
              ? "The coach role has been removed"
              : `The account is ${coach.status}`}
            . The public page cannot check either — it goes by publication alone
            — so take the profile down here if it should no longer be shown.
          </p>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Biography</CardTitle>
          <CardDescription>
            What a visitor reads on the coaches page. Saving does not change
            whether it is published.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CoachProfileForm
            coachId={coach.id}
            displayName={coach.displayName}
            headline={coach.headline}
            bio={coach.bio ?? ""}
            sortOrder={coach.sortOrder}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Publication</CardTitle>
          <CardDescription>
            {coach.hasProfile
              ? isPublished
                ? "This profile is live on the public website."
                : "Only administrators can see this profile."
              : "Save the biography first, then it can be published."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {coach.hasProfile ? (
            <CoachPublishControls
              coachId={coach.id}
              isPublished={isPublished}
              /* Formatted here rather than in the client component: the
                 server's timezone is the academy's, and the browser's may
                 not be. */
              publishedLabel={
                coach.publishedAt ? formatDateTime(coach.publishedAt) : null
              }
            />
          ) : (
            <p className="text-sm text-[var(--foreground-muted)]">
              Nothing to publish yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
