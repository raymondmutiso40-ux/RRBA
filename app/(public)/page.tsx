import Link from "next/link";
import type { Metadata } from "next";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Target,
  Trophy,
} from "lucide-react";

import { InstagramIcon } from "@/components/icons/instagram";
import { Button } from "@/components/ui/button";
import { academy, contact, instagram, pillars, programs, stats } from "@/lib/content/site";

export const metadata: Metadata = {
  title: `${academy.name} — Basketball coaching in ${academy.location}`,
  description: academy.intro,
  openGraph: {
    title: academy.name,
    description: academy.intro,
    type: "website",
  },
};

/**
 * Public landing page — the academy's advertisement.
 *
 * Copy and figures live in lib/content/site.ts so the coach can edit them
 * without touching layout. Sections are static by design; when the gallery and
 * achievements tables have real rows behind them, the showcase section can read
 * from the database instead.
 */

const pillarIcons = {
  target: Target,
  activity: Activity,
  trophy: Trophy,
  shield: ShieldCheck,
} as const;

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <Hero />
        <StatsStrip />
        <Pillars />
        <Programs />
        <InstagramShowcase />
        <CallToAction />
      </main>
      <SiteFooter />
    </>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border-color)] bg-[var(--background)]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3.5">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <span
            className="grid size-9 place-items-center rounded-lg bg-[var(--primary)] text-sm font-bold text-[var(--primary-foreground)]"
            aria-hidden="true"
          >
            {academy.initials}
          </span>
          <span className="text-sm">
            {academy.shortName}
            <span className="block text-xs font-normal text-[var(--foreground-muted)]">
              Basketball Academy
            </span>
          </span>
        </Link>

        <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
          <Link
            href="#programs"
            className="hidden rounded-lg px-3 py-2 text-sm text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] sm:block"
          >
            Programmes
          </Link>
          <a
            href={instagram.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden rounded-lg px-3 py-2 text-sm text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] sm:block"
          >
            Gallery
          </a>
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
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-[var(--color-ink-950)] text-white">
      <div
        className="absolute inset-0 -z-10"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 15% 15%, oklch(0.60 0.19 42 / 0.45), transparent 60%)," +
            "radial-gradient(ellipse 60% 50% at 85% 80%, oklch(0.50 0.16 40 / 0.35), transparent 60%)",
        }}
      />
      {/* Half-court arc, echoing a baseline view. */}
      <svg
        className="absolute -right-24 -bottom-32 -z-10 size-[34rem] text-white/[0.07]"
        viewBox="0 0 200 200"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <circle cx="100" cy="100" r="95" />
        <circle cx="100" cy="100" r="58" />
        <circle cx="100" cy="100" r="22" />
        <path d="M5 100h190M100 5v190" />
      </svg>

      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <p className="flex items-center gap-2 text-sm font-medium text-[var(--color-brand-300)]">
          <MapPin className="size-4" aria-hidden="true" />
          {academy.location}
        </p>
        <h1 className="mt-5 max-w-3xl text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl">
          {academy.tagline}
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
          {academy.intro}
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link href="/apply">
            <Button size="lg" className="shadow-lg shadow-[var(--color-brand-900)]/40">
              Apply to join
              <ArrowRight aria-hidden="true" />
            </Button>
          </Link>
          <a href={instagram.url} target="_blank" rel="noopener noreferrer">
            <Button
              size="lg"
              variant="outline"
              className="border-white/25 text-white hover:bg-white/10"
            >
              <InstagramIcon className="size-4" />
              See us on Instagram
            </Button>
          </a>
        </div>
        <p className="mt-6 flex items-center gap-2 text-sm text-white/50">
          <CalendarDays className="size-4" aria-hidden="true" />
          Training {contact.trainingDays}
        </p>
      </div>
    </section>
  );
}
function StatsStrip() {
  return (
    <section className="border-b border-[var(--border-color)] bg-[var(--surface)]">
      <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-y-8 px-6 py-12 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <dt className="sr-only">{stat.label}</dt>
            <dd>
              <span className="block text-3xl font-semibold tracking-tight text-[var(--primary)] sm:text-4xl">
                {stat.value}
              </span>
              <span className="mt-1.5 block text-sm text-[var(--foreground-muted)]">
                {stat.label}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Pillars() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-[var(--primary)]">Our approach</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Coaching that goes further than drills
        </h2>
        <p className="mt-4 text-lg text-[var(--foreground-muted)]">
          Talent shows up on its own. Everything after that takes structure —
          which is what the academy is built around.
        </p>
      </div>

      <ul className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2">
        {pillars.map((pillar) => {
          const Icon = pillarIcons[pillar.icon];
          return (
            <li key={pillar.title} className="flex gap-4">
              <span
                className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--color-brand-50)] text-[var(--color-brand-700)]"
                aria-hidden="true"
              >
                <Icon className="size-5" />
              </span>
              <div>
                <h3 className="font-medium">{pillar.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--foreground-muted)]">
                  {pillar.body}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Programs() {
  return (
    <section
      id="programs"
      className="scroll-mt-20 border-y border-[var(--border-color)] bg-[var(--surface-muted)]"
    >
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-[var(--primary)]">Programmes</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            A pathway for every age
          </h2>
          <p className="mt-4 text-lg text-[var(--foreground-muted)]">
            Players move up as they are ready, not as they turn a year older.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {programs.map((program) => (
            <article
              key={program.id}
              className="group flex flex-col rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--surface)] p-6 transition-shadow hover:shadow-lg hover:shadow-black/[0.04]"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-lg font-semibold tracking-tight">
                  {program.name}
                </h3>
                <span className="shrink-0 rounded-full bg-[var(--color-brand-50)] px-2.5 py-1 text-xs font-medium text-[var(--color-brand-700)]">
                  {program.ages}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[var(--foreground-muted)]">
                {program.summary}
              </p>
              <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-[var(--border-color)] pt-4 text-xs text-[var(--foreground-muted)]">
                {program.points.map((point) => (
                  <li key={point} className="flex items-center gap-1.5">
                    <span
                      className="size-1.5 rounded-full bg-[var(--primary)]"
                      aria-hidden="true"
                    />
                    {point}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
function InstagramShowcase() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--color-ink-950)] text-white">
        <div className="grid gap-10 p-8 sm:p-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-[var(--color-brand-300)]">
              <InstagramIcon className="size-4" />
              {instagram.handle}
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              See the work, session by session
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-white/70">
              Training clips, game-day highlights and the day-to-day of the
              academy are posted to Instagram. It is the fastest way to see how
              the coach works before you get in touch.
            </p>
            <a
              href={instagram.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex"
            >
              <Button size="lg" className="shadow-lg shadow-[var(--color-brand-900)]/40">
                <InstagramIcon className="size-4" />
                Follow {instagram.handle}
                <ArrowRight aria-hidden="true" />
              </Button>
            </a>
          </div>

          {/*
            A styled link tile rather than embedded posts. Showing real photos
            requires the Instagram Basic Display API and a long-lived token;
            mocked-up screenshots here would be a fabrication of the academy's
            actual feed.
          */}
          <a
            href={instagram.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative grid aspect-[4/3] place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-colors hover:bg-white/[0.06]"
          >
            <div
              className="absolute inset-0"
              aria-hidden="true"
              style={{
                background:
                  "radial-gradient(circle at 30% 25%, oklch(0.60 0.19 42 / 0.30), transparent 55%)," +
                  "radial-gradient(circle at 75% 80%, oklch(0.50 0.16 40 / 0.25), transparent 55%)",
              }}
            />
            <div className="relative flex flex-col items-center gap-3 text-center">
              <span className="grid size-16 place-items-center rounded-2xl bg-white/10 backdrop-blur-sm transition-transform group-hover:scale-105">
                <InstagramIcon className="size-8" />
              </span>
              <span className="text-lg font-medium">{instagram.handle}</span>
              <span className="text-sm text-white/60">
                Photos, clips &amp; highlights
              </span>
            </div>
          </a>
        </div>
      </div>
    </section>
  );
}

function CallToAction() {
  return (
    <section className="border-t border-[var(--border-color)] bg-[var(--surface-muted)]">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Ready to put your child on the court?
            </h2>
            <p className="mt-4 max-w-lg text-lg text-[var(--foreground-muted)]">
              Register to start an application. We will be in touch to arrange a
              first session and find the right age group.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/apply">
                <Button size="lg">
                  Start an application
                  <ArrowRight aria-hidden="true" />
                </Button>
              </Link>
              <a href={`tel:${contact.phone.replace(/\s/g, "")}`}>
                <Button size="lg" variant="outline">
                  Call the academy
                </Button>
              </a>
            </div>
          </div>

          <dl className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--surface)] p-6">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--primary)]" aria-hidden="true" />
              <div>
                <dt className="text-xs tracking-wide text-[var(--foreground-muted)] uppercase">
                  Location
                </dt>
                <dd className="mt-0.5 text-sm">{academy.location}</dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-[var(--primary)]" aria-hidden="true" />
              <div>
                <dt className="text-xs tracking-wide text-[var(--foreground-muted)] uppercase">
                  Training days
                </dt>
                <dd className="mt-0.5 text-sm">{contact.trainingDays}</dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 size-4 shrink-0 text-[var(--primary)]" aria-hidden="true" />
              <div>
                <dt className="text-xs tracking-wide text-[var(--foreground-muted)] uppercase">
                  Phone
                </dt>
                <dd className="mt-0.5 text-sm">
                  <a
                    href={`tel:${contact.phone.replace(/\s/g, "")}`}
                    className="hover:text-[var(--primary)]"
                  >
                    {contact.phone}
                  </a>
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 size-4 shrink-0 text-[var(--primary)]" aria-hidden="true" />
              <div>
                <dt className="text-xs tracking-wide text-[var(--foreground-muted)] uppercase">
                  Email
                </dt>
                <dd className="mt-0.5 text-sm">
                  <a
                    href={`mailto:${contact.email}`}
                    className="hover:text-[var(--primary)]"
                  >
                    {contact.email}
                  </a>
                </dd>
              </div>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border-color)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">{academy.name}</p>
          <p className="mt-1 text-sm text-[var(--foreground-muted)]">
            © {new Date().getFullYear()} · {academy.location}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <a
            href={instagram.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-[var(--foreground-muted)] transition-colors hover:text-[var(--primary)]"
          >
            <InstagramIcon className="size-4" />
            {instagram.handle}
          </a>
          <Link
            href="/login"
            className="text-sm text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]"
          >
            Member sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
