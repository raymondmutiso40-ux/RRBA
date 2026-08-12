"use client";

import { useSyncExternalStore } from "react";

import { Alert } from "@/components/ui/alert";

/**
 * Explains why an email link did not work.
 *
 * Supabase reports failures from /auth/v1/verify in the URL *fragment*:
 *
 *   /auth/callback?next=/update-password#error=access_denied
 *     &error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired
 *
 * A fragment is never sent to the server, so neither the callback route nor any
 * server component can see it. Without something reading it in the browser the
 * reason is simply lost: the callback finds no `code`, bounces to /login, and
 * the reader is left on a page that says nothing about the link they just
 * clicked. That is what made an expired reset link look like a broken app.
 *
 * The query string is read too, for the errors the callback route reports
 * itself.
 *
 * useSyncExternalStore rather than an effect that sets state: the fragment is
 * external browser state, and this is the hook meant for reading it. It also
 * gives a server snapshot, so the markup matches on both sides and nothing
 * flashes or warns about hydration.
 *
 * The fragment is deliberately left in the URL. Clearing it would mean the
 * message vanishing on the next render, and a reader who has to describe what
 * happened is better off with the evidence still in the address bar.
 */

/** Supabase's codes, plus the ones the callback route raises itself. */
const MESSAGES: Record<string, string> = {
  otp_expired:
    "That link has expired. Reset links are only valid for a short time — request a new one below.",
  access_denied:
    "That link is no longer valid. It may already have been used — request a new one below.",
  invalid_code:
    "That link has already been used, or it expired. Request a new one below.",
  missing_code:
    "That link was incomplete. Request a new one below, and open it in the same browser you requested it from.",
};

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/** The fragment and query together — everything that could carry an error. */
function getClientSnapshot() {
  return window.location.hash + "\n" + window.location.search;
}

/** Nothing to report during server rendering, where there is no URL fragment. */
function getServerSnapshot() {
  return "\n";
}

export function AuthErrorNotice() {
  const snapshot = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  const message = describe(snapshot);
  if (!message) return null;

  return (
    <Alert tone="warning">
      <p className="font-medium">This link did not work</p>
      <p className="mt-1">{message}</p>
    </Alert>
  );
}

function describe(snapshot: string): string | null {
  const [rawHash, rawQuery] = snapshot.split("\n");

  const hash = new URLSearchParams((rawHash ?? "").replace(/^#/, ""));
  const query = new URLSearchParams(rawQuery ?? "");

  // The fragment first: Supabase's own code is more specific than the fallback
  // the callback route substitutes when it sees no `code` at all.
  const code =
    hash.get("error_code") ?? hash.get("error") ?? query.get("error");

  if (!code) return null;

  return (
    MESSAGES[code] ??
    // Supabase's description is form-encoded in the fragment.
    hash.get("error_description")?.replace(/\+/g, " ") ??
    "That link could not be used. Request a new one below."
  );
}
