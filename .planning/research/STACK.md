# Technology Stack

**Project:** SafeStart — SOP Creation Pathways (v2.0 Milestone)
**Researched:** 2026-03-29
**Scope:** NEW additions only — Video transcription, expanded file parsing, video generation with TTS
**Note:** Existing validated stack (Next.js 16, Supabase, GPT-4o, Dexie.js, @serwist/next, TanStack Query, mammoth, unpdf, tesseract.js) is documented in STACK.md (2026-03-23) and is not repeated here.

---

## What Needs to Change (Summary)

The three new pathways each require distinct additions:

| Pathway | New Capability | Primary Addition |
|---------|---------------|-----------------|
| Video → SOP | Transcription of uploaded video/audio | OpenAI `gpt-4o-transcribe` (already in `openai` SDK v6) |
| Video → SOP | Extract existing captions from YouTube/Vimeo URL | `youtube-transcript` (no download required) |
| Video → SOP | In-browser camera recording | `MediaRecorder` API (native — no library) |
| Video → SOP | Audio extraction from uploaded video for chunking | `@ffmpeg/ffmpeg` (WASM, client-side) |
| File → SOP (expanded) | Excel (.xlsx) text/table extraction | `officeparser` v6 |
| File → SOP (expanded) | PowerPoint (.pptx) text extraction | `officeparser` v6 (same library) |
| File → SOP (expanded) | Plain text (.txt, .csv) | Native `fs.readFile` / `Request.text()` — no library |
| File → Video SOP | AI voice narration (TTS) | OpenAI `gpt-4o-mini-tts` (already in `openai` SDK v6) |
| File → Video SOP | Video composition & rendering | Shotstack API (cloud, no binary) |

The OpenAI SDK (already installed) covers both the transcription models and the TTS models — no new SDK required for those capabilities.

---

## New Libraries Required

### Pathway 1: Video → SOP

#### Audio Transcription

No new package required. The existing `openai` SDK v6 already supports `gpt-4o-transcribe`:

```typescript
const transcription = await openai.audio.transcriptions.create({
  file: audioFile,
  model: 'gpt-4o-transcribe',
  response_format: 'verbose_json', // returns timestamps + segments
})
```

Use `gpt-4o-transcribe` over `whisper-1`. It has lower word error rate and is the current flagship model. Use `gpt-4o-mini-transcribe` at $0.003/min when cost is more important than accuracy (low-quality audio, informal recordings).

**Whisper API constraint:** 25 MB file size limit per request. Most factory floor videos will exceed this. The chunking strategy is: client extracts audio with `@ffmpeg/ffmpeg`, strips video track (MP4 → MP3 reduces file size by ~10×), uploads the audio file. If audio still exceeds 25 MB (roughly 45+ minutes at MP3 128 kbps), split with timestamps and stitch transcription segments server-side. In practice, SOP walkthrough recordings are typically under 15 minutes.

#### YouTube / Vimeo URL Transcription

**Recommended:** `youtube-transcript` for YouTube, Vimeo official API for Vimeo.

Do NOT download the video from YouTube or Vimeo. Terms of service violations, unnecessary bandwidth, and legal risk. Instead:

- **YouTube:** Use the `youtube-transcript` package to fetch auto-generated captions directly from YouTube's caption XML endpoint. This uses YouTube's own API surface (same as the captions button in the player). Call from a Next.js Route Handler (not client-side, to avoid CORS). If a video has no auto-generated captions, fall back to downloading audio and transcribing with Whisper.
- **Vimeo:** The Vimeo API (`/videos/{id}/texttracks`) returns VTT subtitle files for videos where the owner has enabled captions or where Vimeo has auto-generated them. Authentication is required (Bearer token). For videos with no text tracks, fall back to audio download + Whisper.

The fallback path (download audio for transcription) requires `yt-dlp` as a system binary on the server. This is not viable on Vercel serverless (binary too large, no shell access). If the app is deployed on Vercel, the fallback must go through a separate worker (Supabase Edge Function with a container, or a dedicated small VPS). Flag this as a deployment decision point.

| Package | Version | Why |
|---------|---------|-----|
| `youtube-transcript` | `^1.3.0` | Fetches YouTube auto-captions without downloading video. Serverless-compatible. Returns timestamped segments. |

#### Client-Side Audio Extraction (for uploaded video files)

**Recommended:** `@ffmpeg/ffmpeg` (ffmpeg.wasm)

When a user uploads an MP4/MOV file, the server would receive a potentially large binary. Instead, extract audio on the client before upload: strip the video track, produce an MP3. This reduces a 200 MB video upload to a 15 MB audio upload, staying under Whisper's 25 MB limit and dramatically improving upload time on industrial WiFi.

The 30 MB WASM core load is a one-time cost per session, loaded lazily only when the user enters the video upload screen.

| Package | Version | Why |
|---------|---------|-----|
| `@ffmpeg/ffmpeg` | `^0.12.x` | Client-side audio extraction from video. Strip video track, produce compressed MP3 before upload. Eliminates server-side FFmpeg binary dependency. |
| `@ffmpeg/util` | `^0.12.x` | Companion utilities for fetchFile and createFFmpegCore. Required by @ffmpeg/ffmpeg. |

**What NOT to do:** Do not install `fluent-ffmpeg` or `ffmpeg-static` for this purpose. Vercel serverless functions push over the 50 MB limit when FFmpeg binaries are included. `ffmpeg-static` path resolution breaks in serverless environments. Server-side FFmpeg is only needed if you use Remotion for video generation (addressed below in Pathway 3).

#### In-Browser Camera Recording

No library required. The `MediaRecorder` API is native to all modern browsers including Safari (supported since Safari 14, iOS 14+). This is sufficient for the PWA target audience.

```typescript
const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
const recorder = new MediaRecorder(stream, {
  // Safari produces MP4/H.264+AAC; Chrome produces WebM/VP8+Opus
  // Use isTypeSupported() to pick the right format per device
  mimeType: MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm',
})
```

**Safari caveat:** On iOS, MediaRecorder requires enabling under Settings > Safari > Advanced > Experimental Features on older iOS versions (pre-iOS 17.2). iOS 17.2+ has it on by default. Show users a "use file upload instead" fallback if `window.MediaRecorder` is undefined. This will affect some users on factory floors with un-updated iPhones — the fallback matters.

**Format handling:** Safari records MP4; Chrome/Firefox record WebM. Both formats are accepted by the OpenAI Whisper API. No transcoding is needed before sending to the transcription API.

---

### Pathway 2: File → SOP (Expanded)

#### Excel and PowerPoint Parsing

**Recommended:** `officeparser` v6

`officeparser` v6.0.0 (released December 2025) handles `.pptx`, `.xlsx`, `.docx`, `.odt`, `.odp`, `.ods`, `.pdf`, and `.rtf` in a single library. It outputs a structured AST with paragraphs, headings, tables, and extracted images as Base64. This is a superset of what mammoth does for DOCX.

**Why not SheetJS/xlsx for Excel?** The SheetJS npm package (`xlsx`) has not been published to npm since 0.18.5 — that version has known CVEs (prototype pollution, DoS via crafted files). The maintained version requires installing from SheetJS's own CDN (`https://cdn.sheetjs.com/`), which adds supply chain complexity and breaks reproducible installs. `officeparser` wraps a safe internal XLSX parser and is maintained.

**Why not a separate pptx library?** Dedicated PPTX libraries (pptx2json, js-pptx, pptx-parser) are mostly unmaintained or produce incomplete ASTs. `officeparser`'s December 2025 v6 release purpose-built AST output makes it the right choice.

**Important:** The project already uses `mammoth` for DOCX parsing. `officeparser` also handles DOCX. Do not replace mammoth — it has better fidelity for .docx embedded images and styled content (mammoth preserves bold/italic/heading structure better for AI prompting). Use `officeparser` only for XLSX, PPTX, ODT variants, and RTF. Keep mammoth for .docx.

| Package | Version | Purpose | Formats |
|---------|---------|---------|---------|
| `officeparser` | `^6.0.0` | Text + table extraction from Office formats | .pptx, .xlsx, .odt, .odp, .ods, .rtf |

#### Plain Text

No new library. In a Next.js Route Handler:
- `.txt` files: `await req.text()`
- `.csv` files: read as text, pass raw content to GPT-4o with a prompt that treats columns as procedure steps or configuration items

---

### Pathway 3: File → Video SOP

#### Text-to-Speech (TTS)

No new package required. The existing `openai` SDK v6 supports `gpt-4o-mini-tts`:

```typescript
const speech = await openai.audio.speech.create({
  model: 'gpt-4o-mini-tts',
  voice: 'alloy',          // or nova, shimmer, echo, fable, onyx
  input: sopStepText,
  instructions: 'Speak clearly and at a measured pace. This is a safety procedure.',
})
const audioBuffer = Buffer.from(await speech.arrayBuffer())
```

**Why `gpt-4o-mini-tts` over ElevenLabs or Google Cloud TTS?**

- Already in the existing OpenAI SDK — no new dependency, no new API key, no new billing account
- $0.003/1K characters ($3/million chars) vs ElevenLabs Starter at $5/month for 30K credits
- Quality is adequate for industrial safety narration — workers need clarity over emotion. ElevenLabs' superior emotional range is not a differentiator here
- If clients specifically request higher-quality narration voices, ElevenLabs can be swapped in later as an add-on tier

**Extended narration caveat:** For long SOPs (>2 minutes of narration), `gpt-4o-mini-tts` may introduce occasional pauses or stutters. Split TTS requests by SOP section (one API call per section, not the entire SOP as one input). Stitch audio segments in video composition.

#### Video Generation and Composition

**Recommended:** Shotstack API

Use Shotstack over Remotion for the following reasons:

1. **No binary dependencies.** Remotion's `@remotion/renderer` requires an FFmpeg binary in `node_modules`, which exceeds Vercel's 50 MB function limit and is explicitly "not officially supported" by Remotion for Next.js deployments. Shotstack is a pure HTTP API — no binaries, no Lambda setup, no Remotion licensing.

2. **Remotion licensing risk.** Remotion is free for individuals but requires a paid company license for for-profit organizations with 4+ employees. A SaaS product where customers generate videos likely requires a company license even if the Remotion code lives on the server. At ~$100/month baseline this adds meaningful cost. Shotstack at $0.20/min on a subscription only accrues cost when a video is actually rendered.

3. **Simpler integration for this use case.** Shotstack takes a JSON timeline descriptor and returns an MP4 URL. It supports: image sequences (slideshow), audio tracks (TTS narration), text overlays, and transitions. All three video output formats in Pathway 3 can be expressed as Shotstack timelines.

4. **Cost at expected volume.** SafeStart is a B2B SaaS for 50-500-SOP organizations. If admins generate one video per SOP, at roughly 3 minutes per SOP video, 500 SOPs = 1,500 minutes = $300 at PAYG rates (or $156 on the $0.20/min subscription tier). Acceptable at this scale.

**Where Remotion wins and when to reconsider:** Remotion is superior for high-volume rendering (thousands of videos/day), complex React-based animations, and teams comfortable managing AWS Lambda. If SafeStart grows to serve hundreds of organizations all generating videos simultaneously, revisit Remotion + Lambda. At v2.0 launch, Shotstack's simplicity wins.

| Service | Type | SDK |
|---------|------|-----|
| Shotstack | Cloud API (no install) | `@shotstack/shotstack-sdk` or plain `fetch` |

Shotstack has an official Node.js SDK but it's optional — the API is simple enough to call with `fetch` and avoids a dependency. Recommend plain `fetch` with typed request/response interfaces (define locally from Shotstack's OpenAPI spec).

**Video output formats — how each maps to Shotstack:**

| Pathway 3 Format | Shotstack Timeline Structure |
|-----------------|------------------------------|
| Narrated slideshow | Image clips (one per SOP step) + audio track (TTS per step) + title overlays |
| Screen recording style | Single long scrolling HTML/image clip + full-SOP TTS audio track |
| Full AI video | Text-to-image API (DALL-E 3 or similar) per step → image clips → TTS audio |

For "full AI video with animations", generating images per step via `openai.images.generate` (DALL-E 3) is the recommended path. This is already covered by the existing OpenAI SDK.

---

## Revised Installation Block (v2.0 additions only)

```bash
# Video transcription — YouTube caption extraction (no video download)
npm install youtube-transcript

# Client-side audio extraction from video uploads
npm install @ffmpeg/ffmpeg @ffmpeg/util

# Office file parsing — Excel, PowerPoint, ODF formats (v6 = Dec 2025 AST output)
npm install officeparser

# Video generation — Shotstack SDK (optional: can also use fetch directly)
# npm install @shotstack/shotstack-sdk
```

The `openai` SDK (already installed at v6.32.0) covers:
- `gpt-4o-transcribe` and `gpt-4o-mini-transcribe` (transcription)
- `gpt-4o-mini-tts` (text-to-speech for video narration)
- `dall-e-3` (image generation for "full AI video" format)

No new API keys are needed for these — they use the existing OpenAI key.

New API keys required:
- `SHOTSTACK_API_KEY` — for video rendering (Shotstack)
- `VIMEO_ACCESS_TOKEN` — for Vimeo caption API (optional, only needed if Vimeo URL support is in scope for v2.0)

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Transcription | OpenAI `gpt-4o-transcribe` (existing SDK) | AssemblyAI | AssemblyAI has better accuracy benchmarks and speaker diarization. Use it if the app later needs "who said what" in meeting-style recordings. For SOP narration (one speaker, clear audio), GPT-4o-transcribe is accurate enough and eliminates a new dependency. |
| Transcription | OpenAI `gpt-4o-transcribe` | Deepgram Nova-2 | Deepgram is faster for real-time streaming and has lower latency. Not needed here — transcription is batch, not real-time. |
| YouTube captions | `youtube-transcript` | `yt-dlp` binary | yt-dlp requires a Python or Deno runtime. Not deployable on Vercel serverless. Even if self-hosted, it's the wrong tool when captions are available via HTTP. |
| Excel/PPTX | `officeparser` v6 | SheetJS (`xlsx`) + separate PPTX lib | SheetJS npm version has security CVEs and is unmaintained on npm. Separate PPTX libraries are mostly abandoned. `officeparser` covers both formats with a single maintained package. |
| TTS | OpenAI `gpt-4o-mini-tts` (existing SDK) | ElevenLabs | ElevenLabs has dramatically better voice quality and cloning. Use it if clients request custom brand voices or if users complain about the AI voice quality. ElevenLabs starter ($5/mo) covers 30K credits — fine for low volume, but credit-based pricing becomes unpredictable at scale. |
| TTS | OpenAI `gpt-4o-mini-tts` | Google Cloud TTS (Chirp 3 HD) | $30/million chars vs OpenAI's $3/million. Google's quality is better but the 10× cost difference is hard to justify for this use case. |
| Video generation | Shotstack API | Remotion + AWS Lambda | Remotion requires FFmpeg binary (breaks Vercel), needs AWS Lambda setup, and requires a paid company license for commercial SaaS. Shotstack is simpler and more cost-effective at v2.0 scale. |
| Video generation | Shotstack API | Creatomate | Comparable product. Shotstack is slightly cheaper at scale ($0.20/min subscription vs Creatomate's $41/month Essential tier). Creatomate's template editor is more advanced — revisit if template-based video creation for admins becomes a future feature. |
| Client audio extraction | `@ffmpeg/ffmpeg` (WASM) | Server-side FFmpeg | Server-side FFmpeg binary breaks Vercel deployments. WASM approach keeps audio extraction client-side, reduces server load, and preserves user privacy (video never uploaded to server). |

---

## What NOT to Add

| Avoid | Why | What to Use Instead |
|-------|-----|---------------------|
| `ytdl-core` | Abandoned (last meaningful update 2022). Breaks regularly as YouTube changes its internal API. npm page warns of deprecation. | `youtube-transcript` for captions; no download needed |
| SheetJS `xlsx` from npm | Security CVEs (prototype pollution, DoS). Unmaintained on npm since 0.18.5 (2023). Installing from SheetJS CDN creates supply chain risk. | `officeparser` v6 |
| `fluent-ffmpeg` + `ffmpeg-static` on Vercel | Binary pushes serverless function over 50 MB limit. Path resolution breaks in Vercel's sandbox. Verified broken in multiple community reports through 2025. | `@ffmpeg/ffmpeg` (WASM, client-side) |
| Remotion `@remotion/renderer` in Next.js API routes | Cannot bundle Webpack-inside-Webpack. Requires FFmpeg binary. Explicitly "not officially supported" in Next.js by Remotion's own docs. Company license required for SaaS. | Shotstack API |
| ElevenLabs at launch | Quality improvement doesn't justify adding a new vendor, API key, and billing account at v2.0. OpenAI TTS is good enough for industrial safety narration. | OpenAI `gpt-4o-mini-tts` |
| `pptx2json`, `js-pptx`, `node-pptx-parser` | All have low npm downloads, sporadic maintenance, and produce flat or incomplete output. `officeparser` v6 is actively maintained and produces rich AST. | `officeparser` v6 |
| `ffmpeg.wasm` (the original package from `@ffmpegwasm/ffmpeg`) | Superseded by `@ffmpeg/ffmpeg` (the official package by the same maintainer with multi-thread support). Use the `@ffmpeg` scope. | `@ffmpeg/ffmpeg` |
| ExcelJS | Hasn't released a new npm version in 12+ months as of 2025. Considered potentially abandoned. | `officeparser` v6 |

---

## Integration Points with Existing Stack

**Transcription pipeline:**
```
Client: video file selected
  → @ffmpeg/ffmpeg extracts audio (MP3, client-side)
  → audio blob uploaded to Next.js Route Handler
  → Route Handler calls openai.audio.transcriptions.create (gpt-4o-transcribe)
  → transcript segments returned to server
  → GPT-4o structures transcript into SOP JSON (existing pipeline)
  → SOP written to Supabase (existing pipeline)
```

**YouTube URL pipeline:**
```
Client: pastes YouTube URL
  → Next.js Route Handler calls youtube-transcript
  → caption segments returned
  → if no captions: error with "no auto-captions available" message (no download fallback on Vercel)
  → GPT-4o structures captions into SOP JSON (existing pipeline)
```

**Excel/PPTX pipeline:**
```
File uploaded to Supabase Storage (existing)
  → Route Handler fetches file buffer
  → officeparser.parseOffice(buffer) returns AST
  → AST text + table content extracted
  → GPT-4o structures content into SOP JSON (existing pipeline)
```

**Video SOP generation pipeline:**
```
SOP retrieved from Supabase
  → Route Handler loops SOP steps:
      - openai.audio.speech.create per step (gpt-4o-mini-tts) → audio buffer
      - audio stored to Supabase Storage, presigned URL generated
  → Shotstack API called with timeline JSON:
      - image clips (SOP step photos or auto-generated DALL-E 3 images)
      - audio clips (TTS per step from Supabase Storage URLs)
      - text overlays (step titles, hazard warnings)
  → Shotstack returns render job ID
  → polling or webhook callback writes rendered video URL back to Supabase
  → video URL stored on SOP record, linked from admin UI
```

**Offline impact:** Video generation is admin-only, runs on reliable connections, and produces a stored output (MP4 URL). The generated video URL can be stored in the SOP record and pre-cached to Dexie for worker offline access using the existing caching pipeline. No new offline architecture needed.

---

## Deployment Constraint Summary

| Feature | Works on Vercel Serverless? | Notes |
|---------|----------------------------|-------|
| `gpt-4o-transcribe` via OpenAI SDK | Yes | Pure HTTP, no binary |
| `youtube-transcript` | Yes | Pure HTTP |
| `@ffmpeg/ffmpeg` (WASM) | Client-side only | Runs in browser, not on Vercel |
| `officeparser` v6 | Yes | Pure Node.js, no binary |
| `gpt-4o-mini-tts` via OpenAI SDK | Yes | Pure HTTP, no binary |
| Shotstack API | Yes | Pure HTTP |
| yt-dlp for YouTube/Vimeo fallback | No | Requires binary + shell access |
| Remotion `@remotion/renderer` | No | Binary + too large |
| Server-side FFmpeg | No | Binary exceeds 50 MB limit |

The yt-dlp fallback (for YouTube/Vimeo videos with no captions) is blocked on Vercel. If this fallback matters for product completeness, the transcription step for URL-sourced videos must run in a Supabase Edge Function backed by a Docker container, or be deferred to a future milestone.

---

## Sources

- [OpenAI Speech-to-Text models](https://developers.openai.com/api/docs/models) — gpt-4o-transcribe, gpt-4o-mini-transcribe — HIGH confidence
- [OpenAI TTS gpt-4o-mini-tts announcement](https://openai.com/index/introducing-our-next-generation-audio-models/) — March 2025 — HIGH confidence
- [OpenAI Whisper API limits](https://www.transcribetube.com/blog/openai-whisper-api-limits) — 25 MB limit, ~30 min audio — MEDIUM confidence
- [AssemblyAI transcription benchmarks 2026](https://www.assemblyai.com/benchmarks) — comparison data — MEDIUM confidence
- [youtube-transcript npm](https://www.npmjs.com/package/youtube-transcript) — v1.3.0, last published ~17 days before research — MEDIUM confidence (npm registry)
- [officeparser GitHub v6.0.0](https://github.com/harshankur/officeParser) — December 2025 release, AST output — HIGH confidence (official repo)
- [SheetJS xlsx security issues](https://security.snyk.io/package/npm/xlsx) — CVEs confirmed — HIGH confidence (Snyk)
- [Remotion Next.js limitations](https://www.remotion.dev/docs/miscellaneous/nextjs) — official docs, binary + bundling constraints — HIGH confidence
- [Remotion license](https://www.remotion.dev/docs/license) — free for individuals, company license for 4+ employee for-profit orgs — HIGH confidence
- [Remotion server-side options comparison](https://www.remotion.dev/docs/compare-ssr) — Lambda vs Cloud Run vs self-hosted — HIGH confidence
- [Shotstack pricing](https://shotstack.io/pricing/) — $0.20/min subscription, $0.30/min PAYG — HIGH confidence
- [Vercel FFmpeg binary issues](https://github.com/vercel/next.js/issues/53791) — confirmed broken path resolution — HIGH confidence (GitHub issue)
- [ffmpeg.wasm in Next.js](https://blog.brightcoding.dev/2026/01/09/build-a-viral-video-editor-in-your-browser-next-js-+-ffmpeg-wasm-complete-guide-2026) — WASM client-side pattern — MEDIUM confidence
- [MediaRecorder browser support](https://caniuse.com/mediarecorder) — Safari 14+, iOS 14+ — HIGH confidence
- [ElevenLabs vs OpenAI TTS comparison](https://www.speechmatics.com/company/articles-and-news/best-tts-apis-in-2025-top-12-text-to-speech-services-for-developers) — quality and pricing — MEDIUM confidence
- [Vimeo transcript API](https://help.vimeo.com/hc/en-us/articles/17480150130833-How-to-access-and-download-video-transcripts-via-API) — official Vimeo docs — HIGH confidence

---

*Stack additions research for: SafeStart v2.0 — SOP Creation Pathways*
*Researched: 2026-03-29*
