---
phase: 05-expanded-file-intake
plan: 02
subsystem: ui
tags: [tus-js-client, heic2any, file-upload, resumable-upload, mime-types, react, next-js]

# Dependency graph
requires:
  - phase: 05-expanded-file-intake-01
    provides: Extended MIME type validation infrastructure at server action level

provides:
  - TUS resumable upload helper (tusUpload) for large files > 10MB with 6MB chunk Supabase config
  - TusUploadProgress component with brand-yellow progress bar and percentage readout
  - Extended UploadDropzone accepting Excel, PowerPoint, plain text, and HEIC/HEIF files
  - Scan document button entry point (placeholder modal, real scanner in Plan 03)
  - Automatic HEIC-to-JPEG conversion for iPhone camera uploads
  - Macro-enabled Office file blocking (.xlsm, .xlsb, .xltm, .pptm, .potm, .ppam)

affects:
  - 05-03 (PhotoScanner — replaces placeholder Scan document modal)
  - 06 (video uploads will use the TUS infrastructure established here)

# Tech tracking
tech-stack:
  added:
    - tus-js-client@4.3.1 (TUS resumable upload protocol)
    - heic2any@0.0.4 (HEIC to JPEG conversion in browser)
  patterns:
    - TUS threshold pattern: files > 10MB use TUS, smaller use presigned URL upload
    - Dynamic import for heic2any: avoids bundle bloat for non-iPhone users
    - Async validateAndAddFiles: async conversion pipeline before queuing

key-files:
  created:
    - src/lib/upload/tus-upload.ts
    - src/components/admin/TusUploadProgress.tsx
  modified:
    - src/components/admin/UploadDropzone.tsx
    - package.json

key-decisions:
  - "TUS threshold at 10MB: presigned URL for small files (fast), TUS for large (resumable)"
  - "HEIC conversion via dynamic import: heic2any loaded only when HEIC file detected"
  - "Supabase TUS chunkSize exactly 6MB: hard Supabase requirement, not configurable"

patterns-established:
  - "tusUpload() returns tus.Upload object — caller calls .start(), enabling cancellation"
  - "TUS uses session.path from createUploadSession for storage path routing"
  - "Scan button shows placeholder modal — Plan 03 replaces with real PhotoScanner"

requirements-completed:
  - INFRA-01
  - FILE-01

# Metrics
duration: 25min
completed: 2026-04-03
---

# Phase 05 Plan 02: Upload Infrastructure (TUS + Extended MIME Types) Summary

**TUS resumable upload for large files (6MB chunks, Supabase config), HEIC-to-JPEG conversion, and UploadDropzone extended with Excel/PowerPoint/TXT support and a three-button layout**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-03T02:15:00Z
- **Completed:** 2026-04-03T02:41:24Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created `src/lib/upload/tus-upload.ts` — wraps tus-js-client with Supabase-specific config (exactly 6MB chunks, auth headers, storage metadata), exports `tusUpload()` and `TUS_THRESHOLD`
- Created `src/components/admin/TusUploadProgress.tsx` — yellow progress bar with tabular-nums percentage, matches design system
- Extended `UploadDropzone` with XLSX, PPTX, TXT, HEIC/HEIF MIME types, macro-enabled file blocking, HEIC auto-conversion, TUS large-file upload path, three-button layout (Browse / Take a photo / Scan document), and updated subtitle copy

## Task Commits

Each task was committed atomically:

1. **Task 1: TUS upload helper and TusUploadProgress component** - `6b308ac` (feat)
2. **Task 2: Extend UploadDropzone with new MIME types, Scan button, HEIC conversion, and TUS integration** - `f8bb237` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/lib/upload/tus-upload.ts` - TUS upload helper, tusUpload() function, TUS_THRESHOLD constant
- `src/components/admin/TusUploadProgress.tsx` - Progress bar component for TUS uploads
- `src/components/admin/UploadDropzone.tsx` - Extended with all Phase 5 file types, 3-button layout, HEIC conversion, TUS integration
- `package.json` - Added tus-js-client@4.3.1 and heic2any@0.0.4 dependencies

## Decisions Made
- **TUS threshold at 10MB**: Files <= 10MB continue using fast presigned URL upload. Files > 10MB use TUS for resumability. This balances upload speed for typical SOPs vs. reliability for large files.
- **Dynamic import for heic2any**: `import('heic2any')` is only called when a HEIC/HEIF file is detected. This avoids bundling ~200KB HEIC decoder for users who never upload iPhone photos.
- **Supabase TUS chunkSize exactly 6MB**: This is a hard Supabase Storage requirement documented in research. The constant `CHUNK_SIZE = 6 * 1024 * 1024` is marked with a comment for future maintainers.
- **Scan button placeholder**: The Scan document button opens a simple modal with "Scanner coming soon" — Plan 03 will replace this with the real PhotoScanner component.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing tus-js-client and heic2any packages**
- **Found during:** Task 1 (pre-implementation check)
- **Issue:** Both packages referenced in plan were not in package.json
- **Fix:** `npm install tus-js-client heic2any`
- **Files modified:** package.json, package-lock.json
- **Verification:** TypeScript imports resolve cleanly, `npx tsc --noEmit` passes
- **Committed in:** 6b308ac (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — missing dependencies)
**Impact on plan:** Essential fix; packages are required for the plan's core features. No scope creep.

## Issues Encountered
- `npm run build` fails due to missing `OPENAI_API_KEY` environment variable during static page data collection — this is a pre-existing issue in the build environment (the OpenAI client initializes at module load in the parse route). TypeScript compilation passes cleanly (`npx tsc --noEmit` exits 0). The build failure is out of scope for this plan.

## User Setup Required
None - no external service configuration required beyond the existing Supabase setup.

## Next Phase Readiness
- TUS infrastructure ready for Plan 03 (PhotoScanner) and Phase 6 (video uploads)
- Scan document button wired to `scannerOpen` state — Plan 03 can replace the placeholder modal with real scanner
- HEIC conversion working client-side, no server changes needed
- All new MIME types accepted by UploadDropzone; server-side parser support is Plan 05-04's concern

---
*Phase: 05-expanded-file-intake*
*Completed: 2026-04-03*

## Self-Check: PASSED

- FOUND: src/lib/upload/tus-upload.ts
- FOUND: src/components/admin/TusUploadProgress.tsx
- FOUND: .planning/phases/05-expanded-file-intake/05-02-SUMMARY.md
- FOUND: commit 6b308ac (Task 1)
- FOUND: commit f8bb237 (Task 2)
