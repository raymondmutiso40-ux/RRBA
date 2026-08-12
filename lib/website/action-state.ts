/**
 * Shared result shape for the public-website server actions.
 *
 * Separate from actions.ts because that file is "use server" — the forms are
 * client components and need the type without importing the actions' module
 * graph.
 */
export type WebsiteActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const emptyWebsiteActionState: WebsiteActionState = { ok: false };
