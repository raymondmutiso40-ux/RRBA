/**
 * Shared result shape for the super-admin bootstrap action.
 *
 * This module deliberately has no imports. It is read by both the client
 * component that renders the claim form and the "use server" action module,
 * and it must not pull anything server-only (next/headers, the Supabase
 * server client) into the browser bundle.
 *
 * It cannot live in lib/auth/bootstrap.ts, which imports the server client,
 * nor in lib/auth/bootstrap-actions.ts, where a "use server" module may only
 * export async functions.
 */
export type BootstrapActionState = {
  ok: boolean;
  message?: string;
};

export const emptyBootstrapActionState: BootstrapActionState = { ok: false };
