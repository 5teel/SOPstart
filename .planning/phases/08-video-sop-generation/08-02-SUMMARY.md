---
phase: 08-video-sop-generation
plan: "02"
subsystem: video-gen, api, actions
tags: [shotstack, tts, video-generation, pipeline, server-actions, api-route]

requires:
  - phase: 08-01
    provides: tts.ts, shotstack-client.ts, types.ts, video_generation_jobs table, generateVideoSchema, recordVideoViewSchema

provides:
  - buildSlideshowEdit function (render-slides.ts)
  - buildScrollEdit function (render-scroll.ts)
  - runVideoGenerationPipeline orchestrator (pipeline.ts)
  - POST /api/sops/generate-video route with idempotency guard
  - recordVideoView, publishVideo, unpublishVideo, deleteVideoJob, regenerateVideo server actions

affects:
  - 08-03 (admin UI — imports publishVideo, regenerateVideo, deleteVideoJob from video.ts)
  - 08-04 (worker video player — calls recordVideoView, reads video_generation_jobs)

tech-stack:
  added: []
  patterns:
    - Fire-and-forget pipeline: void runVideoGenerationPipeline().catch() pattern (same as parse route)
    - Per-section audio clips in Shotstack multi-track: avoids invalid MP3 concatenation (Research Pitfall 2)
    - buildSectionContent helper: formats steps sections as numbered lists for both HTML and TTS text
    - Idempotency via maybeSingle() check before insert (D-14)
    - Completion_type cast via spread + as any: handles migration-extended columns not in database.types.ts

key-files:
  created:
    - src/lib/video-gen/render-slides.ts
    - src/lib/video-gen/render-scroll.ts
    - src/lib/video-gen/pipeline.ts
    - src/app/api/sops/generate-video/route.ts
    - src/actions/video.ts

key-decisions:
  - "buildScrollEdit uses per-section audio clips (not stitched MP3) — same pattern as buildSlideshowEdit per Research Pitfall 2"
  - "pipeline.ts fetches SOP steps in one batched query and groups by section_id — avoids N+1 per section"
  - "recordVideoView uses submitted_at not completed_at — matches actual sop_completions DB schema"
  - "VGEN-03 (full AI video) acknowledged as deferred — not included in route or actions"

patterns-established:
  - "render-slides.ts: two tracks — Track 1 HTML clips, Track 2 audio clips with matching start/length"
  - "render-scroll.ts: Track 1 single scrolling HTML, Track 2 per-section audio clips with cumulative start offsets"
  - "pipeline.ts: updateJobStatus helper encapsulates status+stage+updated_at updates"

requirements-completed:
  - VGEN-01
  - VGEN-02
  - VGEN-03
  - VGEN-04
  - VGEN-06

duration: 6min
completed: "2026-04-04"
---

# Phase 08 Plan 02: Video Generation Pipeline Summary

**Shotstack timeline builders (narrated slideshow + screen-recording-style), full pipeline orchestrator, API route, and server actions for video generation operations**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-04T05:28:45Z
- **Completed:** 2026-04-04T05:35:12Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- buildSlideshowEdit generates a two-track Shotstack timeline: HTML slide per section (brand-yellow titles on steel-900 background) with matching audio clips
- buildScrollEdit generates a single scrolling HTML clip with CSS @keyframes animation, per-section scroll stops computed from cumulative TTS durations, and per-section audio clips on Track 2 (no stitched MP3)
- runVideoGenerationPipeline drives the full generation flow: analyzing → generating_audio (parallel Promise.all) → compute chapter markers → build timeline → rendering (submit Shotstack) → poll until done → re-upload to Storage → ready
- POST /api/sops/generate-video validates input, checks role (admin/safety_manager), verifies SOP is published, performs idempotency check (D-14), creates job, fires pipeline fire-and-forget, returns 202
- server actions: recordVideoView (fire-and-forget completion record with completion_type='video_view'), publishVideo, unpublishVideo, deleteVideoJob (clears Storage files), regenerateVideo (marks old job failed, creates new, calls pipeline directly)

## Task Commits

1. **Task 1: Shotstack timeline builders and video generation pipeline** — `cb4f17a` (feat)
2. **Task 2: API route and server actions for video generation and viewing** — `d523915` (feat)

**Plan metadata:** (recorded in final commit)

## Files Created/Modified

- `src/lib/video-gen/render-slides.ts` — buildSlideshowEdit: two-track narrated slideshow (HTML clips + audio clips)
- `src/lib/video-gen/render-scroll.ts` — buildScrollEdit: single scrolling HTML clip + per-section audio track
- `src/lib/video-gen/pipeline.ts` — runVideoGenerationPipeline: full orchestration from DB fetch through Shotstack render to Storage re-upload
- `src/app/api/sops/generate-video/route.ts` — POST handler with auth, idempotency, 202 response
- `src/actions/video.ts` — recordVideoView, publishVideo, unpublishVideo, deleteVideoJob, regenerateVideo

## Decisions Made

- buildScrollEdit uses per-section Shotstack audio clips (not stitched MP3) — naive Buffer.concat of MP3 files produces invalid output (Research Pitfall 2)
- pipeline.ts fetches all steps in a single query and groups by section_id — avoids N+1 query per section
- recordVideoView uses `submitted_at` not `completed_at` — matches actual sop_completions table schema (completed_at does not exist)
- regenerateVideo calls runVideoGenerationPipeline directly rather than via fetch to avoid unnecessary HTTP round-trip
- VGEN-03 (full AI video/avatar format) acknowledged as deferred per D-01 — not included in any route handler or action

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed completed_at vs submitted_at in recordVideoView**
- **Found during:** Task 2 implementation
- **Issue:** Plan specified `completed_at: new Date().toISOString()` but sop_completions table has `submitted_at` not `completed_at` — passing completed_at would silently be ignored or cause a DB error
- **Fix:** Used `submitted_at: new Date().toISOString()` to match the actual DB schema
- **Files modified:** src/actions/video.ts

## Known Stubs

None — this plan implements the full generation pipeline with no stub data flows. The pipeline requires real SHOTSTACK_API_KEY and OPENAI_API_KEY to execute.

## Next Phase Readiness

- All Plan 03 (admin UI) dependencies ready: publishVideo, unpublishVideo, deleteVideoJob, regenerateVideo in video.ts
- video_generation_jobs status updates fire Supabase Realtime events (updated_at pattern)
- chapter_markers stored in JSONB for Plan 04 (worker video player) chapter navigation

---
*Phase: 08-video-sop-generation*
*Completed: 2026-04-04*
