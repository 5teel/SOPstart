-- ============================================================
-- Migration 00019: v3.0 Section Schema + Block Library (additive)
-- Adds:
--   1. section_kinds catalog (global + per-org) with canonical seeds
--   2. sop_sections.section_kind_id advisory FK (nullable)
--   3. blocks definition table + block_versions history
--   4. sop_section_blocks junction with pin_mode + snapshot_content
--   5. RLS: read globals + own-org; write own-org admin only
-- This migration is fully additive — no existing rows are modified
-- except an optional backfill that sets section_kind_id where a
-- legacy section_type matches a canonical slug.
-- ============================================================

-- ============================================================
-- Step 1: section_kinds catalog table
-- ============================================================
create table if not exists public.section_kinds (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid references public.organisations(id) on delete cascade,
  -- NULL organisation_id = global/canonical kind; non-null = org-custom kind
  slug             text not null,
  display_name     text not null,
  render_family    text not null check (render_family in
                     ('hazard','ppe','steps','content','signoff','emergency','custom')),
  icon             text,              -- lucide icon name (e.g. 'AlertTriangle')
  color_family     text,              -- brand palette key (e.g. 'red-400')
  render_priority  int  not null default 100,
  description      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Unique per scope: globals keyed by (NULL, slug), org-customs by (org, slug).
-- Postgres treats NULL as distinct in unique indexes, so coalesce to a sentinel.
create unique index if not exists uq_section_kinds_slug_scoped
  on public.section_kinds (
    coalesce(organisation_id, '00000000-0000-0000-0000-000000000000'::uuid),
    slug
  );

create index if not exists idx_section_kinds_org on public.section_kinds (organisation_id);

-- ============================================================
-- Step 2: canonical seed rows (organisation_id = NULL, global)
-- ============================================================
-- Seeds run in the migration context as superuser, so RLS write policies
-- (which forbid authenticated inserts of NULL-org rows) do not apply here.
insert into public.section_kinds (
  organisation_id, slug, display_name, render_family, icon, color_family, render_priority, description
) values
  (null, 'hazards',   'Hazards',     'hazard',    'AlertTriangle', 'red-400',      10, 'Safety hazards that must be understood before starting work'),
  (null, 'ppe',       'PPE',         'ppe',       'ShieldCheck',   'blue-400',     20, 'Personal protective equipment required for this SOP'),
  (null, 'steps',     'Steps',       'steps',     'ListChecks',    'brand-yellow', 40, 'Primary procedural steps'),
  (null, 'emergency', 'Emergency',   'emergency', 'Siren',         'red-400',      50, 'Emergency response procedures'),
  (null, 'signoff',   'Sign-off',    'signoff',   'CheckCircle2',  'green-400',    90, 'Worker and supervisor sign-off at SOP completion'),
  (null, 'content',   'Overview',    'content',   'FileText',      'steel-100',    30, 'General content, overview, scope, or notes'),
  (null, 'custom',    'Custom',      'custom',    'Sparkles',      'steel-100',    99, 'Org-defined custom section with default rendering')
on conflict do nothing;

-- ============================================================
-- Step 3: advisory FK column on sop_sections
-- ============================================================
-- NOTE: no unique constraint on (sop_id, section_kind_id) —
-- SB-SECT-01 requires multiple sections of the same kind per SOP
-- (e.g., two "Hazards" sections scoped to different machine states)
alter table public.sop_sections
  add column if not exists section_kind_id uuid
    references public.section_kinds(id) on delete set null;

create index if not exists idx_sop_sections_kind on public.sop_sections (section_kind_id);

-- Backfill: link legacy rows to canonical kinds by fuzzy match on section_type.
-- Rows that don't match stay NULL → renderer falls back to substring matching.
update public.sop_sections s
   set section_kind_id = k.id
  from public.section_kinds k
 where k.organisation_id is null
   and s.section_kind_id is null
   and (
     lower(s.section_type) = k.slug
     or (k.slug = 'hazards'   and lower(s.section_type) like '%hazard%')
     or (k.slug = 'ppe'       and (lower(s.section_type) like '%ppe%' or lower(s.section_type) like '%protective%'))
     or (k.slug = 'emergency' and lower(s.section_type) like '%emergency%')
     or (k.slug = 'steps'     and (lower(s.section_type) = 'steps' or lower(s.section_type) like '%procedure%'))
     or (k.slug = 'signoff'   and (lower(s.section_type) like '%sign%off%' or lower(s.section_type) like '%sign_off%'))
     or (k.slug = 'content'   and lower(s.section_type) in ('overview','notes','scope','content','introduction'))
   );

-- ============================================================
-- Step 4: blocks definition table
-- ============================================================
create table if not exists public.blocks (
  id                 uuid primary key default gen_random_uuid(),
  organisation_id    uuid references public.organisations(id) on delete cascade,
  -- NULL = global block, non-null = org-scoped block
  kind_slug          text not null,
  -- Admin-visible name; should be unique within org + kind for findability.
  name               text not null,
  category           text,
  current_version_id uuid,       -- FK added after block_versions exists (circular)
  archived_at        timestamptz,
  created_by         uuid references auth.users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_blocks_org_kind
  on public.blocks (organisation_id, kind_slug)
  where archived_at is null;

-- ============================================================
-- Step 5: block_versions history + circular FK on blocks.current_version_id
-- ============================================================
create table if not exists public.block_versions (
  id              uuid primary key default gen_random_uuid(),
  block_id        uuid not null references public.blocks(id) on delete cascade,
  version_number  int  not null,
  content         jsonb not null,
  -- Discriminated-union payload; shape enforced at the application layer
  -- by a Zod schema (see 11-02). Content must include a 'kind' discriminator.
  change_note     text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  unique (block_id, version_number)
);

create index if not exists idx_block_versions_block
  on public.block_versions (block_id, version_number desc);

-- Circular FK: blocks.current_version_id → block_versions.id
-- Deferrable so insert order within a transaction can go block → version → set current.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'blocks_current_version_fk'
  ) then
    alter table public.blocks
      add constraint blocks_current_version_fk
      foreign key (current_version_id)
      references public.block_versions(id)
      on delete set null
      deferrable initially deferred;
  end if;
end $$;

-- ============================================================
-- Step 6: sop_section_blocks junction (pin_mode + snapshot_content)
-- ============================================================
create table if not exists public.sop_section_blocks (
  id                 uuid primary key default gen_random_uuid(),
  sop_section_id     uuid not null references public.sop_sections(id) on delete cascade,
  block_id           uuid not null references public.blocks(id) on delete restrict,
  pinned_version_id  uuid references public.block_versions(id),
  pin_mode           text not null default 'pinned'
                       check (pin_mode in ('pinned','follow_latest')),
  -- Offline-first: cached copy of the block content at insertion time.
  -- Workers read ONLY this column; never join block_versions at read time.
  snapshot_content   jsonb not null,
  overridden_at      timestamptz,
  update_available   boolean not null default false,
  sort_order         int not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_ssb_section_sort
  on public.sop_section_blocks (sop_section_id, sort_order);

create index if not exists idx_ssb_block
  on public.sop_section_blocks (block_id);
-- Note: no UNIQUE on (sop_section_id, block_id) — multiple instances of the
-- same block within a section are allowed (e.g. warning → instructions → warning).
