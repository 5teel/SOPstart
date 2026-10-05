-- Phase 58 FOC-02/FOC-04/WRK-04/SOP-04: in-progress walks, AI findings, the step
-- tick with a self-clearing trigger, the SOP objective and the forward-jump flag.
--
-- D-15 / D-09: an in-progress walk lives in sop_walks. Its id becomes the
--       completion id on send, so sop_completions stays append-only and never
--       holds a half-finished walk. One in_progress row per worker and SOP.
-- D-17: AI findings are rows with a nullable step id (a SOP-level finding has
--       none), cleared by an admin action. Read by admins and safety managers of
--       the org only; no authenticated write policy -- the reviewer route and the
--       clear action write with the service role and self-scope.
-- D-01 / WRK-04: sop_focus_steps gains the tick (verified_by_admin_id,
--       verified_at) and needs_recheck. A before-update trigger clears the tick
--       whenever a worker-visible field changes, so no action can forget it.
--       The table still has no authenticated write policy.
-- D-20 / D-08: sops.objective (<= 500 chars) and sops.allow_forward_jump.
--
-- RLS (CLAUDE.md 2026-08-04): every policy is double-quoted, every arm carries
-- the org conjunct, and every WITH CHECK restates its USING in full. A WITH CHECK
-- replaces the USING, it does not add to it.
--
-- No elevated-privilege function: the trigger function below runs as the
-- invoking role with a pinned search_path and takes no tenant id
-- (CLAUDE.md 2026-07-05).
--
-- Idempotent: add column if not exists, create ... if not exists, drop policy /
-- trigger if exists before create, create or replace function -- so the
-- applier's Management-API fallback can re-run this file safely.

-- ============================================================
-- 1. sop_focus_steps: tick, recheck flag, editor-created rows
-- ============================================================
alter table public.sop_focus_steps add column if not exists verified_by_admin_id uuid references auth.users(id) on delete set null;
alter table public.sop_focus_steps add column if not exists verified_at timestamptz;
alter table public.sop_focus_steps add column if not exists needs_recheck boolean not null default false;

-- Steps the editor creates have no converter run; the key only has to be unique
-- within the section.
alter table public.sop_focus_steps alter column run_id drop not null;
alter table public.sop_focus_steps alter column source_key set default ('edit:' || gen_random_uuid()::text);

-- Any change to what a worker reads or must do clears the tick. A reorder or a
-- section move does not (sort_order and section_id are left out on purpose). An
-- update that itself sets or clears the tick is the tick action, so it is left
-- alone. Ticking also lowers the recheck flag; an edit to an already-open
-- recheck keeps it raised.
create or replace function public.clear_focus_step_tick() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.verified_by_admin_id is not distinct from old.verified_by_admin_id
     and (
       new.text is distinct from old.text
       or new.kind is distinct from old.kind
       or new.tip is distinct from old.tip
       or new.photo_required is distinct from old.photo_required
       or new.image_paths is distinct from old.image_paths
     )
  then
    new.needs_recheck := old.verified_by_admin_id is not null or old.needs_recheck;
    new.verified_by_admin_id := null;
    new.verified_at := null;
  elsif new.verified_by_admin_id is not null then
    new.needs_recheck := false;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists clear_focus_step_tick on public.sop_focus_steps;
create trigger clear_focus_step_tick
  before update on public.sop_focus_steps
  for each row execute function public.clear_focus_step_tick();

-- ============================================================
-- 2. sops: objective and forward-jump flag
-- ============================================================
alter table public.sops add column if not exists objective text;
alter table public.sops drop constraint if exists sops_objective_length_check;
alter table public.sops add constraint sops_objective_length_check
  check (objective is null or char_length(objective) <= 500);
alter table public.sops add column if not exists allow_forward_jump boolean not null default false;

-- ============================================================
-- 3. sop_walks (D-15) -- one in-progress walk per worker and SOP
-- ============================================================
create table if not exists public.sop_walks (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  sop_id uuid not null references public.sops(id) on delete cascade,
  sop_version integer not null,
  worker_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'abandoned')),
  acks jsonb not null default '{}'::jsonb,
  done jsonb not null default '{}'::jsonb,
  photos jsonb not null default '[]'::jsonb,
  current_step_id uuid,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz
);

create unique index if not exists sop_walks_one_in_progress_key
  on public.sop_walks (worker_id, sop_id) where status = 'in_progress';
create index if not exists sop_walks_organisation_id_idx on public.sop_walks (organisation_id);

alter table public.sop_walks enable row level security;

-- Own rows only. No delete policy: a walk is submitted or abandoned, never erased.
drop policy if exists "workers_can_view_own_sop_walks" on public.sop_walks;
create policy "workers_can_view_own_sop_walks"
  on public.sop_walks for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and worker_id = auth.uid()
  );

-- The sop must belong to the caller's org too, so a walk cannot point at a
-- foreign SOP.
drop policy if exists "workers_can_start_own_sop_walks" on public.sop_walks;
create policy "workers_can_start_own_sop_walks"
  on public.sop_walks for insert to authenticated
  with check (
    organisation_id = public.current_organisation_id()
    and worker_id = auth.uid()
    and exists (
      select 1 from public.sops s
      where s.id = sop_walks.sop_id
        and s.organisation_id = public.current_organisation_id()
    )
  );

drop policy if exists "workers_can_update_own_sop_walks" on public.sop_walks;
create policy "workers_can_update_own_sop_walks"
  on public.sop_walks for update to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and worker_id = auth.uid()
  )
  with check (
    organisation_id = public.current_organisation_id()
    and worker_id = auth.uid()
    and exists (
      select 1 from public.sops s
      where s.id = sop_walks.sop_id
        and s.organisation_id = public.current_organisation_id()
    )
  );

-- ============================================================
-- 4. sop_ai_findings (D-17) -- AI check results, one row per finding
-- ============================================================
create table if not exists public.sop_ai_findings (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  sop_id uuid not null references public.sops(id) on delete cascade,
  run_id uuid,
  job text not null,
  kind text not null,
  severity text not null check (severity in ('critical', 'warning')),
  step_id uuid references public.sop_focus_steps(id) on delete cascade,
  description text not null,
  extras jsonb not null default '{}'::jsonb,
  cleared_by uuid references auth.users(id) on delete set null,
  cleared_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists sop_ai_findings_open_idx on public.sop_ai_findings (sop_id) where cleared_at is null;
create index if not exists sop_ai_findings_organisation_id_idx on public.sop_ai_findings (organisation_id);

alter table public.sop_ai_findings enable row level security;

-- No write policy: the reviewer route and the clear action use the service role.
drop policy if exists "admins_can_view_sop_ai_findings" on public.sop_ai_findings;
create policy "admins_can_view_sop_ai_findings"
  on public.sop_ai_findings for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager')
  );
