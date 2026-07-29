---
phase: 40-shared-creation-foundation
plan: 07
subsystem: ui
tags: [file-upload, video-pipeline, server-actions, next.js]

# Dependency graph
requires:
  - phase: 40-shared-creation-foundation
    provides: "40-02's shared @/lib/upload/file-intake module (ACCEPT_ATTR, validateIntakeFile, startVideoSopUpload) and 40-04's live sops.category_slug column"
provides:
  - "One accept list on all three upload surfaces (UploadDropzone, VideoFormatSelectionModal, versions/page.tsx) — SC-1 complete"
  - "uploadNewVersion and createVideoSopPipelineSession both route video sources through the shipped transcription pipeline instead of the document parser"
  - "uploadNewVersion no longer silently defaults unsupported MIME types to docx, and now blocks macro-enabled Office files"
affects: [phase-42-authoring-convergence, sop-versioning, video-generation-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Video branch shape (storage path {org}/{sopId}/audio/audio.{ext} in sop-videos bucket, parse_jobs with input_type: video_file / current_stage: uploading, isVideo discriminator on the action return) is now consistent across createVideoUploadSession, uploadNewVersion, and createVideoSopPipelineSession"

key-files:
  created: []
  modified:
    - src/actions/versioning.ts
    - src/actions/sops.ts
    - "src/app/(protected)/admin/sops/[sopId]/versions/page.tsx"
    - src/components/admin/VideoFormatSelectionModal.tsx
    - tests/phase40/dup01-file-intake.spec.ts

key-decisions:
  - "uploadNewVersion's video branch authenticates the TUS upload the same way createVideoUploadSession does (SUPABASE_SERVICE_ROLE_KEY as the token), not a presigned PUT URL — the isVideo discriminator tells the client which upload routine to run"
  - "Upload progress on the new-version page surfaces as a percentage in the existing button label (no new progress component — that's plan 40-03's ParseJobStatus scope)"

patterns-established:
  - "Any future SOP-creating action that accepts a video source should branch on getSourceFileType(...) === 'video' and mirror this exact storage-path/parse_jobs/isVideo shape rather than growing a fourth copy"

requirements-completed: [DUP-01]

duration: 45min
completed: 2026-07-29
---

# Phase 40 Plan 07: Video-Capable Version Upload + Pipeline Picker Summary

**Unified the new-version page and video-generate picker onto the shared file-intake accept list, and routed both surfaces' video sources through the Phase 6 transcription pipeline (startVideoSopUpload) instead of the document parser.**

## Performance

- **Duration:** 45 min
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- `uploadNewVersion` (src/actions/versioning.ts) replaced its silently-defaults-to-docx `extensionMap` with `getSourceFileType` (throws on unknown types) and added the previously-absent `isBlockedMacroFile` guard
- `uploadNewVersion` and `createVideoSopPipelineSession` both gained a video branch: `sop-videos` bucket, `{org}/{sopId}/audio/audio.{ext}` path, `parse_jobs` row with `input_type: 'video_file'` / `current_stage: 'uploading'`, and an `isVideo` discriminator on the return value
- `versions/page.tsx` now validates every picked file through `validateIntakeFile` (HEIC conversion included) and uses `ACCEPT_ATTR`/`INTAKE_HINT` from the shared module instead of its own hardcoded (and `.doc`-accepting) accept string
- `versions/page.tsx` and `VideoFormatSelectionModal.tsx` both branch on `isVideo` to call `startVideoSopUpload` (audio extraction + TUS + `/api/sops/transcribe`) instead of a presigned-PUT + `/api/sops/parse` pair
- `category_slug` now carries forward to new versions alongside `refresher_interval_months` (D-01 lineage invariant)
- Un-fixmed the two remaining all-three-surfaces / `.doc,` assertions in `dup01-file-intake.spec.ts`, and added a D-06 honesty-rule assertion that both surfaces reference `startVideoSopUpload`

## Task Commits

1. **Task 1: Make uploadNewVersion type-correct and video-capable** - `df6f506` (feat)
2. **Task 2: Put the new-version page and video-generate picker on the shared intake** - `17ab70f` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/actions/versioning.ts` - `uploadNewVersion`: getSourceFileType + isBlockedMacroFile guard, video branch, category_slug carry-forward, isVideo discriminator
- `src/actions/sops.ts` - `createVideoSopPipelineSession`: video branch (sop-videos bucket, video_file parse_jobs shape), isVideo discriminator, pipeline_run_id preserved on both branches
- `src/app/(protected)/admin/sops/[sopId]/versions/page.tsx` - shared ACCEPT_ATTR/INTAKE_HINT, validateIntakeFile, startVideoSopUpload branch, upload-progress percentage in button label
- `src/components/admin/VideoFormatSelectionModal.tsx` - startVideoSopUpload branch in handleConfirm when session.isVideo
- `tests/phase40/dup01-file-intake.spec.ts` - un-fixmed 2 assertions, added D-06 honesty-rule assertion

## Decisions Made
- Video branch's TUS token is the service-role key (matching `createVideoUploadSession`'s existing pattern), not a presigned PUT URL — kept `uploadUrl: ''` on the return type for that branch since the client never uses it.
- No new progress-bar component added for the new-version page's video upload; the existing `uploading` boolean gained a sibling `uploadProgress` percentage rendered inline in the button label, per the plan's explicit "plan 40-03 owns progress UI" scope boundary.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SC-1 (one accept list, honestly wired, on all three upload surfaces) is complete for this phase.
- `journeys.ts` was not touched — no route was added, removed, or rerouted; only upload-handler internals changed on existing routes.
- Sibling plans 40-05 (category readers/governance) and 40-08 (SopMetadataFields + creation clients) are unaffected — this plan touched no files in their scope.

---
*Phase: 40-shared-creation-foundation*
*Completed: 2026-07-29*
