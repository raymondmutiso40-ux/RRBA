/**
 * Shared result shape for every development server action.
 *
 * Lives apart from actions.ts because that file is "use server" — client
 * components can import a type from here without pulling the actions in.
 */
export type DevelopmentActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const emptyDevelopmentActionState: DevelopmentActionState = {
  ok: false,
};
