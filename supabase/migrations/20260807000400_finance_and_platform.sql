-- ===========================================================================
-- RRBA — 004 finance & platform
-- ---------------------------------------------------------------------------
-- Fee types, invoices, payments, the M-Pesa staging table, documents,
-- notifications, and public website content.
--
-- Core decision: no table stores a balance. Outstanding amounts are derived
-- in the invoice_balances view as amount_due - sum(payments). A stored
-- balance drifts the first time a payment is voided or corrected, and
-- reconciling the drift afterwards is painful.
-- ===========================================================================

create type fee_interval as enum ('one_time', 'monthly', 'termly', 'annual');

create type invoice_status as enum ('draft', 'issued', 'partially_paid', 'paid', 'void');

create type payment_method as enum ('cash', 'mpesa', 'bank_transfer', 'cheque', 'card', 'other');

create type payment_state as enum ('pending', 'confirmed', 'failed', 'reversed');

create type notification_channel as enum ('email', 'sms', 'whatsapp', 'push');

create type notification_state as enum ('queued', 'sent', 'failed', 'cancelled');

create type document_kind as enum (
  'registration',
  'medical_form',
  'waiver',
  'receipt',
  'report',
  'id_document',
  'other'
);

-- ---------------------------------------------------------------------------
-- fee_types
-- ---------------------------------------------------------------------------

create table fee_types (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null unique,
  description   text,
  amount        numeric(12, 2) not null,
  currency      char(3) not null default 'KES',
  interval      fee_interval not null default 'monthly',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),

  constraint fee_types_amount_positive check (amount > 0)
);

-- ---------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------

create table invoices (
  id            uuid primary key default uuid_generate_v4(),
  invoice_number text not null unique,
  player_id     uuid not null references players (id) on delete restrict,
  fee_type_id   uuid references fee_types (id) on delete set null,

  description   text not null,
  amount_due    numeric(12, 2) not null,
  currency      char(3) not null default 'KES',

  period_start  date,
  period_end    date,
  issued_on     date not null default current_date,
  due_on        date not null,

  status        invoice_status not null default 'draft',

  created_by    uuid references profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint invoices_amount_positive check (amount_due > 0),
  constraint invoices_period_order check (
    period_end is null or period_start is null or period_end >= period_start
  )
);

create index invoices_player_idx on invoices (player_id, issued_on desc);
create index invoices_status_idx on invoices (status) where status <> 'paid';
create index invoices_due_idx    on invoices (due_on) where status in ('issued', 'partially_paid');

create trigger invoices_set_updated_at
  before update on invoices
  for each row execute function set_updated_at();

comment on column invoices.amount_due is
  'The billed amount. Never mutated by payments — see invoice_balances for '
  'what is still owed.';

-- Human-readable sequential invoice numbers: RRBA-INV-000001
create sequence invoice_number_seq start 1;

create or replace function next_invoice_number()
returns text
language sql
volatile
as $$
  select 'RRBA-INV-' || lpad(nextval('invoice_number_seq')::text, 6, '0');
$$;

-- ---------------------------------------------------------------------------
-- payments — the money ledger
-- ---------------------------------------------------------------------------

create table payments (
  id             uuid primary key default uuid_generate_v4(),
  receipt_number text not null unique,
  invoice_id     uuid not null references invoices (id) on delete restrict,
  player_id      uuid not null references players (id) on delete restrict,

  amount         numeric(12, 2) not null,
  currency       char(3) not null default 'KES',
  method         payment_method not null,
  state          payment_state not null default 'pending',

  paid_on        date not null default current_date,
  reference      text,
  payer_name     text,
  payer_phone    text,
  notes          text,

  recorded_by    uuid references profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint payments_amount_positive check (amount > 0)
);

create index payments_invoice_idx on payments (invoice_id);
create index payments_player_idx  on payments (player_id, paid_on desc);
create index payments_state_idx   on payments (state);

create trigger payments_set_updated_at
  before update on payments
  for each row execute function set_updated_at();

create sequence receipt_number_seq start 1;

create or replace function next_receipt_number()
returns text
language sql
volatile
as $$
  select 'RRBA-RCP-' || lpad(nextval('receipt_number_seq')::text, 6, '0');
$$;

-- ---------------------------------------------------------------------------
-- mpesa_transactions — gateway staging, kept out of the ledger
-- ---------------------------------------------------------------------------

create table mpesa_transactions (
  id                   uuid primary key default uuid_generate_v4(),
  invoice_id           uuid references invoices (id) on delete set null,
  payment_id           uuid references payments (id) on delete set null,

  -- Daraja correlation ids. checkout_request_id is unique so a retried
  -- callback cannot create a second payment.
  merchant_request_id  text,
  checkout_request_id  text unique,
  mpesa_receipt_number text unique,

  phone_number         text not null,
  amount               numeric(12, 2) not null,

  result_code          integer,
  result_description   text,
  raw_callback         jsonb,

  state                payment_state not null default 'pending',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index mpesa_invoice_idx on mpesa_transactions (invoice_id);
create index mpesa_state_idx   on mpesa_transactions (state);

create trigger mpesa_set_updated_at
  before update on mpesa_transactions
  for each row execute function set_updated_at();

comment on table mpesa_transactions is
  'Gateway-facing staging for M-Pesa (M10). Raw callbacks and failures land '
  'here; only confirmed money is promoted into payments. Keeps the ledger '
  'clean and makes retried callbacks idempotent via checkout_request_id.';

-- ---------------------------------------------------------------------------
-- Derived balances — the single source of truth for "what is owed"
-- ---------------------------------------------------------------------------

create view invoice_balances as
select
  i.id                as invoice_id,
  i.invoice_number,
  i.player_id,
  i.amount_due,
  i.currency,
  i.due_on,
  i.status,
  coalesce(sum(p.amount) filter (where p.state = 'confirmed'), 0) as amount_paid,
  i.amount_due
    - coalesce(sum(p.amount) filter (where p.state = 'confirmed'), 0) as balance,
  i.status <> 'void'
    and i.due_on < current_date
    and i.amount_due
        > coalesce(sum(p.amount) filter (where p.state = 'confirmed'), 0) as is_overdue
from invoices i
left join payments p on p.invoice_id = i.id
group by i.id;

comment on view invoice_balances is
  'Authoritative outstanding amounts, computed rather than stored. Query this '
  'for balances — never add a balance column to invoices.';

create view player_account_summary as
select
  pl.id as player_id,
  count(distinct ib.invoice_id)                          as invoice_count,
  coalesce(sum(ib.amount_due), 0)                        as total_billed,
  coalesce(sum(ib.amount_paid), 0)                       as total_paid,
  coalesce(sum(ib.balance), 0)                           as total_outstanding,
  bool_or(ib.is_overdue)                                 as has_overdue
from players pl
left join invoice_balances ib
  on ib.player_id = pl.id and ib.status <> 'void'
group by pl.id;

-- ---------------------------------------------------------------------------
-- documents — metadata; bytes live in Supabase Storage
-- ---------------------------------------------------------------------------

create table documents (
  id           uuid primary key default uuid_generate_v4(),
  player_id    uuid references players (id) on delete cascade,
  kind         document_kind not null default 'other',
  title        text not null,
  storage_path text not null unique,
  mime_type    text,
  size_bytes   bigint,
  is_sensitive boolean not null default false,
  uploaded_by  uuid references profiles (id) on delete set null,
  created_at   timestamptz not null default now(),

  constraint documents_size_limit check (size_bytes is null or size_bytes <= 26214400)
);

create index documents_player_idx on documents (player_id, created_at desc);
create index documents_kind_idx   on documents (kind);

comment on column documents.storage_path is
  'Path within a private Storage bucket. Served only via short-lived signed '
  'URLs — never a public URL, since these include minors'' medical forms.';

-- ---------------------------------------------------------------------------
-- notifications — queue shape ready for M10 delivery workers
-- ---------------------------------------------------------------------------

create table notification_templates (
  id         uuid primary key default uuid_generate_v4(),
  code       text not null unique,
  channel    notification_channel not null,
  subject    text,
  body       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table notifications (
  id           uuid primary key default uuid_generate_v4(),
  recipient_id uuid references profiles (id) on delete cascade,
  template_id  uuid references notification_templates (id) on delete set null,
  channel      notification_channel not null,

  -- Denormalised so a queued message still delivers if the profile changes.
  to_address   text not null,
  subject      text,
  body         text not null,

  state        notification_state not null default 'queued',
  attempts     smallint not null default 0,
  last_error   text,
  scheduled_for timestamptz not null default now(),
  sent_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index notifications_queue_idx
  on notifications (state, scheduled_for)
  where state = 'queued';

create index notifications_recipient_idx on notifications (recipient_id, created_at desc);

comment on table notifications is
  'Channel-agnostic outbox. Rows are queued by the app; per-channel workers '
  '(email/SMS/WhatsApp/push) drain them in M10.';

-- ---------------------------------------------------------------------------
-- Public website content
-- ---------------------------------------------------------------------------

create table programs (
  id          uuid primary key default uuid_generate_v4(),
  slug        text not null unique,
  name        text not null,
  tagline     text,
  description text,
  age_range   text,
  schedule    text,
  fee_note    text,
  image_path  text,
  sort_order  smallint not null default 0,
  is_published boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger programs_set_updated_at
  before update on programs
  for each row execute function set_updated_at();

create table achievements (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null,
  description text,
  achieved_on date,
  category    text,
  image_path  text,
  is_published boolean not null default false,
  created_at  timestamptz not null default now()
);

create table gallery_items (
  id          uuid primary key default uuid_generate_v4(),
  title       text,
  caption     text,
  storage_path text not null,
  album       text,
  taken_on    date,
  sort_order  smallint not null default 0,
  is_published boolean not null default false,
  created_at  timestamptz not null default now()
);

create table contact_submissions (
  id           uuid primary key default uuid_generate_v4(),
  full_name    text not null,
  email        citext not null,
  phone        text,
  subject      text,
  message      text not null,
  player_age   smallint,
  is_application boolean not null default false,
  handled_by   uuid references profiles (id) on delete set null,
  handled_at   timestamptz,
  created_at   timestamptz not null default now(),

  constraint contact_message_len check (char_length(message) between 10 and 4000),
  constraint contact_name_len    check (char_length(full_name) between 2 and 160)
);

create index contact_submissions_new_idx
  on contact_submissions (created_at desc)
  where handled_at is null;

comment on table contact_submissions is
  'Public registration/enquiry inbox. Anonymous insert is allowed; reads are '
  'staff-only. Length constraints bound abuse from unauthenticated writes.';
