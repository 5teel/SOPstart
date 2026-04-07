---
phase: 10-video-version-management
plan: "01"
subsystem: video-version-management
tags: [database-migration, playwright, typescript-types, video-generation]
dependency_graph:
  requires: []
  provides: [phase10-stubs-playwright-project, migration-00018, VideoGenerationJob-extended-type]
  affects: [src/types/sop.ts, supabase/migrations, playwright.config.ts]
tech_stack:
  added: []
  patterns: [test.fixme stub pattern, ALTER TABLE migration pattern, partial unique index]
key_files:
  created:
    - tests/video-version-management.test.ts
    - supabase/migrations/00018_video_version_management.sql
  modified:
    - playwright.config.ts
    - src/types/sop.ts
decisions:
  - "Partial unique index WHERE published=true enforces one-published-per-SOP at DB level (T-10-01 mitigation), preventing application logic bypass"
  - "version_number DEFAULT 0 with immediate backfill UPDATE to 1 — ensures no existing rows stay at 0 after migration"
  - "label length capped at 60 chars via CHECK constraint — enforced at DB level, not just application validation"
metrics:
  duration: "8m"
  completed: "2026-04-07"
  tasks_completed: 2
  files_created: 3
  files_modified: 2
---

# Phase 10 Plan 01: Video Version Management Foundation Summary

**One-liner:** Playwright phase10-stubs project with 8 VVM test.fixme stubs, migration 00018 dropping UNIQUE constraint and adding version_number/label/archived columns with partial unique index, and VideoGenerationJob TypeScript type extended with three new fields.

## What Was Built

### Task 1: Playwright test stubs and phase10-stubs project
- Created `tests/video-version-management.test.ts` with 8 `test.fixme` stubs covering VVM-01 through VVM-08
- Added `phase10-stubs` Playwright project to `playwright.config.ts` matching `/video-version-management/`
- All 8 stubs discovered and listed correctly by `npx playwright test --project=phase10-stubs --list`

### Task 2: Database migration and TypeScript type extensions
- Created `supabase/migrations/00018_video_version_management.sql` with 5 operations:
  1. DROP CONSTRAINT `video_generation_jobs_sop_format_version_unique` (removes single-version-per-SOP restriction)
  2. ADD COLUMNS: `version_number int NOT NULL DEFAULT 0`, `label text DEFAULT NULL`, `archived boolean NOT NULL DEFAULT false`
  3. Backfill UPDATE: sets `version_number = 1` for all existing rows
  4. Partial unique index `video_generation_jobs_one_published_per_sop ON (sop_id) WHERE published = true` (D-03)
  5. CHECK constraint: `label IS NULL OR char_length(label) <= 60`
- Extended `VideoGenerationJob` interface in `src/types/sop.ts` with `version_number: number`, `label: string | null`, `archived: boolean`
- Build passes with the extended type

## Verification Results

- `npx playwright test --project=phase10-stubs --list` shows 8 tests in 1 file
- `grep "version_number" src/types/sop.ts` returns line 162
- `npm run build` passes cleanly

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 1d79f33 | test(10-01): add phase10-stubs Playwright project with 8 VVM test.fixme stubs |
| 2 | 94b3324 | feat(10-01): database migration and TypeScript type extensions for video version management |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

The test file `tests/video-version-management.test.ts` contains 8 `test.fixme` stubs intentionally — these are the scaffold for subsequent plans (10-02 through 10-04) to implement.

## Threat Flags

No new threat surfaces introduced beyond those defined in the plan's threat model. T-10-01 (partial unique index) is implemented as specified.

## Self-Check: PASSED

- `tests/video-version-management.test.ts` — FOUND
- `supabase/migrations/00018_video_version_management.sql` — FOUND
- `playwright.config.ts` contains `phase10-stubs` — FOUND
- `src/types/sop.ts` contains `version_number` at line 162 — FOUND
- Commit 1d79f33 — FOUND
- Commit 94b3324 — FOUND
