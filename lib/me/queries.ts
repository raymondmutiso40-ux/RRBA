import { createClient } from "@/lib/supabase/server";
import type {
  AttendanceStatus,
  InvoiceStatus,
  Tables,
} from "@/lib/supabase/types";

/**
 * The family-facing reads.
 *
 * Two things are true of every query here and worth stating once:
 *
 *  1. RLS does the filtering, not this file. players_guardian_read,
 *     attendance_read, invoices_self_read and the rest already restrict these
 *     tables to the caller's own children, so a bug in the code below shows
 *     somebody too little rather than too much. Where a query does narrow by
 *     player id it is for cost, not for safety.
 *  2. Everything hangs off a profile_id link. Without one the queries return
 *     nothing at all — correctly, since the database genuinely cannot tell who
 *     the account is. The pages say so rather than rendering empty tables.
 *
 * The exception is events: events_read_authenticated lets any signed-in user
 * read the whole calendar, so the schedule query filters by the family's teams
 * itself. That filter *is* load-bearing.
 */

export type Player = Tables<"players">;

export type MyPlayer = {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  status: string;
  jersey_number: number | null;
  position: string | null;
  teams: { id: string; name: string; age_group: string }[];
};

export type MyIdentity = {
  /** How this account is linked, if at all. */
  kind: "player" | "guardian" | null;
  /** The guardian's own name, when linked as one. */
  guardianName: string | null;
  /** The players this account may see: themselves, or their children. */
  players: MyPlayer[];
};

/**
 * Resolves who the signed-in account is in academy terms.
 *
 * Checked in one place so the three family pages agree about it, and so the
 * "you are not linked yet" message is written once.
 */
export async function getMyIdentity(profileId: string): Promise<MyIdentity> {
  const supabase = await createClient();

  const [selfResult, guardianResult] = await Promise.all([
    supabase
      .from("players")
      .select("id")
      .eq("profile_id", profileId)
      .maybeSingle(),
    supabase
      .from("guardians")
      .select("id, full_name")
      .eq("profile_id", profileId)
      .maybeSingle(),
  ]);

  if (guardianResult.data) {
    const { data: links } = await supabase
      .from("player_guardians")
      .select("player_id")
      .eq("guardian_id", guardianResult.data.id);

    const playerIds = (links ?? []).map((row) => row.player_id);

    return {
      kind: "guardian",
      guardianName: guardianResult.data.full_name,
      players: await loadPlayers(supabase, playerIds),
    };
  }

  if (selfResult.data) {
    return {
      kind: "player",
      guardianName: null,
      players: await loadPlayers(supabase, [selfResult.data.id]),
    };
  }

  return { kind: null, guardianName: null, players: [] };
}

async function loadPlayers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  playerIds: string[],
): Promise<MyPlayer[]> {
  if (playerIds.length === 0) return [];

  const [playersResult, membershipResult] = await Promise.all([
    supabase
      .from("players")
      .select(
        "id, first_name, last_name, date_of_birth, status, jersey_number, position",
      )
      .in("id", playerIds),
    supabase
      .from("team_players")
      .select("player_id, teams (id, name, age_group)")
      .in("player_id", playerIds)
      .is("left_at", null),
  ]);

  type JoinedMembership = {
    player_id: string;
    teams: { id: string; name: string; age_group: string } | null;
  };

  const teamsByPlayer = new Map<
    string,
    { id: string; name: string; age_group: string }[]
  >();

  for (const row of (membershipResult.data ??
    []) as unknown as JoinedMembership[]) {
    if (!row.teams) continue;
    const list = teamsByPlayer.get(row.player_id) ?? [];
    list.push(row.teams);
    teamsByPlayer.set(row.player_id, list);
  }

  return (playersResult.data ?? [])
    .map((player) => ({
      ...player,
      teams: teamsByPlayer.get(player.id) ?? [],
    }))
    .sort((a, b) => a.first_name.localeCompare(b.first_name));
}

export type MySession = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  status: string;
  team_id: string | null;
  team_name: string | null;
  /** Which of the family's players this session is for. */
  player_names: string[];
};

/**
 * Upcoming sessions for the family's teams.
 *
 * Filtered by team here rather than by RLS on purpose: the calendar is readable
 * by every authenticated user (events_read_authenticated), so without this a
 * parent would be shown the whole academy's timetable.
 */
export async function getMySchedule(
  players: MyPlayer[],
  options: { includePast?: boolean; limit?: number } = {},
): Promise<MySession[]> {
  const teamIds = [
    ...new Set(players.flatMap((player) => player.teams.map((team) => team.id))),
  ];

  if (teamIds.length === 0) return [];

  const supabase = await createClient();
  const now = new Date().toISOString();

  let query = supabase
    .from("events")
    .select("id, title, starts_at, ends_at, location, status, team_id, teams (name)")
    .eq("event_type", "training")
    .in("team_id", teamIds)
    .limit(options.limit ?? 50);

  if (options.includePast) {
    query = query.lt("starts_at", now).order("starts_at", { ascending: false });
  } else {
    query = query
      .gte("starts_at", now)
      .neq("status", "cancelled")
      .order("starts_at", { ascending: true });
  }

  const { data } = await query;

  type Joined = {
    id: string;
    title: string;
    starts_at: string;
    ends_at: string;
    location: string | null;
    status: string;
    team_id: string | null;
    teams: { name: string } | null;
  };

  return ((data ?? []) as unknown as Joined[]).map((row) => {
    const { teams, ...event } = row;
    return {
      ...event,
      team_name: teams?.name ?? null,
      // Named so a parent with two children knows which one is training.
      player_names: players
        .filter((player) =>
          player.teams.some((team) => team.id === event.team_id),
        )
        .map((player) => player.first_name),
    };
  });
}

export type MyAttendanceRow = {
  player_id: string;
  counts: Record<AttendanceStatus, number>;
  total: number;
};

/** Each player's own attendance tally. */
export async function getMyAttendance(
  players: MyPlayer[],
): Promise<Map<string, MyAttendanceRow>> {
  const byPlayer = new Map<string, MyAttendanceRow>();
  if (players.length === 0) return byPlayer;

  const supabase = await createClient();

  const { data } = await supabase
    .from("attendance")
    .select("player_id, status")
    .in(
      "player_id",
      players.map((player) => player.id),
    );

  for (const row of data ?? []) {
    const existing = byPlayer.get(row.player_id) ?? {
      player_id: row.player_id,
      counts: { present: 0, absent: 0, late: 0, excused: 0 },
      total: 0,
    };
    existing.counts[row.status] += 1;
    existing.total += 1;
    byPlayer.set(row.player_id, existing);
  }

  return byPlayer;
}

export type MyInvoice = {
  id: string;
  invoice_number: string;
  player_id: string;
  player_name: string;
  description: string;
  amount_due: number;
  amount_paid: number;
  balance: number;
  currency: string;
  due_on: string;
  status: InvoiceStatus;
  is_overdue: boolean;
};

/**
 * The family's invoices with what is still owed on each.
 *
 * invoice_balances is the authority for the numbers, exactly as it is for
 * staff. Migration 010 put the view under security_invoker, so it now applies
 * invoices_self_read on the caller's behalf and returns only this family's
 * rows — before that it would have returned the whole academy's.
 */
export async function getMyInvoices(players: MyPlayer[]): Promise<MyInvoice[]> {
  if (players.length === 0) return [];

  const supabase = await createClient();
  const playerIds = players.map((player) => player.id);
  const nameById = new Map(
    players.map((player) => [
      player.id,
      `${player.first_name} ${player.last_name}`.trim(),
    ]),
  );

  const [invoicesResult, balancesResult] = await Promise.all([
    supabase
      .from("invoices")
      .select("*")
      .in("player_id", playerIds)
      // A draft has not been sent to anybody, so it is not the family's
      // business that it exists.
      .neq("status", "draft")
      .order("due_on", { ascending: false }),
    supabase
      .from("invoice_balances")
      .select("invoice_id, amount_paid, balance, is_overdue")
      .in("player_id", playerIds),
  ]);

  const balances = new Map(
    (balancesResult.data ?? []).map((row) => [row.invoice_id, row]),
  );

  return (invoicesResult.data ?? []).map((invoice) => {
    const balance = balances.get(invoice.id);
    return {
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      player_id: invoice.player_id,
      player_name: nameById.get(invoice.player_id) ?? "Unknown",
      description: invoice.description,
      amount_due: Number(invoice.amount_due),
      amount_paid: Number(balance?.amount_paid ?? 0),
      balance: Number(balance?.balance ?? invoice.amount_due),
      currency: invoice.currency,
      due_on: invoice.due_on,
      status: invoice.status,
      is_overdue: Boolean(balance?.is_overdue),
    };
  });
}

export type MyPayment = Tables<"payments">;

/** Receipts, so a family can check a payment was recorded. */
export async function getMyPayments(players: MyPlayer[]): Promise<MyPayment[]> {
  if (players.length === 0) return [];

  const supabase = await createClient();

  const { data } = await supabase
    .from("payments")
    .select("*")
    .in(
      "player_id",
      players.map((player) => player.id),
    )
    .order("paid_on", { ascending: false })
    .limit(50);

  return data ?? [];
}
