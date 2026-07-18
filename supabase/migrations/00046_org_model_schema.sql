-- ============================================================
-- Migration 00046: Phase 32 Visual Org Model & Library Permissions — schema
-- Adds:
--   1. grant_subject_type enum          — org|area|department|role|person
--   2. areas                            — org-scoped entity (D-04)
--   3. roles                            — dept-scoped entity (D-05)
--   4. collections                      — org-scoped entity, seeded from sops.category (D-01)
--   5. departments.area_id column       — nullable FK, D-04
--   6. role_members junction            — roles ↔ people (D-05/D-07)
--   7. sop_collections junction         — sops ↔ collections (D-01)
--   8. access_grants                    — org-unit × collection grants (D-02/D-06/D-11)
--   9. sop_access_people junction       — materialized person/role grant fanout (D-13)
--  10. sop_in_user_person_grants()      — SECURITY DEFINER helper for RLS (D-13)
--  11. sops_visible_by_person_grant     — fourth permissive SELECT (additive OR, D-13)
--
-- All changes are pure-additive — no existing tables, columns, indexes, or
-- policies are modified or dropped. sops_visible_by_department and
-- sops_visible_by_sub_trade are byte-untouched.
--
-- Anti-pattern (per 00030/00031 learning): NEVER reference sops/departments/
-- roles/collections from a junction's own SELECT policy — this causes 42P17
-- infinite recursion. All junction tables here use `using(true)` for SELECT,
-- except access_grants (org-scoped, not a UUID-pair junction — see §8) and
-- sop_access_people (self/admin-scoped — see §9).
-- ============================================================

begin;

-- ============================================================
-- 1. grant_subject_type enum (D-02, D-06)
-- ============================================================
create type public.grant_subject_type as enum ('org', 'area', 'department', 'role', 'person');

-- ============================================================
-- 2. areas — org-scoped entity (D-04)
-- ============================================================
create table if not exists public.areas (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations(id) on delete cascade,
  name             text not null,
  colour           text not null default '#3b82f6',
  sort             int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.areas enable row level security;

create policy "areas_org_read" on public.areas
  for select to authenticated
  using (organisation_id = public.current_organisation_id());

create policy "areas_admin_insert" on public.areas
  for insert to authenticated
  with check (
    organisation_id = public.current_organisation_id()
    and exists (
      select 1 from public.organisation_members om
      where om.user_id = auth.uid()
        and om.role in ('admin', 'safety_manager')
    )
  );

create policy "areas_admin_update" on public.areas
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

create policy "areas_admin_delete" on public.areas
  for delete to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and exists (
      select 1 from public.organisation_members om
      where om.user_id = auth.uid()
        and om.role in ('admin', 'safety_manager')
    )
  );

create index if not exists idx_areas_org on public.areas (organisation_id);

comment on table public.areas is
  'Phase 32 D-04: org-scoped area entity that groups departments in the org chart/rail. Grantable (D-04).';

-- ============================================================
-- 3. roles — dept-scoped job role entity (D-05)
-- ============================================================
create table if not exists public.roles (
  id                uuid primary key default gen_random_uuid(),
  organisation_id   uuid not null references public.organisations(id) on delete cascade,
  department_id     uuid not null references public.departments(id) on delete cascade,
  name              text not null,
  budgeted_count    int not null default 1,
  sort              int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.roles enable row level security;

create policy "roles_org_read" on public.roles
  for select to authenticated
  using (organisation_id = public.current_organisation_id());

create policy "roles_admin_insert" on public.roles
  for insert to authenticated
  with check (
    organisation_id = public.current_organisation_id()
    and exists (
      select 1 from public.organisation_members om
      where om.user_id = auth.uid()
        and om.role in ('admin', 'safety_manager')
    )
  );

create policy "roles_admin_update" on public.roles
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

create policy "roles_admin_delete" on public.roles
  for delete to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and exists (
      select 1 from public.organisation_members om
      where om.user_id = auth.uid()
        and om.role in ('admin', 'safety_manager')
    )
  );

create index if not exists idx_roles_org on public.roles (organisation_id);
create index if not exists idx_roles_dept on public.roles (department_id);

comment on table public.roles is
  'Phase 32 D-05: dept-scoped job role. Vacancies = budgeted_count minus filled role_members rows. Grantable (D-06).';

-- ============================================================
-- 4. collections — org-scoped entity, seeded from sops.category (D-01)
-- ============================================================
create table if not exists public.collections (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations(id) on delete cascade,
  name             text not null,
  colour           text not null default '#3b82f6',
  sort             int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organisation_id, name)
);

alter table public.collections enable row level security;

create policy "collections_org_read" on public.collections
  for select to authenticated
  using (organisation_id = public.current_organisation_id());

create policy "collections_admin_insert" on public.collections
  for insert to authenticated
  with check (
    organisation_id = public.current_organisation_id()
    and exists (
      select 1 from public.organisation_members om
      where om.user_id = auth.uid()
        and om.role in ('admin', 'safety_manager')
    )
  );

create policy "collections_admin_update" on public.collections
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

create policy "collections_admin_delete" on public.collections
  for delete to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and exists (
      select 1 from public.organisation_members om
      where om.user_id = auth.uid()
        and om.role in ('admin', 'safety_manager')
    )
  );

create index if not exists idx_collections_org on public.collections (organisation_id);

comment on table public.collections is
  'Phase 32 D-01: org-scoped SOP collection, one seeded per distinct sops.category per org (00047). unique(organisation_id, name) required for idempotent ON CONFLICT seeding.';

-- ============================================================
-- 5. departments.area_id — nullable FK (D-04)
-- ============================================================
alter table public.departments
  add column if not exists area_id uuid references public.areas(id) on delete set null;

comment on column public.departments.area_id is
  'Phase 32 D-04: optional grouping area for this department. Nullable — a department with no area is ungrouped in the chart/rail.';

-- ============================================================
-- 6. role_members junction — roles ↔ people (D-05/D-07)
-- Non-sensitive UUID-pair junction — using(true) for SELECT to avoid
-- the 00030/00031 recursion trap. The real gate stays on roles.
-- ============================================================
create table if not exists public.role_members (
  role_id      uuid not null references public.roles(id) on delete cascade,
  member_id    uuid not null references auth.users(id) on delete cascade,
  assigned_at  timestamptz not null default now(),
  assigned_by  uuid references auth.users(id),
  primary key (role_id, member_id)
);

alter table public.role_members enable row level security;

-- CRITICAL: using(true) — NOT a reference to public.roles. Recursion trap avoided.
create policy "role_members_read_all_auth" on public.role_members
  for select to authenticated using (true);
-- Writes: admin server actions only — no authenticated INSERT/UPDATE/DELETE policy.

create index if not exists idx_role_members_role on public.role_members (role_id);
create index if not exists idx_role_members_member on public.role_members (member_id);

comment on table public.role_members is
  'Phase 32 D-05/D-07: many-to-many junction binding roles to people. SELECT using(true) — no recursion. Writes via admin server actions only.';

-- ============================================================
-- 7. sop_collections junction — sops ↔ collections (D-01)
-- Same recursion-avoidance pattern as role_members above.
-- ============================================================
create table if not exists public.sop_collections (
  sop_id         uuid not null references public.sops(id) on delete cascade,
  collection_id  uuid not null references public.collections(id) on delete cascade,
  primary key (sop_id, collection_id)
);

alter table public.sop_collections enable row level security;

-- CRITICAL: using(true) — NOT a reference to public.sops. Recursion trap avoided.
create policy "sop_collections_read_all_auth" on public.sop_collections
  for select to authenticated using (true);
-- Writes: admin server actions only — no authenticated INSERT/UPDATE/DELETE policy.

create index if not exists idx_sop_collections_sop on public.sop_collections (sop_id);
create index if not exists idx_sop_collections_collection on public.sop_collections (collection_id);

comment on table public.sop_collections is
  'Phase 32 D-01: many-to-many junction binding SOPs to collections. SELECT using(true) — no recursion. Writes via admin server actions only.';

-- ============================================================
-- 8. access_grants — org-unit × collection grants (D-02/D-06/D-11)
-- Org-scoped SELECT (NOT using(true)) — grants reveal who-sees-what,
-- a tighter disclosure boundary than a bare UUID-pair junction (T-32-02-03).
-- No authenticated write policy — writes via admin server actions only.
-- ============================================================
create table if not exists public.access_grants (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations(id) on delete cascade,
  subject_type     public.grant_subject_type not null,
  subject_id       uuid,
  collection_id    uuid not null references public.collections(id) on delete cascade,
  granted_by       uuid references auth.users(id),
  created_at       timestamptz not null default now()
);

alter table public.access_grants enable row level security;

create policy "access_grants_org_read" on public.access_grants
  for select to authenticated
  using (organisation_id = public.current_organisation_id());
-- Writes: admin server actions only — no authenticated INSERT/UPDATE/DELETE policy.

create index if not exists idx_access_grants_org on public.access_grants (organisation_id);
create index if not exists idx_access_grants_collection on public.access_grants (collection_id);

comment on table public.access_grants is
  'Phase 32 D-02/D-06/D-11: additive-only grant of a collection to an org unit (subject_type = org|area|department|role|person; subject_id null only for subject_type=org). Source of truth for access; enforcement is by materialization onto sop_departments (dept-level, D-03) and sop_access_people (role/person-level, D-13). Org-scoped SELECT, not using(true) — writes via admin server actions only.';

-- ============================================================
-- 9. sop_access_people junction + D-13 SECURITY DEFINER RLS arm
-- Materialized fanout of role/person-level access_grants. Mirrors the
-- 00035 member_departments_self_read + sop_in_user_departments template.
-- ============================================================
create table if not exists public.sop_access_people (
  sop_id     uuid not null references public.sops(id) on delete cascade,
  member_id  uuid not null references auth.users(id) on delete cascade,
  primary key (sop_id, member_id)
);

alter table public.sop_access_people enable row level security;

-- Workers see their own rows; admins/safety_managers in same org see all
-- (mirrors member_departments_self_read from 00035).
create policy "sop_access_people_self_read" on public.sop_access_people
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

create index if not exists idx_sop_access_people_sop on public.sop_access_people (sop_id);
create index if not exists idx_sop_access_people_member on public.sop_access_people (member_id);

comment on table public.sop_access_people is
  'Phase 32 D-13: materialized fanout of role- and person-level access_grants onto individual people, per SOP. Populated by the materialization layer, not by RLS. Self-read + same-org admin/safety_manager read. Writes via admin server actions only.';

-- CRITICAL: SQL function bodies reference tables by NAME — any later rename
-- MUST recompile this function (CLAUDE.md learning 2026-05-08).
-- CRITICAL: self-scoping via auth.uid() only — NEVER a caller-supplied
-- org/subject parameter (CLAUDE.md learning 2026-07-05).
create or replace function public.sop_in_user_person_grants(p_sop_id uuid) returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1 from public.sop_access_people sap
    where sap.sop_id = p_sop_id
      and sap.member_id = auth.uid()
  );
$$;

comment on function public.sop_in_user_person_grants(uuid) is
  'Phase 32 D-13: returns true if the calling user has a materialized person/role grant on the SOP via sop_access_people. Self-scoping via auth.uid() only (CLAUDE.md 2026-07-05). References public.sop_access_people by NAME — see CLAUDE.md learning 2026-05-08.';

-- ============================================================
-- 10. Fourth permissive SELECT policy on sops — person/role grant gate (D-13)
--
-- Additive OR with existing sops_visible_by_department, sops_visible_by_sub_trade,
-- and the base policies. DO NOT modify or replace any of those policies.
-- ============================================================
create policy "sops_visible_by_person_grant" on public.sops
  for select to authenticated
  using (
    sop_in_user_person_grants(sops.id)
  );

comment on policy "sops_visible_by_person_grant" on public.sops is
  'Phase 32 D-13: fourth permissive SELECT policy — additive OR arm for materialized role/person-level grant visibility. Calls sop_in_user_person_grants() SECURITY DEFINER helper (self-scoped via auth.uid(), no recursion). Does NOT modify or replace sops_visible_by_department or sops_visible_by_sub_trade.';

commit;
