import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * M0 landing page.
 *
 * A real but minimal front door so the site is navigable end to end. The full
 * marketing site — programs, teams, coaches, gallery, achievements, contact —
 * is M1, and its content will come from the database rather than this file.
 */
export default function HomePage() {
  return (
    <>
      <header className="border-b border-[var(--border-color)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <span
              className="grid size-9 place-items-center rounded-lg bg-[var(--primary)] text-sm font-bold text-[var(--primary-foreground)]"
              aria-hidden="true"
            >
              RR
            </span>
            <span className="text-sm">
              Runda Ridge
              <span className="block text-xs font-normal text-[var(--foreground-muted)]">
                Basketball Academy
              </span>
            </span>
          </Link>

          <nav aria-label="Primary" className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Register</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main id="main">
        <section className="relative overflow-hidden border-b border-[var(--border-color)]">
          <div
            className="absolute inset-0 -z-10 opacity-[0.07]"
            aria-hidden="true"
            style={{
              background:
                "radial-gradient(circle at 20% 30%, var(--color-brand-500), transparent 45%)," +
                "radial-gradient(circle at 80% 70%, var(--color-brand-700), transparent 50%)",
            }}
          />
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-20 sm:py-28">
            <p className="text-sm font-medium text-[var(--primary)]">
              Nairobi, Kenya
            </p>
            <h1 className="max-w-3xl text-4xl leading-[1.1] font-semibold tracking-tight sm:text-5xl">
              Developing the next generation of basketball talent
            </h1>
            <p className="max-w-xl text-lg text-[var(--foreground-muted)]">
              Runda Ridge Basketball Academy combines structured coaching,
              competitive play, and individual development tracking to help
              young players reach their potential.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/signup">
                <Button size="lg">Apply to join</Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline">
                  Member sign in
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">
            Built for player development
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              {
                title: "Structured coaching",
                body: "Age-group teams with dedicated coaches and consistent training schedules.",
              },
              {
                title: "Tracked progress",
                body: "Skills assessed over time across twelve development areas, so growth is visible.",
              },
              {
                title: "Competitive play",
                body: "Regular fixtures with per-player statistics recorded for every match.",
              },
            ].map((item) => (
              <Card key={item.title}>
                <CardContent className="flex flex-col gap-2 p-5">
                  <h3 className="font-medium">{item.title}</h3>
                  <p className="text-sm text-[var(--foreground-muted)]">
                    {item.body}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border-color)]">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <p className="text-sm text-[var(--foreground-muted)]">
            © {new Date().getFullYear()} Runda Ridge Basketball Academy
          </p>
        </div>
      </footer>
    </>
  );
}
