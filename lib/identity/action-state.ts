/**
 * Shared result shape for the account-linking server actions.
 *
 * Lives apart from actions.ts because that file is "use server" — client
 * components can import a type from here without pulling the actions in.
 */
export type IdentityActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const emptyIdentityActionState: IdentityActionState = { ok: false };
