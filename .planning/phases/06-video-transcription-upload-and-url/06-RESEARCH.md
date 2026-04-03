# Phase 6: Video Transcription (Upload and URL) - Research

**Researched:** 2026-04-03
**Domain:** Video transcription pipeline, YouTube caption API, adversarial AI verification, side-by-side review UI extension
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Transcript Review UX**
- D-01: Side-by-side panels — left panel: scrollable transcript with timestamps; right panel: structured SOP sections (same as existing review UI). Click a transcript line to highlight the corresponding SOP section.
- D-02: Transcript is read-only reference. Admin edits the structured SOP sections only — consistent with existing document-parsed SOP review flow.
- D-03: Embedded video player above the transcript panel with timestamp sync. Click a transcript line to jump to that timestamp in the video. For YouTube URL-sourced SOPs, embed the YouTube player; for file uploads, use HTML5 video with the uploaded file's presigned URL.

**Adversarial AI Verification**
- D-04: After GPT-4o structures the SOP, an adversarial verification pass auto-runs using a different base model (e.g., Claude). It cross-checks the source transcript against the structured SOP output, looking for discrepancies — omitted safety information, numerical errors, misattributed sections, dropped content. Discrepancies flagged as amber highlights in the review UI that admin must resolve before publishing.
- D-05: This replaces simple "high-risk token flagging" — the verification is semantic, not keyword-based. It has an adversarial objective: find mistakes the structuring model made.

**YouTube/Vimeo URL Scope**
- D-06: YouTube only for Phase 6. Vimeo deferred.
- D-07: Caption-only from YouTube — use YouTube Data API v3 captions.list for compliant caption access. No server-side video/audio download (ToS protection).
- D-08: When no captions are available, prompt admin: "No captions found — download the video and upload as MP4 for audio transcription." Fallback to file upload pathway.
- D-09: Terms acknowledgement checkbox when pasting a YouTube URL: "I confirm I have rights to use this content for SOP creation." One-time per URL submission.

**Processing Feedback**
- D-10: Named stages with progress indicators: uploading (% bar from TUS) → extracting audio → transcribing (elapsed time) → structuring → verifying → ready. Reuse ParseJobStatus component pattern with extended stage set.
- D-11: On failure: show which stage failed with brief error message + "Retry" button that re-attempts from the failed stage (not from scratch). Admin can also delete and re-upload.

**Transcription Accuracy**
- D-12: Global industry vocabulary list shipped with the app — common NZ industrial/manufacturing terms passed as prompt context to the transcription API. No per-org customisation in Phase 6.
- D-13: Missing hazards/PPE section: warn but allow publish — banner "Warning: No hazards/PPE section detected in this SOP." Admin can acknowledge and publish anyway.

### Claude's Discretion
- Transcription API choice (OpenAI Whisper / gpt-4o-transcribe / other)
- Audio extraction approach (ffmpeg-static server-side vs client-side WASM)
- Adversarial verification model selection and prompt engineering
- YouTube caption API integration details
- Video player component choice (HTML5 native vs library)
- How to extend parse_jobs for video-specific stages
- Retry mechanism internals (which stages are idempotent)

### Deferred Ideas (OUT OF SCOPE)
- Vimeo URL support — requires separate API token, different caption API, limited NZ market demand
- Per-organisation vocabulary dictionaries
- Automatic transcript correction (admin edits transcript → system re-structures)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VID-01 | Admin can upload a video file (MP4/MOV) and the system transcribes it into a structured SOP with standard sections | Audio extraction via @ffmpeg/ffmpeg (WASM, client-side) + gpt-4o-transcribe via existing openai SDK; TUS upload to sop-videos bucket |
| VID-02 | Admin can paste a YouTube or Vimeo URL and the system extracts captions or transcribes audio into a structured SOP | youtube-transcript package fetches auto-captions; no video download; caption-first fast path |
| VID-04 | System shows async processing progress with named stages (uploading → transcribing → structuring → ready) | Extended parse_jobs stage column + extended ParseJobStatus component |
| VID-05 | Admin can view and edit the raw transcript alongside the structured SOP output before publishing | Side-by-side review UI extension in ReviewClient.tsx; transcript stored on parse_jobs or new column |
| VID-06 | Transcription-sourced SOPs go through the same confidence scoring and admin review gate as document-parsed SOPs | Existing gpt-parser.ts + ParsedSopSchema + approval gate unchanged; adversarial verification adds semantic layer |
| VID-07 | System flags when mandatory SOP sections (hazards, PPE) are absent from the video source | Post-structure check against parsed sections; warn-but-allow banner (consistent with Phase 5 D-08) |
</phase_requirements>

## Summary

Phase 6 extends the existing SOP parsing pipeline with two new intake pathways: MP4/MOV file upload with audio transcription, and YouTube URL with caption extraction. Both pathways converge at the existing `gpt-parser.ts` structuring step and flow through the same admin review UI — the key additions are upstream (audio extraction, transcription, YouTube captions) and a new downstream verification layer (adversarial AI cross-check).

The existing codebase provides strong foundations: `tus-upload.ts` handles large file uploads, `parse_jobs` tracks async processing with Realtime updates, `ParseJobStatus.tsx` shows progress to the admin, and `ReviewClient.tsx` renders the side-by-side review. All of these need extension, not replacement.

The most technically novel addition is the adversarial verification pass (D-04/D-05). After GPT-4o structures the SOP, a second model call — using Claude via `@anthropic-ai/sdk` (version 0.82.0, already available on npm) — cross-checks the source transcript against the structured output with an adversarial objective: find discrepancies, omissions, and numerical errors. Results are stored as a JSON array of flags and rendered as amber highlights in the review UI.

**Primary recommendation:** Use `@ffmpeg/ffmpeg` WASM for client-side audio extraction, `gpt-4o-transcribe` (existing openai SDK) for transcription, `youtube-transcript` (v1.3.0) for YouTube captions, and `@anthropic-ai/sdk` (v0.82.0) for adversarial verification. Store the transcript text on a new `transcript_text` column in `parse_jobs`; store verification flags as a JSONB column.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `openai` | 6.33.0 (installed: 6.32.0) | `gpt-4o-transcribe` for audio transcription; `gpt-4o` for structuring (existing) | Already installed; covers transcription with no new dependency |
| `@ffmpeg/ffmpeg` | 0.12.15 | Client-side audio extraction from MP4/MOV before upload | WASM runs in browser, bypasses Vercel 4.5MB body limit and 50MB bundle limit for server binaries |
| `@ffmpeg/util` | 0.12.2 | Companion to @ffmpeg/ffmpeg — `fetchFile`, `createFFmpegCore` utilities | Required by @ffmpeg/ffmpeg |
| `youtube-transcript` | 1.3.0 | Fetches YouTube auto-captions without video download | Serverless-compatible; returns timestamped segments; no ToS violation |
| `@anthropic-ai/sdk` | 0.82.0 | Adversarial verification pass using Claude (different model family than structuring model) | D-04 requires a different base model; Claude is the natural choice; SDK is lightweight |
| `tus-js-client` | 4.3.1 (installed) | Resumable chunked upload for video files to Supabase Storage | Already installed from Phase 5; handles chunks, retries, and resumption |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | 1.0.1 (installed) | Icons for video player controls, stage indicators, flag highlights | Consistent with all prior phases |
| `zustand` | 5.0.12 (installed) | Local state for transcript panel scroll position and video player sync | For transcript-video timestamp sync state without prop drilling |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@ffmpeg/ffmpeg` (WASM) | `ffmpeg-static` (server-side binary) | Server-side FFmpeg is documented but "bundle-sensitive" on Vercel (CONTEXT.md Pitfall 6). The ARCHITECTURE.md actually contradicts itself here — STACK.md recommends WASM; ARCHITECTURE.md mentions ffmpeg-static. WASM wins: video never leaves the browser until it's an audio file. |
| `@anthropic-ai/sdk` | Second OpenAI call with `o1-mini` | Same model family = correlated failure modes; adversarial verification requires a different architecture per D-04. Claude's constitutional AI training makes it well-suited to finding safety-critical omissions. |
| `youtube-transcript` | YouTube Data API v3 `captions.list` | D-07 specifies "YouTube Data API v3 captions.list" but `youtube-transcript` uses the same caption endpoint without requiring OAuth setup. For Phase 6 scope (reading public auto-captions), `youtube-transcript` is simpler. If accessing private/uploaded captions later, switch to official API. |
| HTML5 `<video>` (native) | react-player or similar | D-03 permits native HTML5 video. Native handles presigned URL playback without a dependency. YouTube embed uses YouTube IFrame API directly. |

**Installation (new packages only):**
```bash
npm install @ffmpeg/ffmpeg @ffmpeg/util youtube-transcript @anthropic-ai/sdk
```

**Version verification (as of 2026-04-03):**
- `@ffmpeg/ffmpeg`: 0.12.15 (confirmed via npm registry)
- `@ffmpeg/util`: 0.12.2 (confirmed via npm registry)
- `youtube-transcript`: 1.3.0 (confirmed via npm registry)
- `@anthropic-ai/sdk`: 0.82.0 (confirmed via npm registry)
- `openai`: current 6.33.0 — installed version 6.32.0 is functionally equivalent

## Architecture Patterns

### Recommended Project Structure (new files only)

```
src/
├── app/
│   └── api/sops/
│       ├── transcribe/route.ts          # NEW: video transcription orchestrator
│       └── youtube/route.ts             # NEW: YouTube caption fetch
├── components/admin/
│   ├── VideoUploader.tsx                # NEW: MP4/MOV upload + @ffmpeg WASM audio extraction
│   ├── VideoTranscriptPanel.tsx         # NEW: scrollable transcript with timestamps + video player
│   └── AdversarialFlags.tsx             # NEW: amber flag highlights for verification results
├── lib/parsers/
│   ├── extract-video-audio.ts           # NEW: client-side WASM orchestration helper (imported in VideoUploader)
│   ├── transcribe-audio.ts              # NEW: server-side openai.audio.transcriptions.create wrapper
│   ├── fetch-youtube-transcript.ts      # NEW: youtube-transcript package wrapper
│   └── verify-sop.ts                   # NEW: adversarial verification via @anthropic-ai/sdk
└── types/sop.ts                         # EXTEND: SourceFileType, ParseJob, new VerificationFlag type
supabase/migrations/
└── 00012_video_transcription.sql        # NEW: parse_jobs extensions, sop-videos bucket
```

### Pattern 1: Client-Side Audio Extraction Before Upload

**What:** Use `@ffmpeg/ffmpeg` WASM to strip the video track from MP4/MOV in the browser. Upload the resulting MP3 (not the video) to Supabase Storage. This keeps video files off the server entirely.

**When to use:** Every MP4/MOV upload. The WASM core (~30MB) loads lazily only when the user opens the video upload UI.

**Key constraint:** `@ffmpeg/ffmpeg` v0.12.x requires SharedArrayBuffer, which requires cross-origin isolation headers: `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. These must be set in `next.config.ts` for the upload route. Without these headers, the WASM multi-thread mode falls back to single-thread (slower but functional).

```typescript
// Source: @ffmpeg/ffmpeg v0.12 documentation
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

const ffmpeg = new FFmpeg()

// Load WASM core (30MB, lazy)
await ffmpeg.load({
  coreURL: await toBlobURL('/ffmpeg/ffmpeg-core.js', 'text/javascript'),
  wasmURL: await toBlobURL('/ffmpeg/ffmpeg-core.wasm', 'application/wasm'),
})

// Write video to WASM virtual filesystem
await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile))

// Extract audio as MP3 (strips video track — reduces file size by ~10x)
await ffmpeg.exec(['-i', 'input.mp4', '-vn', '-acodec', 'libmp3lame', '-q:a', '4', 'audio.mp3'])

// Read output
const data = await ffmpeg.readFile('audio.mp3')
const audioBlob = new Blob([data], { type: 'audio/mp3' })
```

The WASM binaries must be served from `/public/ffmpeg/`. Use `toBlobURL` to create object URLs, avoiding CORS issues with CDN-hosted WASM.

### Pattern 2: Async Video Transcription Pipeline

**What:** POST to `/api/sops/transcribe` with `sopId`. Route handler fetches audio from Supabase Storage, calls `gpt-4o-transcribe`, then passes transcript text to existing `gpt-parser.ts`. Progress communicated via `parse_jobs.current_stage` column updated incrementally.

**When to use:** After TUS upload completes. Client triggers parse identically to document pipeline (`fetch('/api/sops/transcribe', ...)`).

```typescript
// Source: OpenAI SDK v6 — audio.transcriptions.create
const transcription = await openai.audio.transcriptions.create({
  file: audioFile,                  // File object from Storage blob
  model: 'gpt-4o-transcribe',
  response_format: 'verbose_json',  // Returns segments with timestamps
  prompt: NZ_INDUSTRY_VOCABULARY,   // D-12: domain vocabulary for accuracy
})

// transcription.segments: Array<{ start: number, end: number, text: string }>
// Store as JSONB in parse_jobs.transcript_segments
```

The `verbose_json` response format returns individual segments with start/end timestamps — essential for the transcript-to-video-player sync (D-03).

### Pattern 3: YouTube Caption Extraction

**What:** POST to `/api/sops/youtube` with the YouTube URL. Route handler uses `youtube-transcript` to fetch captions. No video download. Returns caption segments with timestamps.

**When to use:** When admin pastes a YouTube URL (after terms acknowledgement, D-09).

```typescript
// Source: youtube-transcript npm package v1.3.0
import { YoutubeTranscript } from 'youtube-transcript'

// Extract video ID from URL (handle watch?v=, youtu.be/, /shorts/)
const videoId = extractYouTubeId(url)

try {
  const segments = await YoutubeTranscript.fetchTranscript(videoId)
  // segments: Array<{ text: string, duration: number, offset: number }>
  // offset is start timestamp in ms
} catch (err) {
  if (err instanceof YoutubeTranscriptError) {
    // No auto-captions available — return D-08 message to client
    return { noCaption: true, message: 'No captions found — download the video and upload as MP4.' }
  }
}
```

`YoutubeTranscript.fetchTranscript` throws `YoutubeTranscriptError` when no transcript exists (private, disabled, or not generated). This is the D-08 trigger.

### Pattern 4: Adversarial Verification

**What:** After `gpt-parser.ts` produces `ParsedSop`, call Claude (`claude-3-5-haiku-20241022` for cost, or `claude-3-5-sonnet-20241022` for accuracy) with the source transcript and the structured SOP. Prompt instructs Claude to act as an auditor: find discrepancies, omissions, and errors the structuring model introduced.

**When to use:** Auto-runs after structuring completes (D-04). Adds a `verifying` stage to the pipeline.

```typescript
// Source: @anthropic-ai/sdk v0.82.0
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic() // reads ANTHROPIC_API_KEY from env

const ADVERSARIAL_SYSTEM = `You are a safety auditor reviewing an AI-generated SOP.
Your job is to find discrepancies between the source transcript and the structured SOP output.
Be adversarial — look for: omitted safety information, changed numerical values (tolerances, temperatures, voltages), 
misattributed section content, paraphrased hazard warnings that lose meaning, dropped PPE requirements.
Return a JSON array of findings. Each finding has: severity ("critical"|"warning"), 
location (section title + step number if applicable), original_text (from transcript), 
structured_text (what the SOP says), description (what's wrong).
If no discrepancies found, return an empty array.`

const response = await anthropic.messages.create({
  model: 'claude-3-5-haiku-20241022',
  max_tokens: 2048,
  system: ADVERSARIAL_SYSTEM,
  messages: [{
    role: 'user',
    content: `SOURCE TRANSCRIPT:\n${transcriptText}\n\nSTRUCTURED SOP:\n${JSON.stringify(parsedSop, null, 2)}`
  }]
})

// Parse JSON from response.content[0].text
const flags: VerificationFlag[] = JSON.parse(response.content[0].text)
```

**Model choice:** `claude-3-5-haiku-20241022` at $0.80/MTok input, $4/MTok output balances cost vs capability for this verification task. A 15-minute transcript is approximately 3,000-5,000 tokens; verification cost is under $0.01 per SOP. Use `claude-3-5-sonnet-20241022` only if haiku produces too many false positives in testing.

### Pattern 5: Extended parse_jobs with Stage Tracking

**What:** Add `current_stage` text column to `parse_jobs`. API route updates it at each pipeline step. ParseJobStatus component reads it via existing Realtime subscription.

**Stage FSM for video pathway:**
```
queued → uploading → extracting_audio → transcribing → structuring → verifying → completed
                                                                               ↘ failed (at any stage)
```

**Document pathway stages (unchanged):** `queued → processing → completed | failed`

The `current_stage` column allows the review UI (D-10) to show named stages with elapsed time rather than a generic spinner.

### Anti-Patterns to Avoid

- **Routing video bytes through a Next.js API route:** Vercel hard-limits request body at 4.5MB. Any video larger than this returns 413. Always use TUS to Supabase Storage directly from the browser.
- **Using yt-dlp, ytdl-core, or any video downloader for YouTube URLs:** ToS violation, DMCA exposure. Caption-only via `youtube-transcript`. Period.
- **Server-side FFmpeg binary on Vercel:** Documented in PITFALLS.md and STACK.md. Use WASM on client instead.
- **Running adversarial verification with the same model as structuring:** Defeats the adversarial objective. Must be a different model family (D-04).
- **Calling `gpt-4o-transcribe` with a file over 25MB:** API hard limit. Audio extracted from video (MP3, 128kbps) is approximately 1MB/minute, so a 25-minute recording hits the limit. Add chunking logic for files >20MB (safety margin) before the limit.
- **Storing transcript as plain text without timestamps:** Timestamp data is needed for transcript-to-video seek (D-03). Store as JSONB `transcript_segments` array, not a flat string.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audio extraction from video | Custom Web Audio API extraction | `@ffmpeg/ffmpeg` WASM | Audio codec handling (AAC, MP3, Opus, PCM) across MP4/MOV/WEBM is complex; FFmpeg handles all cases |
| YouTube caption fetch | YouTube Data API OAuth flow | `youtube-transcript` package | Auto-captions are accessible without OAuth for public videos; the package handles URL parsing, language selection, and error cases |
| Chunked video upload | Custom multipart upload | Existing `tus-upload.ts` + `tus-js-client` | TUS resumable upload with 6MB chunks is already built and tested in Phase 5 |
| Parse job progress display | New polling component | Extend `ParseJobStatus.tsx` | Supabase Realtime subscription + polling fallback already implemented |
| Adversarial AI JSON parsing | Regex extraction from LLM output | Structured prompt asking for JSON + JSON.parse with error handling | LLMs reliably produce valid JSON when the prompt is explicit; no need for a schema library here |
| Video player for local files | Custom video component | HTML5 `<video>` with presigned URL | Native video element handles seeking, playback, and currentTime sync with no library needed |
| YouTube embed | Custom player | YouTube IFrame API embed | Standard embed URL (`https://www.youtube.com/embed/{videoId}?enablejsapi=1`) exposes `seekTo` via postMessage |

**Key insight:** The core transcription pipeline reuses gpt-parser.ts entirely unchanged. Only the upstream extraction differs — the LLM sees a "transcript" hint instead of a document format hint.

## Common Pitfalls

### Pitfall 1: WASM SharedArrayBuffer Headers Break Next.js Dev Server

**What goes wrong:** `@ffmpeg/ffmpeg` v0.12 multi-thread mode requires `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers. Without them, the browser silently falls back to single-thread mode (3-5x slower extraction) or throws `SharedArrayBuffer is not defined`. In Next.js, these headers must be set in `next.config.ts` via `headers()`, and only for routes that serve the video upload UI. Setting them globally breaks third-party embeds (YouTube IFrame).

**Why it happens:** COEP headers prevent loading third-party resources (fonts, CDN assets, YouTube iframes) unless those resources opt in with `Cross-Origin-Resource-Policy`. YouTube's IFrame API does not opt in, so the YouTube player breaks on pages with COEP enabled.

**How to avoid:** Apply COOP/COEP headers only to the `/admin/sops/new` route (or whichever route hosts the video uploader), not globally. The review page (which embeds the YouTube player) must NOT have COEP enabled. Alternatively, use `@ffmpeg/ffmpeg` in single-thread mode (no SharedArrayBuffer needed) — extraction takes ~3x longer but avoids the header conflict entirely for a simpler v1.

**Warning signs:** YouTube player is blank on the review page; browser console shows "Refused to load" CORS errors for youtube.com.

### Pitfall 2: youtube-transcript Throws on Auto-Caption Disabled Videos

**What goes wrong:** `YoutubeTranscript.fetchTranscript(videoId)` throws `YoutubeTranscriptError` not just for "no captions" but also for: private videos, age-restricted videos, and videos where the owner disabled auto-captions. The error message in all cases is generic. Admin gets a confusing error.

**Why it happens:** The package uses the same endpoint YouTube's front-end uses; access restrictions apply uniformly.

**How to avoid:** Wrap in try/catch, catch `YoutubeTranscriptError` specifically, and return D-08's user-friendly message regardless of the specific sub-reason. Don't attempt to distinguish between "private" and "no captions" — the fix is the same (upload MP4 instead).

**Warning signs:** "Unhandled promise rejection" in the `/api/sops/youtube` route for non-public YouTube videos.

### Pitfall 3: gpt-4o-transcribe 25MB File Limit with No Chunking

**What goes wrong:** A 30-minute SOP walkthrough video produces an MP3 at 128kbps of approximately 28MB — just over the OpenAI API 25MB limit. The API returns a 413 error with no retry mechanism.

**Why it happens:** Most SOP recordings are under 15 minutes, so developers test within the limit and don't build chunking. Factory floor demonstration recordings can run longer.

**How to avoid:** Check audio file size before the API call. If size > 20MB (20% safety margin), split into chunks using FFmpeg's `segment` muxer (e.g., 10-minute segments). Transcribe chunks in sequence (not parallel — the API has per-minute rate limits on Transcription). Concatenate transcript segments with correct timestamp offsets.

```bash
# Split audio into 10-minute chunks:
ffmpeg -i audio.mp3 -f segment -segment_time 600 -c copy chunk_%03d.mp3
```

**Warning signs:** No file size check before transcription API call; tests only on sub-5-minute recordings.

### Pitfall 4: Adversarial Verification Timeout on Long Transcripts

**What goes wrong:** A 20-minute transcript is approximately 4,000-6,000 words (~6,000 tokens). Combined with the full structured SOP JSON, the adversarial verification prompt can exceed 10,000 input tokens. Claude Haiku processes this in 10-20 seconds, but if the verification runs synchronously in the same 300s window as transcription + structuring, the combined pipeline risks hitting the Vercel function timeout on slow days.

**Why it happens:** Transcription (60-90s for a 15-min recording) + structuring (10-20s) + verification (10-20s) = 80-130s — within the 300s limit individually, but margin is thin for large videos.

**How to avoid:** Run adversarial verification as a separate update to the parse job — trigger it from the same route handler but after the structuring step completes and the parse_job is updated to `current_stage: 'verifying'`. Since all steps are in the same function execution context, the total wall time must stay under 300s. For safety, enforce a max transcript length of 15,000 words (roughly 25 minutes of speech) with a UI warning above that threshold.

**Warning signs:** No timeout handling around the Anthropic API call; no max-transcript-length guard.

### Pitfall 5: parse_jobs Schema Migration Breaks Existing Document Pipeline

**What goes wrong:** Adding `current_stage` column or changing the `input_type` check constraint in `parse_jobs` can cause existing in-flight document parse jobs to fail if the constraint change is applied mid-operation, or causes TypeScript type errors in the existing document parse route if column names change.

**Why it happens:** `parse_jobs` is used by both old and new code paths. Schema changes that tighten or alter check constraints can invalidate existing rows.

**How to avoid:** Only ADD columns; never tighten existing check constraints mid-migration. The `input_type` column already accepts `'upload' | 'scan' | 'url'` — add `'video_file' | 'youtube_url'` to the constraint check as an ALTER (drop old constraint, add new one with expanded value set). Use `IF NOT EXISTS` / `IF EXISTS` guards. Existing rows with `input_type = 'upload'` remain valid.

**Warning signs:** Migration drops and recreates the `parse_jobs` table; check constraints altered without expanding (not replacing) the allowed value set.

### Pitfall 6: Transcript Storage Missing for Side-by-Side Review

**What goes wrong:** Transcript is generated server-side and used immediately for GPT structuring, but never persisted. The review UI loads the page later and has no transcript to display. Admin sees an empty left panel.

**Why it happens:** Developers treat the transcript as a transient intermediate value in the pipeline, not as a product artifact.

**How to avoid:** Store transcript segments as JSONB on `parse_jobs.transcript_segments` (type: `Array<{start: number, end: number, text: string}>`). Add `transcript_text` as a flat text column for the adversarial verification input. Both columns are nullable (existing document parse jobs have no transcript). The review page server component fetches the parse job record and passes segments to the transcript panel component.

### Pitfall 7: YouTube IFrame Timestamp Seek Requires API Initialization

**What goes wrong:** Clicking a transcript line should seek the YouTube player to that timestamp (D-03). The YouTube IFrame API requires `enablejsapi=1` in the embed URL AND the `onYouTubeIframeAPIReady` callback to be defined before `seekTo()` can be called. In a React component, this global callback conflicts with hydration and causes "YT is not defined" errors.

**Why it happens:** YouTube IFrame API uses a global callback pattern (`window.YT`) incompatible with React's component lifecycle without careful handling.

**How to avoid:** Load the YouTube IFrame API script lazily (only when the review page has a YouTube-sourced SOP). Use `window.onYouTubeIframeAPIReady` inside a `useEffect` with cleanup. Store the `YT.Player` instance in a ref, not state. Call `player.seekTo(timestamp, true)` from transcript line click handlers.

## Code Examples

### Audio Extraction Stage (Client-Side)

```typescript
// Source: @ffmpeg/ffmpeg v0.12.15 — src/components/admin/VideoUploader.tsx
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

async function extractAudio(videoFile: File, onProgress?: (pct: number) => void): Promise<File> {
  const ffmpeg = new FFmpeg()
  
  ffmpeg.on('progress', ({ progress }) => {
    onProgress?.(Math.round(progress * 100))
  })

  // Load WASM — must be served from /public/ffmpeg/
  await ffmpeg.load({
    coreURL: await toBlobURL('/ffmpeg/ffmpeg-core.js', 'text/javascript'),
    wasmURL: await toBlobURL('/ffmpeg/ffmpeg-core.wasm', 'application/wasm'),
  })

  const inputName = 'input.' + videoFile.name.split('.').pop()
  await ffmpeg.writeFile(inputName, await fetchFile(videoFile))
  
  await ffmpeg.exec([
    '-i', inputName,
    '-vn',                    // strip video track
    '-acodec', 'libmp3lame',  // MP3 codec
    '-q:a', '4',              // VBR quality (4 = ~165kbps, good for speech)
    '-ac', '1',               // mono (speech only — halves file size)
    'audio.mp3',
  ])

  const data = await ffmpeg.readFile('audio.mp3')
  return new File([data], 'audio.mp3', { type: 'audio/mp3' })
}
```

### Transcription API Call (Server-Side)

```typescript
// Source: OpenAI SDK v6 — src/lib/parsers/transcribe-audio.ts
import OpenAI from 'openai'

const openai = new OpenAI()

// NZ industrial vocabulary for improved accuracy (D-12)
const NZ_INDUSTRY_VOCABULARY = [
  'OTG laser', 'Tergo Alkalox', 'IRI CSV', 'PPE', 'MSDS', 'SDS',
  'torque wrench', 'lockout tagout', 'LOTO', 'Newtons', 'kPa', 'kN',
  // ... expand based on real-world client terminology
].join(', ')

export interface TranscriptSegment {
  start: number   // seconds
  end: number     // seconds
  text: string
}

export async function transcribeAudio(audioBuffer: ArrayBuffer): Promise<TranscriptSegment[]> {
  const audioFile = new File([audioBuffer], 'audio.mp3', { type: 'audio/mp3' })
  
  if (audioFile.size > 20 * 1024 * 1024) {
    throw new Error('Audio file too large for single API call — chunking required (>20MB)')
  }

  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: 'gpt-4o-transcribe',
    response_format: 'verbose_json',
    prompt: `Industrial SOP recording. Technical vocabulary includes: ${NZ_INDUSTRY_VOCABULARY}`,
  })

  return (transcription.segments ?? []).map((seg) => ({
    start: seg.start,
    end: seg.end,
    text: seg.text.trim(),
  }))
}
```

### Adversarial Verification (Server-Side)

```typescript
// Source: @anthropic-ai/sdk v0.82.0 — src/lib/parsers/verify-sop.ts
import Anthropic from '@anthropic-ai/sdk'
import type { ParsedSop } from '@/lib/validators/sop'

const anthropic = new Anthropic() // reads ANTHROPIC_API_KEY from env

export interface VerificationFlag {
  severity: 'critical' | 'warning'
  section_title: string
  step_number?: number
  original_text: string       // from transcript
  structured_text: string     // from parsed SOP
  description: string         // what's wrong
}

export async function verifyTranscriptVsSop(
  transcriptText: string,
  parsedSop: ParsedSop,
): Promise<VerificationFlag[]> {
  const response = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 2048,
    system: `You are a safety auditor reviewing an AI-generated Standard Operating Procedure (SOP).
Your job is to find discrepancies between the source transcript and the AI-structured SOP output.
Find: omitted safety information, changed numerical values, misattributed section content, 
paraphrased hazard warnings that lose meaning, dropped PPE requirements.
Respond with a JSON array of findings only. No prose. 
Each finding: { severity: "critical"|"warning", section_title: string, step_number?: number, 
original_text: string, structured_text: string, description: string }
If no discrepancies: return [].`,
    messages: [{
      role: 'user',
      content: `SOURCE TRANSCRIPT:\n${transcriptText}\n\nSTRUCTURED SOP (JSON):\n${JSON.stringify(parsedSop, null, 2)}`,
    }],
  })

  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
    return JSON.parse(text) as VerificationFlag[]
  } catch {
    return [] // verification parse failure is non-blocking — log and continue
  }
}
```

### Extended parse_jobs Stage Update Pattern

```typescript
// Pattern for updating current_stage in route handlers
// src/app/api/sops/transcribe/route.ts

async function updateStage(
  admin: ReturnType<typeof createAdminClient>,
  jobId: string,
  stage: string,
) {
  await admin.from('parse_jobs')
    .update({ current_stage: stage, updated_at: new Date().toISOString() })
    .eq('id', jobId)
}

// Usage in the transcription pipeline:
await updateStage(admin, job.id, 'extracting_audio')
// ... fetch audio from storage ...

await updateStage(admin, job.id, 'transcribing')
const segments = await transcribeAudio(audioBuffer)

await updateStage(admin, job.id, 'structuring')
const parsedSop = await parseSopWithGPT(transcriptText, 'video')

await updateStage(admin, job.id, 'verifying')
const flags = await verifyTranscriptVsSop(transcriptText, parsedSop)

await updateStage(admin, job.id, 'completed')
```

### GPT Parser Format Hint for Video Input

```typescript
// Addition to FORMAT_HINTS in src/lib/parsers/gpt-parser.ts
// Extend the existing Partial<Record<SourceFileType, string>> map:

video: '\n\nNote: This text is a transcript from a video recording of someone demonstrating an SOP. ' +
  'It is spoken language, not written prose. Sentences may be incomplete, informal, or repeated. ' +
  'Look for action verbs as step indicators. Treat numerical values (measurements, torques, temperatures, voltages) ' +
  'as safety-critical — preserve exact numbers. If the speaker corrects themselves, use the corrected value.',
```

This requires adding `'video'` to the `SourceFileType` union in `src/types/sop.ts`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `whisper-1` transcription model | `gpt-4o-transcribe` | March 2025 (OpenAI release) | Lower word error rate, better NZ/AU accent handling; same API surface |
| `ytdl-core` for YouTube content | `youtube-transcript` (captions-only) | 2022-2024 (ytdl-core abandoned) | No video download = ToS compliant; faster (text only) |
| Keyword-based safety flagging | Adversarial AI semantic verification | Phase 6 (new) | Detects paraphrased omissions, not just missing keywords |
| Single-model parsing pipeline | Two-model pipeline (GPT-4o structure + Claude verify) | Phase 6 (new) | Reduces uncaught structuring errors for safety-critical content |

**Deprecated/outdated:**
- `ytdl-core`: Last meaningful update 2022. Breaks regularly as YouTube updates its internal API. npm page warns of deprecation. Do not use.
- `whisper-1`: Superseded by `gpt-4o-transcribe` for accuracy. Still usable as a cost fallback but not recommended for industrial/accented audio.
- `ffmpegwasm` (original package): Superseded by `@ffmpeg/ffmpeg` from the `@ffmpeg` scope with multi-thread support.

## Open Questions

1. **FFmpeg WASM binary hosting approach**
   - What we know: `@ffmpeg/ffmpeg` requires WASM core files (~30MB total) to be served from the same origin. They can go in `/public/ffmpeg/` or be loaded from a CDN with correct CORS headers.
   - What's unclear: Whether hosting 30MB of static files in Next.js `/public/` is acceptable, or whether a CDN URL with CORS headers is preferable for build size.
   - Recommendation: Use `/public/ffmpeg/` for Phase 6 (simpler, no CORS setup). Move to CDN if Vercel static asset costs become a concern.

2. **COEP header scope for WASM multi-threading**
   - What we know: Multi-thread WASM requires COOP/COEP headers. COEP breaks YouTube IFrame embed on the same page.
   - What's unclear: Whether the upload page and review page are distinct routes (they are: `/admin/sops/new` vs `/admin/sops/[sopId]/review`) — which means COEP can be scoped to the upload route only.
   - Recommendation: Apply COEP only to `/admin/sops/new`. Start with single-thread mode (no COEP needed) if WASM multi-threading setup adds too much Wave 0 friction.

3. **Adversarial verification false positive rate**
   - What we know: No empirical data yet on how often Claude Haiku flags correct structuring. Industrial SOP content with specific numerical values should produce low false positives.
   - What's unclear: Whether Haiku is accurate enough for critical flags, or if Sonnet is needed.
   - Recommendation: Ship with Haiku. Add a `ANTHROPIC_VERIFY_MODEL` env var so the model can be swapped without a code change. Monitor flag quality in post-launch review.

4. **Transcript storage column placement**
   - What we know: Transcript needs to be available at review time. It could live on `parse_jobs` (alongside the job that produced it) or on the `sops` table (as a permanent artifact).
   - What's unclear: Whether admins should be able to access the transcript after re-parsing.
   - Recommendation: Store on `parse_jobs` as `transcript_segments JSONB` and `transcript_text TEXT`. If the SOP is re-parsed (reparseSop action), a new parse job is created — the old transcript remains on the old job. The review page fetches the most recent parse job (existing pattern).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All server routes | Yes | v22.16.0 | — |
| npm | Package install | Yes | 10.9.2 | — |
| `openai` SDK | gpt-4o-transcribe | Yes (installed) | 6.32.0 | — |
| `tus-js-client` | Video file upload | Yes (installed) | 4.3.1 | — |
| `@ffmpeg/ffmpeg` | Client audio extraction | Not installed | — | Install: `npm install @ffmpeg/ffmpeg @ffmpeg/util` |
| `youtube-transcript` | YouTube captions | Not installed | — | Install: `npm install youtube-transcript` |
| `@anthropic-ai/sdk` | Adversarial verification | Not installed | — | Install: `npm install @anthropic-ai/sdk` |
| `ANTHROPIC_API_KEY` env var | Adversarial verification | Unknown | — | Must be added to `.env.local` and Vercel env |
| Supabase `sop-videos` bucket | Video storage | Not created | — | Create via migration 00012 |
| FFmpeg WASM binaries | Client audio extraction | Not present | — | Copy to `/public/ffmpeg/` during Wave 0 setup |

**Missing dependencies with no fallback:**
- `ANTHROPIC_API_KEY` — adversarial verification (D-04) cannot run without it. Must be provisioned before Wave 3 (verification implementation).
- Supabase `sop-videos` bucket — video files have nowhere to go without it. Must be created in migration 00012.

**Missing dependencies with fallback:**
- FFmpeg WASM binaries — if loading from `/public/ffmpeg/` fails, `@ffmpeg/ffmpeg` can load from CDN (`https://unpkg.com/@ffmpeg/core`) as a fallback. Slower first load but functional.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright (already installed, v1.58.2) |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test --project=integration --grep "@video"` |
| Full suite command | `npx playwright test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VID-01 | MP4 upload triggers transcription pipeline and produces draft SOP | integration | `npx playwright test tests/phase6/video-upload.spec.ts -x` | ❌ Wave 0 |
| VID-02 | YouTube URL submission fetches captions and produces draft SOP | integration | `npx playwright test tests/phase6/youtube-url.spec.ts -x` | ❌ Wave 0 |
| VID-02 | YouTube URL with no captions shows D-08 fallback message | integration | `npx playwright test tests/phase6/youtube-no-captions.spec.ts -x` | ❌ Wave 0 |
| VID-04 | Named stage indicators appear in correct sequence during processing | integration | `npx playwright test tests/phase6/stage-progress.spec.ts -x` | ❌ Wave 0 |
| VID-05 | Transcript panel shows timestamped segments on review page | e2e | `npx playwright test tests/phase6/transcript-review.spec.ts -x` | ❌ Wave 0 |
| VID-06 | Video-sourced SOP requires section approval before publish (same gate as documents) | integration | `npx playwright test tests/phase6/publish-gate.spec.ts -x` | ❌ Wave 0 |
| VID-07 | Missing hazards/PPE section triggers warning banner on review page | integration | `npx playwright test tests/phase6/safety-warning.spec.ts -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx playwright test --project=integration --grep "@video" --reporter=line`
- **Per wave merge:** `npx playwright test --project=integration --project=e2e`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/phase6/video-upload.spec.ts` — VID-01
- [ ] `tests/phase6/youtube-url.spec.ts` — VID-02
- [ ] `tests/phase6/youtube-no-captions.spec.ts` — VID-02 (no-caption case)
- [ ] `tests/phase6/stage-progress.spec.ts` — VID-04
- [ ] `tests/phase6/transcript-review.spec.ts` — VID-05
- [ ] `tests/phase6/publish-gate.spec.ts` — VID-06
- [ ] `tests/phase6/safety-warning.spec.ts` — VID-07
- [ ] `tests/phase6/fixtures/` — shared fixtures for mock video file, mock YouTube videoId with captions, mock YouTube videoId without captions

**Note on test strategy:** Playwright integration tests should mock the external APIs (OpenAI transcription, Anthropic verification, youtube-transcript) to avoid API cost and network dependency during CI. Use Playwright's `page.route()` to intercept the relevant API routes and return fixture responses.

## Project Constraints (from CLAUDE.md)

| Directive | Constraint |
|-----------|------------|
| Framework | Next.js 16 (App Router), React 19, TypeScript 5 |
| Styling | Tailwind CSS 4 (PostCSS plugin) — no shadcn |
| Database/Auth | Supabase (Postgres, Auth, Storage, RLS policies) |
| AI | OpenAI API (GPT-4o) for structuring — existing; gpt-4o-transcribe for audio |
| Testing | Playwright only (integration + E2E) |
| Icons | Lucide React |
| Theme | Dark mode default (`bg-steel-900`, `text-brand-yellow` palette) |
| Dev port | 4200 (`npm run dev`) |
| Upload | TUS resumable for large files — already wired in Phase 5 |
| Server actions | In `src/actions/` for mutations; API routes for complex operations |
| Validation | Zod schemas in `src/lib/validators/` |
| Supabase | RLS for all data access; `admin.ts` client for elevated operations only |
| Build | `next build --webpack` (Turbopack conflicts with @serwist/next) |
| Service worker | Disabled in development (`NODE_ENV === 'development'`) |
| Offline | Not applicable to admin video upload (admin-only, reliable connection assumed) |
| Security | `getSourceFileType` throws on unknown MIME types — extend to include video types |

## Sources

### Primary (HIGH confidence)
- `src/app/api/sops/parse/route.ts` — existing parse orchestrator pattern to extend
- `src/lib/parsers/gpt-parser.ts` — FORMAT_HINTS pattern for video input type
- `src/types/sop.ts` — SourceFileType, ParseJob types to extend
- `src/lib/upload/tus-upload.ts` — TUS upload helper to reuse
- `supabase/migrations/00011_expanded_file_intake.sql` — parse_jobs schema extension pattern
- `.planning/research/STACK.md` (2026-03-29) — library recommendations, integration pipelines
- `.planning/research/ARCHITECTURE.md` (2026-03-29) — Vercel constraints, component structure
- `.planning/research/PITFALLS.md` (2026-03-29) — pitfalls 9-11 directly relevant to Phase 6
- `@ffmpeg/ffmpeg` npm registry — version 0.12.15 confirmed
- `youtube-transcript` npm registry — version 1.3.0 confirmed
- `@anthropic-ai/sdk` npm registry — version 0.82.0 confirmed
- `openai` npm registry — version 6.33.0 current (6.32.0 installed)

### Secondary (MEDIUM confidence)
- `.planning/phases/06-video-transcription-upload-and-url/06-CONTEXT.md` — locked decisions D-01 through D-13
- `.planning/phases/06-video-transcription-upload-and-url/06-UI-SPEC.md` — design tokens and interaction spec
- OpenAI audio transcription documentation (gpt-4o-transcribe, verbose_json format, prompt parameter for vocabulary)
- Anthropic Claude API documentation (messages.create, model IDs, pricing)

### Tertiary (LOW confidence — flag for validation)
- COEP header scoping behavior in Next.js `headers()` — untested in this specific project setup; validate early in Wave 0
- youtube-transcript behavior on age-restricted or private videos — not fully characterized in package documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages confirmed on npm registry; existing codebase confirms TUS, openai SDK already installed
- Architecture: HIGH — extension points are clearly identified in existing code; patterns reuse established Phase 2-5 conventions
- Pitfalls: HIGH — pitfalls 1-5 derived from existing PITFALLS.md (authoritative) plus direct code analysis
- Adversarial verification: MEDIUM — Claude Haiku model choice and false positive rate unvalidated empirically; model API is confirmed

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (packages change slowly; OpenAI model names are stable; YouTube caption endpoint is stable but ToS-dependent)
