-- ============================================================
-- Migration 00034: Team UAT & Design-Feedback hub
-- Adds:
--   1. uat_feedback — one row per (org, test, user); criteria responses,
--      overall verdict, rating, free-text notes. Test DEFINITIONS live in
--      version-controlled config (src/lib/uat/tests.ts), NOT in the DB —
--      this table only stores the team's responses so an AI agent can read
--      and analyse them.
--
-- Org scoping mirrors the canonical pattern from 00021:
--   organisation_id::text = (auth.jwt()->>'organisation_id')
--
-- Read: any authenticated org member can see all feedback in their org
--       (so the team can discuss directions). Write: own rows only.
-- Pure-additive — no existing objects modified.
-- ============================================================

begin;

create table if not exists public.uat_feedback (
  id                  uuid primary key default gen_random_uuid(),
  organisation_id     uuid not null,
  test_id             text not null,            -- references a UatTest.id in src/lib/uat/tests.ts
  user_id             uuid not null references auth.users(id) on delete cascade,
  user_email          text,                     -- denormalised for display + AI analysis
  criteria_responses  jsonb not null default '{}'::jsonb,  -- { [criterionId]: 'pass' | 'fail' | 'na' }
  preferred_direction text,                     -- chosen UatDirection.id for design-direction tests
  overall_verdict     text,                     -- 'approve' | 'needs_work' | 'reject' | null
  rating              int,                      -- optional 1..5 preference score
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint uat_feedback_verdict_chk
    check (overall_verdict is null or overall_verdict in ('approve','needs_work','reject')),
  constraint uat_feedback_rating_chk
    check (rating is null or (rating between 1 and 5)),
  -- one response row per user per test per org (upsert target)
  constraint uat_feedback_unique_per_user unique (organisation_id, test_id, user_id)
);

create index if not exists uat_feedback_org_test_idx
  on public.uat_feedback (organisation_id, test_id);

alter table public.uat_feedback enable row level security;

-- Read: all feedback within the caller's org (team can see each other's input)
create policy "uat_feedback_read_org" on public.uat_feedback
  for select to authenticated
  using (organisation_id::text = (auth.jwt()->>'organisation_id'));

-- Insert: own rows, scoped to caller's org
create policy "uat_feedback_insert_own" on public.uat_feedback
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and organisation_id::text = (auth.jwt()->>'organisation_id')
  );

-- Update: own rows only
create policy "uat_feedback_update_own" on public.uat_feedback
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Delete: own rows only
create policy "uat_feedback_delete_own" on public.uat_feedback
  for delete to authenticated
  using (user_id = auth.uid());

comment on table public.uat_feedback is
  'Team UAT / design-direction feedback. Test definitions live in src/lib/uat/tests.ts; this table stores per-user responses (criteria pass/fail/na, verdict, rating, notes) for AI analysis. Migration 00034.';

commit;
