-- ============================================================
-- Migration 00043: Ownership + Review Lifecycle + Governance Queue (Phase 28)
-- Adds: owner_user_id/review_due_at/last_reviewed_at/last_reviewed_by on
--       sops (additive, rides existing admins_can_update_sops /
--       org_members_can_view_sops policies from 00003 — no new RLS needed);
--       default_sop_owner() BEFORE INSERT trigger (D28-01, owner defaults
--       to creator across every create path with zero route edits);
--       sop_review_cadences (org-scoped settings, ai_model_settings shape,
--       D28-03) and sop_review_events (append-only audit, sop_completions
--       shape, D28-04).
-- ============================================================

-- ------------------------------------------------------------
-- Section 1: additive sops columns + indexes
-- ------------------------------------------------------------
alter table public.sops
  add column if not exists owner_user_id    uuid references auth.users(id) on delete set null,
  add column if not exists review_due_at    timestamptz,
  add column if not exists last_reviewed_at timestamptz,
  add column if not exists last_reviewed_by uuid references auth.users(id) on delete set null;

create index if not exists sops_owner_user_id_idx on public.sops(owner_user_id);
create index if not exists sops_review_due_at_idx on public.sops(review_due_at);

-- No new policy on sops: "admins_can_update_sops" (org + admin/safety_manager)
-- already gates writes to these columns, "org_members_can_view_sops" already
-- gates reads (00003_sop_schema.sql). Per D28-01 / RESEARCH Pitfall 1.

-- ------------------------------------------------------------
-- Section 2: default owner on insert (D28-01) — one trigger covers every
-- create path (wizard/upload/ai-prompt/voice/blank/clone) with zero route edits.
-- ------------------------------------------------------------
-- NOTE: sops has no created_by column (only uploaded_by, set to user.id at
-- every insert site — src/actions/sops.ts, versioning.ts, ai-prompt/youtube
-- routes). Rule-1 fix: default owner from uploaded_by, not created_by.
create or replace function public.default_sop_owner()
returns trigger
language plpgsql
as $$
begin
  if new.owner_user_id is null then
    new.owner_user_id := new.uploaded_by;
  end if;
  return new;
end;
$$;

drop trigger if exists set_sop_owner_default on public.sops;
create trigger set_sop_owner_default
  before insert on public.sops
  for each row execute function public.default_sop_owner();

-- ------------------------------------------------------------
-- Section 3: sop_review_cadences (D28-03) — org-scoped settings table,
-- mirrors ai_model_settings (00042) exactly: authenticated SELECT only,
-- writes via service-role server action self-enforcing org scope.
-- ------------------------------------------------------------
create table if not exists public.sop_review_cadences (
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  category        text not null,
  months          int not null default 12,
  updated_by      uuid references auth.users(id) on delete set null,
  updated_at      timestamptz not null default now(),
  primary key (organisation_id, category)
);

alter table public.sop_review_cadences enable row level security;

drop policy if exists sop_review_cadences_read_org on public.sop_review_cadences;
create policy sop_review_cadences_read_org on public.sop_review_cadences
  for select
  using (organisation_id = (auth.jwt()->'app_metadata'->>'organisation_id')::uuid);

-- NO authenticated INSERT/UPDATE/DELETE policy — writes go through the
-- service-role server action (Plan 28-03), self-enforcing org scope,
-- exactly like ai_model_settings (00042).

-- ------------------------------------------------------------
-- Section 4: sop_review_events (D28-04) — append-only audit table,
-- mirrors sop_completions (00010) shape: SELECT org-scoped, INSERT with
-- reviewed_by = auth.uid() + role check, NO update/delete (COMP-07 precedent).
-- ------------------------------------------------------------
create table if not exists public.sop_review_events (
  id              uuid primary key default gen_random_uuid(),
  sop_id          uuid not null references public.sops(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  reviewed_by     uuid references auth.users(id) on delete set null,
  action          text not null check (action in ('confirmed_current','superseded')),
  created_at      timestamptz not null default now()
);

create index if not exists sop_review_events_sop_id_idx on public.sop_review_events(sop_id);

alter table public.sop_review_events enable row level security;

drop policy if exists sop_review_events_read_org on public.sop_review_events;
create policy sop_review_events_read_org on public.sop_review_events
  for select to authenticated
  using (organisation_id = public.current_organisation_id());

drop policy if exists sop_review_events_insert_admin on public.sop_review_events;
create policy sop_review_events_insert_admin on public.sop_review_events
  for insert to authenticated
  with check (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager')
    and reviewed_by = auth.uid()
  );

-- NO UPDATE policy — append-only (COMP-07/D-15 precedent)
-- NO DELETE policy — append-only (COMP-07/D-15 precedent)
