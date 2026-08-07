/**
 * Shared result shape for the player server actions.
 *
 * Kept out of lib/players/actions.ts because a "use server" module may only
 * export async functions — a plain object constant there is a build error.
 * Types are erased at compile time, but the constant is not.
 */
export type PlayerActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const emptyPlayerActionState: PlayerActionState = { ok: false };
