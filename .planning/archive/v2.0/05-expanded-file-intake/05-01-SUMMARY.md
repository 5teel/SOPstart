---
phase: 05-expanded-file-intake
plan: "01"
subsystem: parsing-pipeline
tags: [file-intake, xlsx, pptx, txt, image-ocr, gpt-4o-vision, officeparser, sharp, database-migration]
dependency_graph:
  requires: []
  provides: [extract-xlsx, extract-pptx, extract-txt, extract-image, expanded-source-file-type, parse-route-dispatch]
  affects: [admin-upload-flow, parse-route, gpt-parser]
tech_stack:
  added: [officeparser, sharp (win32 binary)]
  patterns: [server-external-packages for ESM-only deps, GPT-4o vision as primary image OCR, markdown table conversion for spreadsheet data]
key_files:
  created:
    - supabase/migrations/00011_expanded_file_intake.sql
    - src/lib/parsers/extract-txt.ts
    - src/lib/parsers/extract-xlsx.ts
    - src/lib/parsers/extract-pptx.ts
    - src/lib/parsers/extract-image.ts
  modified:
    - src/types/sop.ts
    - src/lib/validators/sop.ts
    - src/actions/sops.ts
    - src/lib/parsers/gpt-parser.ts
    - src/app/api/sops/parse/route.ts
    - src/components/admin/OriginalDocViewer.tsx
    - next.config.ts
    - package.json
decisions:
  - officeparser marked as serverExternalPackages because file-type dependency is ESM-only — webpack cannot bundle it
  - sharp also marked as serverExternalPackages to prevent bundling issues; Windows win32-x64 binary installed for local dev
  - GPT-4o vision replaces Tesseract as primary OCR for image files — better accuracy for SOP documents
  - getSourceFileType now throws on unknown MIME types instead of catch-all image return — prevents silent wrong routing
  - OriginalDocViewer prop type widened to SourceFileType union to avoid TypeScript errors with new file types
metrics:
  duration: "7m"
  completed_date: "2026-04-03"
  tasks_completed: 2
  files_created: 5
  files_modified: 8
---

# Phase 05 Plan 01: Expanded File Intake Backend — Summary

**One-liner:** Four new extractor modules (xlsx, pptx, txt, GPT-4o vision image) with format-specific GPT-4o prompt hints, extended DB constraints, and full parse route dispatch for all 6 file types.

## What Was Built

### Task 1: Database migration, type extensions, and validator updates

**Migration `00011_expanded_file_intake.sql`**
- Drops and re-creates `parse_jobs_file_type_check` constraint to include `xlsx`, `pptx`, `txt`
- Adds `input_type` column to `parse_jobs` (`upload | scan | url`, default `upload`)
- Drops and re-creates `sops_source_file_type_check` constraint to match

**Type system (`src/types/sop.ts`)**
- `SourceFileType` expanded: `'docx' | 'pdf' | 'image' | 'xlsx' | 'pptx' | 'txt'`
- `InputType` added: `'upload' | 'scan' | 'url'`
- `ParseJob.input_type` added as optional field

**Validators (`src/lib/validators/sop.ts`)**
- `ACCEPTED_TYPES` extended with xlsx, pptx, txt, image/heic, image/heif MIME types
- `BLOCKED_MIME_TYPES` and `BLOCKED_EXTENSIONS` arrays for macro-enabled Office files
- `isBlockedMacroFile(filename)` exported — checks .xlsm, .xlsb, .xltm, .pptm, .potm, .ppam
- `getSourceFileType()` maps all new MIME types; throws on unknown (prevents silent wrong routing)

**Action (`src/actions/sops.ts`)**
- `createUploadSession` checks `isBlockedMacroFile(file.name)` before any parsing; returns user-facing error message

### Task 2: New extractor modules + format-specific GPT prompts + parse route dispatch

**`extract-txt.ts`** — UTF-8 buffer decode, trimmed text passthrough

**`extract-xlsx.ts`** — officeparser AST extraction with tab-to-markdown table conversion for preserving spreadsheet structure in GPT-4o input

**`extract-pptx.ts`** — officeparser AST extraction (slide text + speaker notes concatenated)

**`extract-image.ts`** — GPT-4o vision OCR replacing Tesseract as primary image parser:
- sharp preprocessing: auto-rotate (EXIF), normalize contrast, convert to JPEG
- Resize to ≤4MB if needed (2048px max width, 85% quality)
- GPT-4o `detail: 'high'` with document-aware extraction prompt

**`gpt-parser.ts`** — `inputType?: SourceFileType` parameter with format hint map:
- xlsx: tabular data guidance for calibration/parameter tables
- pptx: slide title = section heading, speaker notes = procedural detail
- txt: structure inference from indentation, numbering, keywords
- image: OCR error tolerance, flag uncertain values in parse_notes

**Parse route (`/api/sops/parse`)**
- All 6 file type dispatch branches: docx, pdf, image (GPT-4o vision), xlsx, pptx, txt
- `file_type` passed to `parseSopWithGPT` for format-specific hints
- `fileType` cast as `SourceFileType` for TypeScript correctness

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] OriginalDocViewer prop type too narrow**
- **Found during:** Task 1 — build type-check failure
- **Issue:** `OriginalDocViewer` had `sourceFileType: 'docx' | 'pdf' | 'image'` — incompatible with expanded `SourceFileType` union
- **Fix:** Widened prop type to `SourceFileType` imported from `@/types/sop` — new file types fall to the "preview not available" UI branch, which is correct
- **Files modified:** `src/components/admin/OriginalDocViewer.tsx`
- **Commit:** 89f994d

**2. [Rule 3 - Blocking] officeparser ESM-only file-type dependency blocked webpack**
- **Found during:** Task 2 — webpack build error
- **Issue:** `officeparser` depends on `file-type` (ESM-only, no CJS export) — webpack cannot bundle it in Next.js
- **Fix:** Added `serverExternalPackages: ['officeparser', 'file-type']` to `next.config.ts` so webpack excludes them and Node.js requires them at runtime
- **Files modified:** `next.config.ts`
- **Commit:** e710327

**3. [Rule 3 - Blocking] sharp missing Windows binaries prevented page data collection**
- **Found during:** Task 2 — build error during "Collecting page data" for `/api/sops/parse`
- **Issue:** sharp was installed for Linux only (deployment target); the Windows dev environment had no win32-x64 binary, causing the runtime import to fail during Next.js build
- **Fix:** Added `sharp` to `serverExternalPackages`; installed `@img/sharp-win32-x64` via `npm install --os=win32 --cpu=x64 sharp`
- **Files modified:** `next.config.ts`, `package.json`, `package-lock.json`
- **Commit:** e710327

## Known Stubs

None — all extractors are fully wired to the parse pipeline.

## Self-Check: PASSED

Checked files exist:
- supabase/migrations/00011_expanded_file_intake.sql — FOUND
- src/lib/parsers/extract-txt.ts — FOUND
- src/lib/parsers/extract-xlsx.ts — FOUND
- src/lib/parsers/extract-pptx.ts — FOUND
- src/lib/parsers/extract-image.ts — FOUND

Checked commits exist:
- 89f994d — FOUND (Task 1: types, validators, migration)
- e710327 — FOUND (Task 2: extractors, gpt-parser, parse route)

Build: PASSED (no TypeScript errors, all routes compiled)
