import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Which credentials are present, evaluated at render.
 *
 * NEXT_PUBLIC_* values are inlined at build time, so on a hosted deploy a
 * missing one means the *build* had no value — adding it to the dashboard
 * without redeploying will not fix it. That distinction is the single most
 * common reason this page keeps appearing, so it is called out explicitly.
 */
function readEnvStatus() {
  return [
    {
      name: "NEXT_PUBLIC_SUPABASE_URL",
      present: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      required: true,
      note: "Project URL, e.g. https://abcdefgh.supabase.co",
    },
    {
      name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      present: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      required: true,
      note: "Safe to expose — row-level security is what protects the data.",
    },
    {
      name: "SUPABASE_SERVICE_ROLE_KEY",
      present: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      required: false,
      note: "Server-only. Needed to claim the first admin account.",
    },
    {
      name: "BOOTSTRAP_ADMIN_EMAIL",
      present: Boolean(process.env.BOOTSTRAP_ADMIN_EMAIL),
      required: false,
      note: "The email allowed to claim administrator access.",
    },
  ];
}

/** Hosted on Vercel, or someone's laptop? The fix differs. */
function detectPlatform() {
  if (process.env.VERCEL === "1") {
    return {
      hosted: true,
      label:
        process.env.VERCEL_ENV === "production"
          ? "Vercel — Production"
          : `Vercel — ${process.env.VERCEL_ENV ?? "Preview"}`,
    };
  }
  return { hosted: false, label: "Local development" };
}

const HOSTED_STEPS = [
  {
    title: "Open your project's environment variables",
    body: "In Vercel: Settings → Environment Variables. Add each missing variable listed above, with the value from Supabase → Project Settings → API.",
  },
  {
    title: "Tick every environment",
    body: "Apply each variable to Production, Preview and Development. A variable added to Production only will still be missing on preview deployments, which is why the page can persist on some URLs but not others.",
  },
  {
    title: "Redeploy — this step is not optional",
    body: "NEXT_PUBLIC_* values are baked into the bundle when the app is built, so the running deployment cannot pick them up. Go to Deployments → ⋯ → Redeploy on the latest one.",
  },
  {
    title: "Apply the database migrations",
    body: "Run `npm run db:bundle`, then paste supabase/bundled-schema.sql into the Supabase SQL Editor and run it once. Without this the tables do not exist and signup fails even with credentials set.",
  },
];

const LOCAL_STEPS = [
  {
    title: "Create .env.local in the project root",
    body: "Copy .env.example to .env.local. It is gitignored, so it never reaches the repository.",
  },
  {
    title: "Fill in the credentials",
    body: "From Supabase → Project Settings → API, copy the Project URL and the anon/publishable key into the variables listed above.",
  },
  {
    title: "Restart the server",
    body: "Environment variables are read at boot. Stop the process and run `npm run dev` again — a hot reload will not pick them up.",
  },
  {
    title: "Apply the database migrations",
    body: "Run `npm run db:bundle`, then paste supabase/bundled-schema.sql into the Supabase SQL Editor and run it once. Without this the tables do not exist and signup fails even with credentials set.",
  },
];

/**
 * Shown in place of authenticated UI when Supabase credentials are absent.
 * Reports which specific variables are missing rather than generic setup
 * prose, so the cause is visible without reading any code.
 */
export function SetupRequired() {
  const env = readEnvStatus();
  const platform = detectPlatform();
  const missingRequired = env.filter((v) => v.required && !v.present);
  const steps = platform.hosted ? HOSTED_STEPS : LOCAL_STEPS;

  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center px-6 py-16"
    >
      <Card>
        <CardHeader>
          <CardTitle>Finish connecting Supabase</CardTitle>
          <CardDescription>
            {missingRequired.length === 1
              ? `${missingRequired[0]!.name} is not set, so the app cannot reach your database.`
              : `${missingRequired.length} required credentials are not set, so the app cannot reach your database.`}{" "}
            Detected environment: <strong>{platform.label}</strong>.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Diagnosis first — the specific missing name is the actionable part */}
          <ul className="mb-8 flex flex-col gap-3">
            {env.map((v) => (
              <li key={v.name} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className={
                    "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-xs font-bold " +
                    (v.present
                      ? "bg-[color-mix(in_oklab,var(--color-success,#16a34a)_18%,transparent)] text-[var(--color-success,#16a34a)]"
                      : v.required
                        ? "bg-[color-mix(in_oklab,var(--color-danger,#dc2626)_18%,transparent)] text-[var(--color-danger,#dc2626)]"
                        : "bg-[var(--surface-muted)] text-[var(--foreground-muted)]")
                  }
                >
                  {v.present ? "✓" : "!"}
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="font-mono text-xs break-all">
                    {v.name}
                    <span className="ml-2 font-sans text-[var(--foreground-muted)]">
                      {v.present
                        ? "set"
                        : v.required
                          ? "missing — required"
                          : "missing — optional"}
                    </span>
                  </p>
                  <p className="text-xs leading-relaxed text-[var(--foreground-muted)]">
                    {v.note}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <ol className="flex flex-col gap-5 border-t border-[var(--border-color)] pt-6">
            {steps.map((step, i) => (
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
            No credentials are stored in the repository. This page reports only
            whether each variable has a value, never the value itself.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
