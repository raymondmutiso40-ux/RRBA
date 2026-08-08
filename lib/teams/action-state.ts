/**
 * Shared result shape for every team server action.
 *
 * Lives apart from actions.ts because that file is "use server" — client
 * components can import a type from here without pulling the actions in.
 */
export type TeamActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const emptyTeamActionState: TeamActionState = { ok: false };
