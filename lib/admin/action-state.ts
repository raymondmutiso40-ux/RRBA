/**
 * Shared result shape for the user administration actions.
 *
 * Separate from actions.ts because that file is "use server" — a client
 * component can import this type without pulling the actions in.
 */
export type AdminActionState = {
  ok: boolean;
  message?: string;
};

export const emptyAdminActionState: AdminActionState = { ok: false };
