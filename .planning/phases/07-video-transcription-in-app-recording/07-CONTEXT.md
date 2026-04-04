# Phase 7: Video Transcription (In-App Recording) - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Add in-browser video recording to the existing SOP upload flow. Admin taps "Record" in the UploadDropzone, captures a procedure video via MediaRecorder, previews it, then submits for transcription through the Phase 6 pipeline. iOS devices get a guided fallback to the native camera app + file upload.

</domain>

<decisions>
## Implementation Decisions

### Recording UX Flow
- **D-01:** Third tab in UploadDropzone — "Record" tab alongside existing "Upload file" and "YouTube URL" tabs. All SOP creation methods in one place.
- **D-02:** Full-screen camera overlay — tapping Record opens a full-screen overlay with record/stop/pause buttons, elapsed timer, and close button. Maximises viewfinder on mobile.
- **D-03:** Preview before submit — after stopping, show video playback preview with "Submit for transcription" and "Retake" buttons. Prevents accidental submissions of bad recordings.

### iOS Fallback
- **D-04:** Guided fallback with file picker — on iOS (where MediaRecorder is unreliable), show: "Recording isn't supported on this device yet. Use your camera app to record, then upload the file here." With a prominent "Choose video file" button that opens the iOS file/camera picker directly. One-tap path to native camera.
- **D-05:** Detection via `MediaRecorder` API availability check — if `window.MediaRecorder` is undefined or `isTypeSupported('video/webm')` returns false, show fallback. Don't hide the Record tab — let the user see the feature exists with a clear path forward.

### Video Quality & Limits
- **D-06:** 15-minute maximum recording duration. Show countdown timer in last 2 minutes. Auto-stop at limit.
- **D-07:** Extract audio client-side, upload audio only — same pattern as Phase 6 video upload. Use FFmpeg WASM to strip video track and upload just the MP3 via TUS. Video is only used for the preview, not uploaded. Much smaller upload (~15MB vs 200MB+).

### Claude's Discretion
- MediaRecorder configuration (codec, bitrate, mime type)
- Camera selection (front/rear default, switch button)
- Recording indicator animation style
- How to handle permission denied (camera/microphone)
- Whether to show a "mobile data warning" for large recordings
- Pause/resume implementation details

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Vision, core value, constraints
- `.planning/REQUIREMENTS.md` — VID-03 is this phase's only requirement
- `.planning/ROADMAP.md` — Phase 7 details, success criteria

### Prior Phase Context
- `.planning/phases/06-video-transcription-upload-and-url/06-CONTEXT.md` — Transcription pipeline decisions (all carry forward — D-10 stages, D-11 retry, D-12 vocabulary, D-13 missing section warnings)

### Existing Code (extend these)
- `src/components/admin/UploadDropzone.tsx` — Add Record tab (currently has Upload file + YouTube URL tabs)
- `src/lib/parsers/extract-video-audio.ts` — Client-side FFmpeg WASM audio extraction (reuse for recorded video)
- `src/lib/upload/tus-upload.ts` — TUS resumable upload (reuse for audio upload)
- `src/components/admin/TusUploadProgress.tsx` — Upload progress component (reuse)
- `src/components/admin/ParseJobStatus.tsx` — Video processing stages stepper (reuse as-is)
- `src/actions/sops.ts` — `createVideoUploadSession` server action (reuse for recorded video)
- `src/app/api/sops/transcribe/route.ts` — Transcription pipeline (reuse as-is)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `extract-video-audio.ts` — FFmpeg WASM audio extraction, directly reusable for recorded video blobs
- `tusUpload()` + `TusUploadProgress` — TUS upload infrastructure from Phase 5, already integrated
- `createVideoUploadSession` — Server action that creates SOP + parse job + returns TUS path/token
- `/api/sops/transcribe` route — Full 5-stage transcription pipeline, takes audio file path as input
- `ParseJobStatus` — Video stage stepper already shows uploading → extracting → transcribing → structuring → verifying

### Established Patterns
- UploadDropzone uses tab bar (`role="tablist"`) for upload methods — add a third tab
- Client-side audio extraction before upload — strip video, upload MP3 only
- Async pipeline with Supabase Realtime status updates
- Full-screen overlays exist in codebase (PhotoScanner from Phase 5 uses full-screen modal pattern)

### Integration Points
- New component: `VideoRecorder.tsx` — full-screen recording overlay with camera preview, controls, and preview playback
- `UploadDropzone.tsx` — add Record tab, open VideoRecorder on tap
- After recording: extract audio via `extract-video-audio.ts` → TUS upload → trigger `/api/sops/transcribe`
- No new API routes or server actions needed — reuse Phase 6 infrastructure entirely

</code_context>

<specifics>
## Specific Ideas

- **Full-screen overlay pattern** modelled after PhotoScanner from Phase 5 — similar full-screen modal with controls at bottom, close button at top.
- **Audio-only upload** keeps the recording flow fast and cheap — the video blob stays in memory only for the preview, never uploaded.
- **iOS guided fallback** should feel helpful, not broken — "Use your camera app" with a direct file picker button is a one-tap path to the same result.
- **15-minute cap** aligns with typical SOP procedure length and keeps transcription costs predictable.

</specifics>

<deferred>
## Deferred Ideas

- Per-org recording quality settings (resolution, bitrate)
- Video-to-video recording (upload the actual video for playback in review UI, not just audio)
- Recording pause/resume on Android (MediaRecorder.pause() support varies)

</deferred>

---

*Phase: 07-video-transcription-in-app-recording*
*Context gathered: 2026-04-04*
