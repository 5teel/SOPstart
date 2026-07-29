-- Phase 40 (Shared Creation Foundation) -- DAT-01 / D-01.
--
-- sops.category (free text, written by five API routes) and
-- sops.category_tag (a block_categories slug, written by the wizard) are
-- both RETIRED by this phase in favour of a single sops.category_slug
-- column backed by the fixed seed in src/lib/sop-categories.ts (D-03).
--
-- This migration is purely additive: it adds a nullable column, indexes it,
-- and runs a deterministic pass-1 backfill (D-02 exact/slug match) guarded
-- so a re-run never overwrites an already-resolved row. It does NOT null
-- out sops.category or sops.category_tag -- that happens in the plan-40-06
-- backfill script, after the AI-mapping pass has run and every reader is
-- repointed (plan 40-05). No table, CHECK constraint, trigger, or
-- SECURITY DEFINER function is added: Postgres CHECK cannot subquery (see
-- 00022's comment on the same constraint), so the vocabulary is validated
-- at the application layer via isValidCategorySlug(). No RLS change is
-- needed either -- category_slug is a plain column on sops, already
-- covered by every existing sops policy.

alter table public.sops add column if not exists category_slug text;

create index if not exists sops_category_slug_idx
  on public.sops (category_slug)
  where category_slug is not null;

-- Deterministic pass-1 backfill (D-02): the SAME slugs and labels as
-- SOP_CATEGORIES in src/lib/sop-categories.ts, in the same order. Both
-- updates below are guarded on category_slug is null so a re-run is a
-- no-op on already-resolved rows (the [2026-07-05] null-clobber rule
-- applies to SQL backfills too).
with vocab (slug, label) as (
  values
    ('safety', 'Safety'),
    ('ppe', 'PPE'),
    ('machine-operation', 'Machine Operation'),
    ('manufacturing', 'Manufacturing'),
    ('maintenance', 'Maintenance'),
    ('quality', 'Quality'),
    ('cleaning-hygiene', 'Cleaning & Hygiene'),
    ('emergency', 'Emergency'),
    ('forklift-vehicles', 'Forklift & Vehicles'),
    ('chemical-handling', 'Chemical Handling'),
    ('electrical', 'Electrical'),
    ('training-induction', 'Training & Induction'),
    ('environmental', 'Environmental'),
    ('admin-office', 'Admin & Office'),
    ('other', 'Other')
)
update public.sops s
set category_slug = v.slug
from vocab v
where s.category_slug is null
  and s.category_tag is not null
  and lower(s.category_tag) = v.slug;

with vocab (slug, label) as (
  values
    ('safety', 'Safety'),
    ('ppe', 'PPE'),
    ('machine-operation', 'Machine Operation'),
    ('manufacturing', 'Manufacturing'),
    ('maintenance', 'Maintenance'),
    ('quality', 'Quality'),
    ('cleaning-hygiene', 'Cleaning & Hygiene'),
    ('emergency', 'Emergency'),
    ('forklift-vehicles', 'Forklift & Vehicles'),
    ('chemical-handling', 'Chemical Handling'),
    ('electrical', 'Electrical'),
    ('training-induction', 'Training & Induction'),
    ('environmental', 'Environmental'),
    ('admin-office', 'Admin & Office'),
    ('other', 'Other')
)
update public.sops s
set category_slug = v.slug
from vocab v
where s.category_slug is null
  and s.category is not null
  and (lower(btrim(s.category)) = v.slug or lower(btrim(s.category)) = lower(v.label));

comment on column public.sops.category is 'RETIRED Phase 40 (DAT-01, D-01) -- superseded by category_slug. No code path writes this column. Data nulled by scripts/backfill-sop-category.mjs.';

comment on column public.sops.category_tag is 'RETIRED Phase 40 (DAT-01, D-01) -- superseded by category_slug. No code path writes this column. Data nulled by scripts/backfill-sop-category.mjs.';

comment on column public.sops.category_slug is 'Phase 40 DAT-01 -- the single SOP category. Values are slugs from src/lib/sop-categories.ts (fixed seed, D-03). No FK/CHECK: Postgres CHECK cannot subquery (see 00022) and the vocabulary is code-owned; validated at the application layer.';
