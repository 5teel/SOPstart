---
phase: 40-shared-creation-foundation
plan: 02
subsystem: ui
tags: [file-upload, heic2any, tus, react, nextjs, dedup]

# Dependency graph
requires:
  - phase: 40-shared-creation-foundation
    provides: phase40 Playwright project + tests/phase40 fixme stubs (plan 40-01)
provides:
  - "src/lib/upload/file-intake.ts — single ACCEPTED_MIME_TYPES/BLOCKED_EXTENSIONS/size-limit/HEIC-conversion module"
  - "src/lib/upload/start-video-sop-upload.ts — one reusable client video-upload routine"
  - "UploadDropzone.tsx and VideoFormatSelectionModal.tsx repointed onto the shared module"
affects: [40-07 (repoints the versions page, the third surface, and finishes un-fixme'ing dup01-file-intake.spec.ts)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One accept-list/size-limit/HEIC module consumed by every upload surface (D-05: no per-context accept profiles)"
    - "Extracted client upload routine (startVideoSopUpload) for reuse across creation-side video entry points"

key-files:
  created:
    - src/lib/upload/file-intake.ts
    - src/lib/upload/start-video-sop-upload.ts
  modified:
    - src/components/admin/UploadDropzone.tsx
    - src/components/admin/VideoFormatSelectionModal.tsx
    - src/lib/validators/sop.ts
    - tests/phase40/dup01-file-intake.spec.ts

key-decisions:
  - "Added image/webp to getSourceFileType's image branch (single-line, sop.ts otherwise owned by concurrent plan 40-04) so the new accept list never throws downstream in the parse pipeline"
  - "Left the all-three-surface and '.doc,' dup01 assertions as fixme (they require the versions page repoint, which is 40-07's job per the test file's own docstring); added a 40-02-scoped two-surface variant that proves this plan's slice instead"

patterns-established:
  - "Real HEIC-conversion-failure test relies on heic2any's genuine inability to run without browser Canvas/Image APIs in the Node/Playwright runner, rather than mocking the WASM decoder"

requirements-completed: [DUP-01]

# Metrics
duration: ~25min
completed: 2026-07-29
---

# Phase 40 Plan 02: Shared File-Intake Module Summary

**One `file-intake.ts` module now owns the accept list, blocked-extension list, size limits and HEIC->JPEG conversion for both the creation dropzone and the video-generate picker, replacing three divergent inline copies.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 completed
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- `src/lib/upload/file-intake.ts` exports `ACCEPTED_MIME_TYPES` (12 entries, `.doc` dropped, `.webp` added per D-04), `BLOCKED_EXTENSIONS`, `HEIC_MIME_TYPES`/`HEIC_EXTENSIONS`, `MAX_FILE_SIZE`/`MAX_VIDEO_FILE_SIZE`, `ACCEPT_ATTR`, `INTAKE_HINT`, `isVideoFile`, `isHeicFile`, `convertHeicToJpeg`, `validateIntakeFile`
- `src/lib/upload/start-video-sop-upload.ts` extracts the video-upload routine (audio extraction -> TUS upload -> transcription trigger) out of `UploadDropzone`'s inline `handleUpload` branch for reuse
- `UploadDropzone.tsx` and `VideoFormatSelectionModal.tsx` both validate exclusively through `validateIntakeFile` and render `ACCEPT_ATTR`/`INTAKE_HINT` — no local accept-list, size-limit, or `heic2any` code remains in either file
- 14 live behavioural + source-contract tests in `dup01-file-intake.spec.ts` (12 passing, 2 fixme pending 40-07)

## Task Commits

1. **Task 1: Create the shared file-intake module** - `9bc6d7f` (feat)
2. **Task 2: Repoint UploadDropzone and VideoFormatSelectionModal onto the shared module** - `26a8223` (feat)

_Note: Task 1's commit included the test file with two assertions that only pass once Task 2 lands (the "exactly one declares ACCEPTED_MIME_TYPES" and two-surface "no local decl" tests) — both were red immediately after Task 1 and green after Task 2, consistent with the plan's tightly-coupled extract-then-repoint structure._

## Files Created/Modified
- `src/lib/upload/file-intake.ts` - the shared accept-list/size-limit/HEIC-conversion module
- `src/lib/upload/start-video-sop-upload.ts` - extracted client video-upload routine
- `src/components/admin/UploadDropzone.tsx` - repointed onto file-intake + start-video-sop-upload
- `src/components/admin/VideoFormatSelectionModal.tsx` - repointed onto file-intake
- `src/lib/validators/sop.ts` - `getSourceFileType` now accepts `image/webp` (see deviations)
- `tests/phase40/dup01-file-intake.spec.ts` - un-fixme'd self-contained assertions, added live behavioural describe block

## Decisions Made
- Kept `handleConfirm` in `VideoFormatSelectionModal.tsx` untouched — routing a selected video through transcription on that surface is explicitly 40-07's job (D-05/D-06 honesty), not this plan's.
- Tested `heic-conversion-failed` by letting the real `heic2any` import run in the Node/Playwright runner (it throws there for lack of browser Canvas/Image APIs) rather than mocking the WASM decoder, per the plan's explicit guidance to assert `isHeicFile` routing and the rename rule directly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `getSourceFileType` didn't handle `image/webp`, which the plan mandates adding to `ACCEPTED_MIME_TYPES`**
- **Found during:** Task 1 (writing the cross-check acceptance criterion "every MIME type in ACCEPTED_MIME_TYPES is handled by getSourceFileType without throwing")
- **Issue:** `src/lib/validators/sop.ts`'s `getSourceFileType` threw `Unsupported file type` for `image/webp`. Since `.webp` is a D-04-mandated addition to the shared accept list, any `.webp` upload would pass intake validation and then crash the parse pipeline the first time `createUploadSession`/`createVideoUploadSession` called `getSourceFileType`.
- **Fix:** Added `mimeType === 'image/webp'` to the existing image-type branch (one line).
- **Files modified:** `src/lib/validators/sop.ts`
- **Verification:** New source-contract test `every ACCEPTED_MIME_TYPES entry is handled by getSourceFileType without throwing` passes; `tsc --noEmit` and `npm run build` both clean.
- **Committed in:** `9bc6d7f` (Task 1 commit)
- **Note:** `src/lib/validators/sop.ts` is otherwise in concurrent plan 40-04's `files_modified` scope this wave (category/vocabulary work in an unrelated function). This is a single-line, narrowly-scoped addition to a different function (`getSourceFileType`, not the category logic 40-04 touches) — flagged here explicitly in case of merge review.

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Necessary for D-04's `.webp` acceptance to actually work end-to-end; no scope creep beyond the one line needed.

## Issues Encountered
- The existing `dup01-file-intake.spec.ts` fixme test "UploadDropzone, VideoFormatSelectionModal, and versions page import from @/lib/upload/file-intake..." bundles all three creation-side surfaces (including the versions page) into one assertion, but this plan's scope (`files_modified`) explicitly excludes the versions page — that repoint is plan 40-07's job, confirmed by the test file's own docstring ("Plan 40-07 rewires the three call sites onto it and un-fixmes this spec") and by 40-07-PLAN.md's own action text ("un-fixme the remaining assertions ... zero `.doc,` in `src/`"). Left both the all-three-surface test and the `.doc,` test as `test.fixme`, and added a new, otherwise-identical two-surface test scoped to what this plan actually touches, so DUP-01's guarantee is proven for UploadDropzone + VideoFormatSelectionModal now without prematurely failing on a file this plan doesn't own.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `@/lib/upload/file-intake` and `@/lib/upload/start-video-sop-upload` are ready for plan 40-07 to import into the versions page's re-upload flow.
- `dup01-file-intake.spec.ts` still has 2 `test.fixme` entries (all-three-surface import check, zero `.doc,` in `src/`) — 40-07 un-fixmes both once the versions page is repointed.

---
*Phase: 40-shared-creation-foundation*
*Completed: 2026-07-29*

## Self-Check: PASSED

- FOUND: src/lib/upload/file-intake.ts
- FOUND: src/lib/upload/start-video-sop-upload.ts
- FOUND: .planning/phases/40-shared-creation-foundation/40-02-SUMMARY.md
- FOUND: commit 9bc6d7f
- FOUND: commit 26a8223
- FOUND: commit b981923
