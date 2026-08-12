import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Mail, Phone } from "lucide-react";

import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { Button } from "@/components/ui/button";
import { academy, contact } from "@/lib/content/site";
import { listPublicCoaches, type PublicCoach } from "@/lib/site/queries";
import { getInitials } from "@/lib/utils";

export const metadata: Metadata = {
  title: `Coaching staff — ${academy.name}`,
  description:
    "Meet the coaches who run training, fixtures and player development at " +
    `${academy.name}.`,
};

/**
 * Public coaching staff page.
 *
 * Reads coach_public_profiles, which holds only what an administrator wrote for
 * publication. The staff directory at /dashboard/coaches is a different thing
 * entirely — it lists everyone holding the coach role along with their email,
 * phone and assignments, and none of that belongs here.
 *
 * A coach with no published profile simply does not appear. That is the
 * intended behaviour rather than a gap to fill: a page is not more honest for
 * listing a name with nothing to say about it.
 */
export default async function CoachesPage() {
  const coaches = await listPublicCoaches();

  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="border-b border-[var(--border-color)] bg-[var(--surface-muted)]">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
            <p className="text-sm font-medium text-[var(--primary)]">
              Coaching staff
            </p>
            <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              The people on the court with your child
            </h1>
            <p className="mt-5 max-w-xl text-lg text-[var(--foreground-muted)]">
              Every session is led by a coach who knows the players in front of
              them and what each one is working on.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          {coaches.length > 0 ? (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {coaches.map((coach) => (
                <CoachCard key={coach.id} coach={coach} />
              ))}
            </ul>
          ) : (
            <NoProfilesYet />
          )}
        </section>

        <ContactStrip />
      </main>
      <SiteFooter />
    </>
  );
}

function CoachCard({ coach }: { coach: PublicCoach }) {
  return (
    <li className="flex flex-col rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--surface)] p-6">
      <span
        className="grid size-14 place-items-center rounded-full bg-[var(--color-brand-50)] text-lg font-semibold text-[var(--color-brand-700)]"
        aria-hidden="true"
      >
        {getInitials(coach.displayName)}
      </span>

      <h2 className="mt-5 text-lg font-semibold tracking-tight">
        {coach.displayName}
      </h2>
      {coach.headline ? (
        <p className="mt-1 text-sm font-medium text-[var(--primary)]">
          {coach.headline}
        </p>
      ) : null}
      {coach.bio ? (
        <p className="mt-4 text-sm leading-relaxed whitespace-pre-line text-[var(--foreground-muted)]">
          {coach.bio}
        </p>
      ) : null}
    </li>
  );
}

/**
 * Shown before any profile is published — which is the state of a fresh
 * install, since publication is opt-in. It gives the visitor the next step
 * rather than an apology for an empty page.
 */
function NoProfilesYet() {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-color)] px-6 py-16 text-center">
      <h2 className="text-xl font-semibold tracking-tight">
        Coach profiles are on their way
      </h2>
      <p className="mx-auto mt-3 max-w-md text-[var(--foreground-muted)]">
        We are putting these together. In the meantime, call the academy and the
        coach will talk you through the programme himself.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <a href={`tel:${contact.phone.replace(/\s/g, "")}`}>
          <Button>
            <Phone className="size-4" aria-hidden="true" />
            Call the academy
          </Button>
        </a>
        <Link href="/apply">
          <Button variant="outline">
            Apply to join
            <ArrowRight aria-hidden="true" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

function ContactStrip() {
  return (
    <section className="border-t border-[var(--border-color)] bg-[var(--surface-muted)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-14 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-balance">
            Want to meet the coaches in person?
          </h2>
          <p className="mt-2 text-[var(--foreground-muted)]">
            Start an application and we will arrange a first session.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/apply">
            <Button size="lg">
              Apply to join
              <ArrowRight aria-hidden="true" />
            </Button>
          </Link>
          <a href={`mailto:${contact.email}`}>
            <Button size="lg" variant="outline">
              <Mail className="size-4" aria-hidden="true" />
              Email us
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}
