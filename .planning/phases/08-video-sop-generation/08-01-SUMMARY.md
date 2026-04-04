---
phase: 08-video-sop-generation
plan: "01"
subsystem: database, api, infra
tags: [postgres, supabase, openai, tts, shotstack, video-generation, storage, rls]

requires:
  - phase: 07-video-transcription-in-app-recording
    provides: video transcription pipeline, Phase 7 schema complete
  - phase: 04-completion-and-sign-off
    provides: sop_completions append-only table, completion_status enum

provides:
  - video_generation_jobs table with FSM status enum and idempotency constraint
  - sop_completions extended with completion_type discriminator and video_job_id FK
  - sop-generated-videos Storage bucket with org-scoped RLS
  - VideoGenerationJob, VideoGenStatus, VideoFormat, CompletionType, ChapterMarker TypeScript types
  - database.types.ts manually extended with video_generation_jobs
  - generateVideoSchema and recordVideoViewSchema Zod validators
  - src/lib/video-gen/types.ts: SectionWithAudio, ShotstackEdit, ShotstackClip, ShotstackRenderResponse
  - src/lib/video-gen/tts.ts: generateSectionAudio with gpt-4o-mini-tts and NZ pronunciation guidance
  - src/lib/video-gen/shotstack-client.ts: submitShotstackRender, getShotstackRender typed fetch wrappers

affects:
  - 08-02 (generation pipeline — consumes tts.ts, shotstack-client.ts, video_generation_jobs)
  - 08-03 (admin UI — reads video_generation_jobs types and status)
  - 08-04 (worker video player — uses VideoGenerationJob type and completion_type)

tech-stack:
  added: []
  patterns:
    - Lazy OpenAI client init (same pattern as gpt-parser.ts) applied to TTS module
    - Lazy Shotstack API key resolution to prevent build failure without env vars
    - Manual database.types.ts extension (consistent with Phase 3/6 pattern)
    - SHOTSTACK_API_URL env var for sandbox/production URL switching

key-files:
  created:
    - supabase/migrations/00013_video_generation.sql
    - src/lib/video-gen/types.ts
    - src/lib/video-gen/tts.ts
    - src/lib/video-gen/shotstack-client.ts
  modified:
    - src/types/sop.ts
    - src/types/database.types.ts
    - src/lib/validators/sop.ts

key-decisions:
  - "gpt-4o-mini-tts with nova voice for TTS — clear authoritative voice per research (D-08)"
  - "Direct fetch for Shotstack API — no @shotstack/shotstack-sdk dependency per research recommendation"
  - "SHOTSTACK_API_URL env var for sandbox URL override — allows dev/prod switching without code changes"
  - "video_generation_jobs UNIQUE(sop_id, format, sop_version) constraint for idempotency per D-14"
  - "sop-generated-videos bucket is private — presigned URLs required for playback per security requirement"

patterns-established:
  - "video-gen/ module dir: tts.ts, shotstack-client.ts, types.ts — parallel to parsers/ structure"
  - "Section-type-aware TTS instructions: hazards and emergency types get tone-specific guidance"
  - "Duration estimate: buffer.length / 4000 approximation for MP3 at ~32kbps"

requirements-completed:
  - VGEN-01
  - VGEN-02
  - VGEN-04
  - VGEN-06
  - VGEN-09
  - INFRA-03

duration: 3min
completed: "2026-04-04"
---

# Phase 08 Plan 01: Foundation — DB Migration, Types, TTS, Shotstack Summary

**video_generation_jobs table with FSM enum, sop_completions completion_type extension, gpt-4o-mini-tts narration module, and typed Shotstack fetch client**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-04T05:20:44Z
- **Completed:** 2026-04-04T05:24:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Database migration 00013 creates video_generation_jobs with idempotency UNIQUE constraint and Realtime enabled for live status polling
- sop_completions extended with completion_type discriminator and video_job_id FK to distinguish walkthrough completions from video view events
- sop-generated-videos private Storage bucket created with org-scoped RLS for secure video access
- TTS module generateSectionAudio uses gpt-4o-mini-tts + nova voice with NZ industrial pronunciation guidance (P-P-E, kilopascals, SCBA, MSDS) and section-type-aware tone instructions for hazards and emergency sections
- Shotstack client wraps render submission and status polling with typed interfaces; supports sandbox URL via SHOTSTACK_API_URL env var

## Task Commits

1. **Task 1: Database migration, TypeScript types, and Zod validators** - `4d67ed6` (feat)
2. **Task 2: TTS module and Shotstack API client with shared types** - `c095cf2` (feat)

**Plan metadata:** (recorded in final commit)

## Files Created/Modified

- `supabase/migrations/00013_video_generation.sql` - video_generation_jobs table, enums, RLS, Realtime, sop_completions extension, Storage bucket
- `src/types/sop.ts` - VideoGenStatus, VideoFormat, CompletionType, ChapterMarker, VideoGenerationJob types added
- `src/types/database.types.ts` - video_generation_jobs table type manually extended
- `src/lib/validators/sop.ts` - generateVideoSchema and recordVideoViewSchema Zod validators added
- `src/lib/video-gen/types.ts` - SectionWithAudio, ShotstackClip, ShotstackTrack, ShotstackEdit, ShotstackRenderResponse interfaces
- `src/lib/video-gen/tts.ts` - generateSectionAudio with lazy OpenAI init and NZ pronunciation guidance
- `src/lib/video-gen/shotstack-client.ts` - submitShotstackRender and getShotstackRender typed fetch wrappers

## Decisions Made

- Used direct fetch for Shotstack API (no SDK) per research recommendation — avoids vendor lock-in and reduces bundle size
- SHOTSTACK_API_URL env var allows sandbox/production switching without code changes
- TTS duration estimate uses buffer.length / 4000 (MP3 ~32kbps approximation) — noted in code as improvable if chapter timestamps need precision
- Both TTS and Shotstack client use lazy init pattern (same as gpt-parser.ts) to prevent build failure without env vars set

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

This plan introduces Shotstack as a new external service. Add to `.env.local`:

```
SHOTSTACK_API_KEY=your-shotstack-sandbox-or-production-key
# Optional: override for sandbox testing
SHOTSTACK_API_URL=https://api.shotstack.io/edit/v1
```

Get your API key from: shotstack.io → Dashboard → API Keys

## Known Stubs

None — this plan establishes infrastructure modules with no UI or stub data flows.

## Next Phase Readiness

- All infrastructure Plan 02 (generation pipeline) depends on is ready:
  - video_generation_jobs table with correct schema
  - TTS module (generateSectionAudio) ready to consume
  - Shotstack client (submitShotstackRender, getShotstackRender) ready to consume
  - Shared types (SectionWithAudio, ShotstackEdit, etc.) exported
- TypeScript compiles clean, npm build passes

---
*Phase: 08-video-sop-generation*
*Completed: 2026-04-04*
