---
phase: 33-per-sop-access-granularity-wayfinder-builder-header
plan: 02
subsystem: database
tags: [postgres, supabase, migration, access-grants, rls]

# Dependency graph
requires:
  - phase: 32-visual-org-model-library-permissions
    provides: access_grants table (collection-only target), uq_access_grants_subject_collection unique index (00049)
provides:
  - "Migration 00050: nullable-arm SOP target on access_grants (collection_id XOR sop_id)"
  - "uq_access_grants_subject_target unique index covering both target arms"
  - "scripts/assert-phase33-sop-target-schema.ts — capture/verify equivalence + schema introspection tool for the live push in 33-03"
affects: [33-03-live-push-sop-target-schema, 33-grants-materialization-override]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Nullable-arm target columns (collection_id XOR sop_id) instead of polymorphic target_type/target_id — preserves per-arm FK integrity, old reads stay naturally blind to the new arm"
    - "Coalesce-to-organisation_id sentinel unique index (established 00049, extended here to cover both target columns)"

key-files:
  created:
    - supabase/migrations/00050_access_grants_sop_target.sql
    - scripts/assert-phase33-sop-target-schema.ts
  modified: []

key-decisions:
  - "XOR CHECK (access_grants_exactly_one_target) enforces collection_id/sop_id are mutually exclusive — never both set, per research Pattern 1 (a SOP can live in multiple collections; storing one alongside a direct grant would denormalize)"
  - "uq_access_grants_subject_collection dropped and replaced by uq_access_grants_subject_target — the old index omitted sop_id and Postgres treats NULLs as distinct, so duplicate SOP-target grants would have slipped through it (WR-04 class)"
  - "Assertion script mirrors assert-phase32-day-one-equivalence.ts's --capture/--verify idiom exactly, including the Management API raw-SQL introspection pattern and PGRST205-tolerant retry, for consistency with the existing migration-verification toolset"

patterns-established: []

requirements-completed: [SC-3, SC-4]

# Metrics
duration: ~5min
completed: 2026-07-19
---

# Phase 33 Plan 02: SOP-Target Schema Migration Summary

**Migration 00050 (files-only) adds a nullable sop_id FK arm to access_grants alongside the existing collection_id, enforced by an XOR CHECK and a replacement unique index; plus a capture/verify equivalence + introspection script for the live push in 33-03**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-19T12:41:00+10:00 (approx)
- **Completed:** 2026-07-19T12:42:38+10:00
- **Tasks:** 2/2
- **Files modified:** 2 (both new)

## Accomplishments
- Migration 00050 written: `collection_id` relaxed to nullable, `sop_id uuid references public.sops(id) on delete cascade` added, `access_grants_exactly_one_target` XOR CHECK, `idx_access_grants_sop` index, and `uq_access_grants_subject_target` replacing 00049's collection-only unique index
- `scripts/assert-phase33-sop-target-schema.ts` written with `--capture`/`--verify` modes: byte-equivalence check on pre-existing `access_grants` rows (asserts `sop_id` stays null on rows that predate the migration) plus 6 schema-introspection checks via Management API raw SQL (column existence, nullability, CHECK constraint, both index states, 42P17 sanity probe)
- Both files are additive-only / read-only by design — no live `db push`, no rows written, no policies touched (per plan scope note: the live push + assertions are 33-03's checkpoint gate)

## Task Commits

Each task was committed atomically:

1. **Task 1: Write 00050 nullable-arm migration** - `34dbf03` (feat)
2. **Task 2: Write the pre/post equivalence + schema assertion script** - `a230e47` (feat)

## Files Created/Modified
- `supabase/migrations/00050_access_grants_sop_target.sql` - Nullable-arm SOP target: collection_id NOT NULL dropped, sop_id FK added, XOR CHECK, index swap (uq_access_grants_subject_target replaces uq_access_grants_subject_collection)
- `scripts/assert-phase33-sop-target-schema.ts` - `--capture`/`--verify` tool: row-level byte-equivalence for pre-existing access_grants + 6 Management-API schema-introspection checks (sop_id column, collection_id nullability, XOR constraint, new/old unique index presence/absence, sop index, RLS-recursion sanity probe)

## Decisions Made
- Followed research Pattern 1 verbatim (nullable-arm over polymorphic target_type/target_id) — every existing `.eq('collection_id', …)` read stays naturally blind to SOP-target rows, no discriminator branch needed on day one
- Assertion script's byte-equivalence check normalizes the `sop_id` field on captured (pre-migration) rows to `null` before comparing, since the column doesn't exist at capture time but must be present-and-null post-migration — this is the intended shape, not drift
- Verification script also checks that the OLD index (`uq_access_grants_subject_collection`) is absent post-migration, closing the loop on Pitfall 8 from research (spec drift on the replaced index)

## Deviations from Plan

None — plan executed exactly as written. Both grep/tsc verification gates specified in the plan passed:
- `grep -v '^--' 00050... | grep -c "access_grants_exactly_one_target\|uq_access_grants_subject_target\|drop not null\|references public.sops"` → 6 (plan required presence of all 4 patterns)
- `npx tsc --noEmit` → clean (0 errors anywhere in the project, including the new script)

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. This plan is files-only; the live `db push` and post-push assertion run happen in plan 33-03 (a `[BLOCKING]` checkpoint gate per the plan's objective, mirroring the 32-02/32-03 split).

## Next Phase Readiness
- 00050 and the assertion script are ready for 33-03 to run `--capture`, `npx supabase db push`, then `--verify` against the live Supabase project
- No RLS/policy changes were made — SOP-target grants will materialize into the already-shipped `sop_departments`/`sop_access_people` junctions once `grants.ts` is extended in a later plan
- `createGrant`'s Zod input schema, the XOR `.refine`, and `materializeSopAccessForOrg` still need to be built (deferred to the plan(s) that extend `src/actions/grants.ts`, per the research's Architectural Responsibility Map) — this plan only lays the schema foundation

---
*Phase: 33-per-sop-access-granularity-wayfinder-builder-header*
*Completed: 2026-07-19*

## Self-Check: PASSED

- FOUND: supabase/migrations/00050_access_grants_sop_target.sql
- FOUND: scripts/assert-phase33-sop-target-schema.ts
- FOUND: .planning/phases/33-per-sop-access-granularity-wayfinder-builder-header/33-02-SUMMARY.md
- FOUND commit: 34dbf03 (Task 1)
- FOUND commit: a230e47 (Task 2)
- FOUND commit: e9afb33 (docs: complete plan)
