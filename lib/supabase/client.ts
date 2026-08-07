import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/supabase/types";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";

/**
 * Supabase client for use in client components.
 *
 * Only ever carries the anon key, so every query it makes is subject to
 * row-level security.
 */
export function createClient() {
  const { url, anonKey } = getPublicSupabaseConfig();
  return createBrowserClient<Database>(url, anonKey);
}
