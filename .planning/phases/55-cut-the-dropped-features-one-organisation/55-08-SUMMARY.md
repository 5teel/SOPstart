---
phase: 55-cut-the-dropped-features-one-organisation
plan: 08
subsystem: video-generation
tags: [deletion, video-generation, shotstack, publish, middleware, sweep]
requires:
  - phase: 55-07
    provides: UploadDropzone with no video-generation caller
provides:
  - video generation (Shotstack pipeline, routes, jobs, admin components, pipeline page) deleted
  - publish without the video auto-queue; Shotstack callback exemption removed
  - video-generation sweep live and mutation-proven
affects: [55-09, 55-13, 55-14]
key-files:
  modified:
    - src/lib/governance/publish-core.ts
    - src/app/api/sops/[sopId]/publish/route.ts
    - src/actions/sops.ts
    - src/lib/validators/sop.ts
    - src/lib/supabase/middleware.ts
    - src/lib/ai/registry.ts
    - src/lib/ai/model-options.ts
    - src/components/admin/ParseJobStatus.tsx
    - src/lib/admin/job-stages.ts
    - src/lib/journeys/journeys.ts
    - playwright.config.ts
    - tests/phase55/deletion-sweep.spec.ts
  deleted:
    - src/app/api/sops/{generate-video,recover-renders,pipeline}/, src/app/api/videos/
    - src/app/(protected)/admin/sops/{pipeline/, [sopId]/video/}
    - src/lib/video-gen/, src/actions/video.ts, src/hooks/useVideoGeneration.ts
    - eight src/components/admin/Video*.tsx generation components, src/components/sop/VideoTabPanel.tsx
    - 14 root video-gen / pipeline stub specs
key-decisions:
  - "publish success result is { success: true }; assertPublishGates untouched (diff shows no change inside it)"
  - "dead validators pipelineVideoFormatSchema / generateVideoSchema / recordVideoViewSchema / updateVersionLabelSchema deleted with their only callers"
  - "job-stages loses the render plain stage and 'generating' mapping; youtube_url stage set left alone (not this plan's feature)"
requirements-completed: [CUT-02]
duration: ~45min
completed: 2026-10-03
---

# Phase 55 Plan 08: Video generation removed

**No code path can generate, finalise, recover or stream a generated video; publishing no longer queues one; the Shotstack public-route exemption is gone. The record-a-video on-ramp (D-05) is untouched.**

## Accomplishments

- Deleted the generation routes (generate, finalize, callback, recover-renders, pipeline snapshot, video stream), the pipeline progress page, the `/admin/sops/[sopId]/video` page, `src/lib/video-gen/`, `src/actions/video.ts`, `useVideoGeneration`, the eight generation components and `VideoTabPanel`.
- `performPublish` drops the auto-queue step; result type is `{ success: true }`; the publish route drops `pipelineAutoQueued`. `scripts/verify-gate-check.tsx` lost its auto-queue mock.
- `createVideoSopPipelineSession` and its schema removed from `src/actions/sops.ts`. Surviving exports (`createUploadSession`, `createVideoUploadSession`, ...) re-read: all async and all take `organisationId` from `getSessionContext()` (T-55-04).
- `isShotstackCallback` removed from `middleware.ts`; cron, version, schema and auth exemptions untouched (T-55-02).
- `tts-video` AI key, its option list and label removed.
- `ParseJobStatus` is parse-only (no pipeline props, no `sop_pipeline_runs` / `video_generation_jobs` realtime, no snapshot fetch); `job-stages` lost the pipeline snapshot types, `derivePipelineStage` and the render stage.
- Builder tools menu "Make a training video" and the "Video versions" icon links on assign / versions pages removed.
- Kept (D-05, verified present): `VideoRecorder`, `VideoPreviewPanel`, `VideoReviewPanel`, `/api/sops/transcribe`, `createVideoUploadSession`, TUS, `video-upload` / `transcript-review` / `stage-progress` / `publish-gate` / `safety-warning` specs.

## Verification

- `npx tsc --noEmit` clean; `npm run build` exit 0. Bundle `/sops/[sopId]/page` 935 KB, `/sops/page` 827 KB (same as 55-07; baseline file untouched; both below "Bundle before").
- `phase55 + phase29 + phase26 + phase30 + phase33 + phase40 + phase6-stubs + phase11-stubs + phase21-stubs`: 488 passed, 95 skipped, 9 failed. All 9 are the known `phase11-stubs` rows in 55-BASELINE-FAILURES.md (SB-AUTH-01, SB-LAYOUT-01/02/D01/06/13/16/D08, SB-SECT-05). No new failure.
- `no-dead-internal-hrefs` + `design-tokens`: 12 passed.
- Publish-gate specs (`tests/phase26/verify-gate.spec.ts` behavioural harness, phase29 publish specs, `publish-gate.test.ts`) green; `unverified_blocks` / `status: 400` intact.

### Mutation proof

| Sweep | Planted | Result | Reverted |
|---|---|---|---|
| video-generation | `const isShotstackCallback = false` appended to `middleware.ts` | RED (`src/ has no reference`) | GREEN (5/5) |

## Deviations from Plan

**1. [Rule 1 - Bug] Stale guards repointed beyond the plan's list** - `tests/phase33/wayfinder-header.spec.ts` asserted both `Make a training video` (deleted) and `Print a QR code` (already removed by 55-06, so the spec was red before this plan); both lines removed. `tests/phase40/parse-status-no-navigate-after-unmount.spec.ts` pinned the pipeline snapshot guard (`if (cancelled || !res.ok) return`); repointed to the parse poll + realtime guards (>= 2). `route-auth-org-scope` admin-client census lost its five deleted routes. Commit `e8ab1dd`.

**2. [Rule 1 - Bug] DAT-01 write census 44 to 41** - deleting the pipeline session creator removed one `sops` insert and two `source_file_path` updates; its allow-list entry removed, "4 call sites" comment corrected to 2, dated comment added. Not a silencing: none of the removed sites is a surviving write.

**3. [Rule 3] Two extra dead validators** - `pipelineVideoFormatSchema` and `generateVideoSchema` (plus `recordVideoViewSchema`, `updateVersionLabelSchema`) had no importer once the routes/actions went; deleted.

## Open items (cannot be checked from the repo)

- **Railway cron / Shotstack dashboard:** not inspected. Kill-switch is the removed middleware exemption plus the deleted routes: any external caller (a Shotstack webhook to `/api/sops/generate-video/callback`, or a cron hitting `recover-renders`) now gets the login redirect, not a crash. Simon should confirm in the Shotstack dashboard that the webhook can be removed and in Railway that no cron service targets `/api/sops/recover-renders` or `/api/sops/generate-video/*`.
- **Env vars that can now be retired in Railway:** `SHOTSTACK_API_KEY`, `SHOTSTACK_API_URL`, `SHOTSTACK_CALLBACK_SECRET`, `VIDEO_TTS_MODEL` / `TTS_MODEL`. `DEEPGRAM_API_KEY` stays.
- Tables `video_generation_jobs`, `sop_pipeline_runs`, bucket `sop-generated-videos` and `sops.pipeline_run_id` / `parse_jobs.pipeline_run_id` stay (no migration this phase); `deleteSop` still clears `video_generation_jobs` rows.
- CAPABILITY-MATRIX.md needed no edit ("Create SOP" row names video as an on-ramp; no generation capability listed; already dated 2026-10-03).

## Task Commits

1. `8279548` delete video generation and unwire it from publish, parse status, middleware and builder (Tasks 1 and 2 as one green commit, as the plan allowed)
2. `e8ab1dd` delete video-generation specs and projects, repoint guards, flip sweep live

## Known Stubs

None.

## Threat Flags

None. T-55-02 mitigated (exemption deleted with the route, sweep-pinned, mutation-proven); T-55-08-01 mitigated (`assertPublishGates` body unchanged); T-55-04 mitigated (surviving `sops.ts` exports session-scoped).

## Self-Check: PASSED

- Commits `8279548`, `e8ab1dd` exist; `src/lib/video-gen`, `src/actions/video.ts`, `src/app/api/sops/generate-video` absent; `VideoRecorder.tsx`, `VideoPreviewPanel.tsx`, `VideoReviewPanel.tsx`, `src/app/api/sops/transcribe/route.ts` present.
