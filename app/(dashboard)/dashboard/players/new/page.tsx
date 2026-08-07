import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getSessionUser } from "@/lib/auth/session";
import { canCreatePlayers } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";

import { PlayerForm } from "../player-form";

export const metadata: Metadata = {
  title: "Add player",
};

export default async function NewPlayerPage() {
  if (!isSupabaseConfigured()) return null;

  const user = await getSessionUser();

  // Only admins hold the insert policy on players. Coaches reaching this URL
  // get a 404 rather than a form that would fail on submit.
  if (!user || !canCreatePlayers(user.roles)) return notFound();

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link
          href="/dashboard/players"
          className="text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
        >
          ← Players
        </Link>
      </nav>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Add player</h1>
        <p className="text-sm text-[var(--foreground-muted)]">
          Create a player record. Guardians, medical details, and team
          assignment can be added afterwards.
        </p>
      </div>

      <PlayerForm />
    </div>
  );
}
