# Pitfalls Research

**Domain:** Mobile-first SOP management SaaS — industrial / blue-collar tradespeople
**Researched:** 2026-03-23 (v1.0), updated 2026-03-29 (v2.0 additions)
**Confidence:** HIGH (multiple authoritative sources; pitfalls drawn from documented production incidents, official platform limitations, and verified community patterns)

---

## Critical Pitfalls

### Pitfall 1: AI Parser Silently Produces Wrong SOP Steps

**What goes wrong:**
The AI parsing pipeline extracts a numbered step list from an uploaded Word/PDF but gets the order wrong, merges two steps into one, or omits a step entirely — especially when source documents use non-standard heading hierarchies, tables, or embedded figures to convey sequence. Workers follow the extracted (wrong) procedure, creating a safety incident or quality failure.

**Why it happens:**
LLM-based extraction has well-documented hallucination rates of 44–66% on safety-critical content (per published benchmarks). PDFs in particular lose structural context when rendered to text: columns merge, table rows reorder, figure captions appear in the wrong place. Developers test the parser on clean, well-formatted sample documents and assume it generalises.

**How to avoid:**
- Treat every AI parse as a *draft* requiring human sign-off before the SOP goes live. Never auto-publish.
- Build a structured diff view in the admin UI: original document page alongside the parsed output, step-by-step.
- Add confidence scoring per section (hallucination risk is highest for numbered lists inside tables, multi-column layouts, and embedded figure references).
- Store the original document alongside the parsed output permanently — the source of truth is the document, not the extraction.
- Flag low-confidence sections for admin review and block SOP activation until all flags are cleared.

**Warning signs:**
- Parse pipeline skips admin review step ("we'll add review later")
- No confidence scoring in the extraction output
- Original document is discarded after parsing
- Testing only on clean, single-column PDFs

**Phase to address:** Foundation / AI Parsing phase (earliest phase touching document ingestion)

---

### Pitfall 2: Stale SOP Version Served to Workers After Update

**What goes wrong:**
An admin updates an SOP — fixing a safety step — but workers on the floor continue using the cached (old) version for days or weeks. The new version never reaches offline devices. In the worst case, the worker completes an SOP using outdated PPE requirements and the completion record shows the correct procedure was followed when it wasn't.

**Why it happens:**
Service workers are long-lived by design. A PWA installed on a worker's phone can stay open for days without a full reload. Service worker update detection is navigation-triggered and subject to 24-hour browser checks. iOS Safari has additional aggressive caching behaviour that can trap stale content. Developers focus on "make it work offline" and don't plan the "force-update critical SOPs" path.

**How to avoid:**
- Implement SOP versioning at the data layer: every SOP record has a `version` integer. Cached procedure includes the version it was fetched at.
- On every sync (even partial connectivity), worker client checks its cached SOP versions against the server manifest. Mismatches trigger a background re-fetch.
- For critical updates (e.g., safety-flagged SOPs), include a `force_update: true` flag that surfaces an in-app banner: "This procedure has been updated — tap to refresh before continuing."
- Never cache SOP content with a long TTL via HTTP headers; all SOP data comes through the app's own sync layer, not the browser cache.
- Service worker update: implement `skipWaiting()` with a UI prompt so the app shell also updates.

**Warning signs:**
- SOP data cached with `Cache-Control: max-age=86400` or similar HTTP headers
- No version field on SOP records
- No "SOP updated since you last opened it" notification
- Service worker activates lazily without a skip-waiting mechanism

**Phase to address:** Offline / PWA phase; also requires a gating rule in the SOP publishing workflow (Admin phase)

---

### Pitfall 3: iOS Safari Destroys Offline Data and Camera State

**What goes wrong:**
On iOS, PWA storage (IndexedDB, Cache API) is deleted after approximately 7 days of inactivity. A worker returns from a two-week leave, opens the app, and all cached SOPs are gone — they get a blank screen offline. Separately, iOS Safari does not persist camera permissions for PWAs: every session may re-prompt the worker for camera access mid-procedure, breaking the photo-capture evidence flow.

**Why it happens:**
Apple's Intelligent Tracking Prevention applies its storage eviction policy to PWA storage as aggressively as to web cookies. This is a WebKit platform decision, not a bug that will be fixed. Developers test on Android (where behaviour is more permissive) and assume iOS behaves the same.

**How to avoid:**
- Surface a clear "Download for offline use" affordance that the worker must explicitly trigger, rather than relying on passive caching alone.
- Show workers a "Ready offline" indicator per SOP (green = cached, amber = not cached).
- On app open, always attempt a background sync if online; cache freshness timestamps let the app show "last synced: X days ago."
- For photo capture, use a fallback: if `getUserMedia` fails or is blocked, offer a file picker (`<input type="file" capture="environment">`), which works reliably on iOS PWA.
- Document iOS limitations in onboarding: tell admins deploying to iOS-heavy workforces what workers need to do (open app weekly, etc.).
- Consider a "critical SOPs" subset that is aggressively pre-cached and re-synced on every app open.

**Warning signs:**
- Offline testing only done on Chrome/Android
- No UI indicator showing per-SOP offline availability
- Camera access implemented only via `getUserMedia` without file picker fallback
- No "last synced" timestamp surfaced to users

**Phase to address:** Offline / PWA phase

---

### Pitfall 4: Multi-Tenant Data Leakage via Missing Tenant Context

**What goes wrong:**
Org A's workers can see Org B's SOPs, completion records, or user list — either through a missing `WHERE tenant_id = ?` clause in an API query, through a background job that picks up work without establishing tenant scope, or through a shared cache key that omits the tenant dimension. This is a GDPR/data breach event, not just a bug.

**Why it happens:**
Row-Level Security (RLS) at the database level is a strong last line of defence, but it is not the only required control. Common failure modes:
- A background job (e.g., "generate completion report") is queued with tenant context in the request but the job worker loses that context at execution time.
- A cache key like `sop_library_count` is shared across tenants; Tenant B's request hits Tenant A's cached value.
- A new API endpoint is added during a sprint without going through the standard query builder that applies RLS, so it reads raw.

**How to avoid:**
- Use database-level RLS (e.g., Supabase/PostgreSQL RLS) as a safety net, but also enforce `tenant_id` filtering in every application query — defence in depth.
- Every background job payload must include `tenant_id` explicitly. Workers read `tenant_id` from job payload, not from ambient state.
- Cache keys must always include `tenant_id` as a namespace segment: `tenant:{org_id}:sop_count`.
- In tests: run a fixture that creates two orgs, then assert org A's authenticated requests cannot retrieve org B's resources.
- Connection pool middleware: on every connection checkout, set session-level tenant context variable.

**Warning signs:**
- No cross-tenant test fixtures in the test suite
- Cache keys that don't include tenant_id
- Background jobs that infer tenant from "current user" instead of explicit payload
- New endpoints bypassing the shared data access layer

**Phase to address:** Foundation / multi-tenant data model phase (must be baked in from the first database migration, not retrofitted)

---

### Pitfall 5: Glove-Hostile UI Kills Worker Adoption

**What goes wrong:**
Workers on the factory floor wear gloves and can't reliably hit small tap targets. The app requires precise touches to advance steps, capture photos, or sign off — so workers abandon it and revert to paper. Adoption collapses within the first week of rollout regardless of how technically correct the app is. This is the #1 adoption failure pattern in industrial mobile tools.

**Why it happens:**
Developers and designers test the app at their desk with bare hands on clean screens. WCAG touch target guidance (44×44px minimum) is applied nominally but the interactive elements that matter most — "Next step", "Take photo", "Mark complete" — are buried below visible content, require two-tap confirmation, or are placed in the upper corners of the screen where gloved thumbs can't reach.

**How to avoid:**
- Primary actions (Next, Complete, Photo) must be at minimum 72×72px touch targets, thumb-reachable (bottom third of screen), with 16px+ spacing between them.
- Design for one-handed use: no gesture sequences, no long-press to advance, no drag interactions.
- The step-by-step walkthrough should be a full-screen card interface — swipe or large button advance only. No navbar chrome visible during procedure execution.
- Validate on actual gloved hardware before any user testing. Use a nitrile glove and a mid-range Android device (not a premium iPhone).
- Avoid modals and confirmation dialogs in the primary flow — they add a second tap for every action.

**Warning signs:**
- Design comps showing step list as a scrollable table rather than full-screen cards
- Primary CTA buttons smaller than 56×56px
- Sign-off interaction is a text field requiring keyboard input
- No glove testing planned before launch

**Phase to address:** Worker UI / step execution phase (Phase 2 or equivalent); must be validated with user testing before shipping

---

### Pitfall 6: Photo Storage Bloats IndexedDB and Crashes the App

**What goes wrong:**
Workers capture multiple photos per SOP step as evidence. Each photo is stored as a Blob in IndexedDB pending upload. Over a shift, a worker might capture 20–40 photos at 2–4MB each. IndexedDB on mobile has no hard per-record limit but the global storage quota (typically 10–20% of available disk on iOS, ~unlimited on Chrome) can be hit. On iOS, indexing binary data directly in IndexedDB columns causes progressive slowdown and eventual crashes.

**Why it happens:**
Developers store full-size camera captures directly as Base64 strings or index binary Blob fields in IndexedDB. This is a known IndexedDB anti-pattern. On mobile, photos are often 8–12MP JPEG files; without client-side compression, the queue grows unchecked.

**How to avoid:**
- Compress photos client-side before storing: target 1200px max dimension, ~200KB. Use the Canvas API to resize before writing to IndexedDB.
- Store Blobs as unindexed fields only — never create an IndexedDB index on binary data.
- Implement an upload queue: as soon as connectivity is restored, flush photos to cloud storage (S3/Cloudflare R2) and replace the local Blob with a remote URL reference.
- Set a per-worker offline photo quota (e.g., 50 photos max queued) with a warning before the limit.
- Monitor IndexedDB usage via `navigator.storage.estimate()` and show a warning if remaining quota is below a safe threshold.

**Warning signs:**
- Photos stored as Base64 strings in JSON fields
- No client-side image compression before IndexedDB write
- Upload happens only when the user manually submits the completed SOP
- No IndexedDB quota monitoring

**Phase to address:** Photo capture / offline phase

---

### Pitfall 7: Completion Records Are Not Legally Defensible

**What goes wrong:**
A worker is injured. The organisation claims the SOP was followed. The completion record in the system shows "completed" with a timestamp — but the record has no: confirmed SOP version, record of which specific steps were acknowledged, immutable audit trail (records can be edited after the fact), or cryptographic link between the sign-off and the SOP content at that point in time. The record is useless in a legal or regulatory proceeding.

**Why it happens:**
Developers build the "happy path" — worker completes SOP, supervisor approves, status flips to "complete" — without modelling what "defensible completion" means. Completion records are stored as mutable rows. SOP content can be updated in place without versioning. There is no concept of "what exactly did this worker sign off on?"

**How to avoid:**
- Completion records must be append-only. No updates, no deletes — soft-archive only.
- On completion, snapshot: the SOP version number, a hash of the SOP content, the worker's user ID, timestamp (server-side, not client clock), GPS/location if available, photo evidence references.
- Supervisor sign-off creates a second immutable record referencing the completion record ID.
- SOP version history must be retained indefinitely — never hard-delete old versions.
- For regulated industries (chemical handling, electrical work): consider signed PDFs as the completion artefact, generated server-side from the completion record.

**Warning signs:**
- Completion table has UPDATE or DELETE permissions in the ORM
- SOP content is edited in-place without version increment
- Timestamps come from client device clock rather than server
- No SOP version field on completion records

**Phase to address:** Completion tracking / supervisor sign-off phase

---

### Pitfall 8: Offline Sync Conflict Blindness

**What goes wrong:**
Two workers download the same SOP assignment offline. Worker A completes the SOP on their phone without connectivity. The supervisor, assuming the SOP is unstarted, re-assigns it to Worker B, who also completes it offline. When both devices sync, the system has two completion records for the same assignment, or worse, the last-write-wins strategy silently discards one record. No-one knows which completion stands.

**Why it happens:**
Last-write-wins is the path of least resistance for offline sync. Developers implement it early and never revisit it, because conflicts seem unlikely in testing. In production, factory shift handovers, reassignments, and spotty connectivity create real conflicts frequently.

**How to avoid:**
- For safety-critical completion records: adopt an append-only event log approach. Never merge — both completions are recorded, and a supervisor reviews any duplicates.
- Assign each offline operation a client-generated UUID + client timestamp + device ID so the server can detect duplicates.
- On sync, server returns a conflict manifest if duplicates are detected; client displays a "Review required" banner.
- Do not use last-write-wins for completion records. It is acceptable for draft step progress but not for signed-off records.
- Test explicitly: simulate two devices syncing the same completion and verify both records are preserved.

**Warning signs:**
- Sync layer uses `upsert` on completion records (last-write-wins by construction)
- No client-side UUID on offline-created records
- Conflict resolution not mentioned in any design document
- No test covering concurrent offline completion of the same SOP

**Phase to address:** Offline / sync phase (must be designed before the first completion record is written)

---

## v2.0 Critical Pitfalls — SOP Creation Pathways

### Pitfall 9: Vercel 4.5 MB Request Body Limit Blocks Video Upload

**What goes wrong:**
A video file — even a short 30-second clip from a phone camera — is 15–80 MB. If a developer routes the upload through a Next.js API route or Server Action (the natural pattern for this codebase), Vercel returns a `413 FUNCTION_PAYLOAD_TOO_LARGE` error. The upload silently fails or the user sees an opaque error. This affects both the "upload video file" and "in-app recording" pathways.

**Why it happens:**
Vercel's hard limit on request body size is 4.5 MB across all plans — it cannot be raised. This is enforced at the edge before the function even runs. Developers testing locally (where there is no such limit) never see this error until production deployment. The existing pattern in this codebase (Server Action → Supabase Storage) works for Word/PDF documents (typically under 4.5 MB) and does not expose this limit until video is added.

**Consequences:**
Any video larger than 4.5 MB uploaded via a server route returns a 413 error and the upload silently fails. Supabase Storage supports files up to 500 GB on the Pro plan, so the bottleneck is entirely Vercel.

**Prevention:**
- Never route video bytes through a Vercel function. Generate a Supabase Storage signed upload URL server-side, return it to the client, and have the client upload directly to Supabase Storage from the browser.
- For files larger than 6 MB, use Supabase's TUS resumable upload protocol (`tus-js-client` or Uppy) which handles chunking, retries, and resumption from mobile connections automatically. Resumable uploads support up to 50 GB.
- The flow is: `POST /api/video/upload-url` (server issues signed URL, < 4.5 MB payload) → client PUTs video bytes direct to Supabase Storage → server receives Storage webhook or client polls parse_jobs table.
- Set per-bucket file size limits in Supabase Storage: e.g. 500 MB for video bucket, not the global 500 GB maximum.

**Detection:**
Test with a 20 MB video file on a Vercel preview deployment (not localhost) before any other work.

**Phase to address:** Pathway 1 (Video → SOP) — must be addressed in the very first activity of that phase.

---

### Pitfall 10: Transcription Fails Silently on Factory Audio and NZ-Accented Speech

**What goes wrong:**
A worker records a 5-minute walkthrough of a maintenance procedure on the factory floor. The audio has ambient machinery noise, the worker has a New Zealand accent, and uses industry-specific terminology ("OTG laser", "Tergo Alkalox tank", "IRI CSV"). Whisper (or GPT-4o audio) transcribes most words correctly but silently misreads technical terms — "Tergo Alkalox" becomes "Turgo Alkaloaks", procedural step numbers are omitted, and safety hazards are paraphrased rather than quoted exactly. The admin reviews the transcript but doesn't know the original document's exact wording, so they miss the errors and publish.

**Why it happens:**
Whisper large-v3 achieves 2.7% WER on clean LibriSpeech audio, but 17.7% WER on telephony-quality noisy audio — factory floors are worse. New Zealand and Australian accents share characteristics that increase WER by approximately 30–50% compared to American English benchmarks. Whisper's API accepts a prompt parameter (max 224 tokens) that can bias recognition toward domain vocabulary, but this feature is rarely used and does not cover all industry terms. Developers test on clean office audio and assume it generalises.

**Consequences:**
For safety-critical SOPs (chemical handling, machinery operation), a transcription error that corrupts a hazard warning or PPE requirement is a safety risk. Unlike document parsing where the original document is visible side-by-side, the admin reviewing a video transcript has no direct reference for exact wording.

**Prevention:**
- Pass a `prompt` parameter to the Whisper API containing a comma-separated vocabulary list of organisation-specific terms, abbreviations, chemical names, and equipment names (up to 224 tokens). This reduces WER on domain vocabulary by 40–60% per published benchmarks.
- Always show the admin the transcript with the video playback side-by-side, with timestamps on each segment so they can seek to any sentence and verify it.
- Flag numerical values, chemical names, and PPE specifications as "high-risk tokens" requiring explicit admin confirmation before the SOP publishes.
- Consider OpenAI's newer GPT-4o transcription models (released March 2025) which have lower WER than Whisper large-v3, especially on non-American English accents.
- Pre-process audio: strip silence, normalise gain, apply basic noise reduction (e.g., FFmpeg's `afftdn` filter) before sending to the API. Reduces WER on noisy audio measurably.

**Detection:**
Test on a real recording made on a factory floor with actual NZ-accented speech before shipping. Do not test exclusively on clean voice recordings in a quiet room.

**Phase to address:** Pathway 1 (Video → SOP) — transcription quality gate required before admin review UI is built.

---

### Pitfall 11: YouTube / Vimeo URL Pathway Creates Legal Liability

**What goes wrong:**
The "paste YouTube/Vimeo URL" feature is implemented using a server-side video downloader (yt-dlp, youtube-dl, or a wrapper API) to fetch the video, then transcribes it. This violates YouTube's Terms of Service (Section 5B: "you agree not to... circumvent, disable, fraudulently engage with, or otherwise interfere with... the Service"), creates DMCA exposure for the product, and in a 2026 US court ruling has been characterised as bypassing copyright protections. A single complaint from a video rights holder can result in content takedown notices against the SaaS product.

**Why it happens:**
Downloading YouTube video for transcription feels technically equivalent to parsing a Word document — "we're just extracting the text content." But YouTube video downloads are explicitly prohibited in ToS regardless of purpose. Developers reach for yt-dlp because it works, without reviewing the legal exposure.

**Consequences:**
DMCA takedown notices against the Vercel deployment, potential account suspension, and in the worst case a cease-and-desist from YouTube/Google. For a small NZ SaaS this is existential.

**Prevention:**
- Do not download YouTube or Vimeo video files server-side. Period.
- The correct approach for YouTube: use the YouTube Data API v3 to retrieve the video's auto-generated caption/transcript (if available) via the `captions.list` endpoint. This is permitted by YouTube ToS. If no captions exist, inform the user that URL-based transcription is not available and suggest they download their own video and upload it.
- For Vimeo: use the Vimeo API's `texttracks` endpoint to retrieve existing transcripts for videos the user owns. Vimeo's API explicitly supports this use case.
- For any URL-based pathway that requires the user to own the video: add a terms checkbox: "I confirm I have the right to transcribe this video."
- Document in the product ToS that users are responsible for having the rights to any video content they upload or reference.
- Do not offer yt-dlp or similar tools even as an "optional" backend.

**Detection:**
Review all video-URL code paths before shipping. Any code that fetches video bytes from a YouTube or Vimeo URL without using the official API is a compliance risk.

**Phase to address:** Pathway 1 (Video → SOP) — must be reviewed by the product/legal owner before the URL pathway is implemented.

---

### Pitfall 12: In-App Video Recording Produces Incompatible Audio/Video Formats

**What goes wrong:**
The in-app camera recording feature uses `MediaRecorder` with the default MIME type. On Chrome and Firefox, this produces `video/webm;codecs=vp8,opus`. On iOS Safari (which now supports MediaRecorder since iOS 14.5), the only supported format is `video/mp4;codecs=avc1,mp4a` (H.264/AAC). The app sends the video to the Whisper transcription API, which expects certain audio encodings. The iOS format fails to transcode or transcribes with corrupted audio because the audio codec pipeline is different.

**Why it happens:**
`MediaRecorder` codec support is browser/OS dependent. iOS Safari does not support WebM at all. Developers test recording on Chrome desktop, which works, and don't test on iOS until after launch. Additionally, a 5-minute video recorded at default bitrates on mobile produces 50–200 MB of raw data — iOS Safari has no built-in bitrate control in `MediaRecorder`, so the file size is unpredictable.

**Consequences:**
Recording works on Android/Chrome but fails or produces bad transcriptions on iOS, which is common among industrial workers. Raw recording may produce files too large to upload even with TUS resumable upload if the user has poor connectivity.

**Prevention:**
- Always call `MediaRecorder.isTypeSupported()` to detect the best available format in priority order: `video/webm;codecs=vp9,opus` → `video/webm;codecs=vp8,opus` → `video/mp4;codecs=avc1,mp4a` → `video/mp4`.
- Set explicit bitrate constraints: `videoBitsPerSecond: 1_000_000` (1 Mbps), `audioBitsPerSecond: 128_000` (128 kbps). A 5-minute video at 1 Mbps is approximately 37 MB — manageable for TUS upload.
- Show a live file-size estimate during recording ("3 min 20 sec — approx 24 MB") so the worker knows what they're committing to upload.
- For transcription: extract audio track server-side using FFmpeg (deployed as a Supabase Edge Function or lightweight container) to produce a normalised WAV or MP3 before sending to Whisper, regardless of input container format.
- Test the full recording → transcription pipeline explicitly on a real iPhone with iOS 16+.

**Detection:**
Record a 2-minute test video on an iPhone Safari PWA install. Verify the file uploads and transcribes successfully before the recording feature is promoted to SOP Admins.

**Phase to address:** Pathway 1 (Video → SOP) — recording format handling must be done before transcription integration.

---

### Pitfall 13: Video and Generated-Video Storage Costs Become Unbounded

**What goes wrong:**
The system stores raw uploaded videos (50–500 MB each), transcription intermediaries, and generated output videos (narrated slideshows, full AI videos) in Supabase Storage. An organisation with 100 SOPs and one video per SOP stores 5–50 GB of video. Multiple organisations multiply this. Supabase Pro includes 100 GB storage; overage is billed at $0.021/GB/month. Generated videos for a full SOP library can cost $20–100 per organisation per month in storage and egress alone, which the pricing model may not account for.

**Why it happens:**
Development happens against a small number of test SOPs. Storage costs are invisible until multiple organisations are using the system. Generated video files are treated as permanent assets alongside source documents, but they are actually reproducible outputs — they don't need to be stored indefinitely.

**Prevention:**
- Separate storage buckets by asset type with explicit retention policies:
  - Uploaded source videos: retain for 30 days after transcription completes, then delete (original is the user's responsibility). Warn the user clearly.
  - Transcription audio extracts: delete after transcription job completes.
  - Generated SOP videos: store for 90 days; regenerate on demand if requested after expiry. Do not store indefinitely.
- Implement Supabase Storage lifecycle policies (or a daily Edge Function cron job) to enforce these retention windows.
- Set per-tenant storage quotas. Expose a "Storage used" indicator in the organisation settings UI.
- Per-bucket size limits: video uploads bucket at 500 MB per file, generated video bucket at 200 MB per file.
- Treat generated videos as a derived asset, not a primary asset. Never cache them in the PWA — they are too large and too rarely needed offline.

**Detection:**
Calculate worst-case storage cost for a 500-SOP organisation with videos at 100 MB average before launch. Validate the pricing model covers it.

**Phase to address:** Pathway 1 (Video → SOP) and Pathway 3 (File → Video SOP) — storage policy must be defined before either pathway is shipped.

---

### Pitfall 14: Video Generation Jobs Time Out or Have No Progress Feedback

**What goes wrong:**
Generating a narrated slideshow or full AI video from SOP content is a long-running operation: TTS generation for a 20-step SOP at 5 seconds per step is 100 seconds of audio, plus video assembly, plus any AI image generation. Total rendering time is 2–15 minutes depending on the approach. If the admin triggers generation and the system provides no feedback, they click "Generate" again, creating duplicate jobs. Or the job silently fails after the Vercel function times out (max 800 seconds on Pro), and the admin sees no error.

**Why it happens:**
Developers prototype generation synchronously in a Vercel route handler. This works for short SOPs in development (fast LLM responses, fast TTS) but fails in production with real 30-step SOPs on a loaded system. The async job pattern exists in the codebase for document parsing, but teams sometimes "just add" video generation without using it.

**Prevention:**
- Video generation must always be an async job, never a synchronous response. Use the existing `parse_jobs` async pattern: create a `video_generation_jobs` table row, return the job ID immediately, process in a Supabase Edge Function or background worker.
- Status progression must be visible: "Queued → Generating audio → Assembling video → Ready". Poll job status via Supabase Realtime subscription on the jobs table row — this already exists in the codebase pattern.
- Implement idempotency: if a generation job already exists for a given SOP version, return the existing job rather than creating a new one. Prevent duplicate generation on re-click.
- Cap total generation time per job at 10 minutes with a timeout state. Notify the admin if generation fails so they can retry.
- Consider external video generation APIs (e.g., HeyGen, Shotstack) for full AI video generation — rendering time at peak can be 10–60 minutes on their end, so use their webhook callback pattern, not polling.

**Detection:**
Test generation of a 25-step SOP (representative of real NZ industrial SOPs) and measure end-to-end time before committing to a synchronous approach.

**Phase to address:** Pathway 3 (File → Video SOP) — async pattern must be the starting assumption, not a retrofit.

---

### Pitfall 15: Generated Videos Are Cached in the PWA and Bloat Device Storage

**What goes wrong:**
The offline-first PWA service worker caches SOP content aggressively. If generated video files are referenced from SOP data, the service worker may attempt to cache them alongside other SOP assets. A 50 MB generated video file, multiplied by 20 SOPs, is 1 GB — far exceeding the available storage quota on most mobile devices. iOS allows up to ~50% of free disk space, but in practice PWA storage is evicted after 7 days of inactivity. Workers who encounter the app storing hundreds of MB of video may also report their device slowing down.

**Why it happens:**
The existing caching strategy pre-caches all assets referenced by SOP content. When video URLs are added to SOP records, they inherit this caching strategy without explicit exclusion. Nobody notices during development because test SOPs have one or two small videos.

**Prevention:**
- Explicitly exclude video file URLs (`.mp4`, `.webm`) from all service worker caching strategies. Video is network-only.
- Never embed generated video URLs directly in the SOP data structure that gets synced to IndexedDB. Store video metadata (job ID, status, URL) in a separate non-synced table.
- On the worker's device, generated SOP videos are streamed on demand when online. No offline video playback — the file sizes make this impractical for the vast majority of devices in NZ factory settings.
- If offline video becomes a requirement later, implement it as an explicit user-initiated "Download for offline" action with a quota warning, not automatic caching.

**Detection:**
Inspect the service worker cache contents after loading a video-SOP on a development device. Verify no video files appear in the cache manifest.

**Phase to address:** Pathway 3 (File → Video SOP) — service worker exclusion rules must be added in the same activity that introduces video URLs to the data model.

---

### Pitfall 16: OCR on Low-Quality Photos Produces Unusable Text

**What goes wrong:**
A SOP Admin photographs a laminated A3 procedure sheet with their phone under fluorescent factory lighting, then uploads it expecting OCR to extract the steps. The image has glare from the laminate, slight blur from hand movement, and shadows from overhead fixtures. Cloud OCR APIs achieve 98% accuracy on clean scanned PDFs but drop to 75–85% on real-world phone photos of industrial documents. Critical terms like chemical names and numerical tolerances are misread. The admin trusts the OCR output, makes minor edits, and publishes — but the original document had a tolerance of "±0.5 mm" which OCR read as "±0.5 mm" correctly but a chemical name "Tergo Alkalox" became "Tergo Akaiox" which passes an inattentive review.

**Why it happens:**
Testing of the OCR pathway uses clean, well-lit photos taken deliberately for testing purposes. Production photos are taken on factory floors with suboptimal conditions. There is no mechanism to flag low-confidence OCR tokens for mandatory review.

**Prevention:**
- Use a vision-language model (GPT-4o vision, Google Cloud Vision, or AWS Textract) rather than traditional OCR (Tesseract) for phone-photo inputs. VLMs are significantly more robust to perspective distortion, glare, and blur.
- Compute a per-word confidence score from the OCR output. Flag words below 90% confidence with a highlight in the admin review UI — the admin must explicitly confirm or correct each flagged word.
- For numerical values (tolerances, temperatures, pressures) and chemical names, always flag for mandatory admin confirmation regardless of confidence score. Errors here are safety-critical.
- Provide image preprocessing tips in the upload UI: "For best results, photograph in bright even lighting, avoid direct flash, and keep the document flat."
- Store the original image alongside the extracted text permanently so admins can re-check the source.

**Detection:**
Test with 10 real industrial document photos taken by non-technical staff under typical factory conditions. Measure accuracy before shipping.

**Phase to address:** Pathway 2 (File → SOP expanded) — OCR confidence gate is as important as the AI parsing confidence gate in Phase 2.

---

### Pitfall 17: Office File Parsing (Excel/PowerPoint) Exposes Macro Execution Risk

**What goes wrong:**
The expanded File → SOP pathway accepts Excel (.xlsx, .xlsm) and PowerPoint (.pptx, .ppt) files. A malicious actor uploads a macro-enabled `.xlsm` or `.pptm` file containing a VBA macro payload. The parsing library extracts the macro and executes it, or the file triggers a vulnerability in the parser library running in the Node.js process on Vercel.

**Why it happens:**
Office file parsers for Node.js (ExcelJS, xlsx, pptxgenjs) parse the XML structure of `.xlsx`/`.pptx` files safely, but legacy binary formats (`.xls`, `.ppt`) and macro-enabled formats (`.xlsm`, `.xlsb`, `.pptm`) contain executable content that parser libraries may not safely sandbox. Even "safe" XML parsers can be vulnerable to XXE (XML External Entity) attacks if not configured correctly.

**Prevention:**
- Reject macro-enabled file extensions at the upload validation layer before any parsing occurs: block `.xlsm`, `.xlsb`, `.xltm`, `.pptm`, `.potm`, `.ppam`. Accept only `.xlsx`, `.pptx`, `.csv`.
- Validate MIME type server-side using a magic-byte check (not just the file extension from the client, which can be spoofed).
- Run all Office file parsing in an isolated process or container with no network access and a strict CPU/memory timeout — never in the main Vercel function process.
- Use a library like `exceljs` or `xlsx` (SheetJS) for `.xlsx` and configure XML parsing with `noent: true` and `dtdload: false` to prevent XXE.
- Log all upload events with tenant ID, file name, MIME type, and detected format for security audit.

**Detection:**
Attempt to upload a macro-enabled `.xlsm` file and verify it is rejected with a clear error before parsing begins.

**Phase to address:** Pathway 2 (File → SOP expanded) — file validation must be the first thing built before any Excel/PowerPoint parser is integrated.

---

### Pitfall 18: TTS Mispronounces Industrial Terminology and NZ Place Names

**What goes wrong:**
The File → Video SOP pathway generates narrated audio using a TTS API (OpenAI TTS, ElevenLabs, or similar). The AI voice reads "PPE" as individual letters (correct) but mispronounces "Tergo Alkalox" as "Turgo Al-kay-locks", "OTG" as a word ("otg") instead of letters, "kPa" as "k-pa" instead of "kilopascals", and NZ-specific place names like "Whangārei" entirely incorrectly. The generated audio sounds unprofessional and confusing to workers who know how these terms are correctly pronounced.

**Why it happens:**
General-purpose TTS models are trained predominantly on American/British English text and do not have pronunciation rules for industrial abbreviations, chemical trade names, or te reo Māori place names and te reo words that appear in NZ workplace signage. No TTS API in 2026 handles these automatically. Developers test with generic English sentences and assume industrial text will work.

**Prevention:**
- Use a pronunciation dictionary (SSML `<phoneme>` tags with IPA notation, or ElevenLabs' pronunciation dictionary upload) for known industry terms. Maintain a per-organisation pronunciation dictionary that admins can extend.
- Before audio is included in a generated video, show the admin a "preview audio" step where they can listen to the narration and flag mispronounced terms. This is a required review step, not optional.
- For NZ market specifically: build a starter pronunciation list covering common industrial units (kPa, RPM, mL, kN), PPE abbreviations (SCBA, RPE, PPE), and common te reo words that appear in workplace contexts. This can be maintained as a static lookup table in the codebase and extended by admins.
- Use the `language` parameter if available (e.g., `en-NZ` on Google TTS / AWS Polly) to select a NZ English voice model which has better baseline for NZ pronunciation patterns.

**Detection:**
Generate a narrated SOP with at least 10 industrial terms and 2 NZ-specific names. Have a NZ-based reviewer listen before shipping.

**Phase to address:** Pathway 3 (File → Video SOP) — pronunciation review gate must be built into the generation review flow.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Auto-publish AI-parsed SOPs without admin review | Faster demo, less admin friction | Safety incident from wrong step order; legal liability | Never — always require human sign-off |
| Store photos as Base64 in JSON columns | Simpler code path | IndexedDB crashes on mobile; 3–5x storage bloat | Never |
| Single `tenant_id` filter in application code, no RLS | Simpler to build initially | Cross-tenant data leak on any missed filter; impossible to audit | Never for prod |
| In-place SOP content edits, no versioning | Easier admin UI | Defensibility failure; workers on stale versions with no detection | Never for regulated content |
| Client-side timestamps on completion records | Works without server round-trip offline | Tamper risk; device clock skew invalidates audit trail | MVP only if server-side timestamp added on sync |
| Hardcode tenant context in session, not per-request | Less boilerplate | Background job leaks tenant context across jobs | Never |
| Skip `skipWaiting()` in service worker | Simpler update logic | Workers stuck on old app version for days after deployment | Never for production |
| Route video uploads through a Vercel function | Simpler code (same pattern as document uploads) | 413 error on any file >4.5 MB — all video files exceed this | Never — use presigned URL direct upload |
| Synchronous video generation in a request handler | Simpler to prototype | Times out on Vercel for any real SOP; no retry; no status feedback | Prototype only, never production |
| Cache generated video files in service worker | One caching strategy for all assets | 1 GB+ on device within a week; iOS evicts everything including SOPs | Never |
| Use yt-dlp to download YouTube URLs server-side | Easiest implementation | DMCA exposure; ToS violation; platform ban risk | Never in a SaaS product |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| AI parsing (OpenAI/Claude) | Send entire raw PDF text as one prompt; assume output matches source structure | Extract with document-structure-aware tools (e.g., Azure Document Intelligence, LlamaParse) first; then send structured sections to LLM for cleaning/classification |
| iOS PWA camera | Rely solely on `getUserMedia()` for photo capture | Always include `<input type="file" accept="image/*" capture="environment">` as fallback; test both code paths on iOS 17+ |
| Background Sync API | Assume it works on all platforms | Background Sync is Chromium-only (2026); Firefox disabled, Safari not implemented. Queue locally in IndexedDB and sync on app foreground/online events instead |
| PostgreSQL RLS | Enable RLS and assume it covers all data paths | RLS does not apply to superuser connections; does not block bulk import tools; does not prevent timing-attack row count inference. Layer application-level tenant_id filtering on top |
| Cloud photo storage (S3/R2) | Upload full-size captures directly from device | Compress client-side first (Canvas resize to 1200px); generate a server-side pre-signed URL for direct upload; never route large binary through your API server |
| SOP document parsing (PDF) | Use `pdf.js` text extraction alone | Multi-column PDFs produce garbled text order; use a dedicated document intelligence service that preserves layout and table structure |
| Supabase Storage + video | Use same Server Action upload pattern as documents | Video files exceed the 4.5 MB Vercel body limit. Use `createSignedUploadUrl` server-side + TUS resumable upload client-side for files >6 MB |
| MediaRecorder (in-app recording) | Use default MIME type; test only on Chrome | iOS Safari only supports `video/mp4;codecs=avc1,mp4a`. Call `isTypeSupported()` first. Always extract audio server-side with FFmpeg before sending to Whisper |
| Whisper API (transcription) | Send raw audio with no prompt; assume accuracy on industrial content | Pass domain vocabulary as the `prompt` parameter (max 224 tokens). Pre-process audio to reduce noise. Test on NZ-accented speech before shipping |
| YouTube URL transcription | Use yt-dlp or similar server-side download | Violates YouTube ToS and DMCA. Use YouTube Data API v3 `captions.list` for auto-generated captions. If none exist, prompt user to download and upload the file |
| Video generation (TTS output) | Store generated video permanently like source documents | Generated videos are reproducible — store with 90-day TTL. Never cache in service worker. Treat as derived, not primary, asset |
| Office file parsing (Excel/PowerPoint) | Accept all Excel/PowerPoint variants including macro-enabled | Block `.xlsm`, `.xlsb`, `.pptm` at upload validation before parsing. Validate magic bytes server-side, not just file extension |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Fetching full SOP library on every app open | Slow initial load; high bandwidth on spotty connections | Fetch only delta changes since last sync (use `updated_at` cursor); send a manifest of SOP IDs + versions first | 50+ SOPs per org |
| Storing all SOP images in the same IndexedDB object store as text data | Progressive slowdown; eventual crash on mobile | Separate object stores for binary (Blob) and structured (JSON) data; use unindexed Blob fields | >20 images cached |
| Loading all completion records for supervisor dashboard in one query | Page timeout; OOM on large orgs | Paginate by date range; index on `(tenant_id, completed_at)`; never `SELECT *` completion records | >500 completions per org |
| Service worker pre-caching entire SOP library on install | 50-500 SOPs × images = install fails on low-storage devices | Pre-cache only app shell and assigned SOPs for that worker; lazy-cache others on first view | Orgs with 100+ image-heavy SOPs |
| Synchronous IndexedDB reads blocking the UI thread | UI freezes during SOP navigation | All IndexedDB operations must be async; use Dexie.js or similar to avoid raw IDB callback hell | Any device |
| Video transcription as a synchronous API call in the request lifecycle | 504 timeout on any video over ~30 seconds | Transcription must be an async job: create job row, return job ID, process in background, client polls status | Video > 30 seconds |
| Generating TTS audio synchronously for a full SOP | Times out for SOPs with >10 steps (each step ~5s TTS = 50s+ total) | TTS generation must be chunked and async; generate per-step and assemble — allows partial progress visibility | SOPs with >8 steps |
| Streaming large video from Supabase Storage through the Next.js API layer | High Vercel function execution cost; bandwidth bottleneck | Generate short-lived signed download URLs client-side; stream directly from Supabase Storage CDN, not through the Next.js server | Any video file |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Returning all tenant SOPs from a shared `/api/sops` endpoint filtered only in the frontend | Any authenticated user can enumerate another org's SOPs via API | All data endpoints enforce tenant_id server-side; frontend filtering is display-only, never security |
| Completion records deletable by SOP admins | Admins can erase evidence of non-compliance before a safety audit | Completion records are write-once; provide archive/hide UI that does not physically delete |
| AI parsing API key embedded in frontend bundle | API key exposed; attacker can run unlimited LLM queries at your cost | All AI calls are server-side only; never expose API keys to the client |
| No rate-limiting on SOP upload endpoint | Denial of service via large PDF spam; runaway AI parsing costs | Per-tenant upload rate limit (e.g., 20 documents/hour); max file size enforcement (50MB); file type validation before parsing |
| Photo evidence URLs are permanent public S3 links | Evidence photos publicly accessible if URL is guessed | Photos stored in private S3 bucket; served via short-lived signed URLs (1 hour expiry) scoped per tenant |
| JWT does not include tenant_id claim | Tenant context must be looked up from DB on every request, creating lookup-skip vulnerabilities | Embed `tenant_id` and `role` in the JWT; validate server-side on every request before any data access |
| Accepting macro-enabled Office files without rejection | Remote code execution or SSRF via malicious macro payload in parsing process | Block `.xlsm`, `.xlsb`, `.pptm` at MIME/extension validation before any parsing library touches the file |
| Storing raw uploaded video files without a retention policy | Unbounded storage growth; unexpected billing; GDPR retention violation | Explicit per-bucket retention: source video 30 days post-transcription, generated video 90 days, then delete |
| Generated video signed URLs that never expire | Anyone with a leaked URL can stream the video indefinitely | Generated video URLs expire in 24 hours; regenerate on demand from the stored job record |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| SOP displayed as a scrollable document (replicate Word layout) | Worker loses place, skips steps, reads the wrong section on a small screen | Step-by-step card interface: one step visible at a time, explicit "Next" and "Back" actions |
| Sign-off requires typing name or signature | Workers with gloves cannot type; frustrating on a factory floor | Biometric confirmation (Face ID / fingerprint via Web Authentication API) or PIN tap, not text input |
| No visual indication of offline status | Worker doesn't know if their completion was saved; anxiety; duplicate submissions | Persistent status banner: green "Online — syncing", amber "Offline — saved locally", with last-sync time |
| Step requires scrolling to see photo capture button | Worker on a ladder or in an awkward position can't scroll and act | Photo capture button is always sticky/visible on photo-required steps — never below the fold |
| SOP search requires exact keyword match | Worker types "chemical spill" and gets zero results because the SOP says "hazardous material release" | Full-text search with fuzzy matching and section-type filters (Hazards, PPE, Emergency) |
| Supervisor sign-off requires same device as worker | Supervisor is remote or on a different shift | Supervisor sign-off via separate supervisor session; completion record status shows "pending supervisor review" |
| No progress feedback during video transcription | Admin submits video and sees a spinner for 2–10 minutes with no indication of progress | Show transcription progress stages: "Uploading → Extracting audio → Transcribing → Structuring steps" with estimated time remaining |
| Generated video playback requires streaming on factory floor | Workers on intermittent WiFi cannot play back generated videos | Generated videos are an admin review / training tool, not a field tool. Clearly communicate this scope and do not surface video playback in the worker walkthrough UI |
| Admin uploads a video, sees no indication of whether sound was detected | Silent videos (e.g., screen recordings, timelapse footage) produce empty or garbage transcriptions | Check audio track presence server-side before starting transcription; warn "No audio track detected — upload a video with spoken narration for transcription" |

---

## "Looks Done But Isn't" Checklist

- [ ] **AI Parser:** Has a human review step before SOPs go live — verify there is no way to bypass admin sign-off and publish directly.
- [ ] **Offline mode:** Test with Airplane mode + kill and reopen the app — verify cached SOPs load, in-progress steps resume, and no data loss on restart.
- [ ] **iOS Safari:** Test camera capture, offline storage, and app reload on a real iOS device (not Chrome emulation) — permission re-prompts and storage eviction behave differently.
- [ ] **Tenant isolation:** Create two test orgs and verify that every API endpoint (not just the UI) returns 403 or empty results when accessing the other org's data.
- [ ] **SOP version update:** Update a published SOP and verify an active worker session detects the change within one sync cycle, not just on next manual open.
- [ ] **Completion records:** Attempt to edit or delete a completion record via the API with admin credentials — verify it is rejected (append-only).
- [ ] **Photo bloat:** Queue 30 offline photos (compressed) on a low-end device and verify IndexedDB remains responsive and quota warnings appear before storage is full.
- [ ] **Background jobs:** Run a report-generation job and verify the tenant_id in the output matches the requesting org — not the last job that ran.
- [ ] **Service worker update:** Deploy a new version and verify workers see the update prompt within one navigation, not after 24 hours.
- [ ] **Glove test:** Complete a full SOP start-to-finish wearing nitrile gloves on the smallest supported screen size.
- [ ] **Video upload (Vercel body limit):** Upload a 50 MB video file on a Vercel preview deployment and verify it completes successfully via presigned URL — not a 413 error.
- [ ] **iOS recording:** Record a 2-minute video using the in-app recorder on a real iPhone and verify it uploads and transcribes successfully.
- [ ] **Factory audio transcription:** Test Whisper transcription on a recording with background machinery noise and NZ-accented speech. Verify word error rate is acceptable and domain vocabulary prompt is active.
- [ ] **YouTube URL:** Attempt to paste a standard YouTube URL and verify the system uses the Captions API — not a video download — and handles "no captions available" gracefully.
- [ ] **Macro file rejection:** Upload an `.xlsm` file and verify it is rejected with a clear error before any parsing occurs.
- [ ] **Video storage retention:** Verify a job exists (cron or lifecycle policy) that deletes source videos 30 days after transcription and generated videos 90 days after creation.
- [ ] **Service worker video exclusion:** Load a generated video SOP, then inspect the service worker cache — verify no video files appear in the cached assets.
- [ ] **TTS pronunciation:** Play the generated narration for an SOP containing NZ-specific terms and industrial abbreviations — verify all are intelligible to a NZ listener.
- [ ] **Video generation idempotency:** Click "Generate Video" twice in rapid succession — verify only one job is created, not two.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| AI parser produced wrong SOP steps (already published) | HIGH | Immediately unpublish affected SOPs; notify active users; admin re-reviews and corrects; log which workers followed the wrong version; legal review if safety-relevant |
| Stale SOP version shown after safety update | HIGH | Force-cache-bust via service worker version bump + push notification to all active workers; confirm receipt in audit log |
| Cross-tenant data leak discovered | CRITICAL | Immediate incident response: identify scope (which tenants, which data, what duration); notify affected orgs; regulatory notification if PII/safety data; fix query; audit all similar endpoints |
| iOS storage eviction wipes cached SOPs | LOW | User-facing: prompt to re-download; mitigate by adding visible "re-sync for offline" affordance; no data loss (server has everything) |
| Completion record conflict from dual offline sync | MEDIUM | Surface conflict to supervisor for manual resolution; never auto-discard; both records preserved; supervisor marks one canonical |
| Photo queue fills device storage | LOW | Delete oldest unsynced photos after warning; worker re-captures; show storage warning early enough to prevent silent failure |
| Background job ran with wrong tenant context | HIGH | Audit which jobs ran in the affected window; diff output records against expected tenant; manual correction; add tenant context assertion at job entry point |
| DMCA takedown from YouTube URL download implementation | CRITICAL | Immediately disable the URL pathway; respond to takedown within 10-day window; remove all cached video bytes; switch to Captions API approach; legal review |
| Video storage costs spike from unbounded retention | MEDIUM | Run emergency cleanup job; implement retention policy immediately; review pricing model; notify affected tenants if data is to be deleted |
| Generated video TTS mispronounces safety-critical term after publish | HIGH | Unpublish generated video; regenerate with corrected pronunciation dictionary entry; notify admins who used the video for training; add the term to the permanent pronunciation dictionary |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| AI parser produces wrong SOP steps | Foundation / AI Parsing | Integration test: feed 5 varied real-world SOPs, confirm admin review gate blocks publication |
| Stale SOP version served after update | Offline / PWA | Test: update SOP on server, verify client detects version mismatch within one sync cycle |
| iOS Safari destroys offline data / camera | Offline / PWA | Manual test on real iOS device: Airplane mode + camera capture + 7-day inactivity simulation |
| Multi-tenant data leakage | Foundation / Data Model | Automated test: two-tenant fixture + cross-org API request returns 403/empty |
| Glove-hostile UI | Worker UI / Step Execution | Glove usability test before any user testing session |
| Photo bloat crashes IndexedDB | Photo Capture / Offline | Load test: 40 queued compressed photos on a mid-range Android; verify no crash, quota warning fires |
| Completion records not legally defensible | Completion Tracking / Sign-off | Audit: verify no UPDATE/DELETE on completion table; check SOP version hash is stored |
| Offline sync conflict blindness | Offline / Sync Engine | Test: two devices complete same SOP offline, sync, verify both records preserved |
| Background job tenant context leak | Background Jobs / Async Work | Test: enqueue job for tenant A immediately after tenant B job; verify output is scoped to tenant A |
| Service worker update delay | PWA Shell / Deployment | Deploy canary, verify skipWaiting prompt appears within one navigation on all open tabs |
| Vercel 4.5 MB body limit blocks video upload | Pathway 1 — first activity | Test: 50 MB upload on Vercel preview deployment returns 200, not 413 |
| Transcription accuracy on factory/NZ audio | Pathway 1 — transcription integration | Test: factory-floor recording with NZ accent + domain vocabulary prompt active; WER < 15% |
| YouTube URL DMCA liability | Pathway 1 — URL pathway design | Code review: no yt-dlp or direct YouTube download in codebase; Captions API path confirmed |
| MediaRecorder iOS format incompatibility | Pathway 1 — in-app recording | Test: record 2 min on iPhone Safari PWA; verify upload + transcription succeeds |
| Unbounded video storage costs | Pathway 1 + Pathway 3 — storage design | Storage lifecycle policy verified; per-tenant quota limit set; worst-case cost calculated |
| Video generation job timeout / no progress | Pathway 3 — async job architecture | Test: generate video for 25-step SOP; verify progress states update; no silent timeout |
| Generated videos cached in service worker | Pathway 3 — service worker rules | Inspect cache after video SOP loaded; no .mp4/.webm in cached assets |
| Low-quality OCR on phone photos | Pathway 2 — OCR integration | Test: 10 real industrial document photos; confidence flag rate > 0; safety terms flagged |
| Macro-enabled Office file execution | Pathway 2 — file validation | Test: upload .xlsm file; verify rejected before parsing library is called |
| TTS mispronunciation of NZ/industrial terms | Pathway 3 — TTS generation | Audio review: 10 industrial terms + 2 NZ place names all intelligible to NZ listener |

---

## Sources

- [Your Standard Operating Procedure Program Failed (Now What?) — MaintainX](https://www.getmaintainx.com/blog/standard-operating-procedure-program)
- [Common Mistakes When Converting Paper SOPs to Digital — OrcaLean](https://www.orcalean.com/article/common-mistakes-when-converting-paper-sops-to-digital)
- [Why Operators Struggle With SOPs — OrcaLean](https://www.orcalean.com/article/why-u.s.-operators-struggle-with-sop-complianceand-how-to-fix-it-digitally)
- [PWA iOS Limitations and Safari Support — MagicBell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
- [Camera Access Issues in iOS PWA — STRICH Knowledge Base](https://kb.strich.io/article/29-camera-access-issues-in-ios-pwa)
- [Multi-Tenant Leakage: When Row-Level Security Fails in SaaS — InstaTunnel/Medium](https://medium.com/@instatunnel/multi-tenant-leakage-when-row-level-security-fails-in-saas-da25f40c788c)
- [Tenant Isolation Checklist for SaaS Prototypes — fixmymess.ai](https://fixmymess.ai/blog/tenant-isolation-checklist-saas-prototypes)
- [Building An Offline-Friendly Image Upload System — Smashing Magazine](https://www.smashingmagazine.com/2025/04/building-offline-friendly-image-upload-system/)
- [IndexedDB Max Storage Size Limit — RxDB](https://rxdb.info/articles/indexeddb-max-storage-limit.html)
- [Keep storing large images, just don't index binary data — David Fahlander / Dexie.js](https://medium.com/dexie-js/keep-storing-large-images-just-dont-index-the-binary-data-itself-10b9d9c5c5d7)
- [Offline-First Mobile App Architecture: Syncing, Caching, and Conflict Resolution — DEV Community](https://dev.to/odunayo_dada/offline-first-mobile-app-architecture-syncing-caching-and-conflict-resolution-1j58)
- [Conflict Resolution in Offline-First Apps — Medium](https://shakilbd.medium.com/conflict-resolution-in-offline-first-apps-when-local-and-remote-diverge-12334baa01a7)
- [Hallucination-Free LLMs: The future of OCR and data extraction — Cradl AI](https://www.cradl.ai/post/hallucination-free-llm-data-extraction)
- [From hallucinations to hazards: benchmarking LLMs for safety-critical systems — ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0925753525002814)
- [Offline and background operation — PWA docs, MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation)
- [When 'Just Refresh' Doesn't Work: Taming PWA Cache Behavior — Infinity Interactive](https://iinteractive.com/resources/blog/taming-pwa-cache-behavior/)
- [Preventing Cross-Tenant Data Leakage in Multi-Tenant SaaS — Agnite Studio](https://agnitestudio.com/blog/preventing-cross-tenant-leakage/)
- [Tenant Data Isolation: 5 Patterns That Actually Work — Propelius](https://propelius.tech/blogs/tenant-data-isolation-patterns-and-anti-patterns/)
- [UI/UX Design in Manufacturing — OEE IntelliSuite/Medium](https://medium.com/@hopeful_rajah_koala_193/ui-ux-design-in-manufacturing-f425481afe1c)
- [Touch Target Optimization — Garanord](https://garanord.md/touch-target-optimization-designing-finger-friendly-interfaces-for-mobile-devices/)
- [Vercel Functions Limits — Vercel Docs](https://vercel.com/docs/functions/limitations) — HIGH confidence: 4.5 MB request body limit confirmed, 800s max duration on Pro with Fluid Compute
- [Supabase Storage v3: Resumable Uploads (TUS) up to 50 GB — Supabase Blog](https://supabase.com/blog/storage-v3-resumable-uploads) — HIGH confidence: official Supabase documentation
- [Supabase Storage File Limits — Supabase Docs](https://supabase.com/docs/guides/storage/uploads/file-limits) — HIGH confidence: 50 MB Free, 500 GB Pro per file
- [MediaRecorder API — Can I Use](https://caniuse.com/mediarecorder) — HIGH confidence: iOS 14.5+ support, mp4/H.264 only on Safari
- [How to Implement MediaRecorder with iPhone Safari Support — Build with Matija](https://www.buildwithmatija.com/blog/iphone-safari-mediarecorder-audio-recording-transcription) — MEDIUM confidence: Safari audio format differences confirmed
- [OpenAI Speech to Text (Whisper) API — OpenAI Docs](https://developers.openai.com/api/docs/guides/speech-to-text) — HIGH confidence: prompt parameter, language support
- [Prompt Engineering in Whisper — Ailia Tech Blog](https://medium.com/axinc-ai/prompt-engineering-in-whisper-6bb18003562d) — MEDIUM confidence: 224-token prompt limit, vocabulary bias effect
- [Contextual Biasing for Domain-Specific Vocabulary in Whisper — arXiv](https://arxiv.org/html/2410.18363v1) — MEDIUM confidence: 40-60% WER reduction with vocabulary injection
- [Is Whisper Still #1? 2025 Transcription Benchmarks — DIY AI](https://diyai.io/ai-tools/speech-to-text/can-whisper-still-win-transcription-benchmarks/) — MEDIUM confidence: WER benchmarks including noisy conditions
- [YouTube Terms of Service — YouTube](https://www.youtube.com/static?template=terms) — HIGH confidence: Section 5B prohibits circumventing access controls
- [DMCA Ruling on Third-Party YouTube Downloads — MediaNama](https://www.medianama.com/2026/02/223-dmca-ruling-third-party-youtube-downloads-legal-risks-creators/) — MEDIUM confidence: 2026 US ruling on download tools
- [Vimeo API: Text Tracks (Transcripts) — Vimeo Developer Docs](https://developer.vimeo.com/api/upload/texttracks) — HIGH confidence: official Vimeo API documentation
- [How to Protect Node.js App from Malicious .PPT Files — Cloudmersive/Medium](https://cloudmersive.medium.com/how-to-protect-your-node-js-app-from-malicious-ppt-files-de0b5eeba0bf) — MEDIUM confidence: macro execution risks in Office file parsing
- [Excel Macros Blocked for Security — SpreadsheetsHub](https://spreadsheetshub.com/blogs/articles/excel-macros-blocked-for-security-navigating-the-changes-in-2026/) — MEDIUM confidence: macro security landscape 2026
- [Best TTS APIs in 2026 — Speechmatics](https://www.speechmatics.com/company/articles-and-news/best-tts-apis-in-2025-top-12-text-to-speech-services-for-developers) — MEDIUM confidence: TTS pronunciation accuracy comparison
- [PWA with Offline Streaming — web.dev](https://web.dev/articles/pwa-with-offline-streaming) — HIGH confidence: IndexedDB approach for large video offline
- [How I Solved Background Jobs using Supabase Tables and Edge Functions — jigz.dev](https://www.jigz.dev/blogs/how-i-solved-background-jobs-using-supabase-tables-and-edge-functions) — MEDIUM confidence: async job pattern with Supabase

---

*Pitfalls research for: SOP Assistant — mobile-first SOP management SaaS for blue-collar tradespeople*
*v1.0 researched: 2026-03-23 | v2.0 additions researched: 2026-03-29*
