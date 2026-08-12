/**
 * Environment access for Supabase credentials.
 *
 * Fails loudly at call time rather than letting `undefined` reach the SDK,
 * where it surfaces as an opaque network error instead of a config mistake.
 */

export function getPublicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and set " +
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return { url, anonKey };
}

/**
 * Whether Supabase credentials are present.
 *
 * Lets pages render setup guidance instead of throwing on a fresh clone,
 * where no .env.local exists yet.
 */
export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Whether the service-role key is available.
 *
 * The key is optional, so anything that needs it has to be able to carry on
 * without it. Callers use this to choose a lesser path rather than failing —
 * enrolment still takes an application when it cannot also create the login.
 */
export function isServiceRoleConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/**
 * Service-role config. Server-only — this key bypasses row-level security
 * entirely, so importing it into a client component would hand every visitor
 * unrestricted database access.
 */
export function getServiceRoleConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. Required for admin-only " +
        "server operations.",
    );
  }

  return { url, serviceRoleKey };
}

/**
 * Canonical origin for building absolute links (auth callbacks, emails).
 *
 * Falls back to the URLs Vercel injects, so a deployment does not need
 * NEXT_PUBLIC_SITE_URL set and can never silently emit localhost links in
 * production. VERCEL_PROJECT_PRODUCTION_URL is the stable domain;
 * VERCEL_URL is the per-deployment one used on previews.
 */
export function getSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) return `https://${production}`;

  const deployment = process.env.VERCEL_URL;
  if (deployment) return `https://${deployment}`;

  return "http://localhost:3000";
}
