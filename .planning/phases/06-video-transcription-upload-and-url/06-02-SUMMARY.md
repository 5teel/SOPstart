---
phase: 06-video-transcription-upload-and-url
plan: "02"
subsystem: video-pipeline-backend
tags: [openai, anthropic, youtube, ffmpeg, transcription, verification, api-routes]
dependencies:
  requires:
    - phase: 06-video-transcription-upload-and-url plan 01
      provides: TranscriptSegment, VerificationFlag, VideoProcessingStage types, parse_jobs video columns, sop-videos bucket, youtubeUrlSchema, extractYouTubeId, gpt-parser video hint, @anthropic-ai/sdk, youtube-transcript, @ffmpeg packages
  provides:
    - extractAudioFromVideo: client-side FFmpeg WASM helper (extract-video-audio.ts)
    - transcribeAudio: OpenAI gpt-4o-transcribe wrapper with NZ vocabulary (transcribe-audio.ts)
    - fetchYouTubeTranscript: YouTube caption fetch wrapper (fetch-youtube-transcript.ts)
    - verifyTranscriptVsSop + detectMissingSections: adversarial verification via Claude (verify-sop.ts)
    - POST /api/sops/transcribe: 5-stage video transcription pipeline route
    - POST /api/sops/youtube: YouTube caption ingestion route with server-side auth
    - createVideoUploadSession: server action for video upload session creation
  affects:
    - 06-03 (upload UI calls createVideoUploadSession and /api/sops/transcribe)
    - 06-04 (review UI reads transcript_segments and verification_flags from parse_jobs)
tech-stack:
  added: []
  patterns:
    - Lazy Anthropic client initialization (same pattern as lazy OpenAI in gpt-parser.ts)
    - Json cast pattern for storing typed arrays in Supabase JSONB columns
    - Zod .issues[0]?.message pattern (not .errors which was removed from ZodError API)
key-files:
  created:
    - src/lib/parsers/extract-video-audio.ts
    - src/lib/parsers/transcribe-audio.ts
    - src/lib/parsers/fetch-youtube-transcript.ts
    - src/lib/parsers/verify-sop.ts
    - src/app/api/sops/transcribe/route.ts
    - src/app/api/sops/youtube/route.ts
  modified:
    - src/actions/sops.ts (createVideoUploadSession added)
    - src/types/database.types.ts (parse_jobs extended with video columns)
    - src/lib/parsers/extract-image.ts (lazy OpenAI init bug fix)
key-decisions:
  - "Lazy Anthropic client init (same pattern as gpt-parser.ts lazy OpenAI) — prevents build failure without ANTHROPIC_API_KEY"
  - "database.types.ts manually extended with parse_jobs video columns — type regeneration not available in worktree environment"
  - "Json cast (as unknown as Json) for storing TranscriptSegment[]/VerificationFlag[] in JSONB columns — Supabase types require Json, not typed arrays"
  - "ZodError.issues[0] not .errors[0] — .errors property removed from ZodError in current Zod version"
  - "verifyTranscriptVsSop failure is non-blocking — returns [] on error (verification is additive, not gating per D-04)"
requirements-completed:
  - VID-01
  - VID-02
  - VID-04
  - VID-06
  - VID-07
duration: "471s"
completed: "2026-04-03"
---

# Phase 06 Plan 02: Video Transcription Backend Summary

gpt-4o-transcribe audio pipeline with adversarial Claude verification, YouTube caption ingestion, and server-side auth route handlers for both video sources.

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-03T06:58:03Z
- **Completed:** 2026-04-03T07:05:54Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Four parser modules: client-side FFmpeg WASM audio extraction, OpenAI gpt-4o-transcribe with NZ industrial vocabulary, YouTube caption fetch, and adversarial Claude verification
- Video transcription API route (`/api/sops/transcribe`) orchestrating 5 stages: extracting_audio → transcribing → structuring → verifying → completed
- YouTube caption route (`/api/sops/youtube`) with server-side auth deriving organisationId/uploadedBy from JWT (never from client body)
- `createVideoUploadSession` server action creating SOP + parse_job records targeting `sop-videos` bucket
- Build passes with TypeScript checks after fixing pre-existing lazy-init bug in `extract-image.ts`

## Task Commits

1. **Task 1: Audio transcription, YouTube caption fetch, and adversarial verification modules** - `27a1d75` (feat)
2. **Task 2: Video transcription and YouTube caption route handlers + server action extension** - `c0b71a9` (feat)

**Plan metadata:** (to be committed with this SUMMARY)

## Files Created/Modified

- `src/lib/parsers/extract-video-audio.ts` — Client-side FFmpeg WASM audio extraction, singleton pattern, mono MP3
- `src/lib/parsers/transcribe-audio.ts` — OpenAI gpt-4o-transcribe, NZ industrial vocabulary prompt, 20MB guard
- `src/lib/parsers/fetch-youtube-transcript.ts` — YouTube caption fetch, ms→seconds conversion, graceful noCaption handling
- `src/lib/parsers/verify-sop.ts` — Anthropic Claude adversarial verification + detectMissingSections for hazard/PPE
- `src/app/api/sops/transcribe/route.ts` — 5-stage video pipeline: download audio → transcribe → structure → verify → write
- `src/app/api/sops/youtube/route.ts` — YouTube caption pipeline with server-side auth (createClient + getUser + JWT claims)
- `src/actions/sops.ts` — Added `createVideoUploadSession` targeting sop-videos bucket
- `src/types/database.types.ts` — Manually extended parse_jobs Row/Insert/Update with video columns
- `src/lib/parsers/extract-image.ts` — [Rule 1 Bug Fix] Lazy OpenAI init to prevent build failure

## Decisions Made

- **Lazy Anthropic init** — Same pattern as gpt-parser.ts lazy OpenAI: initialized inside `getAnthropic()` function called at request time. Prevents build-time throws when `ANTHROPIC_API_KEY` is absent.
- **database.types.ts manually extended** — Type regeneration requires live Supabase connection (not available in worktree). Followed established project pattern (Phase 3 and 4 did the same).
- **Json cast for typed arrays** — `segments as unknown as Json` required for Supabase JSONB columns. TypeScript rejects `TranscriptSegment[]` → `Json` direct assignment because `TranscriptSegment` lacks string index signature.
- **verifyTranscriptVsSop non-blocking** — Per D-04: verification failures return `[]` rather than throwing. Verification is additive (informs the review UI), not a gate that blocks SOP creation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] database.types.ts not extended with video columns**
- **Found during:** Task 2 (video transcription route handler)
- **Issue:** Plan 06-01 extended `src/types/sop.ts` with video types but did not extend `database.types.ts`. When the route handlers called `.update({ current_stage: ... })` on `parse_jobs`, TypeScript raised a type error: property `current_stage` does not exist in parse_jobs update type.
- **Fix:** Manually extended `parse_jobs` Row/Insert/Update in `database.types.ts` with all 7 video columns from migration 00012 (current_stage, input_type, transcript_segments, transcript_text, verification_flags, youtube_url, updated_at).
- **Files modified:** `src/types/database.types.ts`
- **Verification:** TypeScript build passes after fix.
- **Committed in:** c0b71a9

**2. [Rule 1 - Bug] extract-image.ts module-level OpenAI initialization breaks build**
- **Found during:** Task 2 build verification
- **Issue:** `src/lib/parsers/extract-image.ts` (added in Phase 5) had `const openai = new OpenAI()` at module scope. Without `OPENAI_API_KEY` in the build environment, Next.js static analysis throws "Missing credentials" when collecting page data for `/api/sops/parse`.
- **Fix:** Applied same lazy initialization pattern as `gpt-parser.ts`: null-initialized variable + `getOpenAI()` getter function called at request time.
- **Files modified:** `src/lib/parsers/extract-image.ts`
- **Verification:** Build succeeds (parse route collected successfully).
- **Committed in:** c0b71a9

**3. [Rule 1 - Bug] ZodError.errors not a valid property**
- **Found during:** Task 2 TypeScript check
- **Issue:** YouTube route used `urlResult.error.errors[0]?.message` but `ZodError` in current Zod version removed the `.errors` alias — use `.issues`.
- **Fix:** Changed `.errors[0]` to `.issues[0]`.
- **Files modified:** `src/app/api/sops/youtube/route.ts`
- **Verification:** TypeScript type check passes.
- **Committed in:** c0b71a9

**4. [Rule 1 - Bug] FFmpeg readFile type incompatible with File constructor**
- **Found during:** Task 2 TypeScript check
- **Issue:** `ffmpeg.readFile()` returns `FileData` (Uint8Array | string). TypeScript rejected passing this directly to `new File([data], ...)` due to `Uint8Array<ArrayBufferLike>` incompatibility with `BlobPart`.
- **Fix:** Cast `data as BlobPart` in the File constructor call.
- **Files modified:** `src/lib/parsers/extract-video-audio.ts`
- **Verification:** TypeScript type check passes.
- **Committed in:** c0b71a9

---

**Total deviations:** 4 auto-fixed (2 blocking, 2 bug)
**Impact on plan:** All fixes necessary for TypeScript correctness and build success. No scope creep.

## Issues Encountered

- Worktree had no `node_modules` (packages installed in a different agent worktree during Plan 01). Required `npm install` before build verification.
- Worktree was branched from phase 4 and needed to `git merge master` to pull in Phase 5 and Phase 06-01 changes before implementation could begin.

## Known Stubs

None — all modules are real implementations with live API integrations. No placeholder data or hardcoded empty values.

## Next Phase Readiness

- Plan 03 (video upload UI) can now call `createVideoUploadSession` server action and `POST /api/sops/transcribe`
- Plan 04 (transcript review UI) can now read `transcript_segments` and `verification_flags` from `parse_jobs`
- `extractAudioFromVideo` is ready for use in the upload UI component (requires `public/ffmpeg/` WASM binaries from `npm install`)

## Self-Check: PASSED

- `src/lib/parsers/extract-video-audio.ts` — EXISTS
- `src/lib/parsers/transcribe-audio.ts` — EXISTS
- `src/lib/parsers/fetch-youtube-transcript.ts` — EXISTS
- `src/lib/parsers/verify-sop.ts` — EXISTS
- `src/app/api/sops/transcribe/route.ts` — EXISTS
- `src/app/api/sops/youtube/route.ts` — EXISTS
- `createVideoUploadSession` in `src/actions/sops.ts` — VERIFIED
- Commit 27a1d75 — FOUND
- Commit c0b71a9 — FOUND
- `npm run build` exits 0 — VERIFIED (routes appear in build output)

---
*Phase: 06-video-transcription-upload-and-url*
*Completed: 2026-04-03*
