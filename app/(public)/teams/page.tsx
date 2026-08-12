import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Users } from "lucide-react";

import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { Button } from "@/components/ui/button";
import { academy, contact } from "@/lib/content/site";
import { ageRangeLabel, listPublicSquads, type PublicSquad } from "@/lib/site/queries";

export const metadata: Metadata = {
  title: `Squads — ${academy.name}`,
  description:
    "The age-group squads training and competing at " + `${academy.name}.`,
};

/**
 * Public squads page.
 *
 * Shows the teams an administrator flagged is_public, and nothing about who is
 * on them. Rosters are children's names: team_players is not readable by anon
 * at all, so this page cannot show a roster even by mistake.
 *
 * This is the live counterpart to the hard-coded Programmes section on the
 * landing page. Programmes describe what the academy offers; squads are the
 * teams that actually exist this season.
 */
export default async function TeamsPage() {
  const squads = await listPublicSquads();

  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="border-b border-[var(--border-color)] bg-[var(--surface-muted)]">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
            <p className="text-sm font-medium text-[var(--primary)]">Squads</p>
            <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              The teams training this season
            </h1>
            <p className="mt-5 max-w-xl text-lg text-[var(--foreground-muted)]">
              Players are placed by ability as much as by age, so a squad is
              where a player is ready to compete — not simply where their
              birthday puts them.
            </p>
            <p className="mt-6 text-sm text-[var(--foreground-muted)]">
              Training {contact.trainingDays}
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          {squads.length > 0 ? (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {squads.map((squad) => (
                <SquadCard key={squad.id} squad={squad} />
              ))}
            </ul>
          ) : (
            <NoSquadsYet />
          )}
        </section>

        <section className="border-t border-[var(--border-color)] bg-[var(--surface-muted)]">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-14 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-balance">
                Not sure which squad fits?
              </h2>
              <p className="mt-2 text-[var(--foreground-muted)]">
                Apply and the coach will place your child after a first session.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/apply">
                <Button size="lg">
                  Start an application
                  <ArrowRight aria-hidden="true" />
                </Button>
              </Link>
              <Link href="/coaches">
                <Button size="lg" variant="outline">
                  Meet the coaches
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function SquadCard({ squad }: { squad: PublicSquad }) {
  const ages = ageRangeLabel(squad);

  return (
    <li className="flex flex-col rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--surface)] p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{squad.name}</h2>
        <span className="shrink-0 rounded-full bg-[var(--color-brand-50)] px-2.5 py-1 text-xs font-medium text-[var(--color-brand-700)]">
          {squad.ageGroup}
        </span>
      </div>

      {ages ? (
        <p className="mt-2 text-sm text-[var(--foreground-muted)]">{ages}</p>
      ) : null}

      {squad.description ? (
        <p className="mt-4 text-sm leading-relaxed whitespace-pre-line text-[var(--foreground-muted)]">
          {squad.description}
        </p>
      ) : null}
    </li>
  );
}

/**
 * The state of a fresh install: teams exist internally but none has been
 * published. Sends the visitor to the Programmes section, which is static copy
 * and therefore always there.
 */
function NoSquadsYet() {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-color)] px-6 py-16 text-center">
      <Users
        className="mx-auto size-8 text-[var(--foreground-muted)]"
        aria-hidden="true"
      />
      <h2 className="mt-4 text-xl font-semibold tracking-tight">
        This season&apos;s squads are being finalised
      </h2>
      <p className="mx-auto mt-3 max-w-md text-[var(--foreground-muted)]">
        Age groups are still being set. The programmes below run every term
        regardless of how the squads are drawn up.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/#programs">
          <Button>
            See the programmes
            <ArrowRight aria-hidden="true" />
          </Button>
        </Link>
        <Link href="/apply">
          <Button variant="outline">Apply to join</Button>
        </Link>
      </div>
    </div>
  );
}
