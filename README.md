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
   migrations reference tables the earlier ones create.

   With the Supabase CLI:

   ```bash
   supabase db push
   ```

   Or, for the SQL editor, concatenate them into one script first:

   ```bash
   npm run db:bundle                    # fresh database — every migration
   npm run db:bundle -- --since=NAME    # existing one — only what is missing
   ```

   Migrations are not idempotent, so do not re-run the full bundle against a
   database that already has part of the schema.

4. Set `BOOTSTRAP_ADMIN_EMAIL` to the address you will sign up with, then
   sign up. The dashboard shows a **Claim admin access** card for that
   account — one click makes you super admin and activates your account. No
   SQL required.

   The claim is gated three ways, all re-checked on the server: the env var
   must be set, no active super admin may exist yet, and your authenticated
   email must match. It disables itself permanently once an administrator
   exists. Leaving the variable blank switches the bootstrap off, so a public
   deployment never grants admin to whoever happens to sign up first.

   Every later user is activated and granted a role from the admin UI.

5. Run the dev server:

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
