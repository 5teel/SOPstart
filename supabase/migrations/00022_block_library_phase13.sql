-- ============================================================
-- Migration 00022: Phase 13 Reusable Block Library — additive schema for tags, super-admins, suggestions, sop-level category
-- Adds:
--   1. summit_admins                — Summit Insights super-admin grants (D-Global-01)
--   2. block_categories             — locked controlled vocab seed table (D-Tax-02)
--   3. blocks.category_tags         — text[] of controlled-vocab slugs (D-Tax-01)
--   4. blocks.free_text_tags        — text[] free-form overlay (D-Tax-01)
--   5. sops.category_tag            — single SOP-level primary category (D-Tax-03)
--   6. block_suggestions            — "suggest for global" queue (D-Global-02)
--   7. is_summit_admin() helper     — defence-in-depth role check
--   8. RLS extensions for super-admin global write paths on blocks/block_versions
--
-- All changes are pure-additive — no existing 00019 tables, columns,
-- indexes, or policies are modified or dropped.
-- ============================================================

begin;

-- ============================================================
-- 1. summit_admins table (D-Global-01)
-- Encoded as a separate role table (mirrors organisation_members role pattern
-- from migration 00001) to avoid modifying auth.users or JWT claims.
-- ============================================================
create table if not exists public.summit_admins (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  granted_at   timestamptz not null default now(),
  granted_by   uuid references auth.users(id),
  notes        text
);

alter table public.summit_admins enable row level security;

-- Only summit admins (or self) can read the table; lookups for RLS use the
-- SECURITY DEFINER helper below to avoid recursive policy evaluation.
create policy "summit_admins_self_read" on public.summit_admins
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.summit_admins sa where sa.user_id = auth.uid())
  );

-- Writes are service_role only (no policy for authenticated INSERT/UPDATE/DELETE).
-- Initial seed must be inserted manually via SQL editor (see plan 13-01 Task 5).

-- Helper: is_summit_admin() — used by RLS policies and server-action defence-in-depth.
create or replace function public.is_summit_admin() returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (select 1 from public.summit_admins where user_id = auth.uid());
$$;

comment on function public.is_summit_admin() is
  'Phase 13: returns true if the calling user has a row in public.summit_admins (D-Global-01).';

-- ============================================================
-- 2. block_categories — controlled vocab seed table (D-Tax-02)
-- Locked vocabulary (modified only via migration). Drives picker filters
-- and validation of blocks.category_tags / sops.category_tag at the
-- application layer (Postgres CHECK cannot subquery).
-- ============================================================
create table if not exists public.block_categories (
  slug             text primary key,
  display_name     text not null,
  category_group   text not null check (category_group in ('hazard','area','ppe','procedure')),
  sort_order       int  not null default 100,
  created_at       timestamptz not null default now()
);

alter table public.block_categories enable row level security;

create policy "block_categories_read_all" on public.block_categories
  for select to authenticated using (true);

-- Writes: service_role only (no authenticated INSERT/UPDATE/DELETE policy).

-- ------------------------------------------------------------
-- Seed rows: 24 hazard tags + 10 area tags = 34 total.
-- Source: .planning/phases/13-reusable-block-library/13-CORPUS-ANALYSIS.md § 6.
-- ------------------------------------------------------------

-- Hazard group (24 tags)
insert into public.block_categories (slug, display_name, category_group, sort_order) values
  ('crush-entrapment',         'Crush / Entrapment',         'hazard',  10),
  ('electrocution',            'Electrocution',              'hazard',  20),
  ('burns-hot',                'Burns / Hot Surfaces',       'hazard',  30),
  ('manual-handling-strain',   'Manual Handling / Strain',   'hazard',  40),
  ('pinch-points',             'Pinch Points',               'hazard',  50),
  ('falls-from-height',        'Falls From Height',          'hazard',  60),
  ('cuts-lacerations',         'Cuts / Lacerations',         'hazard',  70),
  ('moving-machinery',         'Moving Machinery',           'hazard',  80),
  ('forklift-vehicle',         'Forklift / Vehicle',         'hazard',  90),
  ('slips-trips',              'Slips / Trips',              'hazard', 100),
  ('falling-objects',          'Falling Objects',            'hazard', 110),
  ('flying-debris',            'Flying Debris',              'hazard', 120),
  ('spill-environmental',      'Spill / Environmental',      'hazard', 130),
  ('pressurised-fluid',        'Pressurised Fluid',          'hazard', 140),
  ('hot-work',                 'Hot Work',                   'hazard', 150),
  ('glass-breakage',           'Glass Breakage',             'hazard', 160),
  ('fire-explosion',           'Fire / Explosion',           'hazard', 170),
  ('confined-space',           'Confined Space',             'hazard', 180),
  ('chemical-exposure',        'Chemical Exposure',          'hazard', 190),
  ('dust-airborne',            'Dust / Airborne',            'hazard', 200),
  ('noise',                    'Noise',                      'hazard', 210),
  ('isolation-energy',         'Isolation / Energy',         'hazard', 220),
  ('eye-injury',               'Eye Injury',                 'hazard', 230),
  ('biological-hygiene',       'Biological / Hygiene',       'hazard', 240)
on conflict (slug) do nothing;

-- Area group (10 tags) — derived from corpus folder structure
insert into public.block_categories (slug, display_name, category_group, sort_order) values
  ('area-forming',             'Forming Area',               'area',    10),
  ('area-batch-furnace',       'Batch & Furnace Area',       'area',    20),
  ('area-mould-repair',        'Mould Repair Area',          'area',    30),
  ('area-machine-repair',      'Machine Repair Area',        'area',    40),
  ('area-finished-products',   'Finished Products Area',     'area',    50),
  ('area-quality-control',     'Quality Control Area',       'area',    60),
  ('area-electrical',          'Electrical Area',            'area',    70),
  ('area-factory-maintenance', 'Factory Maintenance Area',   'area',    80),
  ('area-plant-services',      'Plant Services Area',        'area',    90),
  ('area-job-change',          'Job Change Area',            'area',   100)
on conflict (slug) do nothing;

-- ============================================================
-- 3. blocks table extension — tag columns (D-Tax-01)
-- ============================================================
alter table public.blocks
  add column if not exists category_tags  text[] not null default '{}';
alter table public.blocks
  add column if not exists free_text_tags text[] not null default '{}';

create index if not exists idx_blocks_category_tags
  on public.blocks using gin (category_tags);
create index if not exists idx_blocks_free_text_tags
  on public.blocks using gin (free_text_tags);

-- Note: no Postgres CHECK constraint validating category_tags entries against
-- block_categories.slug — Postgres CHECK cannot subquery. Enforced at the
-- server-action layer via Zod against listBlockCategories().

-- ============================================================
-- 4. sops table extension — SOP-level category tag (D-Tax-03)
-- Single tag (not array) — admin picks one primary category at SOP creation.
-- Consumed by plan 13-03 picker scoring as the pre-filter input.
-- ============================================================
alter table public.sops
  add column if not exists category_tag text;

create index if not exists idx_sops_category_tag
  on public.sops (category_tag) where category_tag is not null;

-- No FK to block_categories.slug to avoid coupling SOP creation to vocab table
-- availability; enforce at application layer in createSopFromWizard
-- (validate against block_categories list).

-- ============================================================
-- 5. block_suggestions — "suggest for global" queue (D-Global-02)
-- Schema includes suggesting org, original block snapshot, status enum,
-- decided_by, decided_at, decision_note (Discretion item).
-- ============================================================
create table if not exists public.block_suggestions (
  id                    uuid primary key default gen_random_uuid(),
  source_block_id       uuid not null references public.blocks(id) on delete cascade,
  suggested_by_org_id   uuid not null references public.organisations(id) on delete cascade,
  suggested_by_user     uuid references auth.users(id),
  -- Frozen snapshot of block at suggestion time:
  -- { kind_slug, name, category_tags, free_text_tags, content }
  snapshot              jsonb not null,
  status                text not null default 'pending'
                          check (status in ('pending','promoted','rejected')),
  decided_by            uuid references auth.users(id),
  decided_at            timestamptz,
  decision_note         text,
  promoted_block_id     uuid references public.blocks(id),
  created_at            timestamptz not null default now()
);

create index if not exists idx_block_suggestions_status
  on public.block_suggestions (status, created_at desc);
create index if not exists idx_block_suggestions_org
  on public.block_suggestions (suggested_by_org_id);

alter table public.block_suggestions enable row level security;

-- Suggesting-org admins can see their own org's suggestions; summit_admins see all.
create policy "block_suggestions_read" on public.block_suggestions
  for select to authenticated
  using (
    public.is_summit_admin()
    or (
      suggested_by_org_id = public.current_organisation_id()
      and public.current_user_role() in ('admin','safety_manager')
    )
  );

create policy "block_suggestions_insert" on public.block_suggestions
  for insert to authenticated
  with check (
    suggested_by_org_id = public.current_organisation_id()
    and public.current_user_role() in ('admin','safety_manager')
  );

-- Updates (status transitions) restricted to summit super-admins.
create policy "block_suggestions_update_summit_only" on public.block_suggestions
  for update to authenticated
  using (public.is_summit_admin())
  with check (public.is_summit_admin());

-- ============================================================
-- 6. blocks RLS extension — super-admin global write path
-- 00019 only allows org-scoped writes; super-admins must be able to insert/update
-- organisation_id = null rows when promoting suggestions or curating global blocks.
-- ============================================================
create policy "blocks_summit_admin_global_write" on public.blocks
  for insert to authenticated
  with check (organisation_id is null and public.is_summit_admin());

create policy "blocks_summit_admin_global_update" on public.blocks
  for update to authenticated
  using (organisation_id is null and public.is_summit_admin())
  with check (organisation_id is null and public.is_summit_admin());

create policy "block_versions_summit_admin_global_insert" on public.block_versions
  for insert to authenticated
  with check (
    public.is_summit_admin()
    and exists (
      select 1 from public.blocks b
      where b.id = block_versions.block_id
        and b.organisation_id is null
    )
  );

-- ============================================================
-- Comments for documentation
-- ============================================================
comment on table public.summit_admins is
  'Phase 13: Summit Insights super-admin grants (D-Global-01). Service-role-only writes.';
comment on table public.block_categories is
  'Phase 13: Locked controlled vocabulary for block + SOP categories (D-Tax-02). Modified only via migrations.';
comment on table public.block_suggestions is
  'Phase 13: "Suggest for global" queue (D-Global-02). Org admins submit; Summit super-admins promote/reject.';
comment on column public.blocks.category_tags is
  'Phase 13: Controlled-vocab tag slugs from public.block_categories (D-Tax-01).';
comment on column public.blocks.free_text_tags is
  'Phase 13: Free-text tag overlay searchable but not faceted in the picker (D-Tax-01).';
comment on column public.sops.category_tag is
  'Phase 13: SOP-level primary category drives picker pre-filter input (D-Tax-03).';

commit;
