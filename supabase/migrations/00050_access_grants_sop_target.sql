-- ============================================================
-- Migration 00050: Phase 33 SC-3/SC-4 — nullable-arm SOP target on
-- access_grants (files-only wave; live db push + assertions land in 33-03).
--
-- access_grants currently targets collections only (collection_id uuid NOT
-- NULL, 00046 §8). This adds a second, mutually-exclusive target arm:
-- collection_id (existing) XOR sop_id (new) — never both. A SOP can live in
-- multiple collections via sop_collections and can move between them;
-- storing a collection alongside a direct sop_id grant would denormalize
-- and go stale, so the two arms are strictly exclusive, enforced by a CHECK.
--
-- Both arms keep real FK integrity (collection_id -> collections,
-- sop_id -> sops, both ON DELETE CASCADE) rather than a polymorphic
-- target_type + target_id column, which would lose per-arm FK integrity and
-- force every existing `.eq('collection_id', ...)` read to grow a
-- discriminator branch on day one. Every existing read stays naturally
-- blind to SOP-target rows (collection_id is null on them) — old code paths
-- degrade safely.
--
-- 00049's uq_access_grants_subject_collection omits sop_id, and Postgres
-- treats NULLs as distinct in unique indexes, so duplicate SOP-target
-- grants would slip straight through it (WR-04 duplicate-grant class). It is
-- dropped and replaced by uq_access_grants_subject_target, extending the
-- same coalesce-to-organisation_id sentinel trick to cover both target
-- columns.
--
-- Pure-additive to rows: no data writes, no policy changes. SOP-target
-- grants materialize into the already-shipped sop_departments /
-- sop_access_people junctions (00035/00046) — zero RLS changes this phase.
-- ============================================================

begin;

-- 1. Relax collection_id to nullable — a SOP-target row has no collection.
alter table public.access_grants alter column collection_id drop not null;

-- 2. Add the nullable sop_id arm.
alter table public.access_grants
  add column if not exists sop_id uuid references public.sops(id) on delete cascade;

-- 3. XOR: exactly one of collection_id / sop_id is ever set.
alter table public.access_grants
  add constraint access_grants_exactly_one_target
  check ((collection_id is null) <> (sop_id is null));

-- 4. Index the new arm for materialization reads.
create index if not exists idx_access_grants_sop on public.access_grants (sop_id);

-- 5. Replace 00049's collection-only unique index with one covering sop_id.
drop index if exists public.uq_access_grants_subject_collection;

create unique index uq_access_grants_subject_target
  on public.access_grants (organisation_id, subject_type,
    coalesce(subject_id, organisation_id),
    coalesce(collection_id, organisation_id),
    coalesce(sop_id, organisation_id));

comment on index public.uq_access_grants_subject_target is
  'Phase 33 (00050): one grant per (org, subject_type, subject, target). Target is collection_id XOR sop_id; both coalesced to organisation_id so NULLs on the unset arm never defeat uniqueness. Replaces 00049 uq_access_grants_subject_collection, which omitted sop_id and would have let duplicate SOP-target grants through (WR-04 class).';

comment on constraint access_grants_exactly_one_target on public.access_grants is
  'Phase 33 (00050): a grant targets exactly one of collection_id or sop_id, never both and never neither. A SOP can belong to multiple collections (sop_collections m2m) and can move between them; storing a collection alongside a direct sop_id grant would denormalize and go stale.';

commit;
