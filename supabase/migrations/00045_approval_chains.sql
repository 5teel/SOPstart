-- ============================================================
-- Migration: 00045_approval_chains
-- Phase 29 (Approval Chains) — D29-01/D29-02/D29-03.
--
-- Section 1: sops.approval_state / sops.approval_snapshot — two additive
--   nullable columns. Deliberately NOT a new SopStatus enum value (D29-03
--   LOCKED) — every existing status-based code path (17 files filtering on
--   status = 'published'/status !== 'draft') stays untouched. No new RLS:
--   rides admins_can_update_sops / org_members_can_view_sops (00003) exactly
--   like Phase 28's four columns.
--
-- Section 2: approval_chains — org-scoped settings table, PK
--   (organisation_id, category). Mirrors sop_review_cadences (00043) shape,
--   but written with the CORRECT current_organisation_id() predicate from day
--   one (00044 fixed this retroactively for cadences/ai_model_settings —
--   do not repeat that mistake here). NO authenticated write policy — writes
--   go through a service-role server action (setApprovalChain) that
--   self-enforces org scope from the caller's JWT.
--
-- Section 3: sop_approvals — append-only audit table mirroring
--   sop_review_events (00043), PLUS a PARTIAL unique index scoped to
--   action = 'approved' (NOT a blanket unique(sop_id,version,step_index),
--   which would break multi-cycle reject/resubmit — RESEARCH Pitfall 4).
--   INSERT policy requires approver_user_id = auth.uid() (any matching
--   approver may write, not just admin/safety_manager as a role check —
--   Pitfall 3 scoping is enforced at the chain-step-definition layer, not
--   here). NO UPDATE/DELETE — append-only (COMP-07/D-15 precedent).
-- ============================================================

-- Section 1: sops columns
alter table public.sops
  add column if not exists approval_state    text check (approval_state in ('pending', 'approved')),
  add column if not exists approval_snapshot jsonb;

-- Section 2: approval_chains
create table if not exists public.approval_chains (
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  category        text not null,
  steps           jsonb not null,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (organisation_id, category)
);
alter table public.approval_chains enable row level security;
create policy approval_chains_read_org on public.approval_chains
  for select to authenticated
  using (organisation_id = public.current_organisation_id());
-- NO authenticated INSERT/UPDATE/DELETE policy — writes via service-role
-- server action self-enforcing org scope (setApprovalChain, Phase 29-02).

-- Section 3: sop_approvals
create table if not exists public.sop_approvals (
  id               uuid primary key default gen_random_uuid(),
  sop_id           uuid not null references public.sops(id) on delete cascade,
  organisation_id  uuid not null references public.organisations(id) on delete cascade,
  version          int not null,
  step_index       int not null,
  approver_user_id uuid references auth.users(id) on delete set null,
  action           text not null check (action in ('approved', 'changes_requested')),
  comment          text,
  created_at       timestamptz not null default now()
);
create index if not exists sop_approvals_sop_id_idx on public.sop_approvals(sop_id);

-- Idempotent-approve guard: only ONE 'approved' row per (sop, version, step) —
-- a PARTIAL index, NOT a blanket unique(sop_id, version, step_index), which
-- would also block a second changes_requested row across multiple
-- reject/resubmit cycles (RESEARCH Pitfall 4).
create unique index if not exists sop_approvals_one_approval_per_step
  on public.sop_approvals(sop_id, version, step_index)
  where action = 'approved';

alter table public.sop_approvals enable row level security;
create policy sop_approvals_read_org on public.sop_approvals
  for select to authenticated
  using (organisation_id = public.current_organisation_id());
create policy sop_approvals_insert_self on public.sop_approvals
  for insert to authenticated
  with check (
    organisation_id = public.current_organisation_id()
    and approver_user_id = auth.uid()
  );
-- NO UPDATE/DELETE — append-only.
