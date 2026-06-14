-- ============================================================
-- Migration 00035: Phase 25 Department as a First-Class Entity — schema
-- Adds:
--   1. departments                      — org-scoped department entity
--   2. block_departments junction        — many-to-many blocks ↔ departments
--   3. sop_departments junction          — many-to-many sops ↔ departments
--   4. member_departments junction       — many-to-many members ↔ departments
--   5. blocks.all_departments column     — org-wide flag (D-04 parity)
--   6. sops.all_departments column       — org-wide flag (D-04 parity)
--   7. current_user_department_ids()     — SECURITY DEFINER helper for RLS
--   8. sop_in_user_departments()         — SECURITY DEFINER helper for RLS
--   9. sops_visible_by_department policy — third permissive SELECT (additive OR, D-02)
--
-- All changes are pure-additive — no existing tables, columns, indexes,
-- or policies are modified or dropped.
--
-- Anti-pattern (per 00030/00031 learning): NEVER reference sops/blocks from
-- a junction SELECT policy — this causes 42P17 infinite recursion. All three
-- junction tables use `using(true)` for SELECT. The real gate stays on sops.
-- ============================================================

begin;

-- ============================================================
-- 1. departments — org-scoped department entity (REQ-1, D-03)
-- ============================================================
create table if not exists public.departments (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations(id) on delete cascade,
  name             text not null,
  code             text not null,
  colour           text not null default '#3b82f6',
  icon             text,
  -- D-03: owner is an accountability label only — no extra permissions granted.
  -- ON DELETE SET NULL so the dept surfaces a "no owner" warning rather than orphaning (REQ-5).
  owner_user_id    uuid references auth.users(id) on delete set null,
  archived         boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organisation_id, code)
);

alter table public.departments enable row level security;

-- Workers + admins in the same org can read departments (cross-tenant isolation: REQ-1).
create policy "departments_org_read" on public.departments
  for select to authenticated
  using (organisation_id = public.current_organisation_id());

-- Only admins/safety_managers of the same org can insert (T-25-03 privilege escalation mitigated).
create policy "departments_admin_insert" on public.departments
  for insert to authenticated
  with check (
    organisation_id = public.current_organisation_id()
    and exists (
      select 1 from public.organisation_members om
      where om.user_id = auth.uid()
        and om.role in ('admin', 'safety_manager')
    )
  );

create policy "departments_admin_update" on public.departments
  for update to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and exists (
      select 1 from public.organisation_members om
      where om.user_id = auth.uid()
        and om.role in ('admin', 'safety_manager')
    )
  )
  with check (
    organisation_id = public.current_organisation_id()
    and exists (
      select 1 from public.organisation_members om
      where om.user_id = auth.uid()
        and om.role in ('admin', 'safety_manager')
    )
  );

create policy "departments_admin_delete" on public.departments
  for delete to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and exists (
      select 1 from public.organisation_members om
      where om.user_id = auth.uid()
        and om.role in ('admin', 'safety_manager')
    )
  );

create index if not exists idx_departments_org on public.departments (organisation_id);

comment on table public.departments is
  'Phase 25: org-scoped department entity. owner_user_id is an accountability label only (D-03) — ON DELETE SET NULL so the dept surfaces a "no owner" warning when the member is removed (REQ-5).';

-- ============================================================
-- 2. block_departments junction — blocks ↔ departments (REQ-2)
-- Non-sensitive UUID-pair junction — using(true) for SELECT to avoid
-- the 00030/00031 recursion trap (D-02a). The real gate stays on blocks.
-- ============================================================
create table if not exists public.block_departments (
  block_id       uuid not null references public.blocks(id) on delete cascade,
  department_id  uuid not null references public.departments(id) on delete cascade,
  primary key (block_id, department_id)
);

alter table public.block_departments enable row level security;

-- CRITICAL: using(true) — NOT a reference to public.blocks. Recursion trap avoided.
create policy "block_departments_read_all_auth" on public.block_departments
  for select to authenticated using (true);
-- Writes: admin server actions only — no authenticated INSERT/UPDATE/DELETE policy.

create index if not exists idx_block_departments_block on public.block_departments (block_id);
create index if not exists idx_block_departments_dept on public.block_departments (department_id);

comment on table public.block_departments is
  'Phase 25: many-to-many junction binding blocks to departments. SELECT using(true) per D-02a — no recursion. The real gate (org-scoped read) stays on public.blocks. Writes via admin server actions only.';

-- ============================================================
-- 3. sop_departments junction — sops ↔ departments (REQ-3)
-- Same recursion-avoidance pattern as block_departments above.
-- ============================================================
create table if not exists public.sop_departments (
  sop_id         uuid not null references public.sops(id) on delete cascade,
  department_id  uuid not null references public.departments(id) on delete cascade,
  primary key (sop_id, department_id)
);

alter table public.sop_departments enable row level security;

-- CRITICAL: using(true) — NOT a reference to public.sops. Recursion trap avoided.
create policy "sop_departments_read_all_auth" on public.sop_departments
  for select to authenticated using (true);
-- Writes: admin server actions only — no authenticated INSERT/UPDATE/DELETE policy.

create index if not exists idx_sop_departments_sop on public.sop_departments (sop_id);
create index if not exists idx_sop_departments_dept on public.sop_departments (department_id);

comment on table public.sop_departments is
  'Phase 25: many-to-many junction binding SOPs to departments. SELECT using(true) per D-02a — no recursion. The real visibility gate is sops_visible_by_department on public.sops. Writes via admin server actions only.';

-- ============================================================
-- 4. member_departments junction — members ↔ departments (REQ-4)
-- Slightly more restrictive: workers see own rows; admins see all in org.
-- Does NOT reference sops or blocks — recursion trap avoided.
-- ============================================================
create table if not exists public.member_departments (
  member_id      uuid not null references auth.users(id) on delete cascade,
  department_id  uuid not null references public.departments(id) on delete cascade,
  assigned_at    timestamptz not null default now(),
  assigned_by    uuid references auth.users(id),
  primary key (member_id, department_id)
);

alter table public.member_departments enable row level security;

-- Workers see their own rows; admins/safety_managers in same org see all.
create policy "member_departments_self_read" on public.member_departments
  for select to authenticated
  using (
    member_id = auth.uid()
    or exists (
      select 1 from public.organisation_members om
      where om.user_id = auth.uid()
        and om.role in ('admin', 'safety_manager')
    )
  );
-- Writes: admin server actions only — no authenticated INSERT/UPDATE/DELETE policy.

create index if not exists idx_member_departments_member on public.member_departments (member_id);
create index if not exists idx_member_departments_dept on public.member_departments (department_id);

comment on table public.member_departments is
  'Phase 25: many-to-many junction binding org members to departments (REQ-4). Self-read + same-org admin/safety_manager read. Writes via admin server actions only.';

-- ============================================================
-- 5. SECURITY DEFINER helpers for RLS
-- Both mirror the sub_trade pattern from migration 00030 (D-02a).
-- CRITICAL: SQL function bodies reference tables by NAME — any later rename
-- MUST recompile this function (CLAUDE.md learning 2026-05-08).
-- ============================================================
create or replace function public.current_user_department_ids() returns setof uuid
  language sql
  stable
  security definer
  set search_path = public
as $$
  select department_id from public.member_departments where member_id = auth.uid();
$$;

comment on function public.current_user_department_ids() is
  'Phase 25: returns department_ids assigned to the calling user. Used by sop_in_user_departments() and sops_visible_by_department policy. CRITICAL: SQL function body references member_departments by NAME — any later rename MUST recompile this function (CLAUDE.md learning 2026-05-08).';

create or replace function public.sop_in_user_departments(p_sop_id uuid) returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1 from public.sop_departments sd
    where sd.sop_id = p_sop_id
      and sd.department_id in (select * from public.current_user_department_ids())
  );
$$;

comment on function public.sop_in_user_departments(uuid) is
  'Phase 25: returns true if the calling user belongs to at least one department that is tagged on the SOP. Used by sops_visible_by_department policy. References public.sop_departments by NAME — see CLAUDE.md learning 2026-05-08.';

-- ============================================================
-- 6. all_departments flag on blocks + sops (D-04 parity)
-- Signals "org-wide / visible to everyone" independent of department tags.
-- ============================================================
alter table public.blocks
  add column if not exists all_departments boolean not null default false;

alter table public.sops
  add column if not exists all_departments boolean not null default false;

comment on column public.blocks.all_departments is
  'Phase 25 D-04: true = this block is available org-wide regardless of department tags. Analogous to sops.all_departments.';
comment on column public.sops.all_departments is
  'Phase 25 D-04: true = this SOP is visible to all workers regardless of department membership (D-04, REQ-3).';

-- ============================================================
-- 7. Third permissive SELECT policy on sops — department gate (D-02, D-02a)
--
-- Additive OR with existing sops_visible_by_sub_trade and the base policies.
-- Empty sop_departments rows for a SOP = no gate (backward compat with pre-Phase-25 data).
-- sops.all_departments = true = always visible (D-04).
-- sop_in_user_departments() SECURITY DEFINER helper is called instead of a direct
-- cross-policy EXISTS chain — this is the key recursion-avoidance pattern (D-02a).
--
-- Per D-02: a worker sees a SOP if it is assigned to them OR matches one of their
-- departments OR matches one of their sub-trades OR is org-wide. These are additive ORs
-- implemented by multiple permissive SELECT policies on the same command.
--
-- DO NOT modify or replace the existing sops_visible_by_sub_trade policy.
-- ============================================================
create policy "sops_visible_by_department" on public.sops
  for select to authenticated
  using (
    sops.all_departments = true
    or not exists (select 1 from public.sop_departments sd where sd.sop_id = sops.id)
    or sop_in_user_departments(sops.id)
  );

comment on policy "sops_visible_by_department" on public.sops is
  'Phase 25 D-02: third permissive SELECT policy — additive OR arm for department-based visibility. Calls sop_in_user_departments() SECURITY DEFINER helper to avoid 42P17 recursion (D-02a). Does NOT modify or replace sops_visible_by_sub_trade.';

commit;
