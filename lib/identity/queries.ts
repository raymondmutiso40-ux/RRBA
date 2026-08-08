import { createClient } from "@/lib/supabase/server";

/**
 * Account linking.
 *
 * A login and an academy record are two different things. Signing up creates a
 * profile; being enrolled creates a players row, and approving an application
 * creates a guardians row. Nothing joins them automatically, which is why
 * players.profile_id and guardians.profile_id exist — and until one is set,
 * is_player() and guards_player() are false and every self-service policy in
 * the schema matches nothing.
 *
 * The link is made by an admin rather than inferred from a matching email. The
 * address on a guardian record came from whoever filled in the application, so
 * treating it as proof of identity would let a stale or shared inbox hand one
 * family's records — including a child's — to the wrong adult. Email matching
 * is used only to *suggest*; a person confirms.
 */

export type LinkKind = "player" | "guardian";

export type LinkedRecord = {
  kind: LinkKind;
  id: string;
  name: string;
  /** For a guardian, the children they are linked to. */
  children: { id: string; name: string }[];
};

/** What this account is currently linked to, if anything. */
export async function getAccountLink(
  profileId: string,
): Promise<LinkedRecord | null> {
  const supabase = await createClient();

  const [playerResult, guardianResult] = await Promise.all([
    supabase
      .from("players")
      .select("id, first_name, last_name")
      .eq("profile_id", profileId)
      .maybeSingle(),
    supabase
      .from("guardians")
      .select("id, full_name")
      .eq("profile_id", profileId)
      .maybeSingle(),
  ]);

  if (guardianResult.data) {
    const guardian = guardianResult.data;
    return {
      kind: "guardian",
      id: guardian.id,
      name: guardian.full_name,
      children: await childrenOf(supabase, guardian.id),
    };
  }

  if (playerResult.data) {
    const player = playerResult.data;
    return {
      kind: "player",
      id: player.id,
      name: `${player.first_name} ${player.last_name}`.trim(),
      children: [],
    };
  }

  return null;
}

async function childrenOf(
  supabase: Awaited<ReturnType<typeof createClient>>,
  guardianId: string,
): Promise<{ id: string; name: string }[]> {
  const { data } = await supabase
    .from("player_guardians")
    .select("player_id, players (first_name, last_name)")
    .eq("guardian_id", guardianId);

  type Joined = {
    player_id: string;
    players: { first_name: string; last_name: string } | null;
  };

  return ((data ?? []) as unknown as Joined[])
    .filter((row) => row.players)
    .map((row) => ({
      id: row.player_id,
      name: `${row.players!.first_name} ${row.players!.last_name}`.trim(),
    }));
}

export type LinkCandidate = {
  kind: LinkKind;
  id: string;
  name: string;
  detail: string;
  /** True when this was found by matching the account's email address. */
  isEmailMatch: boolean;
};

/**
 * Records this account could plausibly be.
 *
 * Unlinked records only: profile_id is unique on both tables, so offering one
 * that is already claimed would only produce a constraint error.
 */
export async function findLinkCandidates(options: {
  email: string;
  search?: string;
}): Promise<LinkCandidate[]> {
  const supabase = await createClient();

  const email = options.email.trim().toLowerCase();
  const search = (options.search ?? "").replace(/[%,()]/g, " ").trim();

  let guardianQuery = supabase
    .from("guardians")
    .select("id, full_name, relationship, phone, email")
    .is("profile_id", null);

  let playerQuery = supabase
    .from("players")
    .select("id, first_name, last_name, date_of_birth, email")
    .is("profile_id", null);

  if (search) {
    guardianQuery = guardianQuery.or(
      [`full_name.ilike.%${search}%`, `phone.ilike.%${search}%`].join(","),
    );
    playerQuery = playerQuery.or(
      [`first_name.ilike.%${search}%`, `last_name.ilike.%${search}%`].join(","),
    );
  } else {
    // With no search term the only sensible offer is an exact email match.
    guardianQuery = guardianQuery.eq("email", email);
    playerQuery = playerQuery.eq("email", email);
  }

  const [guardians, players] = await Promise.all([
    guardianQuery.order("full_name").limit(20),
    playerQuery.order("last_name").limit(20),
  ]);

  const candidates: LinkCandidate[] = [];

  for (const guardian of guardians.data ?? []) {
    candidates.push({
      kind: "guardian",
      id: guardian.id,
      name: guardian.full_name,
      detail: [guardian.relationship, guardian.phone].filter(Boolean).join(" · "),
      isEmailMatch: (guardian.email ?? "").toLowerCase() === email,
    });
  }

  for (const player of players.data ?? []) {
    candidates.push({
      kind: "player",
      id: player.id,
      name: `${player.first_name} ${player.last_name}`.trim(),
      detail: `Player · born ${player.date_of_birth}`,
      isEmailMatch: (player.email ?? "").toLowerCase() === email,
    });
  }

  // An email match is the strongest signal available, so it goes first.
  return candidates.sort((a, b) => {
    if (a.isEmailMatch !== b.isEmailMatch) return a.isEmailMatch ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
