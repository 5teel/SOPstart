# Research Summary

**Project:** SafeStart — SOP Creation Pathways (v2.0 Milestone)
**Domain:** Industrial safety SOP management — new creation and delivery pathways
**Researched:** 2026-03-29
**Confidence:** HIGH (stack and architecture) / MEDIUM-HIGH (features and pitfalls)

---

## Executive Summary

SafeStart v2.0 adds three new SOP creation and delivery pathways on top of a validated v1.0 foundation (Next.js 16, Supabase, GPT-4o, Dexie.js, TanStack Query, @serwist/next). The new pathways are: Video → SOP (transcription of uploaded files, YouTube/Vimeo URLs, and in-app recordings); File → SOP expanded (photo OCR, Excel/PowerPoint/plain text parsing, improved AI accuracy); and File → Video SOP (narrated slideshow, screen recording style, and full AI video output). All three pathways converge on the same `gpt-parser.ts → ParsedSopSchema` core, which is unchanged. The architectural philosophy is additive: new extractor modules feed plain text into the existing structuring pipeline, and new job tracking reuses the existing `parse_jobs` FSM and Supabase Realtime pattern.

The recommended technology choices minimize new dependencies. The existing OpenAI SDK (v6) already covers `gpt-4o-transcribe` and `gpt-4o-mini-tts` with no additional packages. New additions are `youtube-transcript` for YouTube caption fetching, `@ffmpeg/ffmpeg` (WASM, client-side) for audio extraction from video uploads, and `officeparser` v6 for Excel and PowerPoint parsing. For video rendering (Pathway 3), Shotstack API is recommended over Remotion because it is a pure HTTP service that avoids FFmpeg binary bundling and Vercel function size constraints. The one firm deployment constraint is the Vercel 4.5 MB request body limit: video files must bypass Next.js entirely using TUS resumable upload direct to Supabase Storage.

The primary risks are operational rather than technical. Transcription on factory-floor audio with NZ accents and industrial terminology achieves 75-85% accuracy on the first pass — significantly lower than clean-audio benchmarks. Safety-critical terms (chemical names, tolerances, PPE specifications) must be explicitly flagged for admin confirmation before publish. Legal exposure from YouTube video downloading is a hard constraint: no `yt-dlp` or equivalent download approach is acceptable in a SaaS product; caption API access is the only compliant path. Video generation and stored source videos have unbounded storage cost if not managed with explicit retention policies. None of these risks block the project, but each must be addressed as a first-class concern within its respective pathway phase.

---

## Key Findings

### Recommended Stack

The existing stack requires three new libraries and two new API integrations. No new SDK is needed for transcription or TTS — both are covered by the existing `openai` package at v6. The OpenAI SDK covers `gpt-4o-transcribe` (transcription), `gpt-4o-mini-tts` (narration), and `dall-e-3` (image generation for full AI video). `@ffmpeg/ffmpeg` runs entirely client-side as WASM, keeping video bytes off the server until they reach Supabase Storage. Server-side `ffmpeg-static` is used within the transcription route handler to extract audio from uploaded videos, and this binary must be bundled into the Vercel function via `outputFileTracingIncludes`. See STACK.md for full alternatives analysis.

**New packages required:**
- `youtube-transcript ^1.3.0` — fetch YouTube auto-captions without video download; serverless-compatible
- `@ffmpeg/ffmpeg ^0.12.x` + `@ffmpeg/util ^0.12.x` — client-side audio extraction from video uploads (WASM)
- `officeparser ^6.0.0` — Excel and PowerPoint text/table extraction; December 2025 AST output release

**New API integrations:**
- Shotstack API — cloud video rendering (HTTP only, no binary); `SHOTSTACK_API_KEY` required
- Vimeo API (optional) — caption fetch for Vimeo URLs; `VIMEO_ACCESS_TOKEN` required if Vimeo is in v2.0 scope

**Packages to avoid:**
- `SheetJS/xlsx` from npm — unmaintained on npm since 2023, known CVEs (prototype pollution, DoS)
- `Remotion @remotion/renderer` — Chromium binary exceeds Vercel limits; SaaS company license required
- `ytdl-core` / `yt-dlp` — YouTube ToS violation; existential risk for SaaS product
- `fluent-ffmpeg` / `ffmpeg-static` for client-side use — use `@ffmpeg/ffmpeg` WASM client-side instead
- `ExcelJS` — effectively abandoned on npm as of 2025

### Expected Features

**Must have — Pathway 1 (Video → SOP):**
- File upload (MP4/MOV) with async processing and named stage feedback (uploading → transcribing → structuring → ready)
- YouTube URL paste with caption-first fast path; Vimeo URL with caption API
- Transcript display alongside structured output in admin review (same review UI as v1.0)
- Confidence scoring that reflects transcript quality, not just parsing quality
- Mandatory section detection: flag SOPs where hazards or PPE sections are absent from the transcript

**Must have — Pathway 2 (File → SOP expanded):**
- Photo/image upload with device camera capture (`<input capture="environment">`) and client-side quality check before processing
- GPT-4o vision for OCR (not Tesseract for primary path — VLMs significantly outperform on phone-photo inputs)
- PPTX, XLSX, TXT/CSV upload with unified file picker UI
- Per-word/per-token confidence with mandatory admin confirmation for numerical values and chemical names

**Must have — Pathway 3 (File → Video SOP):**
- Narrated slideshow (Format A) — one card per SOP section, TTS audio, safety-first slide ordering (hazards before steps always)
- Screen recording style (Format C) — scrolling SOP text synced to TTS narration
- Chapter markers and timestamp navigation linked to SOP sections
- Admin preview before publish; "video is outdated" flag when SOP is updated
- Worker video completion tracking integrated with existing compliance records

**Defer to v2.1+:**
- In-app camera recording (iOS Safari MediaRecorder unreliable for video; Android/Chrome only at this time)
- Full AI video (Format B) — avatar API with high per-generation cost; validate demand with Formats A and C first
- Multi-page photo sequence scanning
- Custom vocabulary correction for transcription (implement after first real-world usage reveals problem terms)
- Video re-generation triggered automatically on SOP update

### Architecture Approach

The architecture is deliberately additive. All new extractor modules (`extract-audio.ts`, `transcribe-audio.ts`, `fetch-youtube-transcript.ts`, `extract-image.ts`, `extract-xlsx.ts`, `extract-pptx.ts`, `extract-txt.ts`) return a `string` and feed into the existing `gpt-parser.ts → ParsedSopSchema` without any changes to the structuring layer or admin review UI. The `parse_jobs` table gains an `input_type` column to distinguish video, image, xlsx, pptx, txt, and URL sources. The `video_generation_jobs` table is kept separate because its input (SOP ID), status vocabulary (`generating_audio`, `rendering_video`), and output (video URL) are structurally distinct from document parsing. Two new Supabase Storage buckets are required: `sop-videos` (raw video input, up to 2 GB files via TUS) and `sop-generated-videos` (rendered MP4 output with 90-day retention). See ARCHITECTURE.md for full component breakdown, data flow diagrams, and build order.

**Major new components:**
1. `VideoUploader.tsx` + modified `createUploadSession` — TUS resumable upload bypasses Vercel 4.5 MB limit
2. `/api/sops/transcribe` route — audio extraction (ffmpeg-static) + gpt-4o-transcribe → existing gpt-parser
3. `/api/sops/youtube` route — youtube-transcript caption fetch → existing gpt-parser
4. `/api/sops/generate-video` route — creates `video_generation_jobs` record; delegates to TTS + Shotstack
5. `src/lib/video-gen/tts.ts` — per-section TTS via `gpt-4o-mini-tts`, split by section to avoid pauses
6. `src/lib/video-gen/render-slides.ts` — Shotstack API call with JSON timeline; polling or webhook for completion

**Key architectural patterns:**
- Converging extraction pipelines: all new input types return plain text and feed into unchanged `gpt-parser.ts`
- TUS resumable upload for video; existing presigned URL flow for documents and images
- Extend `parse_jobs.input_type` for Pathways 1+2; separate `video_generation_jobs` table for Pathway 3
- Async-first: all video transcription and video generation must use the existing job/Realtime pattern — no synchronous video processing in the request cycle

### Critical Pitfalls

The following are v2.0-specific pitfalls. The v1.0 pitfalls (stale SOP versions, iOS storage eviction, multi-tenant data leakage, glove-hostile UI, completion record defensibility) remain relevant and are documented in PITFALLS.md (Pitfalls 1-8).

1. **Vercel 4.5 MB request body limit blocks all video uploads** — Never route video bytes through a Next.js API route or Server Action. Issue a TUS endpoint URL from the server; the client uploads directly to Supabase Storage. Test with a 20 MB file on a Vercel preview deployment before any other video work.

2. **YouTube/Vimeo URL pathway creates DMCA and ToS legal liability** — Do not use yt-dlp, ytdl-core, or any server-side video download tool. Use YouTube Data API v3 `captions.list` for compliant caption access. If no captions exist, prompt the user to download and upload the file themselves. Add a terms acknowledgement checkbox. This constraint must be reviewed before the URL pathway is implemented.

3. **Transcription accuracy on factory-floor audio with NZ accents is 75-85%, not 97%+** — Pass a `prompt` parameter to the transcription API with up to 224 tokens of domain vocabulary. Show the admin the transcript with video timestamps for manual verification. Flag numerical values, chemical names, and PPE specs as high-risk tokens requiring explicit admin confirmation. Test on actual NZ-accented factory audio before shipping.

4. **Video and generated-video storage costs become unbounded without retention policies** — Source videos deleted 30 days after transcription completes; audio extraction intermediaries deleted after job completes; generated SOP videos have 90-day TTL. Per-tenant storage quota with visible indicator in settings. Generated videos are reproducible derived assets — not permanent.

5. **Generated videos cached in service worker bloat device storage** — Explicitly exclude `.mp4` and `.webm` URLs from all service worker caching strategies. Never embed generated video URLs in the SOP data structure that syncs to IndexedDB. This exclusion rule must be added in the same activity that first introduces video URLs to the SOP data model.

6. **Video generation jobs time out or produce duplicates without async-first design** — Always create a `video_generation_jobs` row and return 202 immediately. Implement idempotency: if a job already exists for the current SOP version, return the existing job ID rather than creating a duplicate. Status progression visible via Supabase Realtime subscription.

7. **TTS mispronounces industrial terminology and NZ place names** — Build a per-organisation pronunciation dictionary with SSML `<phoneme>` tags for known problem terms (kPa, RPM, SCBA, PPE, Tergo Alkalox, te reo place names). Require admin audio preview before any generated video is published. This review step is mandatory, not optional.

8. **OCR on phone-photo inputs produces 75-85% accuracy without vision model + preprocessing** — Use GPT-4o vision (not Tesseract) as the primary OCR model. Highlight low-confidence tokens in admin review UI; require explicit confirmation for numerical values and chemical names. Store original image permanently alongside extracted text.

9. **Office file parsing accepts macro-enabled formats by default** — Block `.xlsm`, `.xlsb`, `.xltm`, `.pptm`, `.potm`, `.ppam` at upload validation before any parsing library is invoked. Validate magic bytes server-side, not just file extension. File validation is built first within the expanded parsing activity.

---

## Implications for Roadmap

Based on dependency analysis, risk profile, and feature relationships across all three pathways, five phases are suggested. The ordering de-risks infrastructure and low-complexity parsers first, isolates the iOS-constrained recording feature, then addresses video generation as a distinct async-heavy phase.

---

### Phase 1: Infrastructure and Expanded File Parsing

**Rationale:** The foundation work (`parse_jobs.input_type` migration, new storage buckets, expanded MIME type routing) has no user-visible complexity but blocks all three pathways. Expanded file parsing (image OCR, PPTX, XLSX, plain text) builds on the most familiar pattern in the codebase — same extractor interface, same parse route, same admin review UI — and delivers immediate admin value. Building this first validates the `input_type` routing architecture before the more novel video pipeline is added.

**Delivers:** Admin can upload photos of printed SOPs, PPTX slide decks, XLSX checklists, and plain text files and get structured SOPs through the same review UI as v1.0.

**Features addressed:**
- Photo/image upload with camera capture and quality check
- GPT-4o vision OCR with high-risk token flagging
- PPTX, XLSX, TXT/CSV upload with unified file picker

**Pitfalls to avoid:** OCR quality on phone-photo inputs; macro-enabled file validation

**Research flag:** Standard patterns — no additional research needed.

---

### Phase 2: Video → SOP (File Upload and YouTube/Vimeo URL)

**Rationale:** Video file upload carries the highest novel risk: TUS upload pattern, ffmpeg-static bundle size on Vercel, OpenAI Whisper 25 MB limit, and real-world transcription accuracy on NZ factory audio. Building this as a focused phase allows early validation of the TUS infrastructure and ffmpeg bundling before the YouTube URL variant is added. YouTube URL is included in this phase (not deferred) because the legal constraints must be designed in from the start — not retrofitted after the fact.

**Delivers:** Admin can upload an MP4/MOV video file or paste a YouTube URL and receive a structured SOP with transcript displayed for manual review.

**Features addressed:**
- Video file upload (MP4/MOV) with TUS resumable upload, async processing, named stage feedback
- YouTube URL paste with caption-first fast path
- Vimeo URL (if confirmed in scope)
- Transcript display alongside structured output in admin review
- Mandatory section detection flag (hazards/PPE absence warning)
- Industrial terminology confidence scoring and high-risk token flagging

**Pitfalls to avoid:** Vercel 4.5 MB limit (TUS infrastructure built first); YouTube ToS / DMCA liability (legal review before URL pathway ships); factory-floor transcription accuracy (domain vocabulary prompt, NZ accent testing)

**Research flag:** Needs research at planning time — confirm TUS integration with current Supabase JS SDK version before design is finalised.

---

### Phase 3: Video → SOP (In-App Recording)

**Rationale:** Separated from Phase 2 because iOS Safari MediaRecorder support for video is unstable on older devices (pre-iOS 17.2), which is common on NZ factory floors with un-updated iPhones. Shipping in-app recording before iOS support is reliable would produce an Android/Chrome-only feature. This phase should proceed only after Phase 2 is in production and usage data is available.

**Delivers:** Admin can record video directly in the browser (Android/Chrome reliably; iOS 17.2+ with fallback warning) and get a structured SOP without a separate recording tool.

**Features addressed:** In-app camera recording; MediaRecorder with explicit bitrate control (`videoBitsPerSecond: 1_000_000`); iOS fallback warning or file-upload redirect

**Pitfalls to avoid:** MediaRecorder format incompatibility across Chrome/iOS (`isTypeSupported()` priority order; explicit audio extraction before transcription)

**Research flag:** Needs research at planning time — verify current iOS Safari MediaRecorder support status before committing to scope or fallback design.

---

### Phase 4: File → Video SOP (Narrated Slideshow and Screen Recording)

**Rationale:** Pathway 3 generates video from existing structured SOPs — it does not require any document parsing and builds entirely on the published SOP data already in the database. The two simpler formats (narrated slideshow, screen recording style) share the TTS pipeline and differ only in Shotstack timeline structure. Shipping these two formats together validates the async video generation pattern, the Shotstack integration, and the admin preview and worker video player UX before committing to the higher-cost Format B.

**Delivers:** Admin can generate a narrated slideshow or scrolling-text video from any published SOP. Workers see a "Video version" button on the SOP view. Chapter navigation and video completion tracking are live.

**Features addressed:**
- Narrated slideshow (Format A) with safety-first slide ordering (hazards before steps, always)
- Screen recording style (Format C) with scroll timing synced to TTS audio
- Chapter markers and timestamp navigation linked to SOP sections
- Admin preview before publish
- "Video is outdated" flag on SOP update
- Worker video access within existing SOP view
- Video completion tracking integrated with compliance records

**Pitfalls to avoid:** Video generation timeout / duplicate jobs (async-first, idempotency required); TTS mispronunciation (pronunciation dictionary, mandatory audio preview); video storage costs (retention policies); service worker video caching (exclusion rules added in same activity as video URL introduction)

**Research flag:** Needs research at planning time — Shotstack API webhook vs polling pattern; JSON timeline structure for narrated slideshow; validate pricing model at expected SOP volume before committing.

---

### Phase 5: Full AI Video (Format B) — Conditional

**Rationale:** Full AI video (avatar-based or AI-generated visuals per step) has the highest per-generation cost ($0.10-0.50/minute of output via HeyGen/Synthesia/D-ID), the longest generation time, and the greatest sensitivity to industrial content quality. This phase should only proceed if Phase 4 adoption data confirms demand for richer video output beyond narrated slideshows.

**Delivers:** Admin can generate AI avatar-narrated or AI-visual video SOPs with organisation branding.

**Features addressed:** Format B (AI avatar or animated visuals per step); organisation branding overlay

**Research flag:** Needs research at planning time — evaluate HeyGen vs Synthesia vs D-ID for industrial content quality and per-generation cost. Test DALL-E 3 image generation quality on industrial procedure descriptions before committing.

---

### Phase Ordering Rationale

- Expanded file parsing (Phase 1) precedes video (Phase 2) because it validates the `input_type` routing architecture with low-risk additions before the more complex video pipeline is added.
- TUS upload infrastructure (Phase 2) must be the first thing built within that phase — the 4.5 MB Vercel limit makes the upload pattern the most critical decision, and it fails silently on localhost.
- In-app recording (Phase 3) is gated on iOS Safari support maturity, placing it after the file upload path gives the product a working video-to-SOP path while the recording UX is refined.
- Video generation (Phase 4) builds on published SOPs and is independent of the parsing infrastructure, but the async job pattern validated in Phases 1-2 is a prerequisite for its architecture.
- Format B (Phase 5) is explicitly conditioned on demand validation from Phase 4.

### Research Flags

Phases needing `/gsd:research-phase` at planning time:
- **Phase 2:** TUS resumable upload with current Supabase JS SDK; confirm `tus-js-client` vs Uppy for this stack; ffmpeg-static bundling on Vercel confirmed working
- **Phase 3:** Current iOS Safari MediaRecorder support status (post-iOS 17.2); fallback design for unsupported devices
- **Phase 4:** Shotstack webhook/polling pattern and timeline JSON structure; pricing validation at expected volume
- **Phase 5:** AI avatar API comparison for industrial content; DALL-E 3 image quality for procedure visuals

Phases with standard patterns (skip research):
- **Phase 1:** GPT-4o vision OCR, officeparser v6, plain text parsing — all well-documented; STACK.md alternatives analysis is complete and definitive

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Primary choices (OpenAI SDK, officeparser, youtube-transcript, @ffmpeg/ffmpeg) verified via official docs and package repositories. Shotstack chosen over Remotion on verified Vercel constraint documentation. One uncertainty: ffmpeg-static server-side bundling on Vercel is documented but described as "bundle-sensitive" — early validation required in Phase 2. |
| Features | MEDIUM-HIGH | Competitor landscape (Synthesia, HeyGen, ScreenApp, Trupeer, Docustream.ai) verified via product sites. iOS Safari MediaRecorder constraints verified via official compatibility tables. Feature prioritisation reflects documented industrial mobile adoption patterns. |
| Architecture | HIGH | Vercel constraints (4.5 MB body limit, 250 MB bundle) verified against official docs. Supabase TUS resumable upload confirmed via official docs. Shotstack API pattern confirmed. Note: ARCHITECTURE.md system diagram references ElevenLabs and Remotion Lambda (from an earlier draft perspective) while STACK.md makes the case for gpt-4o-mini-tts and Shotstack instead. STACK.md recommendations are authoritative; component file structure in ARCHITECTURE.md is accurate. |
| Pitfalls | HIGH | Critical pitfalls (Vercel body limit, YouTube ToS, transcription accuracy on NZ factory audio, iOS storage eviction) drawn from official documentation, verified CVEs, and published WER benchmarks. |

**Overall confidence:** HIGH

### Gaps to Address

- **ffmpeg-static vs @ffmpeg/ffmpeg WASM dual approach:** The intended architecture uses both — WASM client-side for pre-upload audio extraction (reducing upload size), and `ffmpeg-static` server-side for processing already-uploaded video files. This dual approach should be confirmed and documented in Phase 2 planning to prevent confusion.

- **ARCHITECTURE.md tool divergence:** ARCHITECTURE.md component descriptions reference ElevenLabs, Remotion Lambda, and SheetJS. STACK.md makes a clear case for gpt-4o-mini-tts, Shotstack, and officeparser. STACK.md is authoritative; the component descriptions in ARCHITECTURE.md need to be updated during Phase 2 and Phase 4 planning.

- **Vimeo URL scope for v2.0:** Both STACK.md and FEATURES.md treat Vimeo as "optional, only needed if in scope for v2.0." This is a product decision that needs an explicit answer before Phase 2 planning begins. Vimeo requires a separate API authentication token and has different fallback constraints than YouTube.

- **Pronunciation dictionary implementation:** PITFALLS.md identifies TTS mispronunciation as a critical Pathway 3 concern and recommends SSML `<phoneme>` tags with a per-org dictionary. Neither STACK.md nor ARCHITECTURE.md specifies the implementation. This needs to be designed in Phase 4 planning before the TTS module is built.

- **Inngest for durable jobs:** ARCHITECTURE.md recommends Inngest for long-running transcription and video generation jobs at 500+ SOPs/month. This is not in v2.0 scope, but the async job pattern should be designed to make an Inngest migration non-breaking if growth requires it.

---

## Sources

### Primary (HIGH confidence)
- [OpenAI Speech-to-Text API](https://developers.openai.com/api/docs/models) — gpt-4o-transcribe, gpt-4o-mini-tts, DALL-E 3 in existing SDK
- [Vercel Functions Limits — official docs](https://vercel.com/docs/functions/limitations) — 4.5 MB body, 300s/800s duration, 250 MB bundle
- [Supabase Resumable Uploads — TUS protocol](https://supabase.com/docs/guides/storage/uploads/resumable-uploads) — 50 GB max, 6 MB chunks
- [Remotion on Vercel — official limitations](https://www.remotion.dev/docs/miscellaneous/vercel-functions) — Chromium not viable on Vercel Functions
- [Remotion license](https://www.remotion.dev/docs/license) — company license required for 4+ employee for-profit SaaS
- [officeparser GitHub v6.0.0](https://github.com/harshankur/officeParser) — December 2025 AST output release
- [SheetJS xlsx security](https://security.snyk.io/package/npm/xlsx) — CVEs confirmed in npm version
- [Shotstack pricing](https://shotstack.io/pricing/) — $0.20/min subscription, $0.30/min PAYG
- [Vimeo transcript API](https://help.vimeo.com/hc/en-us/articles/17480150130833) — official Vimeo API docs
- [MediaRecorder browser support](https://caniuse.com/mediarecorder) — Safari 14+, iOS 14+; iOS 17.2+ enabled by default

### Secondary (MEDIUM confidence)
- [youtube-transcript npm](https://www.npmjs.com/package/youtube-transcript) — v1.3.0, serverless-compatible caption fetch; ~17 days old at research time
- [AssemblyAI transcription benchmarks 2026](https://www.assemblyai.com/benchmarks) — WER on noisy audio; NZ/AU accent comparison data
- [ScreenApp SOP from video guide](https://screenapp.io/blog/how-to-create-sop-from-video-ai) — competitor feature landscape
- [Synthesia video SOP](https://www.synthesia.io/post/video-sop) — enterprise video SOP patterns and table stakes
- [Docustream.ai SOP to video](https://docustream.ai/sop-to-video/) — timestamp linking patterns
- [Scanbot OCR accuracy improvement](https://scanbot.io/blog/improve-ocr-accuracy-with-image-processing/) — preprocessing impact on mobile photo OCR
- [ffmpeg.wasm in Next.js](https://blog.brightcoding.dev/2026/01/09/build-a-viral-video-editor-in-your-browser-next-js-+-ffmpeg-wasm-complete-guide-2026) — WASM client-side pattern validated
- [Vercel FFmpeg binary issues](https://github.com/vercel/next.js/issues/53791) — confirmed broken path resolution for some approaches

### Tertiary (LOW confidence — validate before implementation)
- [OpenAI gpt-4o vision for OCR comparison](https://intuitionlabs.ai/articles/ai-ocr-models-pdf-structured-text-comparison) — independent comparison; validate against current model versions at implementation time
- ElevenLabs vs gpt-4o-mini-tts quality — model quality evolves; verify at time of Phase 4 implementation before locking to OpenAI TTS

---

*Research completed: 2026-03-29*
*Scope: v2.0 milestone — Video → SOP, File → SOP (expanded), File → Video SOP*
*Replaces: v1.0 SUMMARY.md (2026-03-23)*
*Ready for roadmap: yes*
