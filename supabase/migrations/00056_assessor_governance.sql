-- ============================================================
-- Migration 00056: Assessor Governance (Phase 37, ASR-01)
--
-- Encodes four decisions:
--   D-05 — override always available, reason mandatory. A recorder who is
--          not a signed-off assessor can still record an advancing
--          observation or approve a sign-off IF they are admin/safety_manager
--          AND supply a reason; the reason is enforced three layers deep
--          (Zod → server action → this migration's CHECK constraint).
--   D-07 — append-only audit stays append-only via STAMPED COLUMNS on the
--          existing sop_observations / completion_sign_offs tables, not a
--          new audit table. Both tables already satisfy every structural
--          property sop_review_events (00043) established for an
--          append-only audit shape: org-scoped read, role-checked insert,
--          no UPDATE policy, no DELETE policy. Adding a table here would be
--          a second source of truth for a single audit fact already living
--          on the row it describes.
--   D-08 — worker_notifications (00009) is reused for the assessment-request
--          path, not a new notification table.
--   Accepted residual RLS gap (37-RESEARCH Pitfall 4) — the full assessor
--          predicate (lineage widening + needs_support reset) is NOT
--          re-implemented in SQL; only the narrow "plain supervisor cannot
--          self-stamp an override" backstop is SQL-expressible and added
--          to the insert policy below (T-37-01-02, mitigate). The broader
--          "non-assessor supervisor recording a non-override advancing
--          observation via raw PostgREST" threat (T-37-01-04) is accepted —
--          see 37-01-PLAN.md threat register.
-- ============================================================

-- ------------------------------------------------------------
-- Section 1: sop_observations override audit columns
-- ------------------------------------------------------------
alter table public.sop_observations
  add column if not exists is_assessor_override boolean not null default false,
  add column if not exists override_reason text;

comment on column public.sop_observations.is_assessor_override is
  'Phase 37 ASR-01/D-05: true when an admin/safety_manager recorded an advancing observation without signed-off assessor status, using the override path.';
comment on column public.sop_observations.override_reason is
  'Phase 37 ASR-01/D-05: mandatory reason text when is_assessor_override = true. Enforced by Zod (layer 1), the server action (layer 2), and the CHECK constraint below (layer 3).';

alter table public.sop_observations
  drop constraint if exists sop_observations_override_reason_required;

alter table public.sop_observations
  add constraint sop_observations_override_reason_required
  check (not is_assessor_override or override_reason is not null);

-- ------------------------------------------------------------
-- Section 2: completion_sign_offs override audit columns (same shape)
-- ------------------------------------------------------------
alter table public.completion_sign_offs
  add column if not exists is_assessor_override boolean not null default false,
  add column if not exists override_reason text;

comment on column public.completion_sign_offs.is_assessor_override is
  'Phase 37 ASR-01/D-05: true when an admin/safety_manager approved a sign-off without signed-off assessor status, using the override path.';
comment on column public.completion_sign_offs.override_reason is
  'Phase 37 ASR-01/D-05: mandatory reason text when is_assessor_override = true. Enforced by Zod (layer 1), the server action (layer 2), and the CHECK constraint below (layer 3).';

alter table public.completion_sign_offs
  drop constraint if exists completion_sign_offs_override_reason_required;

alter table public.completion_sign_offs
  add constraint completion_sign_offs_override_reason_required
  check (not is_assessor_override or override_reason is not null);

-- ------------------------------------------------------------
-- Section 3: worker_notifications.subject_user_id (D-08)
--
-- The person the notification is ABOUT (the supervisor who needs
-- assessing), distinct from user_id (the RECIPIENT of the notification).
-- Nullable — every pre-existing row and every sop_updated/completion_rejected
-- row leaves this null; only the new assessment_requested type populates it.
-- ------------------------------------------------------------
alter table public.worker_notifications
  add column if not exists subject_user_id uuid references auth.users(id) on delete cascade;

comment on column public.worker_notifications.subject_user_id is
  'Phase 37 ASR-01/D-08: the person the notification is ABOUT (e.g. the supervisor who needs assessing), distinct from user_id (the recipient). Null for all pre-existing notification types.';

-- ------------------------------------------------------------
-- Section 4: sop_observations_insert_recorder — re-created with one new
-- conjunct (T-37-01-02, mitigate). The three original conditions are
-- byte-identical to 00052; only a plain supervisor is blocked from
-- self-stamping an override even via a raw authenticated PostgREST call.
--
-- Deliberately NOT expressing the full assessor predicate here — that
-- needs lineage widening + the needs_support reset (pure TS logic in
-- src/lib/competency/assessor.ts) and would become a second source of
-- truth if coarsely re-implemented in SQL (37-RESEARCH Anti-Patterns).
-- ------------------------------------------------------------
drop policy if exists sop_observations_insert_recorder on public.sop_observations;
create policy sop_observations_insert_recorder on public.sop_observations
  for insert to authenticated
  with check (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager', 'supervisor')
    and observed_by = auth.uid()
    and (not is_assessor_override or public.current_user_role() in ('admin', 'safety_manager'))
  );

-- NO UPDATE policy on sop_observations — append-only (D-12, unchanged by this migration)
-- NO DELETE policy on sop_observations — append-only (D-12, unchanged by this migration)
-- NO UPDATE policy on completion_sign_offs — append-only (D-17, unchanged by this migration)
-- NO DELETE policy on completion_sign_offs — append-only (D-17, unchanged by this migration)
