---
phase: 40-shared-creation-foundation
plan: 03
subsystem: ui
tags: [react, supabase-realtime, nextjs, admin]

requires:
  - phase: 40-shared-creation-foundation
    provides: playwright phase40 project + tests/phase40 spec stubs (Wave 1)
provides:
  - src/lib/admin/job-stages.ts — the one plain-language stage vocabulary, per-pipeline stage sets, pipeline stage derivation, and the grace/stale polling predicate
  - ParseJobStatus extended to serve both document/AI parse and the video-generation pipeline, with a single realtime+polling engine (three-timer model)
  - PipelineProgressClient stripped to local snapshot state + outcome CTAs (its own realtime/polling engine deleted)
affects: [40-09 (page shell swap on the pipeline route header)]

tech-stack:
  added: []
  patterns:
    - "Plain-language stage vocabulary mapped over untouched DB stage keys (D-07) — never rename internal parse_jobs/video_generation_jobs.current_stage values, map only at render"
    - "Three-timer realtime+polling model (grace timeout + stale watchdog + subscribe-status fallback) consolidated into exactly one file"

key-files:
  created:
    - src/lib/admin/job-stages.ts
  modified:
    - src/components/admin/ParseJobStatus.tsx
    - src/app/(protected)/admin/sops/pipeline/[pipelineId]/PipelineProgressClient.tsx
    - tests/phase40/dup03-job-progress.spec.ts
  deleted:
    - src/components/admin/PipelineStepper.tsx

key-decisions:
  - "ParseJobStatus props are a discriminated union: exactly one of sopId (parse mode) or pipelineId (pipeline mode) is required, keeping both call sites type-safe"
  - "In pipeline mode ParseJobStatus renders only the StageStepper (the realtime+polling engine + progress bar); PipelineProgressClient keeps ownership of the outcome CTA panels, driven by derivePipelineStage(snapshot)"
  - "derivePipelineStage's error case sets plainKey equal to errorAt (e.g. plainKey: 'read', errorAt: 'read') since PlainStageKey has no separate 'error' variant — callers gate on errorAt !== null to distinguish error from normal progress"

patterns-established:
  - "Pattern 2: Realtime + polling fallback, three-timer model — exactly one file (ParseJobStatus.tsx) owns REALTIME_GRACE_MS/REALTIME_STALE_MS/POLL_INTERVAL_MS for every job-progress surface"

requirements-completed: [DUP-03]

duration: 25min
completed: 2026-07-29
---

# Phase 40 Plan 03: Shared job-progress component (ParseJobStatus + job-stages.ts) Summary

**Merged the two structurally different job-progress implementations (ParseJobStatus's flat 5s poll vs. PipelineStepper+PipelineProgressClient's three-timer model) onto ParseJobStatus as the single realtime+polling engine, with one plain-language stage vocabulary (job-stages.ts) shared by document parse, AI-prompt draft, and video-generation pipeline.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-29T06:48:00Z
- **Completed:** 2026-07-29T07:13:34Z
- **Tasks:** 2
- **Files modified:** 5 (1 created, 3 modified, 1 deleted)

## Accomplishments
- `src/lib/admin/job-stages.ts` — one 6-entry plain-language vocabulary (`Uploading` / `Reading your document` / `Building the draft` / `Checking` / `Making the video` / `Ready`), a `STAGE_TO_PLAIN` map that keeps every internal DB stage key verbatim, `STAGE_SETS` per pipeline (including new `upload` and `video_generation` sets), `derivePipelineStage`, `plainLabel`, and the pure `shouldStartPolling` predicate
- `ParseJobStatus` now serves both flows: parse mode (`sopId`, unchanged behavior) and pipeline mode (`pipelineId` + `initialSnapshot` + `onSnapshot`), both driven by the same ported-wholesale three-timer engine (grace timeout, stale watchdog, subscribe-status fallback)
- `PipelineProgressClient` reduced to local snapshot state + `<ParseJobStatus pipelineId .../>` + its existing outcome CTA blocks (now keyed off `derivePipelineStage(snapshot)`'s `plainKey`/`errorAt` instead of the old `PipelineStageState`/`errorStage`)
- Deleted `PipelineStepper.tsx`; zero references remain under `src/`
- Un-fixme'd `tests/phase40/dup03-job-progress.spec.ts`, added a `shouldStartPolling` threshold assertion and a pipeline-subscription-literals assertion — 10/10 spec assertions pass

## Task Commits

1. **Task 1: Create the plain-language stage vocabulary module** - `6d1f6b1` (feat)
2. **Task 2: Extend ParseJobStatus to serve the video pipeline, and strip the duplicate implementation** - `985740b` (feat)

## Files Created/Modified
- `src/lib/admin/job-stages.ts` - plain-language vocabulary, stage-set map, pipeline stage derivation, polling predicate
- `src/components/admin/ParseJobStatus.tsx` - extended with pipeline mode + the ported three-timer engine + plain-label rendering
- `src/app/(protected)/admin/sops/pipeline/[pipelineId]/PipelineProgressClient.tsx` - stripped to snapshot state + outcome CTAs
- `src/components/admin/PipelineStepper.tsx` - deleted (superseded)
- `tests/phase40/dup03-job-progress.spec.ts` - un-fixme'd, extended with 2 new assertions

## Decisions Made
- Pipeline-mode `ParseJobStatus` renders only the stage stepper; the plan's phrasing ("the outcome panel stays in sync" via `onSnapshot`) implied CTA ownership stays with `PipelineProgressClient`, so the split is: `ParseJobStatus` = engine + progress bar, `PipelineProgressClient` = outcome copy/links. This kept the merge target's diff smallest and avoided duplicating the review/ready/error CTA JSX into a second file.
- Kept `sopId`/`pipelineId` as a discriminated union rather than both-optional, so existing call sites (`PromptClient.tsx`, `VoiceDraftClient.tsx`) keep compiling with `sopId` required exactly as before.

## Deviations from Plan

None — plan executed exactly as written. One clarifying note: the plan's acceptance criteria and top-level `<verification>` both state `grep -rn "PipelineStepper" src/ tests/` returns zero matches, but `tests/phase40/dup03-job-progress.spec.ts` itself must name `PipelineStepper.tsx` in its own guard test (`'PipelineStepper.tsx does not exist'`) to assert the file's absence — this is an unavoidable self-reference in a source-contract guard, not a stray leftover. `src/` is fully clean (`grep -rn "PipelineStepper" src/` returns zero matches); the 3 occurrences under `tests/` are all inside the guard test that proves the deletion.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `job-stages.ts`'s `Snapshot`/`derivePipelineStage`/`STAGE_SETS`/`plainLabel` exports are stable for plan 40-09 (page shell swap), which only touches `PipelineProgressClient`'s sticky header/back-link — untouched by this plan per the plan's own note to avoid a merge conflict.
- No blockers.

---
*Phase: 40-shared-creation-foundation*
*Completed: 2026-07-29*
