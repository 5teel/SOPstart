# Phase 6: Video Transcription (Upload and URL) - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin uploads MP4/MOV video files or pastes YouTube URLs. The system transcribes audio to text, structures it into SOP sections via the existing GPT pipeline, runs an adversarial AI verification pass, and presents the admin with a side-by-side transcript + structured SOP review UI. YouTube caption-only (no video download). Vimeo deferred.

</domain>

<decisions>
## Implementation Decisions

### Transcript Review UX
- **D-01:** Side-by-side panels — left panel: scrollable transcript with timestamps; right panel: structured SOP sections (same as existing review UI). Click a transcript line to highlight the corresponding SOP section.
- **D-02:** Transcript is read-only reference. Admin edits the structured SOP sections only — consistent with existing document-parsed SOP review flow.
- **D-03:** Embedded video player above the transcript panel with timestamp sync. Click a transcript line to jump to that timestamp in the video. For YouTube URL-sourced SOPs, embed the YouTube player; for file uploads, use HTML5 video with the uploaded file's presigned URL.

### Adversarial AI Verification
- **D-04:** After GPT-4o structures the SOP, an adversarial verification pass auto-runs using a different base model (e.g., Claude). It cross-checks the source transcript against the structured SOP output, looking for discrepancies — omitted safety information, numerical errors, misattributed sections, dropped content. Discrepancies flagged as amber highlights in the review UI that admin must resolve before publishing.
- **D-05:** This replaces simple "high-risk token flagging" — the verification is semantic, not keyword-based. It has an adversarial objective: find mistakes the structuring model made.

### YouTube/Vimeo URL Scope
- **D-06:** YouTube only for Phase 6. Vimeo deferred (requires separate API token + different caption API + limited NZ market demand).
- **D-07:** Caption-only from YouTube — use YouTube Data API v3 captions.list for compliant caption access. No server-side video/audio download (ToS protection).
- **D-08:** When no captions are available, prompt admin: "No captions found — download the video and upload as MP4 for audio transcription." Fallback to file upload pathway.
- **D-09:** Terms acknowledgement checkbox when pasting a YouTube URL: "I confirm I have rights to use this content for SOP creation." One-time per URL submission.

### Processing Feedback
- **D-10:** Named stages with progress indicators: uploading (% bar from TUS) → extracting audio → transcribing (elapsed time) → structuring → verifying → ready. Reuse ParseJobStatus component pattern with extended stage set.
- **D-11:** On failure: show which stage failed with brief error message + "Retry" button that re-attempts from the failed stage (not from scratch). Admin can also delete and re-upload.

### Transcription Accuracy
- **D-12:** Global industry vocabulary list shipped with the app — common NZ industrial/manufacturing terms (chemical names, equipment models, PPE terminology, NZ place names). Passed as prompt context to the transcription API. No per-org customisation in Phase 6.
- **D-13:** Missing hazards/PPE section: warn but allow publish — banner "Warning: No hazards/PPE section detected in this SOP." Admin can acknowledge and publish anyway. Consistent with Phase 5 warn-but-allow approach (D-08).

### Claude's Discretion
- Transcription API choice (OpenAI Whisper / gpt-4o-transcribe / other)
- Audio extraction approach (ffmpeg-static server-side vs client-side WASM)
- Adversarial verification model selection and prompt engineering
- YouTube caption API integration details
- Video player component choice (HTML5 native vs library)
- How to extend parse_jobs for video-specific stages
- Retry mechanism internals (which stages are idempotent)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Vision, core value, constraints, NZ market context
- `.planning/REQUIREMENTS.md` — VID-01, VID-02, VID-04, VID-05, VID-06, VID-07 are this phase's requirements
- `.planning/ROADMAP.md` — Phase 6 details, success criteria, depends on Phase 5

### Research (v2.0)
- `.planning/research/STACK.md` — youtube-transcript package, @ffmpeg/ffmpeg WASM, gpt-4o-transcribe
- `.planning/research/ARCHITECTURE.md` — Vercel constraints (4.5MB body limit, 300s function timeout), TUS upload pattern, parse_jobs extension, ffmpeg-static bundling
- `.planning/research/PITFALLS.md` — YouTube ToS (no yt-dlp), NZ accent accuracy 75-85%, ffmpeg bundle validation needed
- `.planning/research/FEATURES.md` — Video transcription pathway features, caption-first fast path
- `.planning/research/SUMMARY.md` — Consolidated recommendations and rejected approaches

### Prior Phase Context
- `.planning/phases/05-expanded-file-intake/05-CONTEXT.md` — TUS upload decisions, format-specific prompts, warn-but-allow approach
- `.planning/phases/02-document-intake/02-CONTEXT.md` — Upload experience, AI parsing approach, admin review UI

### Existing Code (extend these)
- `src/lib/upload/tus-upload.ts` — TUS resumable upload helper (reuse for video uploads)
- `src/components/admin/TusUploadProgress.tsx` — TUS progress component (reuse)
- `src/lib/parsers/gpt-parser.ts` — GPT-4o structuring with format hints (add video/transcript hint)
- `src/app/api/sops/parse/route.ts` — Parse orchestrator (extend for video dispatch)
- `src/components/admin/UploadDropzone.tsx` — Upload UI (extend with video MIME types + URL paste)
- `src/app/(protected)/admin/sops/[sopId]/review/ReviewClient.tsx` — Admin review (add transcript panel + video player)
- `src/types/sop.ts` — Type definitions (extend SourceFileType, add transcript types)
- `src/lib/validators/sop.ts` — Validation schemas (add video MIME types)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tus-upload.ts` + `TusUploadProgress.tsx` — TUS infrastructure from Phase 5, reuse directly for video file uploads
- `gpt-parser.ts` — GPT-4o structured output with format hints; add a `video`/`transcript` hint for video-sourced content
- `ParseJobStatus.tsx` — Real-time parse job status with Supabase Realtime; extend stage set for video processing stages
- `ReviewClient.tsx` — Admin review with side-by-side original doc + structured SOP; extend left panel to support transcript + video player
- `OriginalDocViewer.tsx` — Currently shows original document; will need video variant

### Established Patterns
- Async parse pipeline: upload → parse_jobs row → route handler processes → updates DB → Realtime subscription updates UI
- TUS upload for large files (>10MB threshold) — already wired in Phase 5
- Format-specific GPT prompt hints via `FORMAT_HINTS` map in gpt-parser.ts
- `parse_jobs.input_type` column already exists from Phase 5 migration

### Integration Points
- `parse/route.ts` — add video extraction branch (extract audio → transcribe → structure)
- New API route: `/api/sops/youtube` — YouTube caption fetch
- New modules: `src/lib/parsers/extract-video.ts` (audio extraction + transcription), `src/lib/parsers/verify-sop.ts` (adversarial verification)
- `UploadDropzone.tsx` — add video MIME types (video/mp4, video/quicktime) + URL paste input
- `ReviewClient.tsx` — add transcript panel, video player, adversarial verification highlights
- Database: extend parse_jobs stages for video pipeline

</code_context>

<specifics>
## Specific Ideas

- **Adversarial verification** is the key differentiator — a second AI model with an adversarial objective cross-checks the structuring output against source data. This replaces naive keyword flagging with semantic error detection. Should use a different model family than the structuring model.
- **Side-by-side transcript + structured SOP** mirrors the existing original-doc + structured-SOP review pattern but with video-specific additions (timestamps, video player).
- **Caption-first fast path for YouTube** — when captions exist, skip audio transcription entirely. Much faster and more accurate than re-transcribing.
- **Global industry vocabulary** is a v1 approach — per-org dictionaries can come later based on real-world usage patterns.
- **Warn-but-allow** for missing safety sections — consistent with Phase 5 approach. Don't block admins who are uploading non-safety SOPs (software config guides, etc).

</specifics>

<deferred>
## Deferred Ideas

- **Vimeo URL support** — requires separate API token, different caption API, limited NZ market demand. Add as Phase 6.1 or later.
- **Per-organisation vocabulary dictionaries** — build after real-world usage reveals which terms each org needs. Global vocabulary sufficient for Phase 6.
- **Automatic transcript correction** — admin edits transcript, system re-structures. Could be useful but adds complexity. Evaluate after seeing real usage patterns.

</deferred>

---

*Phase: 06-video-transcription-upload-and-url*
*Context gathered: 2026-04-03*
