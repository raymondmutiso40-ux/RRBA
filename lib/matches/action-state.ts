/**
 * Shared result shape for every match server action.
 *
 * Lives apart from actions.ts because that file is "use server" — client
 * components can import a type from here without pulling the actions in.
 */
export type MatchActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const emptyMatchActionState: MatchActionState = { ok: false };
