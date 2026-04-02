# Architecture Research

**Domain:** Multi-tenant SaaS PWA — SOP management with video transcription, expanded file parsing, and AI video generation
**Researched:** 2026-03-29
**Confidence:** HIGH (core integration patterns verified via official docs and live service documentation)

---

## What This Document Covers

This is a milestone-scoped update to the original architecture research (2026-03-23). It answers the specific integration question for v2.0: **how do three new SOP creation pathways slot into the existing Next.js 16 + Supabase + Vercel architecture without requiring a rewrite?**

The original architecture document covers the base system (multi-tenant auth, RLS, offline-first data layer, async parsing pipeline). This document extends it with new components only.

---

## Existing Architecture Anchor Points

These are the elements of the current system that new features must integrate with cleanly:

| Component | Current Role | Extension Point for v2.0 |
|-----------|-------------|--------------------------|
| `parse_jobs` table | Tracks doc → SOP jobs (queued/processing/completed/failed) | Extend with `input_type` column to support video, image, xlsx, pptx, txt |
| `POST /api/sops/parse` route | Orchestrates mammoth/unpdf → GPT-4o → DB write | Extract into shared pipeline; per-input-type branches |
| `src/lib/parsers/` | `extract-docx.ts`, `extract-pdf.ts`, `ocr-fallback.ts`, `gpt-parser.ts`, `image-uploader.ts` | Add new extractors alongside existing ones |
| `createUploadSession` server action | Creates SOP + parse_job + presigned Supabase Storage URL | Extend with video upload path (TUS resumable instead of signed URL) |
| Supabase Storage | `sop-documents` bucket for original files | Add `sop-videos` bucket (raw input), `sop-generated-videos` bucket (output) |
| Supabase Realtime | `parse_jobs` subscribed for live status in admin UI | Reuse as-is for new job types — same status FSM |
| GPT-4o structured output (`gpt-parser.ts`) | Text → `ParsedSopSchema` via `zodResponseFormat` | Second pass: transcript text → same schema; reuse unchanged |

---

## Vercel Constraint Reality Check

Understanding Vercel's limits is the foundation of every architectural decision here.

| Constraint | Limit | Impact on v2.0 |
|-----------|-------|----------------|
| Request body size | **4.5 MB hard limit** | Video files cannot pass through a Vercel Function. Must bypass entirely via client-to-storage direct upload. |
| Function bundle size | 250 MB (uncompressed) | FFmpeg binary (~50 MB) is feasible, but `@remotion` requires Chromium (~120 MB+) — too large. Chromium-based video render is NOT viable on Vercel Functions. |
| Max duration (Pro, no Fluid Compute) | **300 s (5 min)** | Audio extraction + Whisper transcription for a 15-min video could exceed this. Must use the existing `maxDuration = 300` pattern with care, or use durable jobs via Inngest. |
| Max duration (Pro, with Fluid Compute) | **800 s (13 min)** | More headroom. Large transcription jobs still borderline — durable jobs remain safer. |
| ffmpeg-static on Vercel | ~50 MB binary, feasible but risky on bundle size | Audio extraction from video for Whisper: use `ffmpeg-static` in a Node.js Route Handler with `outputFileTracingIncludes` to bundle the binary. Tested pattern, not trivial. |

**Decision forced by constraints:** Video files must be uploaded by the client directly to Supabase Storage using TUS resumable upload. Processing happens entirely server-side in a long-running Route Handler or durable job function — never in the upload request path.

---

## Standard Architecture (Updated for v2.0)

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER (PWA)                            │
├──────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    SOP Admin UI                                 │  │
│  │                                                                 │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐    │  │
│  │  │ File → SOP   │  │ Video → SOP  │  │ File → Video SOP   │    │  │
│  │  │ (expanded)   │  │ (NEW)        │  │ (NEW)              │    │  │
│  │  │              │  │              │  │                    │    │  │
│  │  │ - docx/pdf   │  │ - upload MP4 │  │ - select input SOP │    │  │
│  │  │ - image/OCR  │  │ - YouTube URL│  │ - choose format    │    │  │
│  │  │ - xlsx/pptx  │  │ - record in  │  │ - narrated slides  │    │  │
│  │  │ - plain text │  │   browser    │  │ - screen recording │    │  │
│  │  └──────┬───────┘  └──────┬───────┘  └─────────┬──────────┘    │  │
│  │         │                 │                     │               │  │
│  │  ┌──────▼─────────────────▼─────────────────────▼────────────┐  │  │
│  │  │  Upload Orchestrator (client-side)                         │  │  │
│  │  │  - Small files (<50 MB): existing signed URL flow          │  │  │
│  │  │  - Video files: TUS resumable upload (tus-js-client)       │  │  │
│  │  │  - YouTube/Vimeo URL: POST to API with URL only            │  │  │
│  │  │  - In-app recording: MediaRecorder → blob → TUS upload     │  │  │
│  │  └───────────────────────────┬────────────────────────────────┘  │  │
│  └─────────────────────────────┬┘                                   │  │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
            ┌────────────────────┴────────────────────┐
            │ TUS Resumable (large video)              │ HTTPS API (all others)
            ▼                                          ▼
┌───────────────────────┐       ┌────────────────────────────────────────┐
│  Supabase Storage     │       │            API LAYER (Next.js)          │
│                       │       ├────────────────────────────────────────┤
│  sop-documents        │       │  /api/sops/parse (existing, extended)   │
│  sop-videos (NEW)     │       │  /api/sops/transcribe (NEW)             │
│  sop-generated-videos │       │  /api/sops/generate-video (NEW)         │
│    (NEW)              │       │  /api/sops/youtube (NEW)                │
└──────────┬────────────┘       └────────────────┬───────────────────────┘
           │                                      │
           └─────────────────┬────────────────────┘
                             │
┌────────────────────────────▼───────────────────────────────────────────┐
│                    ASYNC PROCESSING LAYER                               │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  parse_jobs table (extended — same FSM, new input_type values)          │
│                                                                         │
│  ┌─────────────────────────┐   ┌────────────────────────────────────┐  │
│  │  Document Parsers       │   │  Video Processing Pipeline (NEW)   │  │
│  │  (existing)             │   │                                    │  │
│  │  - extract-docx.ts      │   │  Step 1: fetch/download from       │  │
│  │  - extract-pdf.ts       │   │    Storage or YouTube URL          │  │
│  │  - ocr-fallback.ts      │   │  Step 2: extract audio             │  │
│  │  (new)                  │   │    (ffmpeg-static, server-side)    │  │
│  │  - extract-image.ts     │   │  Step 3: transcribe audio          │  │
│  │  - extract-xlsx.ts      │   │    (OpenAI gpt-4o-transcribe)      │  │
│  │  - extract-pptx.ts      │   │  Step 4: structure transcript      │  │
│  │  - extract-txt.ts       │   │    (GPT-4o structured output)      │  │
│  └───────────┬─────────────┘   └────────────────┬───────────────────┘  │
│              │                                   │                      │
│              └──────────────┬────────────────────┘                      │
│                             │                                           │
│  ┌──────────────────────────▼──────────────────────────────────────┐   │
│  │          gpt-parser.ts (unchanged) — text → ParsedSopSchema     │   │
│  └──────────────────────────┬──────────────────────────────────────┘   │
│                             │                                           │
│  ┌──────────────────────────▼──────────────────────────────────────┐   │
│  │       Video Generation Pipeline (NEW — Pathway 3)               │   │
│  │  Input: published SOP (existing structured data)                │   │
│  │  Step 1: ElevenLabs TTS — generate narration audio per section  │   │
│  │  Step 2a (narrated slides): Remotion Lambda render              │   │
│  │  Step 2b (screen recording): Remotion Lambda render             │   │
│  │  Step 2c (full AI video): Runway/Luma API (external)            │   │
│  │  Step 3: store MP4 in sop-generated-videos bucket               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## New Components Required

### Pathway 1 — Video → SOP

#### New: `src/lib/parsers/extract-audio.ts`
- Runs server-side in a Next.js Route Handler
- Uses `ffmpeg-static` (Node.js binary, bundled via `outputFileTracingIncludes`)
- Reads video file from Supabase Storage, streams audio out as MP3
- Must handle: MP4, MOV, WEBM input formats
- Output: MP3 buffer or temp file path for Whisper
- Confidence: MEDIUM — `ffmpeg-static` on Vercel is documented but bundle-sensitive; test early

#### New: `src/lib/parsers/transcribe-audio.ts`
- Calls `openai.audio.transcriptions.create` with model `gpt-4o-transcribe`
- 25 MB file limit on OpenAI API; videos up to ~45 minutes at typical speech bitrate before file splitting is needed
- Returns raw transcript text + timestamps (VTT format optional)
- Feed transcript text into existing `gpt-parser.ts` unchanged — same `ParsedSopSchema` output
- Confidence: HIGH — official OpenAI SDK, well-documented

#### New: `src/lib/parsers/fetch-youtube-transcript.ts`
- For YouTube URLs: use `youtube-transcript` npm package (fetches existing auto-captions, no video download needed)
- Falls back to: download audio via `ytdl-core`, then transcribe via Whisper (requires ffmpeg for format conversion)
- For Vimeo URLs: no caption API — must download audio stream and transcribe
- Legal note: only use for the customer's own content — state in UI
- Confidence: MEDIUM — `youtube-transcript` works when captions exist; `ytdl-core` is a grey-area dependency that breaks when YouTube updates

#### New: `src/app/api/sops/transcribe/route.ts`
- Orchestrates the video transcription pipeline
- `export const maxDuration = 300` (existing pattern)
- For very long videos (>15 min), split audio into chunks before Whisper API call (25 MB limit)
- Parallelize chunk transcription with `Promise.all`

#### Modified: `createUploadSession` server action
- Add branch: if `input_type === 'video'`, return TUS endpoint URL + auth token instead of presigned URL
- TUS upload goes directly from client to Supabase Storage (bypasses Vercel's 4.5 MB limit)

#### New: Client upload component for video
- `src/components/admin/VideoUploader.tsx`
- Uses `tus-js-client` for chunked resumable upload
- Progress bar (bytes uploaded / bytes total)
- Shows recording UI trigger if user selects "record in browser"

#### New: `src/components/admin/VideoRecorder.tsx`
- Uses `MediaRecorder` API with `getUserMedia({ video: true, audio: true })`
- Records to WEBM blob chunks, accumulates, triggers TUS upload on stop
- iOS Safari caveat: MediaRecorder for video works on iOS 15.1+, but long recordings (>1 min) may cause page reload — cap in-app recording at 5 minutes, show warning
- Confidence: MEDIUM — iOS Safari video recording is documented as unstable for long durations

---

### Pathway 2 — File → SOP (Expanded)

#### New: `src/lib/parsers/extract-image.ts`
- For uploaded images (JPG, PNG, HEIC, WEBP)
- Use GPT-4o vision (`openai.chat.completions.create` with image URL in message content) — superior to tesseract.js for structured industrial documents
- Tesseract.js already installed (Phase 2) — retain as fallback for large-batch cases where cost matters
- GPT-4o vision cost: ~$0.002–0.005 per image at typical SOP photo sizes — acceptable for admin upload flow
- Confidence: HIGH — GPT-4o vision for OCR is well-documented and outperforms Tesseract on complex layouts

#### New: `src/lib/parsers/extract-xlsx.ts`
- Use `xlsx` (SheetJS) — best-in-class, TypeScript-native, handles `.xlsx` and `.xls`
- Convert each sheet to JSON rows, then feed text summary to `gpt-parser.ts`
- Tables/checklists in spreadsheets map well to SOP step structures
- Confidence: HIGH — SheetJS is the standard, well-maintained, official npm package

#### New: `src/lib/parsers/extract-pptx.ts`
- Use `officeparser` — v6.0.0 (released late 2025) added AST output with slide text, notes, embedded images
- Extracts speaker notes (often contain step-by-step instructions), slide text, and image references
- Feed combined slide text + notes into `gpt-parser.ts`
- Confidence: MEDIUM — `officeparser` v6 is recent; verify package stability before committing

#### New: `src/lib/parsers/extract-txt.ts`
- Plain text: minimal processing — strip excess whitespace, feed directly to `gpt-parser.ts`
- Also handles `.md` (Markdown) and `.csv` (convert rows to readable text first)
- Confidence: HIGH — trivial implementation

#### Modified: `POST /api/sops/parse` route
- Add `input_type` routing at top of handler
- Delegate to new extractors based on MIME type / file extension
- All paths converge at `gpt-parser.ts(text)` → `ParsedSopSchema` — no schema changes needed

#### Modified: `UploadDropzone.tsx`
- Add new accepted MIME types: `image/*`, `.xlsx`, `.xls`, `.pptx`, `.ppt`, `.txt`, `.md`, `.csv`
- Adjust file size limit messaging (images/text can still use 50 MB limit)

---

### Pathway 3 — File → Video SOP

This is architecturally the most distinct pathway. It runs on an already-published SOP, not on raw file input.

#### New: `src/app/api/sops/generate-video/route.ts`
- Input: SOP ID + output format choice (narrated_slides | screen_recording | ai_video)
- Creates a new `video_generation_jobs` record (new table, same FSM pattern)
- Delegates to the appropriate generator
- `export const maxDuration = 300`

#### New DB table: `video_generation_jobs`
```sql
create table public.video_generation_jobs (
  id           uuid primary key default gen_random_uuid(),
  sop_id       uuid not null references public.sops(id),
  org_id       uuid not null references public.organisations(id),
  output_format text not null check (output_format in ('narrated_slides', 'screen_recording', 'ai_video')),
  status        text not null default 'queued'
               check (status in ('queued', 'generating_audio', 'rendering_video', 'uploading', 'completed', 'failed')),
  error_message text,
  output_url    text,         -- presigned read URL once complete
  created_at    timestamptz default now(),
  completed_at  timestamptz
);
-- RLS: org_id matches JWT tenant
```

#### New: `src/lib/video-gen/tts.ts`
- Calls ElevenLabs TTS API to generate narration audio for each SOP section/step
- Input: array of text strings (section title + step content)
- Output: array of MP3 audio buffers or storage URLs
- Cost: ~$0.30 per 1,000 characters (Creator plan overage) — a 50-step SOP ≈ 3,000 chars = ~$0.90
- Confidence: HIGH — ElevenLabs has a stable REST API with Node.js SDK

#### New: `src/lib/video-gen/render-slides.ts` (narrated slideshow + screen recording)
- Uses `@remotion/lambda` to trigger a render job on AWS Lambda
- Remotion Lambda is the ONLY viable approach: full Chromium + FFmpeg (~150 MB+) cannot run on Vercel Functions
- Vercel Sandbox is an alternative but is slower (sequential, not parallel) and has startup latency
- Recommendation: Remotion Lambda for production reliability; Vercel Sandbox acceptable for v2.0 prototype
- Remotion React component: renders SOP sections as slides with TTS audio synced to slide transitions
- Output: MP4 file stored in `sop-generated-videos` Supabase Storage bucket
- Confidence: HIGH — Remotion Lambda is a well-documented, production-ready pattern

#### New: `src/lib/video-gen/ai-video.ts` (full AI video with animations — Phase 3 of Pathway 3)
- Delegates to Runway Gen-3 API (or Luma Dream Machine) via REST
- Input: text prompt derived from SOP step content
- Output: short video clips per step, then concatenate via ffmpeg
- This format is the most complex and highest cost — recommend deferring to a later iteration
- Confidence: MEDIUM — Runway API is production-ready but cost is high (~$0.05–0.10/second of video) and output quality for industrial SOPs (e.g., "torque bolts to 40Nm") is unreliable

---

## Database Schema Additions

### Extended `parse_jobs` Table

The existing `parse_jobs` table needs a new column to distinguish input types:

```sql
alter table public.parse_jobs
  add column input_type text not null default 'document'
    check (input_type in ('document', 'video_file', 'youtube_url', 'vimeo_url', 'in_app_recording', 'image', 'xlsx', 'pptx', 'txt'));
```

No other schema changes to `parse_jobs`. Status FSM, RLS policies, and Realtime publication are all reused unchanged.

### New: `video_generation_jobs` Table

See schema above. Keep separate from `parse_jobs` — it has a different status vocabulary, different input (SOP ID vs file), and different outputs.

### New Supabase Storage Buckets

| Bucket | Contents | RLS | Notes |
|--------|----------|-----|-------|
| `sop-videos` | Raw uploaded video files, in-app recordings | Admin write, admin read | Large files — up to 2 GB. TUS upload. |
| `sop-generated-videos` | Rendered MP4 outputs from Pathway 3 | Admin write, admin read; workers read | Presigned read URLs for playback. Lifecycle policy: delete if SOP archived. |

Existing `sop-documents` bucket is unchanged.

---

## Data Flow Changes

### New: Video File → SOP

```
Admin uploads MP4/MOV (any size, up to ~2 GB)
    ↓
Client: createUploadSession server action (input_type='video_file')
    → returns TUS endpoint + auth token (not a presigned URL)
    ↓
Client: tus-js-client uploads directly to Supabase Storage 'sop-videos' bucket
    → chunks 6 MB at a time, resumable
    ↓
Client: POST /api/sops/transcribe (after TUS upload completes — tus onSuccess callback)
    ↓
Route Handler:
    1. Set parse_job status = 'processing'
    2. Download video from Supabase Storage → temp buffer
    3. extract-audio.ts: ffmpeg-static converts to MP3
    4. transcribe-audio.ts: gpt-4o-transcribe → raw transcript text
    5. gpt-parser.ts: transcript → ParsedSopSchema (REUSED UNCHANGED)
    6. Write sop_sections/sop_steps to DB (REUSED UNCHANGED)
    7. Set parse_job status = 'completed'
    ↓
Admin UI: Supabase Realtime notifies → same review UI as document SOPs
```

### New: YouTube/Vimeo URL → SOP

```
Admin pastes YouTube or Vimeo URL
    ↓
Client: POST /api/sops/youtube { url, sop_id }
    ↓
Route Handler:
    1. Validate URL format (YouTube/Vimeo regex)
    2. YouTube: fetch-youtube-transcript.ts → attempt caption fetch (fast, free)
       - If captions available: text ready
       - If no captions: download audio via ytdl-core → transcribe-audio.ts
    3. Vimeo: download audio stream → transcribe-audio.ts
    4. gpt-parser.ts → ParsedSopSchema (REUSED UNCHANGED)
    5. Write to DB, set status = 'completed'
    ↓
Admin UI: same review UI
```

### New: SOP → Narrated Video

```
Admin selects published SOP, clicks "Generate Video", chooses format
    ↓
Client: POST /api/sops/generate-video { sop_id, format: 'narrated_slides' }
    ↓
Route Handler:
    1. Create video_generation_jobs record (status='queued')
    2. Fetch sop_sections/sop_steps from DB
    3. Set status = 'generating_audio'
    4. tts.ts: call ElevenLabs for each section/step → array of MP3 audio
    5. Set status = 'rendering_video'
    6. render-slides.ts: trigger Remotion Lambda render with SOP data + audio URLs
    7. Poll Remotion Lambda render status (async with Inngest, or synchronous for short SOPs)
    8. Set status = 'uploading'
    9. Store MP4 in sop-generated-videos bucket
    10. Set status = 'completed', output_url = presigned URL
    ↓
Admin UI: Supabase Realtime notifies → video playback + download button
```

---

## Recommended Component File Structure (New Additions Only)

```
src/
├── app/
│   └── api/
│       └── sops/
│           ├── parse/route.ts          # MODIFIED: add input_type routing
│           ├── transcribe/route.ts     # NEW: video transcription pipeline
│           ├── youtube/route.ts        # NEW: YouTube/Vimeo URL ingestion
│           └── generate-video/route.ts # NEW: video generation trigger
├── components/
│   └── admin/
│       ├── UploadDropzone.tsx          # MODIFIED: add new MIME types
│       ├── VideoUploader.tsx           # NEW: TUS resumable upload UI
│       └── VideoRecorder.tsx           # NEW: in-app MediaRecorder UI
├── lib/
│   ├── parsers/
│   │   ├── extract-docx.ts             # UNCHANGED
│   │   ├── extract-pdf.ts              # UNCHANGED
│   │   ├── ocr-fallback.ts             # UNCHANGED (kept as cost fallback)
│   │   ├── gpt-parser.ts               # UNCHANGED (reused for all pathways)
│   │   ├── image-uploader.ts           # UNCHANGED
│   │   ├── extract-audio.ts            # NEW: ffmpeg-static video → MP3
│   │   ├── transcribe-audio.ts         # NEW: gpt-4o-transcribe
│   │   ├── fetch-youtube-transcript.ts # NEW: caption fetch + ytdl fallback
│   │   ├── extract-image.ts            # NEW: GPT-4o vision OCR
│   │   ├── extract-xlsx.ts             # NEW: SheetJS
│   │   ├── extract-pptx.ts             # NEW: officeparser
│   │   └── extract-txt.ts              # NEW: plain text / markdown / CSV
│   └── video-gen/
│       ├── tts.ts                      # NEW: ElevenLabs TTS
│       ├── render-slides.ts            # NEW: Remotion Lambda trigger
│       └── ai-video.ts                 # NEW: Runway API (defer to later)
└── types/
    ├── sop.ts                          # MODIFIED: add input_type union type
    └── video-generation.ts             # NEW: VideoGenerationJob types
```

---

## Architectural Patterns

### Pattern 1: Converging Extraction Pipelines (All Pathways)

**What:** Every new input type (video, image, xlsx, pptx, txt, YouTube URL) has its own extractor module that returns a `string` — the extracted text content. All extractors feed into the same `gpt-parser.ts → ParsedSopSchema` final step, which is completely unchanged.

**Why:** The LLM understands all these formats equally well when given plain text. The extraction layer handles format-specific parsing; the structuring layer is format-agnostic.

**Trade-offs:** Some fidelity is lost (Excel column relationships, slide visual context) but this is acceptable — admins review the parsed output before publishing. The benefit is a single path to the SOP data model with no schema divergence.

**Example:**
```typescript
// Every new extractor has the same contract:
export async function extractXlsx(buffer: Buffer): Promise<string>
export async function extractPptx(buffer: Buffer): Promise<string>
export async function extractImage(imageUrl: string): Promise<string>
export async function transcribeAudio(mp3Buffer: Buffer): Promise<string>
// Then all feed into:
const parsed = await parseSopWithGPT(extractedText) // unchanged
```

### Pattern 2: TUS Resumable Upload for Large Files

**What:** Files above ~10 MB (especially video) bypass the 4.5 MB Vercel body limit by uploading directly from the browser to Supabase Storage using the TUS protocol via `tus-js-client`. The Next.js server action issues a TUS endpoint URL and auth token; the client uploads directly.

**When to use:** Video file uploads (MP4/MOV/WEBM). Existing presigned URL flow remains for documents and images.

**Trade-offs:** TUS adds client-side dependency (`tus-js-client`, ~25 KB gzipped). Upload progress is natively available via `onProgress` callback. Resumability is critical for factory floor connectivity.

**Example:**
```typescript
// In VideoUploader.tsx
import * as tus from 'tus-js-client'

const upload = new tus.Upload(file, {
  endpoint: `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`,
  headers: { authorization: `Bearer ${anonKey}` },
  metadata: {
    bucketName: 'sop-videos',
    objectName: `${orgId}/${sopId}/original/${file.name}`,
    contentType: file.type,
  },
  chunkSize: 6 * 1024 * 1024,
  onProgress(bytesUploaded, bytesTotal) {
    setProgress(Math.round((bytesUploaded / bytesTotal) * 100))
  },
  onSuccess() {
    // NOW trigger the transcription job
    triggerTranscription({ sopId, filePath })
  },
})
upload.start()
```

### Pattern 3: Reuse parse_jobs for New Input Types

**What:** Rather than creating new job queue tables per pathway, extend `parse_jobs.input_type` with new enum values. All existing infrastructure (Supabase Realtime subscription, status polling hybrid, admin UI job status display, retry logic) works without change.

**When to use:** All three new input pathways during SOP creation (Pathways 1 and 2). Pathway 3 (video generation from SOP) uses a separate `video_generation_jobs` table because its input, output, and status vocabulary are distinct.

**Trade-offs:** Adding more `input_type` values to `parse_jobs` keeps the table general-purpose, which may feel awkward later. The alternative (a separate `video_transcription_jobs` table) adds migration overhead and a separate Realtime subscription. The extension is low-risk because the status FSM is identical.

### Pattern 4: Remotion Lambda for Video Rendering (Not Vercel Functions)

**What:** Remotion's headless Chromium + FFmpeg stack cannot fit in a Vercel Function (250 MB bundle limit; Chromium alone is ~120 MB). Use `@remotion/lambda` to deploy a Remotion render function to AWS Lambda separately, then trigger renders via the Remotion Lambda SDK from a lightweight Vercel Function.

**When to use:** Pathway 3 narrated slides and screen recording formats.

**Trade-offs:** Introduces AWS Lambda as a dependency alongside Vercel. One-time setup to deploy the Remotion Lambda. Render cost is low (~$0.003 per GB-second; a 2-minute video costs ~$0.05). Alternative is Vercel Sandbox (simpler setup, but slower sequential rendering — acceptable for v2.0 prototype).

**Build order implication:** Set up Remotion Lambda in AWS before building the video generation UI. The Vercel Sandbox prototype path can be used initially to validate the UX before committing to Lambda setup.

### Pattern 5: Two-Stage Transcription for Long Videos

**What:** OpenAI's transcription API has a 25 MB file limit. A 30-minute video audio track typically exceeds this. Split the MP3 into overlapping 10-minute chunks (with 30-second overlaps to prevent cut-off sentences), transcribe each chunk in parallel with `Promise.all`, then concatenate transcripts preserving timestamps.

**When to use:** Any video longer than approximately 15 minutes (depends on audio bitrate; 25 MB at 128kbps ≈ 26 min).

**Example:**
```typescript
// transcribe-audio.ts
async function transcribeLargeAudio(mp3Buffer: Buffer): Promise<string> {
  const chunks = splitIntoChunks(mp3Buffer, 10 * 60) // 10-min chunks
  const transcripts = await Promise.all(
    chunks.map(chunk => openai.audio.transcriptions.create({
      file: new File([chunk], 'chunk.mp3', { type: 'audio/mpeg' }),
      model: 'gpt-4o-transcribe',
      response_format: 'text',
    }))
  )
  return transcripts.join(' ')
}
```

---

## Integration Points

### New External Services

| Service | Integration Pattern | Why | Confidence |
|---------|---------------------|-----|------------|
| OpenAI Transcription API (`gpt-4o-transcribe`) | REST via existing `openai` SDK (`openai.audio.transcriptions.create`) | Best transcription accuracy, already have OpenAI SDK and API key | HIGH |
| ElevenLabs TTS API | REST via `elevenlabs` npm SDK | Best-in-class voice quality for narrated video; per-character billing | HIGH |
| Remotion Lambda | AWS Lambda deployment via `@remotion/lambda` SDK | Only viable video render option within Vercel deployment constraints | HIGH |
| Runway Gen-3 API | REST (`fetch`) — no official npm SDK | Fallback for "full AI video" format (Pathway 3, deferred) | MEDIUM |
| `youtube-transcript` (npm) | Direct import, no auth required | Fetches YouTube auto-captions without video download | MEDIUM |
| Supabase TUS endpoint | `tus-js-client` from browser | Bypass Vercel 4.5 MB body limit for large video uploads | HIGH |

### Modified Internal Boundaries

| Boundary | Before | After |
|----------|--------|-------|
| Client → Storage | Presigned URL (signed URL, one-shot PUT) | Presigned URL for docs; TUS resumable for video |
| `createUploadSession` → `parse` trigger | Unified: always POST /api/sops/parse | Branched: docs → POST /api/sops/parse; video files → POST /api/sops/transcribe; YouTube → POST /api/sops/youtube |
| `parse_jobs` input_type | Implicitly 'document' | Explicit column: 'document' | 'video_file' | 'youtube_url' | 'vimeo_url' | 'in_app_recording' | 'image' | 'xlsx' | 'pptx' | 'txt' |
| Admin review UI | Reads from sop_sections/sop_steps after parse | Unchanged — all pathways write to the same schema |
| `gpt-parser.ts` | Called from parse route handler only | Called from parse route, transcribe route, youtube route — all pass plain text, all get ParsedSopSchema back |

---

## Build Order

Build order is determined by dependency graph and risk. De-risk the novel parts (video upload, ffmpeg, Remotion) before the cosmetically simple parts (xlsx, txt parsing).

1. **`parse_jobs` migration** — Add `input_type` column. Prerequisite for everything else. (1 migration, 15 min)

2. **`sop-videos` and `sop-generated-videos` storage buckets** — Create buckets + RLS policies. All video upload flows depend on these. (1 migration, 30 min)

3. **Expanded document parsers (Pathway 2)** — `extract-image.ts` (GPT-4o vision), `extract-xlsx.ts` (SheetJS), `extract-pptx.ts` (officeparser), `extract-txt.ts`. These are low-risk additions to `src/lib/parsers/` alongside existing extractors. Wire into `/api/sops/parse` with `input_type` routing. (2–3 plans)

4. **TUS video upload infrastructure** — `VideoUploader.tsx` client component + modified `createUploadSession` + TUS endpoint config. This must be validated early because it's the most novel integration. (1 plan)

5. **Video transcription pipeline (Pathway 1 — file upload)** — `extract-audio.ts` (ffmpeg-static), `transcribe-audio.ts` (gpt-4o-transcribe), `/api/sops/transcribe` route. Validate with a short test video first to confirm ffmpeg binary bundle size and Vercel cold start behavior. (2 plans)

6. **YouTube/Vimeo URL pathway (Pathway 1 — URL)** — `fetch-youtube-transcript.ts` + `/api/sops/youtube` route. Lower priority than file upload; use as a refinement after file upload is stable. (1 plan)

7. **In-app video recording (Pathway 1 — record in browser)** — `VideoRecorder.tsx` using MediaRecorder → TUS upload. iOS Safari limitations require careful testing. Defer until file upload and YouTube paths are shipped. (1 plan)

8. **`video_generation_jobs` table + video generation skeleton (Pathway 3)** — DB migration + `generate-video` route skeleton + admin UI trigger. Set up Remotion Lambda AWS deployment. (1 plan setup + 1 plan UI)

9. **ElevenLabs TTS + narrated slides render (Pathway 3 narrated slides)** — `tts.ts` + `render-slides.ts` + Remotion React component for slides. This is the highest-value Pathway 3 format. (2 plans)

10. **Screen recording format (Pathway 3 screen recording style)** — Variant of narrated slides with scrolling SOP content. Low additional effort if Remotion Lambda is already set up. (1 plan)

11. **Full AI video format (Pathway 3 AI video)** — Runway/Luma API. Defer until the simpler formats are validated with real users. The quality and cost need user validation before investing in the integration. (1 plan — later iteration)

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-500 SOPs/month | All processing in Route Handlers with `maxDuration = 300`. Remotion Lambda for video gen. No additional infra. |
| 500-5k SOPs/month | Add Inngest for durable job orchestration (replaces polling + timeout risk on long videos). Inngest wraps existing route handlers — minimal code change. |
| 5k+ SOPs/month | Dedicated Supabase Storage CDN for video delivery. Consider Mux for video hosting + built-in transcription (replaces ffmpeg + Whisper combination at scale with one API). |

**First bottleneck for v2.0:** ffmpeg-static cold start on Vercel. The binary must be bundled into the function; first invocation will be slow. Mitigate by keeping the transcription function warm or migrating to Inngest where the function environment persists between steps.

**Second bottleneck:** ElevenLabs TTS rate limits. At Starter/Creator tier, concurrent request limits apply. Queue TTS requests serially per video generation job.

---

## Anti-Patterns

### Anti-Pattern 1: Routing Video Through a Next.js API Body

**What people do:** Accept the video file as a `multipart/form-data` body in a Next.js Route Handler.

**Why it's wrong:** Vercel's 4.5 MB hard limit will reject any video file. This fails silently in development (no Vercel limits) and catastrophically in production.

**Do this instead:** Issue a TUS resumable upload token from the server action. The client uploads directly to Supabase Storage. The Vercel function is never in the data path.

### Anti-Pattern 2: Bundling Chromium in a Vercel Function for Video Rendering

**What people do:** Install `@remotion/renderer` directly in a Next.js Route Handler, expecting to call `renderMedia()` server-side on Vercel.

**Why it's wrong:** Remotion's renderer requires Chromium (~120 MB) + FFmpeg (~50 MB). The Vercel function bundle limit is 250 MB. Even if it fits, Chromium cannot run in Vercel's serverless sandbox.

**Do this instead:** Deploy Remotion Lambda to AWS. Trigger renders from Vercel via the `@remotion/lambda` SDK's `renderMediaOnLambda()` — the Vercel function sends a job to Lambda; Lambda does the actual render.

### Anti-Pattern 3: Synchronous Video Transcription in the Upload Request

**What people do:** On upload success, immediately await the full transcription pipeline in the same request cycle.

**Why it's wrong:** A 10-minute video → audio extraction (~30s) + Whisper transcription (~60s) = ~90 seconds minimum. Vercel's default timeout is 300s but cold starts and LLM latency can push this. More critically, the user is blocked waiting with no progress updates.

**Do this instead:** Return `202 Accepted` from the transcription trigger endpoint. Update `parse_job.status` in real time. The admin UI subscribes to Supabase Realtime on `parse_jobs` — existing code handles this already.

### Anti-Pattern 4: Using a Single Job Table for Both Parsing and Video Generation

**What people do:** Add video generation jobs to `parse_jobs` as another `input_type` value.

**Why it's wrong:** Video generation (Pathway 3) has a different input (SOP ID, not a file), different status stages (`generating_audio`, `rendering_video`), and a different output (video URL, not structured SOP sections). Forcing it into `parse_jobs` creates schema confusion and makes the Realtime subscription logic in the admin UI brittle.

**Do this instead:** Separate `video_generation_jobs` table. Separate admin UI section for video generation status. The two tables can share the same Realtime notification pattern — just subscribe to both.

### Anti-Pattern 5: Using ytdl-core as the Primary YouTube Ingestion Path

**What people do:** Default to downloading YouTube video/audio via `ytdl-core` for all YouTube URLs.

**Why it's wrong:** YouTube actively blocks `ytdl-core` as it violates YouTube's ToS for automated downloading. The library has frequent breakage as YouTube changes its internals. Server IPs get rate-limited or blocked.

**Do this instead:** Primary path is `youtube-transcript` (fetches auto-captions from YouTube's own caption API, no download needed, works on public videos with captions). Only fall back to audio download if captions are absent — and document clearly in the UI that the user is responsible for having rights to transcribe the video content.

---

## Sources

- [Vercel Functions Limits — official docs](https://vercel.com/docs/functions/limitations) — body size 4.5 MB, max duration 300s (Pro) / 800s (Pro + Fluid Compute), bundle 250 MB — HIGH confidence
- [Supabase Resumable Uploads — TUS protocol](https://supabase.com/docs/guides/storage/uploads/resumable-uploads) — TUS, 50 GB max, 6 MB chunk size — HIGH confidence
- [OpenAI Speech to Text API](https://platform.openai.com/docs/guides/speech-to-text) — 25 MB limit, gpt-4o-transcribe model, $0.006/min — HIGH confidence
- [Remotion on Vercel — limitations](https://www.remotion.dev/docs/miscellaneous/vercel-functions) — "not possible to render on Vercel Functions due to Chromium" — HIGH confidence
- [Remotion Lambda docs](https://www.remotion.dev/docs/lambda) — distributed rendering, AWS Lambda, recommended approach — HIGH confidence
- [Remotion Vercel Sandbox docs](https://www.remotion.dev/docs/vercel-sandbox) — 45 min timeout Hobby, 5 hr Pro, 10 concurrent Hobby — HIGH confidence
- [ElevenLabs API pricing](https://elevenlabs.io/pricing/api) — per-character billing, Creator plan overage $0.30/1k chars — HIGH confidence
- [youtube-transcript npm](https://www.npmjs.com/package/youtube-transcript) — fetches YouTube auto-captions without download — MEDIUM confidence (community package)
- [ffmpeg-wasm Vercel issues](https://github.com/ffmpegwasm/ffmpeg.wasm/issues/622) — not viable for server-side on Vercel; ffmpeg-static is the approach — MEDIUM confidence
- [SheetJS xlsx npm](https://www.npmjs.com/package/xlsx) — Excel parsing, TypeScript support — HIGH confidence
- [officeparser npm v6.0.0](https://github.com/harshankur/officeParser) — PPTX/DOCX/XLSX AST output, late 2025 major release — MEDIUM confidence (recent major version)
- [OpenAI gpt-4o vision for OCR](https://intuitionlabs.ai/articles/ai-ocr-models-pdf-structured-text-comparison) — GPT-4o vision superior to Tesseract for complex layouts — MEDIUM confidence (independent comparison)
- [Inngest Next.js background jobs](https://www.inngest.com/blog/run-nextjs-functions-in-the-background) — durable jobs for long-running video processing — MEDIUM confidence (vendor blog, but well-documented)

---

*Architecture research for: SOP Assistant v2.0 — SOP Creation Pathways (video transcription, expanded file parsing, AI video generation)*
*Researched: 2026-03-29*
