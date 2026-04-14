# Phase 9: Streamlined File → Video Pipeline - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can upload a source file (docx/pdf/image/xlsx/pptx) and reach a ready-to-publish generated video SOP in a single guided flow, without manually navigating between the existing upload, review, publish, and video-generate pages as four separate tabs. The phase chains existing pipelines — it does NOT reimplement parsing, publishing, or video generation.

Out of scope: new parser types, new video output formats, new TTS engines, changes to review UI structure.
</domain>

<decisions>
## Implementation Decisions

### Entry Point
- **D-01:** New "Generate video SOP" button on the existing `UploadDropzone` component, side-by-side with the current "Upload" button. Lowest-friction entry; reuses the dropzone that already handles docx/pdf/xlsx/pptx/image MIME detection and TUS upload dispatch.

### Review Gate
- **D-02:** Full admin review still required before video generation fires. Pipeline pauses at the existing review page (`/admin/sops/[sopId]/review`); video generation auto-queues the moment the admin clicks Publish. Preserves the existing QA gate (server-enforced `all sections approved`), prevents video from generating on a hallucinated SOP, and honours the Phase 8 TTS pronunciation concern (admin audio preview still required before publishing the video itself).

### Video Format Selection Timing
- **D-03:** Format (narrated slideshow vs screen-recording) is chosen **upfront** at upload time — surfaced on the entry CTA before the file is dispatched. The chosen format is persisted on the parse job or on a new pipeline state row and read at publish-time when the video job is queued. Fewest mid-flow interruptions; admin commits once.

### Progress Surface
- **D-04:** Dedicated progress page with named stages: `uploading → parsing → publishing → generating video → ready`. Matches the Phase 6 `ParseJobStatus` stepper pattern and the Phase 8 `VideoGenerationStatus` component. When the admin hits a human-gate (review required), the "publishing" stage shows a "Review required" CTA that deep-links to the review page; on publish, the admin is returned to the progress page to watch the video stage complete.

### Failure Handling
- **D-05:** If video generation fails after the SOP is already published, the SOP stays published. Admin lands on the existing video panel (`/admin/sops/[sopId]/video`) with the failed job and retry button — reuses the `regenerateVideo` recovery path built in Phase 8-04. No publish-status rollback.

### Pipeline State Tracking
- **D-06:** The pipeline needs a single identifier that ties upload → parse_job → sop → video_generation_job together so the progress page can render a unified stepper. Planner to decide between: (a) adding a `pipeline_id` column to both `parse_jobs` and `video_generation_jobs` rows created via this flow, or (b) a new `sop_pipeline_runs` table. Choice is an implementation detail — the decision here is that the linkage must exist.

### Claude's Discretion
- Exact copy on the "Generate video SOP" button and format-selection modal/dropdown
- Progress page polling cadence (Phase 6 used 2s polling after 5s delay — default to same)
- Whether the pipeline page is `/admin/sops/[sopId]/pipeline` or `/admin/sops/pipeline/[pipelineId]` (planner decides based on D-06 state shape)
- Whether format selection is inline (segmented control on dropzone) or a modal (one click on "Generate video SOP" → modal → upload)
- Specific error copy/iconography per failure stage

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Upload entry point (Phase 5)
- `src/components/admin/UploadDropzone.tsx` — existing dropzone; new entry button integrates here
- `src/app/(protected)/admin/sops/upload/page.tsx` — hosts the dropzone
- `src/actions/sops.ts` — `createUploadSession`, `createVideoUploadSession` (pattern for new `createVideoSopPipelineSession`)
- `src/lib/upload/tus-upload.ts` — TUS dispatch for large files

### Parse pipeline (Phase 2, 5, 6)
- `src/app/api/sops/parse/route.ts` — parse dispatch route
- `src/lib/parsers/` — format-specific extractors
- `src/components/admin/ParseJobStatus.tsx` — named-stage stepper pattern to mirror

### Review + publish gate (Phase 2)
- `src/app/(protected)/admin/sops/[sopId]/review/page.tsx` + `ReviewClient.tsx`
- `src/app/api/sops/[sopId]/publish/route.ts` — server-side gate (counts unapproved sections, returns 400)

### Video generation (Phase 8)
- `src/app/(protected)/admin/sops/[sopId]/video/page.tsx` — video format-selection + generation UI
- `src/components/admin/VideoGeneratePanel.tsx` — existing format picker and status states
- `src/components/admin/VideoGenerationStatus.tsx` — stage stepper pattern
- `src/app/api/sops/generate-video/route.ts` — video gen entry
- `src/actions/video.ts` — `regenerateVideo` (failure recovery path reused per D-05)

### Prior phase context
- `.planning/phases/08-video-sop-generation/08-CONTEXT.md` — video format, TTS, outdated-banner decisions
- `.planning/phases/05-expanded-file-intake/05-01-SUMMARY.md` — parse dispatch architecture
- `.planning/PROJECT.md` — Pathway 3 scope and "File → Video SOP" framing

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`UploadDropzone`** — already handles all docx/pdf/xlsx/pptx/image MIME types, TUS dispatch, and has a secondary-button slot pattern (currently: Scan, Record). New "Generate video SOP" button follows the same visual pattern.
- **`ParseJobStatus`** — 5-step stepper component from Phase 6 — the progress-page design should mirror its visual language so admins see a familiar UI.
- **`VideoGenerationStatus`** — Phase 8 stepper for the video half of the pipeline. Compose with `ParseJobStatus` on the new progress page.
- **`createUploadSession` / `createVideoUploadSession`** — server action pattern for atomically creating an SOP row + signed URL. Phase 9 adds a third variant that also captures the chosen video format.
- **`regenerateVideo` server action** — Phase 8 failure-recovery path reused as-is per D-05.
- **`worker_notifications` table** — existing pattern if future work needs background completion notifications (not needed for D-04).

### Established Patterns
- **Server-enforced gates** (Phase 2 publish gate). The "review required" checkpoint in the progress page is UX sugar — the real gate is still the `publish` route counting unapproved sections.
- **Realtime + polling hybrid** (Phase 2-03 — subscribe to `postgres_changes`, fall back to 2s polling after 5s). Apply to the progress page for stage transitions.
- **Format-specific dispatch** — Phase 5 `getSourceFileType` throws on unknown MIME types; new pipeline must preserve that strictness.
- **Lazy external-service clients** — OpenAI, Anthropic, Shotstack clients are lazily initialised so builds don't fail without keys. Any new module in this phase must follow that pattern.

### Integration Points
- **Upload action** — new server action that creates the SOP, signed URL, and a pipeline-linkage row/column (D-06) in one transaction, including the chosen video format.
- **Publish route** — on successful publish, check if `parse_jobs` row has a `pipeline_video_format` (or whatever D-06 names it) and, if so, enqueue a `video_generation_jobs` row tagged with the same pipeline id and call the existing generate-video pipeline code.
- **Progress page route** — new route under `/admin/sops/` that renders the unified stepper. The planner decides the exact URL shape.
- **Video panel** — existing `/admin/sops/[sopId]/video` page is where the admin lands for D-05 failure retry and for the final audio-preview gate before publishing the video.

</code_context>

<specifics>
## Specific Ideas

- Visual language for the progress page should read as one continuous pipeline (not two disconnected steppers) — e.g. stages 1-3 are "SOP" stages, stages 4-5 are "Video" stages, with a single progress bar.
- "Review required" is a human checkpoint dressed as a pipeline stage — the progress page shows a paused state with a CTA, not an error.
- TTS pronunciation preview (Phase 8 concern) must remain mandatory on the video panel before the video itself is marked `published=true`, even when the upstream pipeline was one-click.

</specifics>

<deferred>
## Deferred Ideas

- Auto-publish variants (confidence-threshold skip, abbreviated review) — could be a future phase if admin teams report review friction is the bottleneck.
- Parallel generation of both video formats (slideshow + screen-recording) from a single pipeline run — meaningful but adds cost/complexity.
- Email notification on completion — `worker_notifications` in-app pattern covers the current need; email is out of scope until a customer asks.
- Pipeline from video-source files (MP4/MOV) → transcribed SOP → generated video — possible, but semantically weird (regenerating video from a video). Defer unless user asks.

</deferred>

---

*Phase: 09-streamlined-file-video-pipeline*
*Context gathered: 2026-04-06*
