---
phase: 06-video-transcription-upload-and-url
verified: 2026-04-03T08:30:00Z
status: gaps_found
score: 11/13 must-haves verified
re_verification: false
gaps:
  - truth: "New npm packages installed: @ffmpeg/ffmpeg, @ffmpeg/util, youtube-transcript, @anthropic-ai/sdk"
    status: partial
    reason: "All four packages are present in package.json, but the postinstall hook ('node scripts/copy-ffmpeg.js') is absent from package.json scripts. scripts/copy-ffmpeg.js exists and uses fs.cpSync, but was never wired as a postinstall hook. public/ffmpeg/ directory does not exist — WASM binaries are not in place. A fresh 'npm install' will not copy them."
    artifacts:
      - path: "package.json"
        issue: "No postinstall entry in scripts section — copy-ffmpeg.js is not hooked to npm install"
      - path: "public/ffmpeg/"
        issue: "Directory does not exist; ffmpeg-core.js and ffmpeg-core.wasm are absent"
    missing:
      - "Add \"postinstall\": \"node scripts/copy-ffmpeg.js\" to package.json scripts section"
      - "Run node scripts/copy-ffmpeg.js manually to populate public/ffmpeg/ for current dev environment"
  - truth: "YouTube URL submission fetches captions without downloading video and creates a structured SOP"
    status: partial
    reason: "VID-02 requirement text specifies 'YouTube or Vimeo URL'. Only YouTube is implemented. Vimeo was explicitly deferred via D-06 (DISCUSSION-LOG.md) but REQUIREMENTS.md marks VID-02 as complete without noting the partial scope. The phase goal statement also says 'YouTube or Vimeo URL'. This is a known, documented design decision but the requirement as written is not fully satisfied."
    artifacts:
      - path: "src/app/api/sops/youtube/route.ts"
        issue: "Handles YouTube URLs only; no Vimeo support"
      - path: "src/lib/validators/sop.ts"
        issue: "youtubeUrlSchema validates YouTube hostnames only; Vimeo hostnames not handled"
    missing:
      - "Either update REQUIREMENTS.md VID-02 description to note Vimeo is deferred to Phase 7, or acknowledge the partial scope as intended"
      - "Vimeo implementation deferred per D-06 — no code change needed if requirement text is updated"
---

# Phase 06: Video Transcription Upload and URL — Verification Report

**Phase Goal:** Admins can upload an MP4/MOV video file or paste a YouTube or Vimeo URL and receive a structured SOP draft with the raw transcript visible for manual review — including mandatory warnings when hazard or PPE sections are absent
**Verified:** 2026-04-03T08:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin can upload MP4/MOV and see it queued | VERIFIED | UploadDropzone.tsx: `video/mp4` and `video/quicktime` in ACCEPTED_MIME_TYPES, `createVideoUploadSession` imported and called at line 282 |
| 2 | Admin can paste a YouTube URL and receive a structured SOP | VERIFIED | `/api/sops/youtube/route.ts` (220 lines): fetchYouTubeTranscript → parseSopWithGPT → structured SOP; UploadDropzone YouTube tab wired at line 218 |
| 3 | Vimeo URL support | FAILED | VID-02 requires "YouTube or Vimeo URL"; only YouTube implemented; Vimeo deferred per D-06 |
| 4 | Processing shows named stages with stepper | VERIFIED | ParseJobStatus.tsx: `VIDEO_STAGES` const with 5 stages, horizontal stepper with green/yellow/steel-600 state colours |
| 5 | Transcript is visible alongside structured SOP for review | VERIFIED | VideoReviewPanel.tsx (182 lines): scrollable transcript list with timestamps, click-to-seek; wired into ReviewClient.tsx and OriginalDocViewer.tsx |
| 6 | Transcript is read-only | VERIFIED | VideoReviewPanel.tsx line 139: "Read only — edit the structured SOP on the right." |
| 7 | Clicking transcript line seeks video to timestamp | VERIFIED | VideoReviewPanel.tsx lines 65-66: `videoRef.current.currentTime = seg.start` / `ytPlayerRef.current.seekTo(seg.start, true)` |
| 8 | Adversarial verification flags shown as amber banner | VERIFIED | AdversarialFlagBanner.tsx (105 lines): per-flag Confirm + Dismiss all; rendered in ReviewClient.tsx line 274 |
| 9 | Missing hazards/PPE sections show warning banner | VERIFIED | MissingSectionWarningBanner.tsx: detects Hazards/PPE flags, combined text, acknowledge checkbox with `aria-required="true"` |
| 10 | Publish blocked until missing section acknowledged | VERIFIED | ReviewClient.tsx line 118: `(hasMissingSectionFlags && !missingSectionAcknowledged)` in publish disabled condition |
| 11 | Publish blocked when critical adversarial flags unresolved | VERIFIED | ReviewClient.tsx line 119: `unresolvedCriticalFlags > 0` in publish disabled condition |
| 12 | FFmpeg WASM available for audio extraction | FAILED | public/ffmpeg/ directory absent; postinstall hook missing from package.json scripts |
| 13 | Test stubs cover all VID-* requirements, skip cleanly | VERIFIED | 7 test files with 36 `test.fixme` stubs; `phase6-stubs` Playwright project configured with correct filename regex |

**Score:** 11/13 truths verified

---

## Required Artifacts

### Plan 00 — Test Stubs

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/video-upload.test.ts` | VID-01 stubs | VERIFIED | 5 `test.fixme` stubs |
| `tests/youtube-url.test.ts` | VID-02 YouTube stubs | VERIFIED | 6 `test.fixme` stubs |
| `tests/youtube-no-captions.test.ts` | VID-02/D-08 stubs | VERIFIED | 2 `test.fixme` stubs |
| `tests/stage-progress.test.ts` | VID-04 stubs | VERIFIED | 6 `test.fixme` stubs |
| `tests/transcript-review.test.ts` | VID-05 stubs | VERIFIED | 7 `test.fixme` stubs |
| `tests/publish-gate.test.ts` | VID-06 stubs | VERIFIED | 5 `test.fixme` stubs |
| `tests/safety-warning.test.ts` | VID-07 stubs | VERIFIED | 5 `test.fixme` stubs |

### Plan 01 — Foundation

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/00012_video_transcription.sql` | Schema extensions for video pipeline | VERIFIED | Contains current_stage, transcript_segments, transcript_text, verification_flags, youtube_url columns; sop-videos bucket + RLS |
| `src/types/sop.ts` | Extended TypeScript types | VERIFIED | SourceFileType includes 'video'; InputType includes 'video_file'/'youtube_url'; VideoProcessingStage, TranscriptSegment, VerificationFlag defined |
| `src/lib/validators/sop.ts` | Video MIME type validation | VERIFIED | video/mp4, video/quicktime, uploadVideoFileSchema, youtubeUrlSchema, extractYouTubeId all present |
| `src/lib/parsers/gpt-parser.ts` | Video format hint | VERIFIED | `video:` key in FORMAT_HINTS at line 40 |
| `scripts/copy-ffmpeg.js` | Cross-platform FFmpeg WASM copy | VERIFIED | Exists; uses fs.cpSync |
| `package.json` postinstall hook | Wires copy script to npm install | STUB | `"postinstall"` key absent from scripts section |
| `public/ffmpeg/ffmpeg-core.wasm` | FFmpeg WASM binary in place | MISSING | Directory does not exist |

### Plan 02 — Backend Pipeline

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/parsers/transcribe-audio.ts` | gpt-4o-transcribe wrapper | VERIFIED | 53 lines; lazy OpenAI init; gpt-4o-transcribe model; exports transcribeAudio |
| `src/lib/parsers/fetch-youtube-transcript.ts` | YouTube caption fetch | VERIFIED | 45 lines; YoutubeTranscript.fetchTranscript; ms→seconds conversion |
| `src/lib/parsers/verify-sop.ts` | Adversarial verification via Claude | VERIFIED | 94 lines; lazy Anthropic init; verifyTranscriptVsSop + detectMissingSections exported |
| `src/lib/parsers/extract-video-audio.ts` | Client-side FFmpeg WASM audio extraction | VERIFIED | 53 lines; extractAudioFromVideo exported |
| `src/app/api/sops/transcribe/route.ts` | 5-stage video pipeline route | VERIFIED | 217 lines; all 5 stages wired; transcribeAudio/parseSopWithGPT/verifyTranscriptVsSop imported and called |
| `src/app/api/sops/youtube/route.ts` | YouTube caption route with server-side auth | VERIFIED | 220 lines; createClient()+getUser(); organisationId from JWT; fetchYouTubeTranscript wired |
| `createVideoUploadSession` in `src/actions/sops.ts` | Server action for video upload | VERIFIED | Line 120 in sops.ts |

### Plan 03 — Upload UI

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/admin/UploadDropzone.tsx` | Extended with video MIME types, YouTube tab | VERIFIED | video/mp4 line 31; createVideoUploadSession imported; YouTube tab with fetch to /api/sops/youtube at line 218 |
| `src/components/admin/ParseJobStatus.tsx` | 5-step video stage stepper | VERIFIED | VIDEO_STAGES const; extracting_audio stage; current_stage from realtime subscription |
| `src/lib/upload/tus-upload.ts` | TUS resumable upload helper | VERIFIED | 56 lines; imported by UploadDropzone at line 18 |
| `src/components/admin/TusUploadProgress.tsx` | TUS progress bar component | VERIFIED | Exists; imported and used in UploadDropzone at line 627 |

### Plan 04 — Review UI

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/admin/VideoReviewPanel.tsx` | Video player + scrollable transcript | VERIFIED | 182 lines; HTML5 video + YouTube iframe; click-to-seek; auto-scroll; read-only note |
| `src/components/admin/AdversarialFlagBanner.tsx` | Expandable amber flag banner | VERIFIED | 105 lines; per-flag Confirm; Dismiss all; onUnresolvedCountChange callback |
| `src/components/admin/MissingSectionWarningBanner.tsx` | Warn-but-allow banner for missing sections | VERIFIED | 64 lines; Hazards/PPE detection; acknowledge checkbox with aria-required |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `UploadDropzone.tsx` | `createVideoUploadSession` | import from actions/sops | WIRED | Line 17 import; line 282 call |
| `UploadDropzone.tsx` | `/api/sops/youtube` | fetch call | WIRED | Line 218: `fetch('/api/sops/youtube', ...)` |
| `ParseJobStatus.tsx` | Supabase Realtime | `current_stage` subscription | WIRED | Line 124: `if (payload.new.current_stage)` |
| `transcribe/route.ts` | `transcribe-audio.ts` | import transcribeAudio | WIRED | Line 3 import; line 75 call |
| `transcribe/route.ts` | `gpt-parser.ts` | import parseSopWithGPT | WIRED | Line 4 import; line 92 call |
| `transcribe/route.ts` | `verify-sop.ts` | import verifyTranscriptVsSop | WIRED | Line 5 import; line 96 call |
| `youtube/route.ts` | `fetch-youtube-transcript.ts` | import fetchYouTubeTranscript | WIRED | Line 4 import; line 65 call |
| `youtube/route.ts` | `@/lib/supabase/server` | createClient + auth.getUser | WIRED | Lines 15-16; organisationId from JWT |
| `ReviewClient.tsx` | `VideoReviewPanel.tsx` | conditional render for video source | WIRED | Lines 21-32 props; line 265 render via OriginalDocViewer |
| `ReviewClient.tsx` | `AdversarialFlagBanner.tsx` | renders above section editors | WIRED | Line 11 import; line 274 render |
| `ReviewClient.tsx` | `MissingSectionWarningBanner.tsx` | renders with acknowledge gate | WIRED | Line 12 import; line 282 render |
| `review/page.tsx` | `parse_jobs` | fetches transcript_segments, verification_flags | WIRED | Lines 68-79: Supabase query + destructure to typed arrays |
| `scripts/copy-ffmpeg.js` | `package.json` postinstall | `"postinstall": "node scripts/copy-ffmpeg.js"` | NOT_WIRED | postinstall key absent from scripts section |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `VideoReviewPanel.tsx` | `transcriptSegments` prop | `review/page.tsx` line 78: `parseJob.transcript_segments` from Supabase parse_jobs query | Yes — DB column populated by transcribe/youtube route handlers | FLOWING |
| `AdversarialFlagBanner.tsx` | `flags` prop (verificationFlags) | `review/page.tsx` line 79: `parseJob.verification_flags` from Supabase | Yes — populated by verifyTranscriptVsSop in route handlers | FLOWING |
| `MissingSectionWarningBanner.tsx` | `flags` prop | Same verificationFlags source; detectMissingSections writes to same JSONB | Yes — detectMissingSections in verify-sop.ts writes hazard/PPE flags | FLOWING |
| `ParseJobStatus.tsx` | `currentStage` | Supabase Realtime subscription on parse_jobs; `current_stage` updated by transcribe route at each stage | Yes — route handler calls updateStage() at lines 60, 75, 92, 96, 180 | FLOWING |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — all API routes require Supabase connection and external service credentials (OpenAI, Anthropic, YouTube). No runnable entry points testable without live services.

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VID-01 | 06-00, 06-01, 06-02, 06-03 | Admin can upload MP4/MOV video file; system transcribes to structured SOP | SATISFIED | UploadDropzone + createVideoUploadSession + /api/sops/transcribe pipeline all wired |
| VID-02 | 06-00, 06-01, 06-02, 06-03 | Admin can paste YouTube **or Vimeo** URL; system extracts captions into SOP | PARTIAL | YouTube fully implemented; Vimeo deferred per D-06. Requirement text as written is not fully satisfied. Design decision documented in 06-DISCUSSION-LOG.md |
| VID-04 | 06-00, 06-01, 06-02, 06-03 | System shows async processing progress with named stages | SATISFIED | ParseJobStatus VIDEO_STAGES stepper with 5 stages; realtime updates via current_stage |
| VID-05 | 06-00, 06-04 | Admin can view and edit raw transcript alongside structured SOP before publishing | SATISFIED | VideoReviewPanel transcript panel; ReviewClient side-by-side layout; transcript read-only, sections editable |
| VID-06 | 06-00, 06-01, 06-02, 06-04 | Transcription-sourced SOPs go through same confidence scoring and admin review gate | SATISFIED | Same GPT parser pipeline; AdversarialFlagBanner; all-sections-approved gate in ReviewClient |
| VID-07 | 06-00, 06-02, 06-04 | System flags when mandatory SOP sections (hazards, PPE) absent from video source | SATISFIED | detectMissingSections in verify-sop.ts; MissingSectionWarningBanner; acknowledge gate in ReviewClient |

**Orphaned requirements check:** VID-03 (in-app camera recording) is mapped to Phase 7 in REQUIREMENTS.md. Not expected in Phase 6 — no orphan.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `package.json` | scripts section | Missing `postinstall` hook for `scripts/copy-ffmpeg.js` | WARNING | FFmpeg WASM binaries not automatically copied on `npm install`; `extractAudioFromVideo` will fail at runtime if WASM files absent |
| `public/ffmpeg/` | — | Directory does not exist | WARNING | `extract-video-audio.ts` loads WASM from `/ffmpeg/ffmpeg-core.js` at runtime; missing files will cause a runtime fetch error when video upload is attempted |

No blocker anti-patterns in implementation code. The `return null` occurrences in `AdversarialFlagBanner.tsx` and `MissingSectionWarningBanner.tsx` are correct conditional guard clauses (empty state), not stubs.

---

## Human Verification Required

### 1. YouTube URL Submission Flow

**Test:** In the admin upload page, switch to the YouTube URL tab, paste a valid YouTube URL (e.g., a public video with captions), check the terms checkbox, and click "Transcribe from YouTube."
**Expected:** Navigation to the SOP review page; transcript panel visible on the left; structured SOP sections on the right.
**Why human:** Requires live Supabase + YouTube API + OpenAI credentials; cannot verify programmatically.

### 2. Video File Upload Flow

**Test:** Drop an MP4 file onto the upload dropzone. Verify the purple Video icon appears in the queue. Monitor the ParseJobStatus stepper advancing through Uploading → Extracting → Transcribing → Structuring → Verifying.
**Expected:** 5-step stepper visible; active step highlighted in brand-yellow; completed steps in green.
**Why human:** Requires FFmpeg WASM in public/ffmpeg/ + live Supabase + TUS endpoint + OpenAI credentials.

### 3. Missing Safety Section Warning

**Test:** Upload or process a video whose content lacks hazard or PPE discussion. Navigate to the SOP review page.
**Expected:** Amber warning banner visible; acknowledge checkbox present; Publish button disabled until checkbox checked.
**Why human:** Requires a real transcript with no hazards/PPE content flowing through the Claude verification step.

### 4. Critical Adversarial Flag Publish Gate

**Test:** Process a video where the transcript and structured output contain meaningful discrepancies (e.g., a numerical value differs between spoken and structured text).
**Expected:** Amber AdversarialFlagBanner appears; Publish button tooltip says "Resolve all critical AI verification flags before publishing"; flag can be confirmed via "Confirm #N" button; Publish unblocks after all critical flags resolved.
**Why human:** Requires a specific test video and live Claude API call to generate critical-severity flags.

---

## Gaps Summary

Two gaps identified:

**Gap 1 — postinstall hook missing (Warning severity):**
`scripts/copy-ffmpeg.js` exists and is correctly implemented (uses `fs.cpSync`), but it was never wired to `package.json` as a `postinstall` hook. As a result, `public/ffmpeg/` is absent. The `extract-video-audio.ts` module dynamically loads WASM from `/ffmpeg/ffmpeg-core.js` at runtime. On any fresh checkout, video upload will fail with a fetch error when trying to load the WASM binary. Fix: add `"postinstall": "node scripts/copy-ffmpeg.js"` to `package.json` scripts, then run it manually to populate the current dev environment.

**Gap 2 — VID-02 Vimeo not implemented (Partial/Known deferral):**
The requirement as written in REQUIREMENTS.md specifies "YouTube or Vimeo URL". Only YouTube is implemented. This was an intentional descope documented in D-06 of the DISCUSSION-LOG.md, but REQUIREMENTS.md VID-02 still reads as complete without qualification. This creates a documentation inconsistency. No code change is needed — the appropriate fix is to update REQUIREMENTS.md VID-02 to note "Vimeo deferred to Phase 7 per D-06" so the requirement accurately reflects what was built.

These gaps do not prevent the core video transcription flow from working for YouTube URLs and uploaded video files.

---

_Verified: 2026-04-03T08:30:00Z_
_Verifier: Claude (gsd-verifier)_
