---
phase: 05-expanded-file-intake
plan: 03
subsystem: ui
tags: [photo-scanner, image-quality, canvas-api, tesseract, indexeddb, idb-keyval, react, accessibility]

# Dependency graph
requires:
  - phase: 05-expanded-file-intake-02
    provides: UploadDropzone with scannerOpen state and Scan document button entry point

provides:
  - PhotoScanner full-screen modal scanner with multi-page capture flow
  - ImageQualityOverlay stateless quality indicator component (pass/warn/checking/idle)
  - Client-side blur detection via Laplacian variance on Canvas API (quality-checks.ts)
  - Client-side page number detection via Tesseract OCR on cropped footer region (page-order-detect.ts)
  - IndexedDB session persistence for scanner via idb-keyval (survives mobile app switch)
  - UploadDropzone wired to real PhotoScanner (replaces placeholder modal)

affects:
  - 05-04 (scanned page images will flow through normal parse pipeline as JPEG files)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Laplacian variance blur detection: downsample to 512px max, apply 3x3 kernel, compute variance of result
    - Tesseract page number detection: crop bottom 15% of image, recognize on cropped blob only
    - idb-keyval session persistence: scanner blobs stored without thumbnailUrl (object URLs don't survive restore), rebuilt on mount
    - Drag-to-reorder via HTML5 draggable: dragSourceIndex ref tracks current dragged item, swaps on dragover

key-files:
  created:
    - src/lib/image/quality-checks.ts
    - src/lib/image/page-order-detect.ts
    - src/components/admin/ImageQualityOverlay.tsx
    - src/components/admin/PhotoScanner.tsx
  modified:
    - src/components/admin/UploadDropzone.tsx

key-decisions:
  - "idb-keyval for scanner session: already installed as offline dep; lighter than adding new Dexie table"
  - "detectPageNumber is non-blocking: runs after page is added to strip, never delays Add page button"
  - "Laplacian downsample to 512px max: balances accuracy vs. speed for sub-300ms quality check target"
  - "thumbnailUrl excluded from IndexedDB: object URLs are invalid across tab unload/reload; rebuilt from blob on session restore"

# Metrics
duration: 2min
completed: 2026-04-03
---

# Phase 05 Plan 03: PhotoScanner Component Summary

**PhotoScanner modal with Laplacian blur detection, Tesseract page-number auto-detection, drag-to-reorder thumbnail strip, and IndexedDB session persistence — wired to UploadDropzone Scan document button**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-03T02:48:34Z
- **Completed:** 2026-04-03T02:51:31Z
- **Tasks:** 2
- **Files modified/created:** 5

## Accomplishments

- Created `src/lib/image/quality-checks.ts` — `measureBlur()` via Laplacian variance (Canvas API, downsample to 512px), `checkImageQuality()` returns `QualityResult` with pass/warn status and issues array. Resolution threshold 600px, blur threshold 100 Laplacian variance units.
- Created `src/lib/image/page-order-detect.ts` — `detectPageNumber()` crops bottom 15% of image, runs Tesseract on cropped blob, matches "Page N", "N of M", and standalone number patterns.
- Created `src/components/admin/ImageQualityOverlay.tsx` — stateless inline component with `role="status"` and `aria-live="polite"`. Four states: idle (null), checking (spinner), pass (green checkmark), warn (orange triangle).
- Created `src/components/admin/PhotoScanner.tsx` — 500+ line full-screen modal implementing the scanner state machine. Camera capture via `input[capture=environment]`, quality checks on capture, non-blocking page number detection, thumbnail strip with drag-to-reorder and keyboard ArrowLeft/ArrowRight fallback, discard confirmation dialog, focus trap, idb-keyval session persistence.
- Updated `src/components/admin/UploadDropzone.tsx` — replaced placeholder "Scanner coming soon" modal with real `<PhotoScanner>` component wired to queue via `onSubmit` callback.

## Task Commits

1. **Task 1: Image quality check utilities and page order detection** - `158ee99` (feat)
2. **Task 2: PhotoScanner component, ImageQualityOverlay, and UploadDropzone wiring** - `af41eef` (feat)

## Files Created/Modified

- `src/lib/image/quality-checks.ts` — Laplacian variance blur check, resolution check, `QualityResult` type
- `src/lib/image/page-order-detect.ts` — Tesseract-based page number detection from image footer crop
- `src/components/admin/ImageQualityOverlay.tsx` — inline quality indicator with ARIA live region
- `src/components/admin/PhotoScanner.tsx` — full scanner flow modal component
- `src/components/admin/UploadDropzone.tsx` — replaced placeholder with real PhotoScanner import + wiring

## Decisions Made

- **idb-keyval for scanner session:** Already installed as an offline infrastructure dependency. No new Dexie table needed — a single key per session avoids schema migrations.
- **Non-blocking page number detection:** `detectPageNumber()` is called after `setPages()` updates the strip. The `Add page` button is never delayed by OCR.
- **Laplacian downsample to 512px:** Full-resolution Laplacian on a 4K photo would exceed 300ms. Downsampling to 512px keeps the check well within the UI-SPEC interaction contract.
- **thumbnailUrl excluded from IndexedDB:** Object URLs created with `URL.createObjectURL()` are invalid after a tab unload/reload cycle. Only the raw `Blob` is persisted; the thumbnail URL is rebuilt from the blob on session restore.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. All implemented functionality is wired end-to-end:
- Scanner opens from UploadDropzone "Scan document" button
- Quality check runs on capture
- Pages submit to UploadDropzone queue as JPEG File objects via onSubmit callback
- Session persists to IndexedDB

---

*Phase: 05-expanded-file-intake*
*Completed: 2026-04-03*

## Self-Check: PASSED

- FOUND: src/lib/image/quality-checks.ts
- FOUND: src/lib/image/page-order-detect.ts
- FOUND: src/components/admin/ImageQualityOverlay.tsx
- FOUND: src/components/admin/PhotoScanner.tsx
- FOUND: src/components/admin/UploadDropzone.tsx (modified)
- FOUND: commit 158ee99 (Task 1)
- FOUND: commit af41eef (Task 2)
