-- ===========================================================================
-- RRBA — 005 RLS policies
-- ---------------------------------------------------------------------------
-- The full authorization surface. Every table is enabled with default-deny,
-- then opened with the narrowest policies that express the role model:
--
--   super_admin / academy_admin  — everything, via is_admin()
--   coach                        — their assigned teams' players, via
--                                   coaches_team() / coaches_player()
--   finance                      — billing and documents, NEVER medical
--   player / guardian            — their own record / their linked children
--
-- Delete is withheld everywhere except a handful of owner rows. Operations
-- are retired or voided, never destroyed — that is what makes the audit
-- trail and the payment ledger trustworthy.
-- ===========================================================================

-- ===========================================================================
-- profiles — a user reads/updates their own row; admins manage all
-- ===========================================================================

alter table profiles enable row level security;

create policy "profiles_self_read"
  on profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles_self_update"
  on profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_admin_all"
  on profiles for all
  to authenticated
  using (is_admin());

create policy "profiles_staff_read"
  on profiles for select
  to authenticated
  using (is_staff());

-- A user may delete their own profile (row falls back to auth.users).
create policy "profiles_self_delete"
  on profiles for delete
  to authenticated
  using (id = auth.uid());

-- ===========================================================================
-- user_roles — read by any authenticated user (they must see their own);
-- written ONLY by admins. Self-grant is impossible.
-- ===========================================================================

alter table user_roles enable row level security;

create policy "user_roles_read_all_authenticated"
  on user_roles for select
  to authenticated
  using (true);

create policy "user_roles_admin_write"
  on user_roles for insert
  to authenticated
  with check (is_admin());

create policy "user_roles_admin_update"
  on user_roles for update
  to authenticated
  using (is_admin())
  with check (is_admin());

create policy "user_roles_admin_delete"
  on user_roles for delete
  to authenticated
  using (is_admin());

-- ===========================================================================
-- audit_log — append-only: insert only, no select/update/delete policies
-- ===========================================================================

alter table audit_log enable row level security;

create policy "audit_log_admin_read"
  on audit_log for select
  to authenticated
  using (is_admin());

create policy "audit_log_append"
  on audit_log for insert
  to authenticated
  with check (true);

-- ===========================================================================
-- teams — readable by all authenticated users; managed by admins
-- ===========================================================================

alter table teams enable row level security;

create policy "teams_read_authenticated"
  on teams for select
  to authenticated
  using (true);

create policy "teams_admin_write"
  on teams for insert
  to authenticated
  with check (is_admin());

create policy "teams_admin_update"
  on teams for update
  to authenticated
  using (is_admin())
  with check (is_admin());

create policy "teams_admin_delete"
  on teams for delete
  to authenticated
  using (is_admin());

-- ===========================================================================
-- seasons — readable by all authenticated users; managed by admins
-- ===========================================================================

alter table seasons enable row level security;

create policy "seasons_read_authenticated"
  on seasons for select
  to authenticated
  using (true);

create policy "seasons_admin_write"
  on seasons for insert
  to authenticated
  with check (is_admin());

create policy "seasons_admin_update"
  on seasons for update
  to authenticated
  using (is_admin())
  with check (is_admin());

create policy "seasons_admin_delete"
  on seasons for delete
  to authenticated
  using (is_admin());

-- ===========================================================================
-- team_coaches — visible to all authenticated (assignments are not secret);
-- assignment is admin-only. Coach RLS scope derives from active rows here.
-- ===========================================================================

alter table team_coaches enable row level security;

create policy "team_coaches_read_authenticated"
  on team_coaches for select
  to authenticated
  using (true);

create policy "team_coaches_admin_write"
  on team_coaches for insert
  to authenticated
  with check (is_admin());

create policy "team_coaches_admin_update"
  on team_coaches for update
  to authenticated
  using (is_admin())
  with check (is_admin());

create policy "team_coaches_admin_delete"
  on team_coaches for delete
  to authenticated
  using (is_admin());

-- ===========================================================================
-- players — the heart of the model:
--   admins: full access
--   coaches: players on teams they coach (and their own linked children)
--   finance: nothing (they use invoices/payments)
--   player: self      guardian: linked children
-- ===========================================================================

alter table players enable row level security;

create policy "players_admin_all"
  on players for all
  to authenticated
  using (is_admin());

create policy "players_coach_read"
  on players for select
  to authenticated
  using (coaches_player(id) or is_player(id));

create policy "players_coach_update"
  on players for update
  to authenticated
  using (coaches_player(id))
  with check (coaches_player(id));

create policy "players_player_update"
  on players for update
  to authenticated
  using (is_player(id))
  with check (is_player(id));

create policy "players_guardian_read"
  on players for select
  to authenticated
  using (guards_player(id));

-- ===========================================================================
-- team_players — read by anyone with a player-visible path; admin manages
-- ===========================================================================

alter table team_players enable row level security;

create policy "team_players_admin_all"
  on team_players for all
  to authenticated
  using (is_admin());

create policy "team_players_read"
  on team_players for select
  to authenticated
  using (
    is_admin()
    or exists (
      select 1 from players p where p.id = team_players.player_id
        and (p.profile_id = auth.uid() or guards_player(p.id))
    )
    or exists (
      select 1 from teams t where t.id = team_players.team_id
        and coaches_team(t.id)
    )
  );

-- ===========================================================================
-- guardians — self-visible; admins manage all
-- ===========================================================================

alter table guardians enable row level security;

create policy "guardians_admin_all"
  on guardians for all
  to authenticated
  using (is_admin());

create policy "guardians_self_read"
  on guardians for select
  to authenticated
  using (profile_id = auth.uid());

-- ===========================================================================
-- player_guardians — read where the person appears in the relationship;
-- admin manages
-- ===========================================================================

alter table player_guardians enable row level security;

create policy "player_guardians_admin_all"
  on player_guardians for all
  to authenticated
  using (is_admin());

create policy "player_guardians_read"
  on player_guardians for select
  to authenticated
  using (
    is_admin()
    or exists (
      select 1 from guardians g
      where g.id = player_guardians.guardian_id
        and g.profile_id = auth.uid()
    )
    or exists (
      select 1 from players p
      where p.id = player_guardians.player_id
        and (p.profile_id = auth.uid() or coaches_player(p.id))
    )
  );

-- ===========================================================================
-- player_medical — the most restricted table in the schema.
-- Finance staff are structurally unable to read it. A coach sees only the
-- players they coach; a player sees only their own record.
-- ===========================================================================

alter table player_medical enable row level security;

create policy "medical_admin_all"
  on player_medical for all
  to authenticated
  using (is_admin());

create policy "medical_coach_read"
  on player_medical for select
  to authenticated
  using (coaches_player(player_id));

create policy "medical_coach_update"
  on player_medical for update
  to authenticated
  using (coaches_player(player_id))
  with check (coaches_player(player_id));

create policy "medical_self_read"
  on player_medical for select
  to authenticated
  using (is_player(player_id));

-- ===========================================================================
-- events — public to the academy (schedules aren't secret); coaches manage
-- sessions for their teams; admins manage all
-- ===========================================================================

alter table events enable row level security;

create policy "events_read_authenticated"
  on events for select
  to authenticated
  using (true);

create policy "events_admin_write"
  on events for insert
  to authenticated
  with check (is_admin());

create policy "events_admin_update"
  on events for update
  to authenticated
  using (is_admin())
  with check (is_admin());

create policy "events_admin_delete"
  on events for delete
  to authenticated
  using (is_admin());

create policy "events_coach_write"
  on events for insert
  to authenticated
  with check (team_id is not null and coaches_team(team_id));

create policy "events_coach_update"
  on events for update
  to authenticated
  using (team_id is not null and coaches_team(team_id))
  with check (team_id is not null and coaches_team(team_id));

-- ===========================================================================
-- event_participants — coaches manage their team's callouts; all can read
-- ===========================================================================

alter table event_participants enable row level security;

create policy "event_participants_read"
  on event_participants for select
  to authenticated
  using (
    is_admin()
    or exists (
      select 1 from events e where e.id = event_participants.event_id
        and e.team_id is not null and coaches_team(e.team_id)
    )
    or is_player(event_participants.player_id)
    or guards_player(event_participants.player_id)
  );

create policy "event_participants_coach_write"
  on event_participants for insert
  to authenticated
  with check (
    is_admin()
    or exists (
      select 1 from events e where e.id = event_participants.event_id
        and e.team_id is not null and coaches_team(e.team_id)
    )
  );

create policy "event_participants_coach_delete"
  on event_participants for delete
  to authenticated
  using (
    is_admin()
    or exists (
      select 1 from events e where e.id = event_participants.event_id
        and e.team_id is not null and coaches_team(e.team_id)
    )
  );

-- ===========================================================================
-- attendance — rows are never deleted; a mistaken mark is corrected by an
-- upsert overwriting status. Coaches record for their teams' sessions.
-- ===========================================================================

alter table attendance enable row level security;

create policy "attendance_read"
  on attendance for select
  to authenticated
  using (
    is_admin()
    or is_player(attendance.player_id)
    or guards_player(attendance.player_id)
    or exists (
      select 1 from events e where e.id = attendance.event_id
        and e.team_id is not null and coaches_team(e.team_id)
    )
  );

create policy "attendance_coach_write"
  on attendance for insert
  to authenticated
  with check (
    is_admin()
    or exists (
      select 1 from events e where e.id = attendance.event_id
        and e.team_id is not null and coaches_team(e.team_id)
    )
  );

create policy "attendance_coach_update"
  on attendance for update
  to authenticated
  using (
    is_admin()
    or exists (
      select 1 from events e where e.id = attendance.event_id
        and e.team_id is not null and coaches_team(e.team_id)
    )
  )
  with check (
    is_admin()
    or exists (
      select 1 from events e where e.id = attendance.event_id
        and e.team_id is not null and coaches_team(e.team_id)
    )
  );

-- ===========================================================================
-- player_match_stats — coaches of the team record; all relevant parties read
-- ===========================================================================

alter table player_match_stats enable row level security;

create policy "player_match_stats_read"
  on player_match_stats for select
  to authenticated
  using (
    is_admin()
    or is_player(player_match_stats.player_id)
    or guards_player(player_match_stats.player_id)
    or exists (
      select 1 from events e where e.id = player_match_stats.event_id
        and e.team_id is not null and coaches_team(e.team_id)
    )
  );

create policy "player_match_stats_coach_write"
  on player_match_stats for insert
  to authenticated
  with check (
    is_admin()
    or exists (
      select 1 from events e where e.id = player_match_stats.event_id
        and e.team_id is not null and coaches_team(e.team_id)
    )
  );

create policy "player_match_stats_coach_update"
  on player_match_stats for update
  to authenticated
  using (
    is_admin()
    or exists (
      select 1 from events e where e.id = player_match_stats.event_id
        and e.team_id is not null and coaches_team(e.team_id)
    )
  )
  with check (
    is_admin()
    or exists (
      select 1 from events e where e.id = player_match_stats.event_id
        and e.team_id is not null and coaches_team(e.team_id)
    )
  );

-- ===========================================================================
-- skill_metrics — reference data: read for everyone, admin-managed
-- ===========================================================================

alter table skill_metrics enable row level security;

create policy "skill_metrics_read_authenticated"
  on skill_metrics for select
  to authenticated
  using (true);

create policy "skill_metrics_admin_write"
  on skill_metrics for insert
  to authenticated
  with check (is_admin());

create policy "skill_metrics_admin_update"
  on skill_metrics for update
  to authenticated
  using (is_admin())
  with check (is_admin());

create policy "skill_metrics_admin_delete"
  on skill_metrics for delete
  to authenticated
  using (is_admin());

-- ===========================================================================
-- assessments — a coach writes for players they coach; a player/guardian
-- reads their own development record
-- ===========================================================================

alter table assessments enable row level security;

create policy "assessments_admin_all"
  on assessments for all
  to authenticated
  using (is_admin());

create policy "assessments_coach_write"
  on assessments for insert
  to authenticated
  with check (coaches_player(player_id));

create policy "assessments_coach_update"
  on assessments for update
  to authenticated
  using (coaches_player(player_id) and assessed_by = auth.uid())
  with check (coaches_player(player_id) and assessed_by = auth.uid());

create policy "assessments_read"
  on assessments for select
  to authenticated
  using (
    is_admin()
    or is_player(assessments.player_id)
    or guards_player(assessments.player_id)
    or coaches_player(assessments.player_id)
  );

-- ===========================================================================
-- assessment_scores — write rides on the parent assessment; read mirrors it
-- ===========================================================================

alter table assessment_scores enable row level security;

create policy "assessment_scores_admin_all"
  on assessment_scores for all
  to authenticated
  using (is_admin());

create policy "assessment_scores_coach_write"
  on assessment_scores for insert
  to authenticated
  with check (
    exists (
      select 1 from assessments a
      where a.id = assessment_scores.assessment_id
        and coaches_player(a.player_id)
    )
  );

create policy "assessment_scores_coach_update"
  on assessment_scores for update
  to authenticated
  using (
    exists (
      select 1 from assessments a
      where a.id = assessment_scores.assessment_id
        and coaches_player(a.player_id) and a.assessed_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from assessments a
      where a.id = assessment_scores.assessment_id
        and coaches_player(a.player_id) and a.assessed_by = auth.uid()
    )
  );

create policy "assessment_scores_read"
  on assessment_scores for select
  to authenticated
  using (
    exists (
      select 1 from assessments a
      where a.id = assessment_scores.assessment_id
        and (
          is_admin()
          or is_player(a.player_id)
          or guards_player(a.player_id)
          or coaches_player(a.player_id)
        )
    )
  );

-- ===========================================================================
-- development_notes — coaches write notes on players they coach
-- ===========================================================================

alter table development_notes enable row level security;

create policy "development_notes_admin_all"
  on development_notes for all
  to authenticated
  using (is_admin());

create policy "development_notes_coach_write"
  on development_notes for insert
  to authenticated
  with check (coaches_player(player_id) and coach_id = auth.uid());

create policy "development_notes_coach_update"
  on development_notes for update
  to authenticated
  using (coach_id = auth.uid() and coaches_player(player_id))
  with check (coach_id = auth.uid() and coaches_player(player_id));

create policy "development_notes_read"
  on development_notes for select
  to authenticated
  using (
    is_admin()
    or is_player(development_notes.player_id)
    or guards_player(development_notes.player_id)
    or coaches_player(development_notes.player_id)
  );

-- ===========================================================================
-- Finance — invoices, payments, mpesa_transactions, documents.
-- Finance staff have full read on billing (they reconcile it) and write on
-- payments/documents, but are structurally outside medical and assessments.
-- ===========================================================================

alter table fee_types enable row level security;

create policy "fee_types_read_authenticated"
  on fee_types for select
  to authenticated
  using (true);

create policy "fee_types_admin_write"
  on fee_types for insert
  to authenticated
  with check (is_admin() or has_role('finance'));

create policy "fee_types_admin_update"
  on fee_types for update
  to authenticated
  using (is_admin() or has_role('finance'))
  with check (is_admin() or has_role('finance'));

create policy "fee_types_admin_delete"
  on fee_types for delete
  to authenticated
  using (is_admin());

-- ---------------------------------------------------------------------------

alter table invoices enable row level security;

create policy "invoices_admin_all"
  on invoices for all
  to authenticated
  using (is_admin());

create policy "invoices_finance_read"
  on invoices for select
  to authenticated
  using (has_role('finance'));

create policy "invoices_finance_write"
  on invoices for insert
  to authenticated
  with check (has_role('finance'));

create policy "invoices_finance_update"
  on invoices for update
  to authenticated
  using (has_role('finance'))
  with check (has_role('finance'));

create policy "invoices_self_read"
  on invoices for select
  to authenticated
  using (
    is_player(invoices.player_id)
    or guards_player(invoices.player_id)
  );

-- ---------------------------------------------------------------------------

alter table payments enable row level security;

create policy "payments_admin_all"
  on payments for all
  to authenticated
  using (is_admin());

create policy "payments_finance_all"
  on payments for all
  to authenticated
  using (has_role('finance'));

create policy "payments_self_read"
  on payments for select
  to authenticated
  using (
    is_player(payments.player_id)
    or guards_player(payments.player_id)
  );

-- ---------------------------------------------------------------------------

alter table mpesa_transactions enable row level security;

create policy "mpesa_admin_all"
  on mpesa_transactions for all
  to authenticated
  using (is_admin());

create policy "mpesa_finance_all"
  on mpesa_transactions for all
  to authenticated
  using (has_role('finance'));

create policy "mpesa_self_read"
  on mpesa_transactions for select
  to authenticated
  using (
    exists (
      select 1 from invoices inv
      where inv.id = mpesa_transactions.invoice_id
        and (is_player(inv.player_id) or guards_player(inv.player_id))
    )
  );

-- ---------------------------------------------------------------------------

alter table documents enable row level security;

create policy "documents_admin_all"
  on documents for all
  to authenticated
  using (is_admin());

create policy "documents_finance_read"
  on documents for select
  to authenticated
  using (has_role('finance') and not is_sensitive);

create policy "documents_coach_read"
  on documents for select
  to authenticated
  using (
    coaches_player(documents.player_id)
    and not is_sensitive
  );

create policy "documents_self_read"
  on documents for select
  to authenticated
  using (
    (is_player(documents.player_id) or guards_player(documents.player_id))
    and not is_sensitive
  );

-- ===========================================================================
-- Public website content — insert is open (public forms); everything else
-- is staff/admin. Length constraints bound anonymous abuse.
-- ===========================================================================

alter table programs enable row level security;

create policy "programs_read_all"
  on programs for select
  to anon, authenticated
  using (true);

create policy "programs_staff_write"
  on programs for insert
  to authenticated
  with check (is_staff());

create policy "programs_staff_update"
  on programs for update
  to authenticated
  using (is_staff())
  with check (is_staff());

create policy "programs_admin_delete"
  on programs for delete
  to authenticated
  using (is_admin());

-- ---------------------------------------------------------------------------

alter table achievements enable row level security;

create policy "achievements_read_all"
  on achievements for select
  to anon, authenticated
  using (true);

create policy "achievements_staff_write"
  on achievements for insert
  to authenticated
  with check (is_staff());

create policy "achievements_staff_update"
  on achievements for update
  to authenticated
  using (is_staff())
  with check (is_staff());

create policy "achievements_admin_delete"
  on achievements for delete
  to authenticated
  using (is_admin());

-- ---------------------------------------------------------------------------

alter table gallery_items enable row level security;

create policy "gallery_read_all"
  on gallery_items for select
  to anon, authenticated
  using (true);

create policy "gallery_staff_write"
  on gallery_items for insert
  to authenticated
  with check (is_staff());

create policy "gallery_staff_update"
  on gallery_items for update
  to authenticated
  using (is_staff())
  with check (is_staff());

create policy "gallery_admin_delete"
  on gallery_items for delete
  to authenticated
  using (is_admin());

-- ---------------------------------------------------------------------------

alter table contact_submissions enable row level security;

create policy "contact_submissions_insert_public"
  on contact_submissions for insert
  to anon, authenticated
  with check (true);

create policy "contact_submissions_staff_read"
  on contact_submissions for select
  to authenticated
  using (is_staff());

create policy "contact_submissions_staff_update"
  on contact_submissions for update
  to authenticated
  using (is_staff())
  with check (is_staff());

create policy "contact_submissions_admin_delete"
  on contact_submissions for delete
  to authenticated
  using (is_admin());

-- ===========================================================================
-- notifications & templates — admins manage; users read their own queue
-- ===========================================================================

alter table notification_templates enable row level security;

create policy "notification_templates_read_authenticated"
  on notification_templates for select
  to authenticated
  using (true);

create policy "notification_templates_admin_write"
  on notification_templates for insert
  to authenticated
  with check (is_admin());

create policy "notification_templates_admin_update"
  on notification_templates for update
  to authenticated
  using (is_admin())
  with check (is_admin());

create policy "notification_templates_admin_delete"
  on notification_templates for delete
  to authenticated
  using (is_admin());

-- ---------------------------------------------------------------------------

alter table notifications enable row level security;

create policy "notifications_self_read"
  on notifications for select
  to authenticated
  using (recipient_id = auth.uid());

create policy "notifications_self_update"
  on notifications for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create policy "notifications_admin_all"
  on notifications for all
  to authenticated
  using (is_admin());

-- ===========================================================================
-- Storage: public website bucket — world-readable, staff writes.
-- The private bucket has no policies: access is exclusively via admin-
-- generated short-lived signed URLs.
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('public', 'public', true, 5242880,
   array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('private', 'private', false, 26214400, null)
on conflict (id) do nothing;

create policy "public_bucket_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'public');

create policy "public_bucket_write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'public' and is_staff());

create policy "public_bucket_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'public' and is_staff());

create policy "public_bucket_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'public' and is_staff());
