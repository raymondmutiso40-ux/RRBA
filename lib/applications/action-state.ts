/**
 * Shared result shape for the application server actions.
 *
 * No imports, deliberately: this is read by both a client component and a
 * "use server" module, so it must not pull server-only code into the browser
 * bundle. Same reasoning as lib/players/action-state.ts.
 */
export type ApplicationActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const emptyApplicationActionState: ApplicationActionState = {
  ok: false,
};
