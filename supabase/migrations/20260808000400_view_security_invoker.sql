-- ===========================================================================
-- RRBA — 010 make the finance views respect RLS
-- ---------------------------------------------------------------------------
-- invoice_balances and player_account_summary were created without
-- security_invoker, so both run with the privileges of the view owner rather
-- than the caller. The owner is not subject to the row level security on
-- invoices and payments, which means every policy protecting those tables is
-- bypassed the moment a query goes through a view instead of the table:
--
--   select * from invoice_balances;   -- any authenticated user, every family
--
-- Nothing exploited this yet only because the accounts that exist all belong
-- to staff who may read the whole ledger anyway. It becomes a live disclosure
-- the first time a parent or player signs in, since invoices_self_read is then
-- the only thing standing between them and every other family's fees — and a
-- view that bypasses RLS ignores it.
--
-- security_invoker = true makes the views execute as the caller, so the
-- policies on the underlying tables apply normally. Both views only ever
-- aggregate invoices and payments, and every role that needs them already
-- holds a select policy on both:
--
--   admins   invoices_admin_all      payments_admin_all
--   finance  invoices_finance_read   payments_finance_all
--   family   invoices_self_read      payments_self_read
--
-- so no policy needs widening to go with this. Staff queries return exactly
-- what they did before; a family now gets only their own rows.
--
-- Postgres 15 or later is required for this option, which Supabase satisfies.
-- ===========================================================================

alter view invoice_balances set (security_invoker = true);

alter view player_account_summary set (security_invoker = true);

comment on view invoice_balances is
  'Authoritative outstanding amounts, computed rather than stored. Query this '
  'for balances — never add a balance column to invoices. Runs as the caller '
  '(security_invoker), so the RLS on invoices and payments applies.';

comment on view player_account_summary is
  'Per-player billing position. Runs as the caller (security_invoker), so a '
  'guardian sees only the children they are linked to.';
