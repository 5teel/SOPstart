---
phase: 33-per-sop-access-granularity-wayfinder-builder-header
plan: 11
subsystem: database
tags: [supabase, postgres, rls, access-control, worker-visibility]

# Dependency graph
requires:
  - phase: 33-per-sop-access-granularity-wayfinder-builder-header
    provides: materializeSopAccessForOrg narrowing-override logic (33-05..33-08), 33-REVIEW.md WR-02 finding
provides:
  - Nullable sops.all_departments_pre_override snapshot column (migration 00051)
  - Snapshot-on-first-override + restore-on-re-follow in materializeSopAccessForOrg
  - Live regression test proving a pre-Phase-32 org-wide SOP regains visibility after override->revoke
affects: [33-per-sop-access-granularity-wayfinder-builder-header]

# Tech tracking
tech-stack:
  added: []
  patterns: ["nullable snapshot column to make a materialization write reversible (capture prior state before force-write, restore on the inverse transition)"]

key-files:
  created:
    - supabase/migrations/00051_sops_all_departments_pre_override.sql
  modified:
    - src/actions/grants.ts
    - tests/phase33/sop-grant-materialization.spec.ts

key-decisions:
  - "Snapshot column (not a derived/computed flag) is the only way to distinguish a legacy org-wide SOP (was all_departments=true) from a collection-following SOP (was false) once both hit the same empty-junction re-follow state"
  - "Snapshot captured on FIRST override only (idempotent guard: only write pre_override when it is currently null) so a second named-person grant never clobbers the original pre-override value"

patterns-established:
  - "Reversible force-write pattern: before a materialization step force-writes a flag, snapshot the pre-write value into a nullable sibling column; on the inverse transition, restore from the snapshot and clear it to null"

requirements-completed: [SC-4]

# Metrics
duration: ~20min
completed: 2026-07-19
---

# Phase 33 Plan 11: Snapshot/Restore Fix for the all_departments One-Way Ratchet Summary

**Nullable `sops.all_departments_pre_override` snapshot column + snapshot-on-first-override/restore-on-re-follow logic in `materializeSopAccessForOrg`, closing WR-02 so a legacy org-wide SOP no longer goes silently invisible after an override->revoke round trip.**

## Performance

- **Duration:** ~20 min (Tasks 3-4; Tasks 1-2 completed in a prior session)
- **Tasks:** 4 total (2 completed prior, 2 completed this session)
- **Files modified:** 3 (1 migration, 1 action, 1 test spec)

## Accomplishments
- Migration 00051 adds a nullable `all_departments_pre_override boolean` column to `sops` (applied live, checkpoint-approved)
- `materializeSopAccessForOrg` now snapshots the pre-override `all_departments` value on first override and restores it (clearing the snapshot) when the last SOP-target grant is revoked
- New live test proves the exact WR-02 precondition: a pre-Phase-32 org-wide SOP in a collection with no access grants regains full visibility after an override then revoke, while the existing collection-following happy path (restores to `false`) is unaffected

## Task Commits

Each task was committed atomically:

1. **Task 1: Add migration 00051** - `de78273` (feat) — completed prior session
2. **Task 2: Apply migration 00051 live [checkpoint]** - n/a (no file edits, verified live) — completed prior session
3. **Task 3: Snapshot-on-override + restore-on-re-follow in materializeSopAccessForOrg** - `736c37a` (fix)
4. **Task 4: Live test — org-wide SOP with no collection grant survives override->revoke** - `6fcfc9c` (test)

## Files Created/Modified
- `supabase/migrations/00051_sops_all_departments_pre_override.sql` - adds nullable snapshot column (applied live)
- `src/actions/grants.ts` - `materializeSopAccessForOrg` reads `all_departments, all_departments_pre_override` at entry; three-way write logic (snapshot on first override / leave snapshot untouched on subsequent override / restore + clear on re-follow)
- `tests/phase33/sop-grant-materialization.spec.ts` - `materialize()` test stand-in updated to mirror production; new live case `'a pre-Phase-32 org-wide SOP (all_departments=true, no collection grant) regains visibility after override then revoke'`

## Decisions Made
- Snapshot column over a derived value — see key-decisions above.
- Snapshot-once guard (`currentPreOverride === null` check) prevents a second override event from overwriting the true pre-override value.

## Deviations from Plan

None - plan executed exactly as written. Tasks 1-2 (migration + live apply checkpoint) were completed and approved in a prior session; this session executed Tasks 3-4 per the plan's exact spec.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. Migration 00051 was already applied live during Task 2 (checkpoint-approved).

## Next Phase Readiness
- WR-02 gap closed: SC-4 ("no stale visibility after revoke/override") now holds for the pre-Phase-32 org-wide SOP precondition.
- `resolve-sop-access.ts` (pure resolver) remains byte-unchanged — verified via empty `git diff` for that file.
- `npx tsc --noEmit` and `npm run build` both clean.
- Full phase33 spec (5 cases) and phase32/phase32-unit regression suite (68 passed, 7 skipped runtime-only) all green.
- No blockers for closing out phase 33.

---
*Phase: 33-per-sop-access-granularity-wayfinder-builder-header*
*Completed: 2026-07-19*

## Self-Check: PASSED
- FOUND: supabase/migrations/00051_sops_all_departments_pre_override.sql
- FOUND: .planning/phases/33-per-sop-access-granularity-wayfinder-builder-header/33-11-SUMMARY.md
- FOUND commit: de78273
- FOUND commit: 736c37a
- FOUND commit: 6fcfc9c
