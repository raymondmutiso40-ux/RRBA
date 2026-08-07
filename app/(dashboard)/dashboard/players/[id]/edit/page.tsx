import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getSessionUser } from "@/lib/auth/session";
import { canEditPlayers } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getPlayer } from "@/lib/players/queries";
import { playerFullName } from "@/lib/players/labels";

import { PlayerForm } from "../../player-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  if (!isSupabaseConfigured()) return { title: "Edit player" };

  const { id } = await params;
  const player = await getPlayer(id);

  return {
    title: player ? `Edit ${playerFullName(player)}` : "Edit player",
  };
}

export default async function EditPlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured()) return null;

  const user = await getSessionUser();
  if (!user || !canEditPlayers(user.roles)) return notFound();

  const { id } = await params;
  const player = await getPlayer(id);

  // A coach can hold the edit role but still be outside this player's scope —
  // RLS returns nothing, and the 404 is the correct answer either way.
  if (!player) return notFound();

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link
          href={`/dashboard/players/${player.id}`}
          className="text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
        >
          ← {playerFullName(player)}
        </Link>
      </nav>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Edit player</h1>
        <p className="text-sm text-[var(--foreground-muted)]">
          Update {playerFullName(player)}&apos;s profile.
        </p>
      </div>

      <PlayerForm player={player} />
    </div>
  );
}
