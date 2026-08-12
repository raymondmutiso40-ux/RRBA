# RRBA

A smart system that helps the coach to advertise his academy called
Runda Ridge Basketball Academy and to manage his player track his payment

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- Supabase (Postgres, Auth, Row Level Security)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Supabase project, then copy `.env.example` to `.env.local` and fill
   in the values from your project's API settings:

   ```bash
   cp .env.example .env.local
   ```

   `SUPABASE_SERVICE_ROLE_KEY` is optional and server-only. Never expose it to
   the browser or commit it.

3. Apply every file in `supabase/migrations/` in filename order — the names are
   timestamp-prefixed, so lexical order is execution order, and later
   migrations reference tables and functions the earlier ones create.

   `db:bundle` concatenates them into one script to paste into the SQL editor,
   which is the route that works whatever state the database is in:

   ```bash
   npm run db:bundle                       # fresh database — every migration
   npm run db:bundle -- --since=NAME       # existing one — only what came after
   npm run db:bundle -- --only=NAME        # exactly one migration
   ```

   `NAME` is a full filename or any unique fragment of one. Output goes to
   `supabase/bundled-schema.sql`, which is generated and gitignored.

   Migrations are **not** idempotent — `create type` and `create table` both
   error if the object already exists — so pick the flag that matches what the
   database already has. Running the full bundle against a partly-migrated
   database is the wrong thing and fails confusingly.

   **On `supabase db push`.** It applies only the migrations absent from the
   remote `supabase_migrations.schema_migrations` table. That makes it the right
   tool for a database the CLI has managed from the start, and the wrong one for
   a database whose schema arrived through the SQL editor: the history table has
   no record of what was pasted, so push replays the migrations from the
   beginning and dies on the first `create type`.

   Backfill the history before using it, once per already-applied migration:

   ```bash
   supabase migration repair --status applied 20260807000100
   ```

4. Allow-list the app's URLs for auth emails, under **Authentication → URL
   Configuration** in the Supabase dashboard:

   ```
   Site URL       https://your-domain.example        (the deployed app)
   Redirect URLs  https://your-domain.example/**
                  http://localhost:3000/**
   ```

   Confirmation and password-reset emails carry a `redirect_to` pointing back at
   `/auth/callback`, and Supabase honours it **only** if it matches an
   allow-listed pattern. When it does not, the link silently falls back to Site
   URL — so a parent clicking "reset password" lands on Supabase's own pages
   instead of the app, with no error to explain it. Add every origin the app is
   served from, including localhost for development.

5. Set `BOOTSTRAP_ADMIN_EMAIL` to the address you will sign up with, then
   sign up. The dashboard shows a **Claim admin access** card for that
   account — one click makes you super admin and activates your account. No
   SQL required.

   The claim is gated three ways, all re-checked on the server: the env var
   must be set, no active super admin may exist yet, and your authenticated
   email must match. It disables itself permanently once an administrator
   exists. Leaving the variable blank switches the bootstrap off, so a public
   deployment never grants admin to whoever happens to sign up first.

   Every later user is activated and granted a role from the admin UI.

6. Run the dev server:

   ```bash
   npm run dev
   ```

Until `.env.local` is filled in, the app runs but `/login` and `/dashboard`
render a setup page instead of crashing.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |

## Roles

`super_admin`, `academy_admin`, `coach`, `finance`, `player`, `guardian` —
enforced in Postgres via row level security, not just in the UI. See
`supabase/migrations/20260807000500_rls_policies.sql`.
