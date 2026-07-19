---
phase: 33-per-sop-access-granularity-wayfinder-builder-header
plan: 10
subsystem: auth
tags: [supabase, rls, server-actions, service-role, org-scoping, playwright]

requires:
  - phase: 33-per-sop-access-granularity-wayfinder-builder-header
    provides: "Tools for this SOP menu (SC-6) whose delete action needed a safe deleteSop to expose"
provides:
  - "deleteSop org-ownership guard closing CR-01 (cross-tenant service-role delete)"
  - "tests/phase33/delete-sop-org-scope.spec.ts regression coverage (live + source-contract)"
affects: [sops-actions, phase33-verification, security-review]

tech-stack:
  added: []
  patterns:
    - "Service-role delete cascades must fetch-and-compare organisation_id before the first delete, mirroring the existing updateSopTitle .eq('organisation_id', ...) idiom but via admin client (no session RLS available for the fetch)"

key-files:
  created:
    - tests/phase33/delete-sop-org-scope.spec.ts
  modified:
    - src/actions/sops.ts

key-decisions:
  - "Guard implemented exactly per 33-REVIEW.md CR-01 drafted patch: fetch sops row via admin client, maybeSingle(), reject 'SOP not found' / 'SOP belongs to another organisation' / 'No organisation' before any of the six deletes"
  - "Rule #5 audit re-confirmed: the only other admin-client admin.from('sops').delete() calls in sops.ts are compensating cleanup on a SOP the same function just created (createVideoUploadSession, createSopFromWizard) — self-scoped, left untouched"

patterns-established: []

requirements-completed: [SC-6]

duration: 25min
completed: 2026-07-19
---

# Phase 33 Plan 10: deleteSop org-ownership guard (CR-01 gap closure) Summary

**Closed the cross-tenant deleteSop hole (CR-01 Blocker) by fetching the SOP's organisation_id via the admin client and rejecting before any of the six service-role deletes run, with a live ephemeral-org regression test proving zero rows are destroyed cross-org.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-19T05:46:52Z
- **Completed:** 2026-07-19T05:51:28Z
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- `deleteSop` now returns `{ error: 'SOP belongs to another organisation' }` (or `'SOP not found'` / `'No organisation'`) before touching `sop_sections`, `parse_jobs`, `sop_assignments`, `video_generation_jobs`, `worker_notifications`, or `sops` — making the new Tools-menu delete action (SC-6) safe to expose
- Added `tests/phase33/delete-sop-org-scope.spec.ts`: a live cross-org test (ephemeral Org A admin attempts to delete an Org B SOP with a section + assignment row, asserts all three survive) plus a source-contract test proving the guard's index precedes the first `sop_sections` delete in the function body — both discoverable under the existing broad `phase33` `testMatch` with no config edit
- Re-confirmed the file-wide rule #5 audit: no other admin-client SOP mutator in `src/actions/sops.ts` is unguarded

## Task Commits

Each task was committed atomically:

1. **Task 1: Add org-ownership guard to deleteSop** - `8f93d2e` (fix)
2. **Task 2: Add live cross-org rejection + source-contract test for deleteSop** - `4d96728` (test)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/actions/sops.ts` - `deleteSop` fetches `sops.organisation_id` via admin client and rejects on mismatch before the delete cascade
- `tests/phase33/delete-sop-org-scope.spec.ts` - live cross-org rejection test + source-contract guard-ordering test

## Decisions Made
- Followed the 33-REVIEW.md CR-01 drafted patch verbatim (identifiers `sopRow`, `ctx.organisationId`, error strings)
- Test harness copied verbatim from `tests/phase33/sop-grant-materialization.spec.ts` (env loader, ephemeral org/worker helpers, afterAll teardown) — no new pattern introduced
- `sop_assignments` insert used `assignment_type: 'individual'` (the schema's actual enum is `"role" | "individual"`, not `"all"` as informally referenced in the plan) with `user_id`/`assigned_by` set to the ephemeral uploader

## Deviations from Plan

None — plan executed exactly as written. The one correction (enum value for `sop_assignments.assignment_type`) was caught before commit while building the test fixture, not a deviation from guarded behavior.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- CR-01 closed; `Tools for this SOP` menu's delete action is safe to ship
- `npx tsc --noEmit`, `npm run build` (bundle Δ+1 KB, within ±2 KB tolerance), and the full `phase33` suite (48 passed / 2 pre-existing chromium-runtime skips) are all green
- No blockers for remaining gap-closure plans (33-11 WR-02)

---
*Phase: 33-per-sop-access-granularity-wayfinder-builder-header*
*Completed: 2026-07-19*
