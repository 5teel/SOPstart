-- ============================================================
-- Migration 00038: Phase 23 — AI Field Layer + Version Supersede schema
-- Adds:
--   1. sop_completions.roster_worker_id  — AFL-VER-05 D-11 roster attribution FK
--   2. sop_completion_signatures         — AFL-VER-05 append-only sign-off chain
--   3. ai_field_proposals                — X-03 pending AI field approval records
--
-- All changes are pure-additive — no existing tables, columns, indexes,
-- or policies are modified or dropped.
--
-- Anti-pattern (per 00030/00031/00035 learning): NEVER reference sops or
-- sop_completions from a RLS SELECT policy on these new tables — cross-table
-- EXISTS checks cause 42P17 infinite recursion. Both new tables use
-- current_organisation_id() directly. The real gate stays on the parent table.
--
-- Junction/append-only tables that have no authenticated write policy require
-- writes via createAdminClient() in server actions, which MUST self-enforce
-- org-scoping (CLAUDE.md 2026-06-15 learning).
-- ============================================================

begin;

-- ============================================================
-- 1. sop_completions.roster_worker_id — D-11 roster attribution column
--
-- Distinct from worker_id (which holds the kiosk account uid for RLS).
-- NULL for all pre-Phase-23 completions (back-compat, no row migration needed).
-- ============================================================
alter table public.sop_completions
  add column if not exists roster_worker_id uuid references auth.users(id);

create index if not exists idx_completions_roster_worker
  on public.sop_completions(roster_worker_id);

comment on column public.sop_completions.roster_worker_id is
  'Phase 23 D-11: selected roster worker UUID (attribution FK). Distinct from worker_id which holds the kiosk account uid for RLS. NULL for all pre-Phase-23 completions.';

-- ============================================================
-- 2. sop_completion_signatures — AFL-VER-05 append-only worker+supervisor sign-off chain
--
-- Append-only: NO authenticated INSERT/UPDATE/DELETE policy.
-- Writes go through createAdminClient() in the recordSignature server action.
-- The action MUST self-enforce org-scoping (service-role bypasses RLS).
--
-- RLS SELECT: direct current_organisation_id() only — zero cross-table join
-- to public.sops or public.sop_completions (avoids 42P17 recursion per
-- CLAUDE.md 2026-05-13 learning + RESEARCH Pitfall 1).
-- ============================================================
create table if not exists public.sop_completion_signatures (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations(id) on delete cascade,
  completion_id    uuid not null references public.sop_completions(id),
  role             text not null check (role in ('worker', 'supervisor')),
  roster_user_id   uuid not null references auth.users(id),
  signed_at        timestamptz not null default now()
);

alter table public.sop_completion_signatures enable row level security;

-- SELECT: org-scoped read — direct current_organisation_id(), NO cross-table join.
-- CRITICAL: do NOT reference public.sops or public.sop_completions from this policy —
-- 42P17 recursion risk (CLAUDE.md 2026-05-13 RLS recursion learning; RESEARCH Pitfall 1).
create policy "sop_completion_signatures_org_read" on public.sop_completion_signatures
  for select to authenticated
  using (organisation_id = public.current_organisation_id());

-- NO authenticated INSERT/UPDATE/DELETE policy.
-- Writes via createAdminClient() in recordSignature server action (CLAUDE.md 2026-06-15 learning).

create index if not exists idx_signatures_completion
  on public.sop_completion_signatures(completion_id);
create index if not exists idx_signatures_org
  on public.sop_completion_signatures(organisation_id);

comment on table public.sop_completion_signatures is
  'Phase 23 AFL-VER-05: append-only sign-off chain (worker + supervisor roles). No authenticated write policy — writes via createAdminClient() in recordSignature server action (CLAUDE.md 2026-06-15 learning). RLS SELECT uses current_organisation_id() directly — no cross-table reference to avoid 42P17 (CLAUDE.md 2026-05-13).';

-- ============================================================
-- 3. ai_field_proposals — X-03 pending AI field write approvals
--
-- Stores high-stake AI-proposed field changes pending admin approval.
-- Append-only (status transitions via server action only): NO authenticated
-- INSERT/UPDATE/DELETE policy. Writes via createAdminClient() in applyAiWrite /
-- acceptProposal / rejectProposal server actions.
--
-- RLS SELECT: direct current_organisation_id() only — zero cross-table join.
-- CRITICAL: do NOT reference public.sops from this policy — 42P17 recursion risk.
-- ============================================================
create table if not exists public.ai_field_proposals (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations(id) on delete cascade,
  field_id         text not null,
  field_label      text not null,
  context          jsonb not null default '{}'::jsonb,
  current_value    jsonb,
  proposed_value   jsonb,
  status           text not null default 'pending' check (status in ('pending', 'applied', 'rejected')),
  sop_version      int,
  created_at       timestamptz not null default now()
);

alter table public.ai_field_proposals enable row level security;

-- SELECT: org-scoped read — direct current_organisation_id(), NO cross-table join.
-- CRITICAL: do NOT reference public.sops from this policy — 42P17 recursion risk
-- (CLAUDE.md 2026-05-13 RLS recursion learning; RESEARCH Pitfall 1).
create policy "ai_field_proposals_org_read" on public.ai_field_proposals
  for select to authenticated
  using (organisation_id = public.current_organisation_id());

-- NO authenticated INSERT/UPDATE/DELETE policy.
-- Writes via createAdminClient() in applyAiWrite / acceptProposal / rejectProposal server actions.

create index if not exists idx_ai_field_proposals_org_status
  on public.ai_field_proposals(organisation_id, status);

comment on table public.ai_field_proposals is
  'Phase 23 X-03: AI field write proposals pending admin approval. No authenticated write policy — writes via createAdminClient() in server actions (CLAUDE.md 2026-06-15 learning). RLS SELECT uses current_organisation_id() directly — no cross-table reference to avoid 42P17 (CLAUDE.md 2026-05-13). Do NOT reference public.sops from this policy.';

commit;
