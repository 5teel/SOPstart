-- ============================================================
-- Migration 00049: Phase 32 code-review WR-04 — uniqueness on access_grants.
--
-- access_grants had no unique constraint over (organisation_id, subject_type,
-- subject_id, collection_id), so wiring the same unit twice (double-click Done,
-- re-entering wire-up mode, two admins) inserted duplicate rows. revokeGrant
-- deletes ONE row by id — a duplicate silently keeps the access alive after an
-- admin believes it revoked. Additive-only semantics (D-11) make duplicates
-- pure liability.
--
-- subject_id is NULL for subject_type='org' (Postgres treats NULLs as distinct
-- in unique indexes), so the index coalesces NULL to organisation_id — a value
-- no real subject row can collide with.
--
-- Step 1 dedupes any duplicates that accumulated pre-constraint (keeps the
-- earliest row per key) so the unique index can build.
--
-- createGrant (src/actions/grants.ts) treats the resulting 23505 as an
-- idempotent success: it re-reads the existing row and still re-materializes.
-- ============================================================

begin;

-- Step 1: dedupe — keep the earliest grant per logical key.
delete from public.access_grants a
using public.access_grants b
where a.id <> b.id
  and a.organisation_id = b.organisation_id
  and a.subject_type = b.subject_type
  and coalesce(a.subject_id, a.organisation_id) = coalesce(b.subject_id, b.organisation_id)
  and a.collection_id = b.collection_id
  and (a.created_at > b.created_at or (a.created_at = b.created_at and a.id > b.id));

-- Step 2: enforce.
create unique index if not exists uq_access_grants_subject_collection
  on public.access_grants (organisation_id, subject_type, coalesce(subject_id, organisation_id), collection_id);

comment on index public.uq_access_grants_subject_collection is
  'Phase 32 WR-04 (00049): one grant per (org, subject_type, subject, collection). NULL subject_id (org grants) coalesced to organisation_id. createGrant treats 23505 as idempotent success.';

commit;
