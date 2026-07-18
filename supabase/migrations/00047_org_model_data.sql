-- ============================================================
-- Migration 00047: Phase 32 Visual Org Model & Library Permissions — data seed
-- Steps (day-one equivalence, D-03):
--   A. Seed one collection per distinct sops.category per org
--   B. Backfill sop_collections for every SOP with a non-null category
--   C. Seed dept-level access_grants from existing sop_departments rows
--
-- CRITICAL (day-one cutover safety): this migration does NOT write to
-- sop_departments or sop_access_people. Existing worker visibility is left
-- byte-untouched — materialize faithfulness is proven separately in 32-05.
-- sops.category is only READ, never updated (D-01 — collections are seeded
-- FROM category but do not replace it this phase).
--
-- Idempotency: ON CONFLICT DO NOTHING on every INSERT; final assertion block
-- mirrors the 00036 RAISE EXCEPTION pattern.
-- ============================================================

begin;

-- ============================================================
-- Step A: one collection per distinct sops.category per org
-- ============================================================
insert into public.collections (organisation_id, name, colour, sort)
select distinct s.organisation_id, s.category, '#3b82f6', 0
from public.sops s
where s.category is not null
  and s.organisation_id is not null
on conflict (organisation_id, name) do nothing;

-- ============================================================
-- Step B: backfill sop_collections — every SOP joins its category's collection
-- ============================================================
insert into public.sop_collections (sop_id, collection_id)
select s.id, c.id
from public.sops s
join public.collections c
  on c.organisation_id = s.organisation_id
  and c.name = s.category
where s.category is not null
on conflict do nothing;

-- ============================================================
-- Step C: access_grants — one department-level grant per (department, collection)
-- pair that already exists via sop_departments today (D-03 day-one equivalence).
-- Does NOT write to sop_departments or sop_access_people.
-- ============================================================
insert into public.access_grants (organisation_id, subject_type, subject_id, collection_id, granted_by)
select distinct d.organisation_id, 'department'::public.grant_subject_type, sd.department_id, sc.collection_id, null
from public.sop_departments sd
join public.departments d on d.id = sd.department_id
join public.sop_collections sc on sc.sop_id = sd.sop_id
on conflict do nothing;

-- ============================================================
-- Idempotent assertion (mirrors 00036 RAISE EXCEPTION pattern): fail-fast if
-- any org with sops has zero collections, or any categorised SOP has zero
-- sop_collections rows.
-- ============================================================
DO $$
DECLARE
  missing_org_collections   bigint;
  missing_sop_collections   bigint;
BEGIN
  SELECT COUNT(*) INTO missing_org_collections
  FROM public.sops s
  WHERE s.organisation_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.collections c WHERE c.organisation_id = s.organisation_id
    );

  IF missing_org_collections > 0 THEN
    RAISE EXCEPTION 'Phase 32 data migration failed: % sops belong to orgs with zero collections seeded.', missing_org_collections;
  END IF;

  SELECT COUNT(*) INTO missing_sop_collections
  FROM public.sops s
  WHERE s.category IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.sop_collections sc WHERE sc.sop_id = s.id
    );

  IF missing_sop_collections > 0 THEN
    RAISE EXCEPTION 'Phase 32 data migration failed: % sops with a category have zero sop_collections rows.', missing_sop_collections;
  END IF;

  RAISE NOTICE 'Phase 32 data migration complete. Collections seeded from sops.category, sop_collections backfilled, dept-level access_grants seeded from sop_departments (day-one equivalence, D-03).';
END;
$$;

commit;
