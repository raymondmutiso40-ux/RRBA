import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const STEPS = [
  {
    title: "Create a Supabase project",
    body: "Sign in at supabase.com and create a project. Any region works; pick the one closest to Nairobi for lowest latency.",
  },
  {
    title: "Copy the environment template",
    body: "Duplicate .env.example to .env.local in the project root. .env.local is gitignored and never committed.",
  },
  {
    title: "Fill in the project credentials",
    body: "From Project Settings → API, copy the Project URL and the anon/publishable key into the matching variables. The service role key is optional and server-only — leave it blank until an admin task needs it.",
  },
  {
    title: "Apply the database migrations",
    body: "Run the SQL files in supabase/migrations in filename order, either via the Supabase SQL editor or the Supabase CLI.",
  },
  {
    title: "Restart the dev server",
    body: "Next.js reads environment variables at boot, so stop and restart npm run dev to pick up the new values.",
  },
];

/**
 * Shown in place of authenticated UI when Supabase credentials are absent.
 * Keeps a fresh clone from surfacing a raw server error on /dashboard.
 */
export function SetupRequired() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center px-6 py-16"
    >
      <Card>
        <CardHeader>
          <CardTitle>Finish connecting Supabase</CardTitle>
          <CardDescription>
            The app is running, but no database credentials are configured yet.
            These five steps get the dashboard online.
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
            No credentials are stored in the repository. Everything above stays
            local to your machine.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
