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

3. Apply the database migrations in order, either with the Supabase CLI
   (`supabase db push`) or by pasting each file into the SQL editor:

   ```
   supabase/migrations/20260807000100_identity_and_rbac.sql
   supabase/migrations/20260807000200_academy_core.sql
   supabase/migrations/20260807000300_activity_and_development.sql
   supabase/migrations/20260807000400_finance_and_platform.sql
   supabase/migrations/20260807000500_rls_policies.sql
   ```

4. Sign up once through the app, then bootstrap yourself as super admin.
   New accounts are created `pending` with no role, so the first user has to
   both activate the profile and grant the role — there is no admin yet to do
   it for them:

   ```sql
   update profiles set status = 'active' where email = 'you@example.com';

   insert into user_roles (user_id, role)
   select id, 'super_admin' from profiles where email = 'you@example.com';
   ```

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
