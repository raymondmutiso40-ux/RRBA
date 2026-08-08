/**
 * Shared result shape for every training and attendance server action.
 *
 * Lives apart from actions.ts because that file is "use server" — client
 * components can import a type from here without pulling the actions in.
 */
export type ActivityActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const emptyActivityActionState: ActivityActionState = { ok: false };
