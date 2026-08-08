import { createClient } from "@/lib/supabase/server";
import type { InvoiceStatus, PaymentState, Tables } from "@/lib/supabase/types";
import type { InvoiceFilter } from "@/lib/finance/labels";

export type FeeType = Tables<"fee_types">;
export type Invoice = Tables<"invoices">;
export type Payment = Tables<"payments">;

/**
 * Finance reads.
 *
 * Every outstanding amount on these types comes from the invoice_balances
 * view, never from a column. invoices.status is derived too (migration 009),
 * so it is safe to filter on — but the *number* owed is only ever the view's.
 */

/** Derived money figures for one invoice. */
export type InvoiceBalance = {
  amount_paid: number;
  balance: number;
  is_overdue: boolean;
};

export type InvoiceListRow = Invoice & InvoiceBalance & {
  player_name: string;
};

export type InvoiceListParams = {
  filter?: InvoiceFilter;
  search?: string;
  playerId?: string;
  limit?: number;
};

const DEFAULT_LIMIT = 100;

/** Postgres ILIKE metacharacters that would otherwise break the or() filter. */
function sanitiseSearch(search: string | undefined): string {
  return (search ?? "").replace(/[%,()]/g, " ").trim();
}

async function playerIdsMatching(
  supabase: Awaited<ReturnType<typeof createClient>>,
  search: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("players")
    .select("id")
    .or([`first_name.ilike.%${search}%`, `last_name.ilike.%${search}%`].join(","));

  return (data ?? []).map((row) => row.id);
}

/**
 * A draft is never overdue.
 *
 * invoice_balances marks any non-void invoice past its due date as overdue,
 * drafts included — but a draft has not been sent to anybody, so nobody is
 * late paying it. Corrected on the way out rather than in the view, which is
 * already applied to live databases.
 */
function presentOverdue(status: InvoiceStatus, isOverdue: boolean): boolean {
  return status === "draft" ? false : isOverdue;
}

/** Balances for a set of invoices, keyed by invoice id. */
async function balancesFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  invoiceIds: string[],
): Promise<Map<string, InvoiceBalance>> {
  if (invoiceIds.length === 0) return new Map();

  const { data } = await supabase
    .from("invoice_balances")
    .select("invoice_id, amount_paid, balance, is_overdue")
    .in("invoice_id", invoiceIds);

  return new Map(
    (data ?? []).map((row) => [
      row.invoice_id,
      {
        amount_paid: Number(row.amount_paid),
        balance: Number(row.balance),
        is_overdue: Boolean(row.is_overdue),
      },
    ]),
  );
}

/**
 * Invoices for the billing list, each with its derived balance.
 *
 * Two round trips rather than one join: invoice_balances is a view, and
 * PostgREST cannot embed players through it. Fetching the rows and then their
 * balances keeps the numbers authoritative without a per-row query.
 */
export async function listInvoices(
  params: InvoiceListParams = {},
): Promise<InvoiceListRow[]> {
  const supabase = await createClient();
  const filter = params.filter ?? "outstanding";

  let query = supabase
    .from("invoices")
    .select("*, players (first_name, last_name)")
    .limit(params.limit ?? DEFAULT_LIMIT);

  if (filter === "outstanding") {
    query = query.in("status", ["issued", "partially_paid"]);
  } else if (filter === "overdue") {
    // Overdue depends on payments, so the view decides which ids qualify.
    const { data } = await supabase
      .from("invoice_balances")
      .select("invoice_id")
      .eq("is_overdue", true)
      .neq("status", "draft");

    const overdueIds = (data ?? []).map((row) => row.invoice_id);
    if (overdueIds.length === 0) return [];
    query = query.in("id", overdueIds);
  } else if (filter !== "all") {
    query = query.eq("status", filter);
  }

  if (params.playerId) {
    query = query.eq("player_id", params.playerId);
  }

  const search = sanitiseSearch(params.search);
  if (search) {
    // An invoice number is exact enough to match on its own; a name has to be
    // resolved to player ids first, since the number lives on a different table.
    const matchingPlayers = await playerIdsMatching(supabase, search);
    query = matchingPlayers.length > 0
      ? query.or(
          [
            `invoice_number.ilike.%${search}%`,
            `player_id.in.(${matchingPlayers.join(",")})`,
          ].join(","),
        )
      : query.ilike("invoice_number", `%${search}%`);
  }

  const { data, error } = await query.order("due_on", { ascending: true });

  if (error) {
    throw new Error(`Could not load invoices: ${error.message}`);
  }

  type Joined = Invoice & {
    players: { first_name: string; last_name: string } | null;
  };

  const rows = (data ?? []) as unknown as Joined[];
  const balances = await balancesFor(supabase, rows.map((row) => row.id));

  return rows.map((row) => {
    const { players, ...invoice } = row;
    const balance = balances.get(row.id) ?? {
      amount_paid: 0,
      balance: Number(row.amount_due),
      is_overdue: false,
    };

    return {
      ...invoice,
      player_name: players
        ? `${players.first_name} ${players.last_name}`.trim()
        : "Unknown player",
      ...balance,
      is_overdue: presentOverdue(invoice.status, balance.is_overdue),
    };
  });
}

export type InvoiceDetail = InvoiceListRow & {
  fee_type_name: string | null;
  created_by_name: string | null;
  payments: Payment[];
};

export async function getInvoice(id: string): Promise<InvoiceDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoices")
    .select(
      "*, players (first_name, last_name), fee_types (name), profiles (full_name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Could not load invoice: ${error.message}`);
  if (!data) return null;

  type Joined = Invoice & {
    players: { first_name: string; last_name: string } | null;
    fee_types: { name: string } | null;
    profiles: { full_name: string } | null;
  };

  const row = data as unknown as Joined;
  const { players, fee_types, profiles, ...invoice } = row;

  const [balances, paymentsResult] = await Promise.all([
    balancesFor(supabase, [id]),
    supabase
      .from("payments")
      .select("*")
      .eq("invoice_id", id)
      .order("paid_on", { ascending: false }),
  ]);

  const balance = balances.get(id) ?? {
    amount_paid: 0,
    balance: Number(invoice.amount_due),
    is_overdue: false,
  };

  return {
    ...invoice,
    player_name: players
      ? `${players.first_name} ${players.last_name}`.trim()
      : "Unknown player",
    fee_type_name: fee_types?.name ?? null,
    created_by_name: profiles?.full_name ?? null,
    payments: paymentsResult.data ?? [],
    ...balance,
    is_overdue: presentOverdue(invoice.status, balance.is_overdue),
  };
}

export type PaymentListRow = Payment & {
  invoice_number: string;
  player_name: string;
};

export type PaymentListParams = {
  state?: PaymentState | "all";
  search?: string;
  invoiceId?: string;
  limit?: number;
};

export async function listPayments(
  params: PaymentListParams = {},
): Promise<PaymentListRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("payments")
    .select("*, invoices (invoice_number), players (first_name, last_name)")
    .limit(params.limit ?? DEFAULT_LIMIT);

  if (params.state && params.state !== "all") {
    query = query.eq("state", params.state);
  }

  if (params.invoiceId) {
    query = query.eq("invoice_id", params.invoiceId);
  }

  const search = sanitiseSearch(params.search);
  if (search) {
    const matchingPlayers = await playerIdsMatching(supabase, search);
    const clauses = [
      `receipt_number.ilike.%${search}%`,
      `reference.ilike.%${search}%`,
    ];
    if (matchingPlayers.length > 0) {
      clauses.push(`player_id.in.(${matchingPlayers.join(",")})`);
    }
    query = query.or(clauses.join(","));
  }

  const { data, error } = await query.order("paid_on", { ascending: false });

  if (error) {
    throw new Error(`Could not load payments: ${error.message}`);
  }

  type Joined = Payment & {
    invoices: { invoice_number: string } | null;
    players: { first_name: string; last_name: string } | null;
  };

  return ((data ?? []) as unknown as Joined[]).map((row) => {
    const { invoices, players, ...payment } = row;
    return {
      ...payment,
      invoice_number: invoices?.invoice_number ?? "—",
      player_name: players
        ? `${players.first_name} ${players.last_name}`.trim()
        : "Unknown player",
    };
  });
}

export async function listFeeTypes(
  options: { includeInactive?: boolean } = {},
): Promise<FeeType[]> {
  const supabase = await createClient();

  let query = supabase.from("fee_types").select("*");
  if (!options.includeInactive) query = query.eq("is_active", true);

  const { data, error } = await query.order("name");

  if (error) throw new Error(`Could not load fee types: ${error.message}`);
  return data ?? [];
}

export async function getFeeType(id: string): Promise<FeeType | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("fee_types")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Could not load fee type: ${error.message}`);
  return data;
}

/** Players an invoice can be raised against. Withdrawn players are excluded. */
export async function getBillablePlayers() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("players")
    .select("id, first_name, last_name")
    .in("status", ["applicant", "active", "inactive"])
    .order("last_name");

  return data ?? [];
}

export type OpenInvoiceOption = {
  id: string;
  invoice_number: string;
  player_id: string;
  player_name: string;
  balance: number;
  currency: string;
  due_on: string;
};

/**
 * Invoices a payment can still be recorded against.
 *
 * Drafts are excluded — nobody has been asked to pay them yet — and so are
 * invoices already settled in full, since the ledger has no way to hold change.
 */
export async function getPayableInvoices(): Promise<OpenInvoiceOption[]> {
  const invoices = await listInvoices({ filter: "outstanding", limit: 500 });

  return invoices
    .filter((invoice) => invoice.balance > 0)
    .map((invoice) => ({
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      player_id: invoice.player_id,
      player_name: invoice.player_name,
      balance: invoice.balance,
      currency: invoice.currency,
      due_on: invoice.due_on,
    }));
}

export type FinanceSummary = {
  outstanding: number;
  overdue: number;
  overdueCount: number;
  collectedThisMonth: number;
  currency: string;
};

/**
 * Headline numbers for the billing dashboard.
 *
 * Summed in the application rather than in SQL: an academy has hundreds of
 * invoices, not millions, and a view per tile would be three more things to
 * keep in step with invoice_balances. Void invoices are excluded because the
 * view leaves them in.
 */
export async function getFinanceSummary(): Promise<FinanceSummary> {
  const supabase = await createClient();

  const monthStart = new Date();
  monthStart.setDate(1);
  const firstOfMonth = monthStart.toISOString().slice(0, 10);

  const [balancesResult, paymentsResult] = await Promise.all([
    supabase
      .from("invoice_balances")
      .select("balance, is_overdue, status, currency"),
    supabase
      .from("payments")
      .select("amount")
      .eq("state", "confirmed")
      .gte("paid_on", firstOfMonth),
  ]);

  const balances = (balancesResult.data ?? []).filter(
    (row) => row.status !== "void" && row.status !== "draft",
  );

  let outstanding = 0;
  let overdue = 0;
  let overdueCount = 0;

  for (const row of balances) {
    const balance = Number(row.balance);
    outstanding += balance;
    if (row.is_overdue) {
      overdue += balance;
      overdueCount += 1;
    }
  }

  const collectedThisMonth = (paymentsResult.data ?? []).reduce(
    (total, row) => total + Number(row.amount),
    0,
  );

  return {
    outstanding,
    overdue,
    overdueCount,
    collectedThisMonth,
    currency: balances[0]?.currency ?? "KES",
  };
}

/** Billing position for one player, for the player detail page. */
export async function getPlayerAccount(playerId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("player_account_summary")
    .select("*")
    .eq("player_id", playerId)
    .maybeSingle();

  return data;
}
