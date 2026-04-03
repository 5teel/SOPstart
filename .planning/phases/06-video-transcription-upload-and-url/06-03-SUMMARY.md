---
phase: 06-video-transcription-upload-and-url
plan: "03"
subsystem: ui
tags: [video, upload, youtube, ffmpeg, tus, dropzone, stepper, react]

requires:
  - phase: 06-01
    provides: VideoProcessingStage type, youtubeUrlSchema validator, video MIME types in validators
  - phase: 06-02
    provides: createVideoUploadSession server action, /api/sops/youtube route, /api/sops/transcribe route

provides:
  - UploadDropzone with video MIME types (mp4/mov), YouTube URL tab, video upload flow
  - ParseJobStatus with 5-step video processing stepper
  - TusUploadProgress component (phase 5 parallel)
  - tus-upload.ts TUS resumable upload helper (phase 5 parallel)
  - extract-video-audio.ts FFmpeg WASM client-side audio extraction

affects:
  - 06-04-PLAN (video review UI — will use ParseJobStatus extended props)

tech-stack:
  added:
    - "tus-js-client ^4.3.1 — TUS resumable upload protocol"
    - "@ffmpeg/ffmpeg ^0.12.15 — client-side WASM audio extraction"
    - "@ffmpeg/util ^0.12.2 — FFmpeg WASM utilities"
    - "@ffmpeg/core ^0.12.10 — FFmpeg WASM binaries"
    - "heic2any ^0.0.4 — HEIC to JPEG conversion"
  patterns:
    - "Tab bar UI pattern: role=tablist + role=tab + aria-selected for accessible mode switching"
    - "Dynamic import for FFmpeg WASM — avoids loading 30MB+ WASM unless video is actually uploaded"
    - "Video upload split into two phases: extraction progress (0-50%) + TUS upload (50-100%)"
    - "Realtime + polling hybrid: file_type and current_stage read from parse_jobs for video detection"

key-files:
  created:
    - src/lib/upload/tus-upload.ts
    - src/lib/parsers/extract-video-audio.ts
    - src/components/admin/TusUploadProgress.tsx
  modified:
    - src/components/admin/UploadDropzone.tsx
    - src/components/admin/ParseJobStatus.tsx
    - src/actions/sops.ts
    - src/lib/parsers/gpt-parser.ts
    - package.json

key-decisions:
  - "Dynamic import for extractAudioFromVideo: avoids loading FFmpeg WASM bundle unless user actually uploads a video file"
  - "Video upload progress split 50/50 between extraction and TUS upload for consistent UX"
  - "Parallel wave 2 includes Phase 5 additions (TUS helper, HEIC conversion, scan button) since this worktree branched from Phase 4"
  - "createVideoUploadSession added to sops.ts in Plan 03 (parallel to Plan 02 which also adds it) — merge will deduplicate"

patterns-established:
  - "YouTube URL validation: client-side hostname check (youtube.com/youtu.be/m.youtube.com) before server fetch"
  - "Role-tab/tabpanel ARIA pattern for Upload file / YouTube URL mode switching"
  - "Video stepper: completed=green-400, active=brand-yellow+font-semibold, pending=steel-600, line=brand-yellow/steel-700"
  - "Failed stage parsed from error_message format 'Failed at {stage}: {message}'"

requirements-completed:
  - VID-01
  - VID-02
  - VID-04

duration: ~25min
completed: 2026-04-03
---

# Phase 06 Plan 03: Upload UI and Parse Status Summary

**Upload dropzone extended with video MIME types, YouTube URL tab, and FFmpeg WASM audio extraction; ParseJobStatus extended with 5-step video processing stepper, elapsed timer, and stage-specific failure/retry UI.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-04-03
- **Tasks:** 2
- **Files modified:** 7
- **Files created:** 3

## Accomplishments

- `UploadDropzone` accepts MP4/MOV files up to 2GB with purple Video icon, separate video upload flow (FFmpeg audio extraction → TUS upload to sop-videos bucket)
- Upload/YouTube URL tab bar with brand-yellow active indicator, YouTube form with URL input, terms checkbox, "Transcribe from YouTube" CTA
- YouTube URL validation: hostname check (youtube.com variants), empty URL check, invalid URL check with user-friendly error messages
- `ParseJobStatus` displays 5-step horizontal stepper (Uploading → Extracting → Transcribing → Structuring → Verifying) for video SOPs
- Stepper shows completed steps in green-400, active step in brand-yellow+semibold, pending in steel-600, connecting lines in brand-yellow/steel-700
- Transcribing stage shows elapsed seconds counter; verifying stage uses brand-orange spinner
- Failed state shows "Retry from {stage}" and "Delete" links parsed from error_message format

## Task Commits

1. **Task 1: Extend UploadDropzone** - `edeb4b4` (feat)
2. **Task 2: Extend ParseJobStatus** - `5ff9965` (feat)
3. **Bug fixes + package installs** - `8c5ca7f` (fix)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified

- `src/components/admin/UploadDropzone.tsx` — Extended with video MIME types, YouTube URL tab, video upload flow, tab bar UI
- `src/components/admin/ParseJobStatus.tsx` — Extended with VIDEO_STAGES stepper, elapsed timer, video-specific status displays
- `src/lib/upload/tus-upload.ts` — TUS resumable upload helper (Supabase TUS endpoint, 6MB chunks)
- `src/lib/parsers/extract-video-audio.ts` — FFmpeg WASM client-side audio extraction (mp3 mono, VBR quality 4)
- `src/components/admin/TusUploadProgress.tsx` — Progress bar component for TUS upload percentage display
- `src/actions/sops.ts` — Added `createVideoUploadSession` server action
- `src/lib/parsers/gpt-parser.ts` — Fixed module-level OpenAI initialization to lazy init
- `package.json` — Added tus-js-client, @ffmpeg/ffmpeg, @ffmpeg/util, @ffmpeg/core, heic2any

## Decisions Made

- Dynamic import for `extractAudioFromVideo` — avoids loading FFmpeg WASM (30MB+) unless video file actually dropped or selected
- Video upload progress split 50/50 between extraction (0-50%) and TUS upload (50-100%) for consistent progress bar feel
- `createVideoUploadSession` added here as parallel wave 2 worktree includes it — merge will deduplicate with Plan 02

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing npm packages for UploadDropzone imports**
- **Found during:** Task 1 verification (build run)
- **Issue:** `tus-js-client`, `@ffmpeg/ffmpeg`, `@ffmpeg/util`, `@ffmpeg/core`, `heic2any` were not in package.json — this worktree branched from Phase 4 before Phase 5 installed them
- **Fix:** Ran `npm install tus-js-client @ffmpeg/ffmpeg @ffmpeg/util @ffmpeg/core heic2any --save`
- **Files modified:** `package.json`, `package-lock.json`
- **Verification:** Build passes after install
- **Committed in:** 8c5ca7f

**2. [Rule 1 - Bug] ParseJobStatus TypeScript error on initial fetch**
- **Found during:** Overall build verification
- **Issue:** `supabase.from('parse_jobs').maybeSingle()` return type inferred as `never` because generated `database.types.ts` doesn't include `current_stage` or `file_type` columns (Phase 6 DB migration not applied to generated types in this worktree)
- **Fix:** Cast `data` as explicit interface type before accessing properties
- **Files modified:** `src/components/admin/ParseJobStatus.tsx`
- **Committed in:** 8c5ca7f

**3. [Rule 1 - Bug] extract-video-audio.ts FileData type incompatibility**
- **Found during:** Overall build verification
- **Issue:** FFmpeg's `readFile` returns `FileData` which is `Uint8Array | string`. Passing `data` directly to `new File([data])` fails because `Uint8Array.buffer` is `ArrayBufferLike` (includes `SharedArrayBuffer`) not `ArrayBuffer`
- **Fix:** Cast `data as Uint8Array` then `buffer.buffer as ArrayBuffer`
- **Files modified:** `src/lib/parsers/extract-video-audio.ts`
- **Committed in:** 8c5ca7f

**4. [Rule 1 - Bug] gpt-parser.ts module-level OpenAI initialization**
- **Found during:** Overall build verification
- **Issue:** `const openai = new OpenAI()` at module scope throws `Missing credentials` during Next.js static analysis when `OPENAI_API_KEY` not in build environment. This is the same bug fixed by Plan 01 in its worktree.
- **Fix:** Changed to lazy initialization via `getOpenAI()` function called at request time
- **Files modified:** `src/lib/parsers/gpt-parser.ts`
- **Committed in:** 8c5ca7f

---

**Total deviations:** 4 auto-fixed (3 Rule 1 bugs, 1 Rule 3 blocking)
**Impact on plan:** All fixes required for build to pass. Parallel wave 2 worktree starting from Phase 4 was the root cause for items 1 and 4.

## Issues Encountered

Build errors from parallel wave 2 execution starting from Phase 4 base: missing Phase 5/6 packages, missing DB column types in generated types, and pre-existing OpenAI init bug. All resolved inline.

## Known Stubs

None — the YouTube URL form POSTs to `/api/sops/youtube` which will be created by Plan 02. The video upload calls `createVideoUploadSession` which is also added by Plan 02. When wave 2 merges, these will connect. The form UI is fully wired with error handling and all states.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 04 (video review UI) can use extended `ParseJobStatus` with `initialStage`, `initialIsVideo`, `onRetry`, `onDelete` props
- Video upload flow ready once Plan 02 (transcription pipeline) merges: `/api/sops/transcribe` and `/api/sops/youtube` routes will exist
- `createVideoUploadSession` will be deduplicated at merge time

---

## Self-Check: PASSED

- `src/components/admin/UploadDropzone.tsx` — FOUND
- `src/components/admin/ParseJobStatus.tsx` — FOUND
- `src/lib/upload/tus-upload.ts` — FOUND
- `src/lib/parsers/extract-video-audio.ts` — FOUND
- `src/components/admin/TusUploadProgress.tsx` — FOUND
- Commit edeb4b4 — FOUND
- Commit 5ff9965 — FOUND
- Commit 8c5ca7f — FOUND
- `npm run build` exits 0 — VERIFIED

---
*Phase: 06-video-transcription-upload-and-url*
*Completed: 2026-04-03*
