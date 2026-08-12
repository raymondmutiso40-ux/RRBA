-- ===========================================================================
-- RRBA — 011 the public site's data
-- ---------------------------------------------------------------------------
-- The landing page is entirely hard-coded copy. The coaching staff and the
-- age-group squads are already in the database, but every read policy in the
-- schema is `to authenticated`, so a visitor who has not signed in can read
-- none of it. This migration gives the public site something real to read.
--
-- Widening the existing policies to `anon` would have been one line per table,
-- and is the wrong line. RLS filters rows, not columns: letting anon select
-- from `profiles` to get a coach's name also hands over their email and phone,
-- and letting anon reach `team_players` to count a roster points the public
-- internet at a table of children. Column privileges could claw the first case
-- back, but then the safety of the public site depends on a GRANT staying in
-- step with every future `select *`.
--
-- So nothing existing is widened. Publication gets its own surface:
--
--   coach_public_profiles  a row per coach holding only what an administrator
--                          typed for publication — no email, no phone, and its
--                          own display name, so anon never reads `profiles`
--   teams.is_public        an explicit per-team flag; the columns anon can then
--                          read are the squad's own description, never a roster
--
-- Publication is opt-in and off by default in both, so applying this migration
-- publishes nothing. The site keeps showing hard-coded copy until an admin
-- fills a profile in and presses publish.
--
-- These are the schema's first anonymous *reads*. The only anonymous write
-- remains applications_insert_public.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- coach_public_profiles
-- ---------------------------------------------------------------------------

create table coach_public_profiles (
  coach_id     uuid primary key references profiles (id) on delete cascade,
  display_name text        not null,
  headline     text        not null default '',
  bio          text,
  sort_order   smallint    not null default 0,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Bounded like the application columns: this is public-facing text and the
  -- pages that render it have a fixed layout.
  constraint coach_public_display_name_len check (
    char_length(display_name) between 2 and 80
  ),
  constraint coach_public_headline_len check (char_length(headline) <= 120),
  constraint coach_public_bio_len      check (bio is null or char_length(bio) <= 1200)
);

-- Ordering index for the public list: the partial predicate matches the only
-- query anon can run against this table.
create index coach_public_profiles_published_idx
  on coach_public_profiles (sort_order, display_name)
  where published_at is not null;

create trigger coach_public_profiles_set_updated_at
  before update on coach_public_profiles
  for each row execute function set_updated_at();

comment on table coach_public_profiles is
  'Publishable biography for a coach, readable by anonymous visitors. Holds no '
  'contact details by design — a coach is reachable through the academy, not '
  'through the website.';

comment on column coach_public_profiles.display_name is
  'The name to show on the site, deliberately separate from profiles.full_name. '
  'A coach may be "Coach Mike" publicly and carry their legal name on the '
  'account, and keeping it here means anon never needs to read profiles at all.';

comment on column coach_public_profiles.published_at is
  'Null means draft. A row is invisible to the public until an admin publishes '
  'it, so writing a bio is not the same act as putting it on the internet.';

-- ---------------------------------------------------------------------------
-- teams.is_public
-- ---------------------------------------------------------------------------

alter table teams add column is_public boolean not null default false;

create index teams_public_idx
  on teams (age_group, name)
  where is_public and is_active;

comment on column teams.is_public is
  'Opt-in: show this squad on the public site. Defaults to false, so a team '
  'created for internal use is never advertised by accident. Only the squad''s '
  'own columns are exposed — never its roster.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table coach_public_profiles enable row level security;

-- The published set, to the world. `authenticated` is included so a signed-in
-- visitor sees the same public page as everyone else rather than an empty one.
create policy "coach_public_profiles_read_published"
  on coach_public_profiles for select
  to anon, authenticated
  using (published_at is not null);

-- Admins manage every row, draft or published. Coaches are not given write
-- access to their own row on purpose: what the academy says about its staff on
-- its own website is the academy's to decide.
create policy "coach_public_profiles_admin_all"
  on coach_public_profiles for all
  to authenticated
  using (is_admin());

-- teams already carries teams_read_authenticated (using true) plus the three
-- admin write policies. Only the anonymous case is new, and it is narrower
-- than the authenticated one in both directions: published squads, still
-- active, select only.
create policy "teams_public_read"
  on teams for select
  to anon
  using (is_public and is_active);
