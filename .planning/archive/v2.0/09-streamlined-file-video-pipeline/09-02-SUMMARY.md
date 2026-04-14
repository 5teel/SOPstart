---
phase: 09-streamlined-file-video-pipeline
plan: "02"
subsystem: admin-upload
tags: [ui, pipeline, modal, upload, video-sop]
requires:
  - createVideoSopPipelineSession (src/actions/sops.ts — Plan 09-01)
  - PipelineVideoFormat type (src/types/sop.ts — Plan 09-01)
  - createClient (src/lib/supabase/client.ts)
provides:
  - VideoFormatSelectionModal component (named export)
  - "Generate video SOP" entry button on UploadDropzone
affects:
  - src/components/admin/UploadDropzone.tsx (button row + modal mount)
tech_stack:
  added: []
  patterns:
    - Client-side file validation (blocked extensions + 50MB cap)
    - Fire-and-forget /api/sops/parse trigger (Next.js 16 pattern mirrored from UploadDropzone.handleUpload)
    - Supabase presigned URL upload via uploadToSignedUrl
    - Controlled modal via open/onClose props, local reset on dismiss
key_files:
  created:
    - src/components/admin/VideoFormatSelectionModal.tsx
  modified:
    - src/components/admin/UploadDropzone.tsx
decisions:
  - Modal mounted unconditionally (returns null when !open) so pipelineModalOpen state drives visibility rather than conditional render wrapper — cleaner reset-on-close semantics
  - Removed unused Film import from VideoFormatSelectionModal (icon used only in UploadDropzone button); keeps component lean
metrics:
  tasks: 2
  files_created: 1
  files_modified: 1
  commits: 2
  completed: 2026-04-13
---

# Phase 9 Plan 02: Video Format Selection Modal + Upload Dropzone Entry Summary

Single-click entry to the Phase 9 chained video SOP pipeline: admins see a new "Generate video SOP" button in the upload dropzone button row, click it to open a modal that picks a source file and commits to a video format (narrated slideshow vs screen recording), then confirms to dispatch `createVideoSopPipelineSession`, upload via presigned URL, fire the parse trigger, and navigate to `/admin/sops/pipeline/[pipelineId]`.

## What Was Built

### VideoFormatSelectionModal component
New client component at `src/components/admin/VideoFormatSelectionModal.tsx`:
- Controlled modal (`open` + `onClose` props) that renders `null` when closed
- File picker (dashed dropzone-style button) using the same `ACCEPT` list as the existing upload flow (.docx, .pdf, .xlsx, .pptx, .txt, image/jpeg, image/png, image/heic, image/heif)
- Client-side validation mirrors `UploadDropzone.validateAndAddFiles`: blocks `.xlsm/.xlsb/.xltm/.pptm/.potm/.ppam` and files >50MB with inline `role="alert"` error
- Two format radio cards using the exact visual pattern from `VideoGeneratePanel.tsx`: `flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer`, `border-brand-yellow` when selected with inner `bg-brand-yellow` dot
- Accessibility: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="video-format-modal-title"`; `<fieldset>` + `sr-only <legend>` for radio group; `aria-label="Close"` on X icon
- Primary CTA: `h-[72px] w-full bg-brand-yellow text-steel-900 font-semibold text-xl rounded-lg` — disabled until both a file AND a format are selected
- Confirm flow:
  1. Call `createVideoSopPipelineSession({file: {name,size,type}, format})`
  2. On error, surface `session.error` inline and re-enable button
  3. On success, upload via `supabase.storage.from('sop-documents').uploadToSignedUrl(session.path, session.token, file, {contentType})`
  4. Fire-and-forget `fetch('/api/sops/parse', {method:'POST', body: {sopId: session.sopId}})` — Next.js 16 client-side pattern to avoid server action abort
  5. `router.push('/admin/sops/pipeline/' + session.pipelineId)` to the Plan 04 progress page
- Discard CTA (44px secondary button) resets state and calls `onClose`
- "Starting…" label + `Loader2` spinner while submitting

### UploadDropzone wiring
Modified `src/components/admin/UploadDropzone.tsx`:
- Added `Film` to the lucide-react imports
- Added `VideoFormatSelectionModal` import from `./VideoFormatSelectionModal`
- Added `pipelineModalOpen` state alongside other useState calls
- New button in the Upload tab panel button row, positioned AFTER "Browse video", using the secondary button style (`bg-steel-700 text-steel-100 font-semibold px-6 h-[72px]`) with the Film icon
- Mounted `<VideoFormatSelectionModal open={pipelineModalOpen} onClose={() => setPipelineModalOpen(false)} />` at the component root alongside the VideoRecorder overlay
- Preserved all existing buttons (Browse files, Take a photo, Scan document, Browse video), state, handlers, YouTube tab, Record tab, and VideoRecorder logic

## Verification

- `npx tsc --noEmit` exits 0
- `grep "Generate video SOP" src/components/admin/UploadDropzone.tsx` — found on line 662 (visible label)
- `grep "pipelineModalOpen" src/components/admin/UploadDropzone.tsx` — found on lines 102 (useState), 657 (button onClick), 825 (modal prop) — 3 matches
- `grep "import.*VideoFormatSelectionModal" src/components/admin/UploadDropzone.tsx` — found on line 24
- `grep "createVideoSopPipelineSession" src/components/admin/VideoFormatSelectionModal.tsx` — import + call site
- `grep "/admin/sops/pipeline/" src/components/admin/VideoFormatSelectionModal.tsx` — router.push target present
- Acceptance-criteria class strings verified present in modal source: `h-[72px] w-full bg-brand-yellow text-steel-900 font-semibold text-xl rounded-lg`, `border-brand-yellow`, `border-steel-700`, `min-h-[44px]`, `role="dialog"`, `aria-modal="true"`, `aria-label="Close"`, `<fieldset>` + `<legend className="sr-only">`

## Deviations from Plan

- **[Minor - Cleanup] Removed unused `Film` lucide import from VideoFormatSelectionModal** — The plan's action block suggested importing `Film` but noted it was optional ("remove the `Film` import from this component if you prefer"). The `Film` icon is only used in `UploadDropzone` (Task 2), so the modal imports only `X`, `Loader2`, `Upload`. Keeps the component lean and avoids an unused-import lint warning.

No other deviations — plan executed exactly as written. No Rule 1/2/3 auto-fixes needed. No authentication gates encountered (modal does not authenticate; `createVideoSopPipelineSession` handles auth server-side per Plan 01).

## Commits

| Task | Description                                                       | Commit    |
| ---- | ----------------------------------------------------------------- | --------- |
| 1    | feat(09-02): add VideoFormatSelectionModal component              | `1e565f2` |
| 2    | feat(09-02): add Generate video SOP entry button to UploadDropzone | `bd54929` |

## Known Stubs

None. The modal wires directly into the Plan 01 server action and the Phase 6 parse dispatch route. The target `/admin/sops/pipeline/[pipelineId]` route is built in Plan 09-04 — navigating there before Plan 04 lands will 404, but that is expected phase-9 wave ordering and not a stub in this plan's scope.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema touchpoints beyond the Plan 01 server action and the existing Supabase storage `sop-documents` bucket (same presigned upload pattern as `createUploadSession`). Client-side validation is UX-only — all real enforcement (file type, blocked extensions, size, role) is in the server action per Plan 01's threat model (T-09-02-01, T-09-02-03).

## Self-Check

Files:
- FOUND: src/components/admin/VideoFormatSelectionModal.tsx
- FOUND: src/components/admin/UploadDropzone.tsx (modified)

Commits:
- FOUND: 1e565f2 (Task 1)
- FOUND: bd54929 (Task 2)

## Self-Check: PASSED
