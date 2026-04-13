---
phase: 09-streamlined-file-video-pipeline
plan: "03"
subsystem: publish-to-video-auto-queue
tags: [publish-route, auto-queue, video-gen, pipeline-linkage, path-03, path-06]
dependency_graph:
  requires:
    - sop_pipeline_runs-table
    - pipeline_run_id-FK-parse_jobs
    - pipeline_run_id-FK-video_generation_jobs
    - createVideoSopPipelineSession-action
  provides:
    - enqueueVideoGenerationForPipeline-helper
    - publish-route-auto-queue-hook
  affects:
    - src/app/api/sops/[sopId]/publish/route.ts
    - src/lib/video-gen/auto-queue.ts
tech_stack:
  added: []
  patterns:
    - "next/server after() fire-and-forget with lazy dynamic import"
    - "idempotent enqueue — reuse active non-terminal job then fall through to versioned INSERT"
    - "never-throw auto-queue wrapper so publish response is never rolled back"
key_files:
  created:
    - src/lib/video-gen/auto-queue.ts
  modified:
    - src/app/api/sops/[sopId]/publish/route.ts
decisions:
  - "Plan 09-03 spec referenced a UNIQUE(sop_id, format, sop_version) check — that constraint was dropped in Phase 10 migration 00018. Implementation uses the Phase 10 multi-version pattern instead (active-job reuse → versioned INSERT), mirroring generateNewVersion in src/actions/video.ts"
  - "pipeline_run_id writes did NOT need `as any` casts — worktree database.types.ts already has the column typed on parse_jobs, sops, and video_generation_jobs, so all writes are fully type-checked"
  - "Auto-queue placed AFTER the publish UPDATE so the D-02 review gate remains the only surface that can 400. Queue result never affects publish response status."
  - "Pipeline dispatch uses lazy dynamic import of @/lib/video-gen/pipeline inside after() so the publish route bundle does not drag in the full video-gen stack"
metrics:
  completed: "2026-04-13"
  tasks_completed: 2
  files_created: 1
  files_modified: 1
  duration: "~5m"
commits:
  - a87759c — feat(09-03): enqueueVideoGenerationForPipeline helper
  - e31a9f5 — feat(09-03): wire auto-queue into publish route
requirements: [PATH-03, PATH-06]
---

# Phase 9 Plan 3: Publish → Auto-Queue Wire-up Summary

## What was built

One-sentence: **The publish route now auto-queues a video generation job whenever the SOP originated from the D-01 pipeline flow, without touching the D-02 review gate.**

Created `src/lib/video-gen/auto-queue.ts` exporting
`enqueueVideoGenerationForPipeline({ sopId, organisationId, createdBy })`.
The helper:

1. Reads the SOP's most recent `parse_jobs` row and extracts `pipeline_run_id`.
   If the row is missing or `pipeline_run_id` is null, returns `{ skipped: true }`
   and the publish flow continues as normal.
2. Reads `sop_pipeline_runs.requested_video_format` for the pipeline run.
3. Defence-in-depth: re-reads `sops.status` and bails with `{ error }` if the
   SOP is not actually published (never throws).
4. Idempotency: if there's already a non-terminal
   (`queued|analyzing|generating_audio|rendering`) `video_generation_jobs` row
   for this `sop_id+format`, reuses it and returns that job id.
5. Otherwise computes the next `version_number` (app-level counter scoped to SOP,
   matching `generateNewVersion` in `src/actions/video.ts`) and inserts a new
   `video_generation_jobs` row tagged with the same `pipeline_run_id`.
6. Dispatches `runVideoGenerationPipeline(jobId)` via `next/server` `after()`
   with a lazy dynamic `import('@/lib/video-gen/pipeline')` so the publish
   route bundle does not pull in the full video-gen stack.
7. Wraps the entire body in `try/catch` so no DB hiccup can ever propagate
   back to the publish route — publish stays idempotent and durable.

Rewrote `src/app/api/sops/[sopId]/publish/route.ts` to:

- Preserve the D-02 review gate verbatim (count unapproved sections → 400).
- Resolve `user` and `organisation_id` from the JWT claims before the gate,
  consistent with the `/api/sops/generate-video` route pattern.
- Call `enqueueVideoGenerationForPipeline` immediately AFTER the successful
  `sops.update({ status: 'published', ... })`.
- Log (but not propagate) any `queueResult.error`.
- Return `{ success: true, pipelineAutoQueued: 'enqueued' in queueResult }`.

## Why it matters

Closes the chain for PATH-03: a pipeline-originated SOP now auto-generates
the user's chosen video format the instant the admin publishes the draft,
without requiring them to navigate to the video panel and manually dispatch
generation. The D-02 review gate is preserved, so video generation still
fires on a human-approved SOP (no hallucinated SOPs reaching production).
Non-pipeline (manual-upload) SOPs are unaffected — the helper `{ skipped: true }`
short-circuits before any insert, so existing publish semantics are unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Stale schema reference] Plan referenced Phase-9-era UNIQUE constraint on video_generation_jobs**

- **Found during:** Task 1 planning
- **Issue:** The plan's Task 1 action block described checking an existing
  job by `(sop_id, format, sop_version)` and resetting `status='queued'` on
  the same row if it was `failed`. That behaviour assumed the UNIQUE
  constraint `video_generation_jobs_sop_format_version_unique` from
  migration 00013. Phase 10 migration 00018 DROPs that constraint and
  introduces `version_number` with "only one published per SOP" semantics.
  Calling `UPDATE ... SET status='queued'` on a historical failed row would
  silently break version history and conflict with `publishVersionExclusive`.
- **Fix:** Implemented the Phase 10 multi-version pattern instead — reuse
  active non-terminal jobs (true idempotency for retry-during-publish),
  otherwise compute `nextVersion = max(version_number) + 1` and INSERT a
  new row. Mirrors the exact pattern used by `generateNewVersion` in
  `src/actions/video.ts` and `/api/sops/generate-video/route.ts`.
- **Files modified:** `src/lib/video-gen/auto-queue.ts`
- **Commit:** a87759c

**2. [Rule 2 - Auto-add] Removed unnecessary `as any` casts**

- **Found during:** Task 1 implementation
- **Issue:** Plan spec used `...({ pipeline_run_id: pipelineRunId } as any)`
  casts, commented "consistent with Phase 8-04 pattern for columns not yet
  regenerated in database.types.ts". Inspection shows `database.types.ts` in
  this worktree already has `pipeline_run_id` fully typed on all three tables
  (`parse_jobs`, `sops`, `video_generation_jobs`). Casts would hide real type
  errors in future edits.
- **Fix:** Wrote fully type-checked inserts/updates with no `any` casts.
- **Files modified:** `src/lib/video-gen/auto-queue.ts`
- **Commit:** a87759c

## Verification

| Success criterion | Outcome |
|---|---|
| D-02 publish gate preserved — unapproved sections still return 400 | PASS — `grep "All sections must be approved"` returns one match, `status: 400` present on the gate branch, code path unchanged |
| enqueueVideoGenerationForPipeline helper exists | PASS — `src/lib/video-gen/auto-queue.ts`, named export |
| Publish route checks parse_jobs.pipeline_run_id and auto-queues only when set | PASS — helper returns `{ skipped: true }` when `pipeline_run_id` is null; publish route response carries `pipelineAutoQueued: false` |
| Failures in auto-queue are logged but don't fail the publish response | PASS — helper never throws; publish route only `console.error`s on `queueResult.error` and always returns 200 |
| `npx tsc --noEmit` clean | PASS — `EXIT=0` after both tasks |
| Per-task commits with --no-verify (parallel executor) | PASS — 2 commits, both `--no-verify` as required |

## Threat Model — Disposition Status

| Threat ID | Category | Disposition | Status |
|---|---|---|---|
| T-09-03-01 | E — Auto-publish bypasses review gate | mitigate | Implemented — auto-queue call sits AFTER the `unapprovedCount > 0 → 400` gate and AFTER the sops UPDATE. No code path reaches `enqueueVideoGenerationForPipeline` unless both gates already passed. |
| T-09-03-02 | I — Tenant bleed on auto-queue | mitigate | Implemented — `organisationId` is read from JWT claims in the publish route and passed through to the helper; all writes use that exact value. RLS on video_generation_jobs (migration 00015) enforces `current_organisation_id()` as a secondary gate. |
| T-09-03-03 | T — Client forges pipelineAutoQueued response | accept | Informational only, no security decision depends on it. |
| T-09-03-04 | D — auto-queue failure blocks publish | mitigate | Implemented — helper wrapped in try/catch, returns `{ error }` on any DB failure; publish logs then returns 200. |
| T-09-03-05 | T — Injected pipeline_run_id from another org | mitigate | Implemented — `pipeline_run_id` is read from `parse_jobs` WHERE `sop_id = input.sopId`; RLS + the authenticated publish gate prevent cross-org sopId access before the helper ever runs. |
| T-09-03-06 | I — organisationId leak via JWT parse | accept | Standard pattern across every other server route. |

## Threat Flags

None — no new trust boundaries, network endpoints, or schema changes introduced.

## Follow-ups

- 09-04 progress page can subscribe to `video_generation_jobs` filtered by
  `pipeline_run_id` to render stages 4-5 of the unified stepper.
- Playwright stubs in `tests/pipeline-autoqueue.test.ts` and
  `tests/pipeline-review-gate.test.ts` are still `test.fixme` — promote to
  real tests in a later verification pass once the integration fixtures
  are wired (out of scope for 09-03).

## Self-Check: PASSED

- [x] `src/lib/video-gen/auto-queue.ts` exists with `enqueueVideoGenerationForPipeline` export
- [x] `src/app/api/sops/[sopId]/publish/route.ts` imports and calls the helper
- [x] Publish gate branch still returns 400 on unapproved sections
- [x] Auto-queue call placed AFTER the sops UPDATE, never before the gate
- [x] `npx tsc --noEmit` exits 0
- [x] Commit a87759c exists: `git log --oneline --all | grep a87759c`
- [x] Commit e31a9f5 exists: `git log --oneline --all | grep e31a9f5`
