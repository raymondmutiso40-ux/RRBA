import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/lib/supabase/types";
import { getPublicSupabaseConfig, getServiceRoleConfig } from "@/lib/supabase/config";

/**
 * Supabase client for server components, server actions, and route handlers.
 *
 * Uses the anon key and the caller's session cookie, so RLS applies exactly
 * as it does in the browser.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getPublicSupabaseConfig();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server components cannot set cookies. Session refresh is handled
          // by middleware, so this is safe to ignore.
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses row-level security completely.
 *
 * Reserved for operations that legitimately act outside any user's
 * permissions — granting the first super admin, or promoting a verified
 * M-Pesa callback into the payments ledger.
 *
 * Never import this from a client component, and always check the caller's
 * own permissions before using it.
 */
export function createAdminClient() {
  const { url, serviceRoleKey } = getServiceRoleConfig();

  return createServerClient<Database>(url, serviceRoleKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        // Service-role client is stateless — it must never adopt a session.
      },
    },
  });
}
