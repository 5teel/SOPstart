---
phase: 23-ai-field-layer-version-supersede
plan: "03"
subsystem: versioning
tags: [server-actions, version-supersede, clone, restore, append-only, tdd]
dependency_graph:
  requires: ["23-00", "23-01"]
  provides: ["cloneSopAsDraft", "restoreVersionAsNew", "computeNextVersionLineage"]
  affects: ["src/actions/versioning.ts", "23-05 UI wiring"]
tech_stack:
  added: []
  patterns: ["status-sentinel deep-copy", "admin-client-org-scope-self-enforce", "append-only-history"]
key_files:
  created:
    - src/lib/builder/__tests__/clone-restore.test.ts
  modified:
    - src/actions/versioning.ts
decisions:
  - "computeNextVersionLineage extracted as pure exported helper so lineage logic is unit-testable without a DB"
  - "Column names corrected to match database.types.ts: section_id/step_number/required_tools/confidence/content_type (not assumed names)"
  - "restoreVersionAsNew delegates entirely to cloneSopAsDraft — restore is structurally identical to clone-of-old-version"
  - "sop_section_blocks snapshot_content copied from source row (required field per types)"
metrics:
  duration: "14 minutes"
  completed_date: "2026-06-25"
  tasks_completed: 3
  files_changed: 2
---

# Phase 23 Plan 03: Version Clone + Restore Actions Summary

**One-liner:** Deep-copy clone-to-draft (cloneSopAsDraft) + append-only restore-as-new (restoreVersionAsNew) server actions with pure lineage helper and unit tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | cloneSopAsDraft — deep-copy published SOP into draft | 0d65923 | src/actions/versioning.ts |
| 2 | restoreVersionAsNew — append-only restore-as-new | 0d65923 | src/actions/versioning.ts |
| 3 | Lineage + append-only unit tests (TDD GREEN) | c653c86 | src/lib/builder/__tests__/clone-restore.test.ts |

## What Was Built

### computeNextVersionLineage (pure helper)
Exported pure function `computeNextVersionLineage(oldSop: {id, version, parent_sop_id})` returning `{newVersion, newParentId}`. Resolves parent_sop_id chain: if source is root (no parent), new parent = source.id; if source has a parent, new parent propagates the existing root id. Enables deterministic unit testing of lineage logic without any DB.

### cloneSopAsDraft (AFL-VER-01)
Deep-copies a published SOP into a new draft continuing the version lineage:
1. Auth guard + JWT role check (`['admin', 'safety_manager']`)
2. Org-scope self-enforcement via JWT `organisation_id` claim before any admin client ops
3. Inserts new SOP row with `status:'uploading'` sentinel
4. Batch-copies `sop_sections` → `sop_steps` → `sop_section_blocks` (FK only, no block re-copy) → `sop_images` (by reference — same `storage_path`, no re-upload)
5. On any failure: deletes partial draft (CASCADE removes children) — Pitfall 2 guard
6. On success: flips `status` to `'draft'`
7. **Never** sets `superseded_by` — that only happens via the existing publish path (D-05)

### restoreVersionAsNew (AFL-VER-03 / D-06)
Delegates entirely to `cloneSopAsDraft(oldVersionSopId)`. D-06 append-only invariant: never mutates `superseded_by` on old rows, never reactivates old rows in place, never sets `status:'published'` on old ids. History is strictly forward-append only.

### Unit tests (phase21.5-unit)
10 tests in `src/lib/builder/__tests__/clone-restore.test.ts`:
- 5 lineage tests (N→N+1, parent resolution for root and non-root cases)
- 5 append-only source-contract assertions (export presence, no superseded_by:null, no old-row reactivation, delegation to cloneSopAsDraft, static imports only)

## Verification Results

- `npx playwright test --project=phase21.5-unit -g "clone-restore|lineage"`: **10/10 PASSED**
- `npx playwright test --project=phase23-stubs -g "AFL-VER-01|AFL-VER-03"`: **4 passed, 1 skipped** (skipped test is AFL-VER-01 wiring in versions/page.tsx — that is Plan 23-05 UI work)
- `npx tsc --noEmit`: **CLEAN**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Column names corrected to match actual database.types.ts schema**
- **Found during:** Task 1 tsc --noEmit check
- **Issue:** Plan skeleton and initial implementation used assumed column names (`sop_section_id` on sop_steps, `sort_order` on sop_steps, `tools`, `confidence_score`, `sub_heading`, `show_media_side_by_side`, `sop_section_id` on sop_images, `mime_type`, `junction_data`) that do not exist in the actual DB types
- **Fix:** Read `database.types.ts` for all four tables and corrected to actual names: `section_id`, `step_number`, `required_tools`, `confidence`, `content_type`; removed non-existent columns; added required `snapshot_content` field on `sop_section_blocks` insert
- **Files modified:** src/actions/versioning.ts
- **Commit:** 0d65923

**2. [Rule 1 - Bug] Self-referential test assertion for dynamic import check**
- **Found during:** Task 3 first test run
- **Issue:** `expect(testSrc).not.toContain('await import(')` in the test file always fails because the test file contains that exact string in the assertion itself
- **Fix:** Replaced with a positive assertion verifying the static import appears before any `test()` call
- **Files modified:** src/lib/builder/__tests__/clone-restore.test.ts
- **Commit:** c653c86

## Threat Model Mitigations Applied

| Threat ID | Status |
|-----------|--------|
| T-23-03-01 (cross-org clone via admin client) | MITIGATED — source SOP `organisation_id` checked against JWT `organisation_id` before any admin op |
| T-23-03-02 (non-admin triggers clone/restore) | MITIGATED — JWT role guard `['admin', 'safety_manager']` on both actions |
| T-23-03-03 (restore rewrites history) | MITIGATED — D-06 invariant: no `superseded_by: null`, no `status: 'published'` on old ids; unit + source-contract tests assert |
| T-23-03-04 (orphan sections on failure) | MITIGATED — status sentinel + `delete().eq('id', newSopId)` cleanup on any exception |

## Threat Flags

None found — no new network endpoints, auth paths, or trust boundary changes introduced.

## Known Stubs

None — this plan produces server actions only. The UI wiring (versions/page.tsx "Edit into new version" button calling cloneSopAsDraft) is Plan 23-05 scope and is tracked in the phase23-stubs skipped test AFL-VER-01 wiring check.

## Self-Check: PASSED

- [x] src/actions/versioning.ts modified and committed at 0d65923
- [x] src/lib/builder/__tests__/clone-restore.test.ts created and committed at c653c86
- [x] Both commits verified: `git log --oneline -3` shows c653c86 and 0d65923
- [x] 10/10 unit tests GREEN
- [x] 4/5 phase23-stubs pass (1 expected-skip for Plan 23-05 UI)
- [x] `npx tsc --noEmit` clean
