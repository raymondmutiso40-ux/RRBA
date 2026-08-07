import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const STEPS = [
  {
    title: "Generate the combined SQL file",
    body: "Run `npm run db:bundle` in the project root. It concatenates every file in supabase/migrations in the correct order into supabase/bundled-schema.sql, so you paste once instead of running six files by hand.",
  },
  {
    title: "Run it in the Supabase SQL Editor",
    body: "Open your project → SQL Editor → New query, paste the whole file, and press Run. Run it only once — a second run fails because the tables already exist.",
  },
  {
    title: "Reload this page",
    body: "Your sign-in is already valid, so once the tables exist your profile row is created and the dashboard appears. No need to sign up again.",
  },
];

/**
 * Shown when credentials are valid and the token is good, but the tables are
 * absent — the state you land in by signing up before applying the migrations.
 *
 * This deliberately does not redirect. The proxy bounces authenticated users
 * from /login back to /dashboard, so redirecting a signed-in user with no
 * profile row produces an infinite loop rather than an error page.
 */
export function SchemaMissing() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center px-6 py-16"
    >
      <Card>
        <CardHeader>
          <CardTitle>One step left: create the tables</CardTitle>
          <CardDescription>
            You are signed in and the database credentials are working, but the
            tables have not been created yet, so there is no profile to load.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-5">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--surface-muted)] text-sm font-semibold text-[var(--primary)]"
                >
                  {i + 1}
                </span>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold">{step.title}</p>
                  <p className="text-sm leading-relaxed text-[var(--foreground-muted)]">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-6 border-t border-[var(--border-color)] pt-5 text-sm text-[var(--foreground-muted)]">
            Your account already exists in authentication. Applying the
            migrations is what gives it a profile.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
