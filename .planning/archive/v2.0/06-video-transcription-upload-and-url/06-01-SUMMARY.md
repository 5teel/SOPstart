---
phase: 06-video-transcription-upload-and-url
plan: "01"
subsystem: video-pipeline-foundation
tags: [database, types, validators, parsers, dependencies, ffmpeg, anthropic]
dependencies:
  requires: []
  provides:
    - parse_jobs video columns (current_stage, transcript_segments, transcript_text, verification_flags, youtube_url)
    - sop-videos storage bucket with RLS
    - SourceFileType 'video' union member
    - InputType 'video_file' and 'youtube_url' union members
    - VideoProcessingStage, TranscriptSegment, VerificationFlag TypeScript types
    - ParseJob extended with video fields
    - uploadVideoFileSchema and youtubeUrlSchema validators
    - extractYouTubeId utility
    - GPT parser video format hint
    - "@anthropic-ai/sdk in serverExternalPackages"
    - FFmpeg WASM binaries in public/ffmpeg/
  affects:
    - src/lib/parsers/gpt-parser.ts (FORMAT_HINTS extended, lazy OpenAI init)
    - src/components/admin/OriginalDocViewer.tsx (SourceFileType import)
tech-stack:
  added:
    - "@ffmpeg/ffmpeg ^0.12.15 — client-side WASM audio extraction"
    - "@ffmpeg/util ^0.12.2 — FFmpeg WASM utilities"
    - "@ffmpeg/core ^0.12.10 — FFmpeg WASM binaries"
    - "youtube-transcript ^1.3.0 — YouTube caption fetching"
    - "@anthropic-ai/sdk ^0.82.0 — adversarial verification via Claude"
  patterns:
    - Lazy OpenAI client initialization to avoid module-load throws during Next.js static analysis
    - Cross-platform Node.js postinstall script (not bash) for Windows compatibility
    - DO $$ EXCEPTION WHEN OTHERS THEN NULL $$ pattern for safe named constraint removal in Postgres
key-files:
  created:
    - supabase/migrations/00012_video_transcription.sql
    - scripts/copy-ffmpeg.js
  modified:
    - src/types/sop.ts
    - src/lib/validators/sop.ts
    - src/lib/parsers/gpt-parser.ts
    - src/components/admin/OriginalDocViewer.tsx
    - next.config.ts
    - package.json
    - .gitignore
decisions:
  - "@ffmpeg/core installed as explicit dependency (not transitive via @ffmpeg/ffmpeg)"
  - "Lazy OpenAI init chosen over env-check to allow build without credentials"
  - "Migration 00012 is idempotent with/without 00011 applied using DROP CONSTRAINT IF EXISTS and ADD COLUMN IF NOT EXISTS"
  - "WASM binaries in public/ffmpeg/ excluded from git via .gitignore (30MB+)"
metrics:
  duration: "557s"
  completed: "2026-04-03"
  tasks_completed: 2
  files_modified: 7
  files_created: 2
---

# Phase 06 Plan 01: Video Transcription Foundation Summary

Video pipeline foundation: DB migration with video columns and sop-videos bucket, TypeScript type extensions for video pipeline, FFmpeg/YouTube/Anthropic SDK dependencies, and GPT parser video format hint.

## What Was Built

**Task 1 — Database migration, type extensions, validator updates, GPT video hint:**

Migration `00012_video_transcription.sql` extends the database to support video-sourced SOPs:
- `parse_jobs.file_type` constraint extended to include `'video'` (idempotent — handles both phase-4-only and phase-5+ databases)
- `parse_jobs.input_type` column added (idempotent with 00011) with extended constraint to include `'video_file'` and `'youtube_url'`
- `sops.source_file_type` constraint extended to include `'video'`
- New columns on `parse_jobs`: `current_stage text`, `transcript_segments jsonb`, `transcript_text text`, `verification_flags jsonb`, `youtube_url text`, `updated_at timestamptz`
- `sop-videos` storage bucket created (private) with RLS policies for authenticated upload and read

`src/types/sop.ts` extended with:
- `SourceFileType` union now includes `'video'`
- `InputType` union now includes `'video_file' | 'youtube_url'`
- New `VideoProcessingStage` type (uploading → extracting_audio → transcribing → structuring → verifying → completed/failed)
- New `TranscriptSegment` interface (start/end seconds, text)
- New `VerificationFlag` interface (severity, section_title, step_number, original_text, structured_text, description)
- `ParseJob` interface extended with all video columns as optional fields

`src/lib/validators/sop.ts` extended with:
- `video/mp4` and `video/quicktime` MIME types in `ACCEPTED_TYPES`
- `MAX_VIDEO_FILE_SIZE = 2GB` constant
- `uploadVideoFileSchema` — validates video file name, size (2GB), and MIME type
- `youtubeUrlSchema` — validates YouTube URL formats (youtube.com, youtu.be, m.youtube.com)
- `extractYouTubeId` — extracts video ID from all YouTube URL formats including shorts
- `getSourceFileType` extended with video MIME type → `'video'` mapping

`src/lib/parsers/gpt-parser.ts` extended with `video` FORMAT_HINT for transcript-sourced SOP parsing (spoken language instructions vs written prose).

`next.config.ts` updated with `serverExternalPackages` including `@anthropic-ai/sdk`.

**Task 2 — npm packages, FFmpeg WASM setup:**

Four new packages installed: `@ffmpeg/ffmpeg`, `@ffmpeg/util`, `@ffmpeg/core`, `youtube-transcript`, `@anthropic-ai/sdk`.

`scripts/copy-ffmpeg.js` created — cross-platform Node.js script (not bash, for Windows compatibility) that copies `ffmpeg-core.js` and `ffmpeg-core.wasm` from `node_modules/@ffmpeg/core/dist/umd/` to `public/ffmpeg/`.

`postinstall` hook added to `package.json` to run copy script on fresh `npm install`.

`.gitignore` updated to exclude `public/ffmpeg/` (binary files 30MB+).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] OriginalDocViewer type mismatch**
- **Found during:** Task 1
- **Issue:** `src/components/admin/OriginalDocViewer.tsx` declared `sourceFileType: 'docx' | 'pdf' | 'image'` as a literal union instead of importing `SourceFileType`. After extending `SourceFileType` to include `'video'`, TypeScript reported a type mismatch because the prop type didn't match the extended union.
- **Fix:** Added `import type { SourceFileType } from '@/types/sop'` and changed prop type to `SourceFileType`.
- **Files modified:** `src/components/admin/OriginalDocViewer.tsx`
- **Commit:** f2b88c3

**2. [Rule 1 - Bug] OpenAI client module-level initialization breaks Next.js build**
- **Found during:** Task 2 (build verification)
- **Issue:** `gpt-parser.ts` initialized `const openai = new OpenAI()` at module scope. When `OPENAI_API_KEY` is not set in the build environment, this throws `Missing credentials` during Next.js static analysis of API routes, causing the build to fail.
- **Fix:** Changed to lazy initialization — `openai` is `null` initially, initialized inside `getOpenAI()` function which is called at request time.
- **Files modified:** `src/lib/parsers/gpt-parser.ts`
- **Commit:** f2b88c3

**3. [Rule 2 - Missing functionality] Phase 5 types included in phase 6 worktree**
- **Found during:** Task 1 setup
- **Issue:** This worktree was branched from phase 4 (before phase 5 expanded file intake). The plan's interfaces described phase 5 state (SourceFileType with xlsx/pptx/txt). The worktree's files were at phase 4 state.
- **Fix:** Types, validators, gpt-parser, and migration were all brought to phase 5+6 state together. Migration 00012 is idempotent — uses `IF NOT EXISTS` and `DROP CONSTRAINT IF EXISTS` patterns so it applies correctly whether or not migration 00011 was run.
- **Files modified:** All files in Task 1
- **Commit:** 37d014a

**4. [Rule 3 - Blocking] @ffmpeg/core not a transitive dependency**
- **Found during:** Task 2
- **Issue:** `@ffmpeg/core` is not automatically installed as a transitive dep of `@ffmpeg/ffmpeg`. The copy script would fail without it.
- **Fix:** Explicitly installed `@ffmpeg/core` as a direct dependency.
- **Commit:** f2b88c3

## Known Stubs

None — this plan is entirely infrastructure (schema, types, dependencies). No UI stubs or placeholder data sources.

## Self-Check: PASSED

- `supabase/migrations/00012_video_transcription.sql` — EXISTS
- `scripts/copy-ffmpeg.js` — EXISTS
- `src/types/sop.ts` contains `export type SourceFileType = '...' | 'video'` — VERIFIED
- `src/lib/validators/sop.ts` contains `video/mp4`, `uploadVideoFileSchema`, `youtubeUrlSchema`, `extractYouTubeId` — VERIFIED
- `src/lib/parsers/gpt-parser.ts` contains `video:` FORMAT_HINT — VERIFIED
- `next.config.ts` contains `@anthropic-ai/sdk` in serverExternalPackages — VERIFIED
- Commit 37d014a — FOUND
- Commit f2b88c3 — FOUND
- `npm run build` exits 0 — VERIFIED
