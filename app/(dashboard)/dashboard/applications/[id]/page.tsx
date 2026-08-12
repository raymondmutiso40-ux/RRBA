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
import { isStaff } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getApplication } from "@/lib/applications/queries";
import {
  APPLICATION_STATUS_LABELS,
  applicantFullName,
  applicationStatusTone,
} from "@/lib/applications/labels";
import { GENDER_LABELS, POSITION_LABELS } from "@/lib/players/labels";
import { calculateAge, formatDate, formatDateTime } from "@/lib/utils";

import { ApplicationReview } from "../application-review";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  if (!isSupabaseConfigured()) return { title: "Application" };
  const { id } = await params;
  const application = await getApplication(id);
  return {
    title: application ? applicantFullName(application) : "Application",
  };
}

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured()) return null;

  const user = await getSessionUser();
  if (!user || !isStaff(user.roles)) return notFound();

  const { id } = await params;
  const application = await getApplication(id);
  if (!application) return notFound();

  // Only needed while the application is still actionable.
  const supabase = await createClient();
  const { data: teams } =
    application.status === "pending"
      ? await supabase
          .from("teams")
          .select("id, name, age_group")
          .eq("is_active", true)
          .order("name")
      : { data: [] };

  const name = applicantFullName(application);

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link
          href="/dashboard/applications"
          className="text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
        >
          ← Applications
        </Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--foreground-muted)]">
            <Badge tone={applicationStatusTone(application.status)}>
              {APPLICATION_STATUS_LABELS[application.status]}
            </Badge>
            <span>{calculateAge(application.date_of_birth)} years old</span>
            <span>· received {formatDate(application.created_at)}</span>
          </div>
        </div>

        {application.created_player_id ? (
          <Link href={`/dashboard/players/${application.created_player_id}`}>
            <Button variant="outline">View player record</Button>
          </Link>
        ) : null}
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Player</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Field label="Date of birth">
                {formatDate(application.date_of_birth)}
              </Field>
              <Field label="Gender">{GENDER_LABELS[application.gender]}</Field>
              <Field label="Preferred position">
                {application.position
                  ? POSITION_LABELS[application.position]
                  : "Any"}
              </Field>
              <Field label="School">{application.school ?? "—"}</Field>
              <Field label="Experience" className="sm:col-span-2">
                {application.previous_experience ?? "—"}
              </Field>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Parent or guardian</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Field label="Name">{application.guardian_name}</Field>
              <Field label="Relationship">
                {application.guardian_relationship}
              </Field>
              <Field label="Phone">
                <a
                  href={`tel:${application.guardian_phone.replace(/\s/g, "")}`}
                  className="hover:text-[var(--primary)]"
                >
                  {application.guardian_phone}
                </a>
              </Field>
              <Field label="Alternative phone">
                {application.guardian_alt_phone ?? "—"}
              </Field>
              <Field label="Email" className="sm:col-span-2">
                {application.guardian_email ? (
                  <a
                    href={`mailto:${application.guardian_email}`}
                    className="hover:text-[var(--primary)]"
                  >
                    {application.guardian_email}
                  </a>
                ) : (
                  "—"
                )}
              </Field>
              {/*
                Which account approval will attach to this family. Shown because
                approving grants that account the guardian role and a child, and
                the applicant chose the address it was matched on — so a human
                confirms it rather than the match being invisible.
              */}
              <Field label="Parent account" className="sm:col-span-2">
                {application.submitter ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <span>
                      {application.submitter.fullName || application.submitter.email}
                    </span>
                    <Badge
                      tone={
                        application.submitter.status === "active"
                          ? "success"
                          : "warning"
                      }
                    >
                      {application.submitter.status}
                    </Badge>
                    {application.submitter.email !== application.guardian_email ? (
                      <Badge tone="danger">
                        differs from the email above
                      </Badge>
                    ) : null}
                  </span>
                ) : (
                  <span className="text-[var(--foreground-muted)]">
                    None — this application was submitted before the form created
                    accounts, so approving it will not link a login.
                  </span>
                )}
              </Field>
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Programme &amp; medical</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Field label="Programme of interest">
                {application.program_interest ?? "—"}
              </Field>
              <Field label="Heard about us via">
                {application.heard_about_us ?? "—"}
              </Field>
              <Field label="Medical notes" className="sm:col-span-2">
                {application.medical_notes ?? "None declared"}
              </Field>
            </dl>
          </CardContent>
        </Card>
      </div>

      {application.status === "pending" ? (
        <Card>
          <CardHeader>
            <CardTitle>Review</CardTitle>
            <CardDescription>
              Approving creates the player record, the guardian record, and the
              link between them in one step.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ApplicationReview
              applicationId={application.id}
              teams={teams ?? []}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Decision</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Field label="Outcome">
                {APPLICATION_STATUS_LABELS[application.status]}
              </Field>
              <Field label="Reviewed">
                {application.reviewed_at
                  ? formatDateTime(application.reviewed_at)
                  : "—"}
              </Field>
              <Field label="Notes" className="sm:col-span-2">
                {application.review_notes ?? "—"}
              </Field>
            </dl>
          </CardContent>
        </Card>
      )}
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
      <dd className="mt-0.5 text-sm whitespace-pre-wrap">{children}</dd>
    </div>
  );
}
