-- ============================================================
-- Migration 00052: Supervisor Observations (Phase 34)
-- Models 00043 § sop_review_events (append-only audit shape);
-- widened to 3 recorder roles (D-04: admin, safety_manager, supervisor);
-- adds a worker self-read RLS branch — no precedent in 00043 (OBS-02);
-- verdict is DB-level check-constrained to 2 canonical values (D-01);
-- sop_version is server-stamped at insert time (D-10);
-- completion_id is an optional link back to sop_completions (D-11);
-- append-only: no UPDATE policy, no DELETE policy (D-12).
-- ============================================================

create table if not exists public.sop_observations (
  id                 uuid primary key default gen_random_uuid(),
  organisation_id    uuid not null references public.organisations(id) on delete cascade,
  sop_id             uuid not null references public.sops(id) on delete cascade,
  sop_version        int not null,
  observed_worker_id uuid not null references auth.users(id) on delete cascade,
  observed_by        uuid references auth.users(id) on delete set null,
  verdict            text not null check (verdict in ('performed_to_sop', 'needs_support')),
  note               text,
  completion_id      uuid references public.sop_completions(id) on delete set null,
  created_at         timestamptz not null default now()
);

create index if not exists sop_observations_observed_worker_id_idx on public.sop_observations(observed_worker_id);
create index if not exists sop_observations_organisation_id_idx on public.sop_observations(organisation_id);
create index if not exists sop_observations_sop_id_idx on public.sop_observations(sop_id);

alter table public.sop_observations enable row level security;

-- current_organisation_id() / current_user_role() are pre-existing helpers
-- (00001_foundation_schema.sql) — not redefined here.

drop policy if exists sop_observations_read_org on public.sop_observations;
create policy sop_observations_read_org on public.sop_observations
  for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    or observed_worker_id = auth.uid()  -- OBS-02: worker self-read, own rows only
  );

drop policy if exists sop_observations_insert_recorder on public.sop_observations;
create policy sop_observations_insert_recorder on public.sop_observations
  for insert to authenticated
  with check (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager', 'supervisor')
    and observed_by = auth.uid()
  );

-- NO UPDATE policy — append-only (D-12)
-- NO DELETE policy — append-only (D-12)

-- ------------------------------------------------------------
-- D-02: per-org renamable display labels for the two canonical verdicts.
-- Display-only — canonical values are never derived from this column,
-- only the fixed 'performed_to_sop' / 'needs_support' strings above.
-- No new RLS: the existing admin-update policy on organisations
-- (00001_foundation_schema.sql) already gates writes; 34-04's server
-- action self-enforces org scope regardless.
-- ------------------------------------------------------------
alter table public.organisations
  add column if not exists observation_labels jsonb;

comment on column public.organisations.observation_labels is
  'Display-only renamable verdict labels, e.g. { "performed_to_sop": "<label>", "needs_support": "<label>" }. Canonical values are never derived from this column.';
