-- ===========================================================================
-- RRBA — 009 invoice status sync and document numbering
-- ---------------------------------------------------------------------------
-- Two gaps in the finance schema that only surface once money starts moving.
--
-- 1. invoice_status has 'partially_paid' and 'paid', but nothing ever set
--    them. Recording a payment left the invoice reading 'issued' forever,
--    so any list filtered on status was wrong even though invoice_balances
--    computed the right number. Status is now derived by trigger from the
--    confirmed payments, so it cannot drift regardless of who writes the
--    payment — the dashboard, the SQL editor, or the future M-Pesa callback.
--
-- 2. invoice_number and receipt_number were NOT NULL with no default, so
--    every insert had to remember to call the sequence helper. Forgetting
--    is a runtime error rather than a wrong number, but there is no reason
--    to leave it to the caller. They now default.
--
-- The ledger itself is untouched: amount_due is still never mutated, and
-- balances are still computed rather than stored.
-- ===========================================================================

alter table invoices
  alter column invoice_number set default next_invoice_number();

alter table payments
  alter column receipt_number set default next_receipt_number();

-- ---------------------------------------------------------------------------
-- Derive invoice status from confirmed payments
-- ---------------------------------------------------------------------------

create or replace function sync_invoice_status(target_invoice uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  billed    numeric(12, 2);
  collected numeric(12, 2);
  current_status invoice_status;
begin
  select amount_due, status
    into billed, current_status
  from invoices
  where id = target_invoice;

  if not found then
    return;
  end if;

  -- A draft has not been issued to anyone, and a void invoice is closed.
  -- Neither should be reopened by payment activity.
  if current_status in ('draft', 'void') then
    return;
  end if;

  select coalesce(sum(amount), 0)
    into collected
  from payments
  where invoice_id = target_invoice
    and state = 'confirmed';

  update invoices
  set status = case
        when collected >= billed then 'paid'::invoice_status
        when collected > 0       then 'partially_paid'::invoice_status
        else 'issued'::invoice_status
      end
  where id = target_invoice
    and status is distinct from case
        when collected >= billed then 'paid'::invoice_status
        when collected > 0       then 'partially_paid'::invoice_status
        else 'issued'::invoice_status
      end;
end;
$$;

comment on function sync_invoice_status(uuid) is
  'Recomputes invoices.status from confirmed payments. Draft and void are '
  'left alone — those states are decisions, not derived facts.';

create or replace function payments_sync_invoice_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- An edited payment can move between invoices, so both ends need syncing.
  if tg_op in ('UPDATE', 'DELETE') and old.invoice_id is not null then
    perform sync_invoice_status(old.invoice_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.invoice_id is not null then
    perform sync_invoice_status(new.invoice_id);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists payments_sync_status on payments;

create trigger payments_sync_status
  after insert or update or delete on payments
  for each row execute function payments_sync_invoice_status();

-- ---------------------------------------------------------------------------
-- Backfill anything recorded before this migration
-- ---------------------------------------------------------------------------

do $$
declare
  invoice_row record;
begin
  for invoice_row in
    select id from invoices where status in ('issued', 'partially_paid', 'paid')
  loop
    perform sync_invoice_status(invoice_row.id);
  end loop;
end;
$$;
