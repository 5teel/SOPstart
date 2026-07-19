---
phase: 33-per-sop-access-granularity-wayfinder-builder-header
plan: 07
subsystem: auth
tags: [supabase, access-grants, department-assignment, playwright]

# Dependency graph
requires:
  - phase: 33-05
    provides: "createGrant/materializeSopAccess SOP-target arm + narrowing-override materialization"
provides:
  - "assignSopDepartments rewired to write dept-subject SOP-target access_grants (replace semantics) then materializeSopAccess() — sop_departments is 100% derived"
  - "createSopFromWizard and the ai-prompt route funnel hand-picked departments through assignSopDepartments — zero direct sop_departments inserts remain in runtime code"
  - "Hand-picked SOPs are overridden-from-birth by construction; closes the 32-VERIFICATION dual-write silent-drop hole"
affects: [33-08, 33-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "sop_departments is now a pure derived projection of access_grants everywhere it is written — grep gate (zero direct inserts) is the enforcement mechanism"
    - "Faithful stand-in live-runtime testing for 'use server' actions (assignSopDepartmentsStandIn mirrors assignSopDepartments byte-for-byte minus the auth wrapper), reusing the existing materialize() stand-in from 33-05 rather than forking a second harness"

key-files:
  created: []
  modified:
    - src/actions/departments.ts
    - src/actions/sops.ts
    - src/app/api/sops/ai-prompt/route.ts
    - tests/phase33/sop-grant-materialization.spec.ts

key-decisions:
  - "assignSopDepartments deletes/inserts ONLY subject_type='department' SOP-target grants for the SOP — other subject-tier SOP-target grants (org/area/role/person) are left untouched, since those belong to the 32-08/33-08 org-model wiring surface, not the department picker"
  - "createSopFromWizard and the ai-prompt route call assignSopDepartments directly (function import, same server bundle) rather than extracting a separate thin helper — request-scope auth (requireAdminContext/getSessionContext) resolves fine across the call since both run in the same Next.js request"
  - "assignSopDepartments sets sops.all_departments from the caller's flag BEFORE inserting grants — 33-05's override rule only force-sets it to false when a SOP-target grant EXISTS, so this ordering cannot conflict with materializeSopAccess's own write"

requirements-completed: [SC-3, SC-4]

# Metrics
duration: ~25min
completed: 2026-07-19
---

# Phase 33 Plan 07: Close the sop_departments dual-write hole Summary

**assignSopDepartments, createSopFromWizard, and the ai-prompt route now write department-subject SOP-target access_grants (replace semantics) instead of sop_departments directly — sop_departments is 100% derived on every path, closing the 32-VERIFICATION silent-drop hole where an unrelated collection materialize could wipe out hand-picked department assignments.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-19
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `assignSopDepartments` (src/actions/departments.ts) rewritten: replace-writes only `subject_type='department'` SOP-target `access_grants` rows for the SOP (never touches other subject tiers' SOP-target grants), sets `sops.all_departments` from the caller's flag, then calls `materializeSopAccess()` so `sop_departments` derives from the grants just written. Org self-enforcement (SOP-org match + heal null-org legacy rows) preserved unchanged.
- `createSopFromWizard` (src/actions/sops.ts) and the ai-prompt route (`src/app/api/sops/ai-prompt/route.ts`) both dropped their direct `.from('sop_departments').insert(...)` blocks and now call `assignSopDepartments(sop.id, departmentIds, allDepartments)` — one write path, no forked logic.
- Grep gate confirms zero direct `sop_departments` inserts remain outside `grants.ts` materialization.
- `npx tsc --noEmit` and `npm run build` both clean; bundle re-baselined at 1057 KB (Δ +1 KB, within ±2 KB tolerance).
- Live ephemeral-org Playwright test (`tests/phase33/sop-grant-materialization.spec.ts`) proves: (1) a hand-picked SOP is overridden-from-birth — `access_grants` rows exist and `sop_departments` contains exactly the picked set, derived not direct; (2) an unrelated sibling-collection materialize (the exact 32-VERIFICATION hole) does NOT replace the hand-picked set; (3) clearing all picks makes the SOP re-follow its collection (emergent, no stored flag); (4) a cross-org `sopId` is rejected by the guard before any grant row is written.

## Task Commits

1. **Task 1: Rewire the three sop_departments write paths through SOP-target grants** - `93f571e` (feat)
2. **Task 2: Live runtime proof — from-birth override + silent-drop closure** - `ddc3426` (test)

## Files Created/Modified
- `src/actions/departments.ts` - `assignSopDepartments` rewritten through dept-subject SOP-target `access_grants` + `materializeSopAccess()`
- `src/actions/sops.ts` - `createSopFromWizard` funnels department assignment through `assignSopDepartments`
- `src/app/api/sops/ai-prompt/route.ts` - ai-prompt creation route funnels department assignment through `assignSopDepartments`
- `tests/phase33/sop-grant-materialization.spec.ts` - `assignSopDepartmentsStandIn` faithful stand-in + 2 new live tests (from-birth/closure/re-follow, cross-org rejection)

## Decisions Made
See `key-decisions` in frontmatter. Most consequential: `assignSopDepartments` scopes its replace-semantics delete to `subject_type='department'` only, so it never collides with SOP-target grants of other subject tiers written by the org-model wiring surface (32-08/33-08, running concurrently in a sibling worktree on this same wave).

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Playwright's `phase33` project test discovery also picked up a duplicate copy of this spec file from the sibling agent's worktree path (`.claude\worktrees\agent-*\tests\phase33\...`), running each test twice in the same invocation. Both copies passed; this is a pre-existing test-discovery scope issue (the worktree directory is nested under the repo root) unrelated to this plan's changes and out of scope to fix here.

## User Setup Required

None.

## Next Phase Readiness
- `sop_departments` is now a pure derived projection of `access_grants` on every write path in the codebase — no further dual-write closure work remains for departments.
- The department-picker UI (SopDepartmentEditor, DepartmentPicker, WizardClient, ai-prompt PromptClient) is unaffected — call signatures on `assignSopDepartments` / `createSopFromWizard` / the ai-prompt route body were not changed.
- 33-08/33-09 (org-model wiring surface, concurrent sibling work) can continue writing other-subject-tier SOP-target grants without risk of collision — this plan's delete scope is narrowed to `subject_type='department'` only.

---
*Phase: 33-per-sop-access-granularity-wayfinder-builder-header*
*Completed: 2026-07-19*

## Self-Check: PASSED

All 4 `files_modified` paths confirmed present on disk; both task commit hashes (`93f571e`, `ddc3426`) confirmed in `git log`.
