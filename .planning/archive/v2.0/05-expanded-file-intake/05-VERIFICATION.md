---
phase: 05-expanded-file-intake
verified: 2026-04-03T08:30:00Z
status: passed
score: 10/10 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Upload an .xlsx file and confirm it parses to structured SOP sections in admin review"
    expected: "SOP appears in draft status with sections extracted from spreadsheet content"
    why_human: "Requires OpenAI API key at runtime; build-time validation not possible"
  - test: "Upload a photo of a printed SOP page via Scan document flow on mobile"
    expected: "Quality overlay shows pass/warn within ~300ms; scanned image appears in parse queue"
    why_human: "Requires physical device with camera and real-time canvas measurement"
  - test: "Open an SOP section containing pipe-separated markdown table on mobile viewport"
    expected: "Table scrolls horizontally without triggering page-level scroll; rows have 44px height"
    why_human: "Touch scroll behavior requires physical device testing"
  - test: "Drop a file >10MB and observe TUS upload progress bar"
    expected: "Percentage counter increments, upload completes, parse is triggered"
    why_human: "Requires large test file and live Supabase TUS endpoint"
---

# Phase 05: Expanded File Intake Verification Report

**Phase Goal:** Admins can upload photos of printed SOPs, Excel checklists, PowerPoint slide decks, and plain text files — all routed through the existing AI structuring pipeline and review UI — and TUS upload infrastructure is in place for all large file uploads.

**Verified:** 2026-04-03T08:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Excel (.xlsx) files are extracted and routed to GPT-4o structuring pipeline | VERIFIED | `extract-xlsx.ts` uses officeparser + markdown table conversion; parse route dispatches on `fileType === 'xlsx'` |
| 2 | PowerPoint (.pptx) files are extracted and routed to GPT-4o structuring pipeline | VERIFIED | `extract-pptx.ts` uses officeparser; parse route dispatches on `fileType === 'pptx'` |
| 3 | Plain text (.txt) files are routed to GPT-4o structuring pipeline | VERIFIED | `extract-txt.ts` UTF-8 decode; parse route dispatches on `fileType === 'txt'` |
| 4 | Format-specific prompts improve section detection for each new input type | VERIFIED | `gpt-parser.ts` has `FORMAT_HINTS` map with xlsx/pptx/txt/image hints; passed via `inputType?` param |
| 5 | All new file types produce ParsedSop output identical in schema to existing docx/pdf | VERIFIED | All extractors return `{ text: string }`; all feed to same `parseSopWithGPT()` returning `ParsedSop` |
| 6 | Macro-enabled Office files are rejected before parsing | VERIFIED | `isBlockedMacroFile()` in validators; called in `createUploadSession` and in UploadDropzone `validateAndAddFiles` |
| 7 | Admin can launch scanner and capture photos of printed SOP pages | VERIFIED | `PhotoScanner.tsx` (538 lines); wired to `scannerOpen` via `UploadDropzone`; `capture="environment"` input |
| 8 | Quality feedback appears after each capture | VERIFIED | `checkImageQuality()` called on capture; `ImageQualityOverlay` with pass/warn/checking states wired in PhotoScanner |
| 9 | Markdown table syntax in section content renders as rich HTML table | VERIFIED | `SopTable.tsx` renders GFM tables; `containsMarkdownTable()` detection wired in `SectionContent.tsx` and `SectionEditor.tsx` |
| 10 | TUS resumable upload infrastructure is in place for large files | VERIFIED | `tus-upload.ts` with 6MB chunk config; `TUS_THRESHOLD = 10MB`; wired in `UploadDropzone` with progress bar |

**Score:** 10/10 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/00011_expanded_file_intake.sql` | Extended file_type constraint + input_type column | VERIFIED | `CHECK (file_type IN ('docx', 'pdf', 'image', 'xlsx', 'pptx', 'txt'))` present; `input_type DEFAULT 'upload'` added |
| `src/lib/parsers/extract-xlsx.ts` | Excel extraction via officeparser | VERIFIED | Exports `extractXlsx`; uses `parseOffice`; converts tab-separated to markdown tables |
| `src/lib/parsers/extract-pptx.ts` | PowerPoint extraction via officeparser | VERIFIED | Exports `extractPptx`; uses `parseOffice` |
| `src/lib/parsers/extract-txt.ts` | Plain text UTF-8 passthrough | VERIFIED | Exports `extractTxt`; Buffer UTF-8 decode and trim |
| `src/lib/parsers/extract-image.ts` | GPT-4o vision OCR with sharp preprocessing | VERIFIED | Exports `extractImage`; uses `sharp` for EXIF rotate + normalize + resize; GPT-4o `detail: 'high'` call |
| `src/lib/parsers/gpt-parser.ts` | Format-specific prompt hints per input type | VERIFIED | `parseSopWithGPT(text, inputType?)` signature; `FORMAT_HINTS` map with entries for xlsx/pptx/txt/image |
| `src/app/api/sops/parse/route.ts` | Full dispatch for all 6 file types | VERIFIED | All 6 branches (docx/pdf/image/xlsx/pptx/txt) present; `fileType` passed to `parseSopWithGPT` |
| `src/lib/upload/tus-upload.ts` | TUS upload helper with Supabase config | VERIFIED | Exports `tusUpload` and `TUS_THRESHOLD`; `chunkSize: 6 * 1024 * 1024`; `/storage/v1/upload/resumable` endpoint |
| `src/components/admin/TusUploadProgress.tsx` | Progress bar component | VERIFIED | Exports `TusUploadProgress`; `bg-brand-yellow` progress bar; `tabular-nums` percentage |
| `src/components/admin/UploadDropzone.tsx` | Extended with all Phase 5 types, Scan button, HEIC, TUS | VERIFIED | All new MIME types; `BLOCKED_EXTENSIONS`; `heic2any` dynamic import; `tusUpload` wired for >10MB; `PhotoScanner` import (not placeholder) |
| `src/lib/image/quality-checks.ts` | Laplacian blur detection + resolution check | VERIFIED | Exports `measureBlur` and `checkImageQuality`; Laplacian 3x3 kernel; `BLUR_THRESHOLD = 100`; `MIN_RESOLUTION = 600` |
| `src/lib/image/page-order-detect.ts` | Tesseract page number detection | VERIFIED | Exports `detectPageNumber`; crops bottom 15%; Tesseract.recognize on cropped blob |
| `src/components/admin/ImageQualityOverlay.tsx` | Quality indicator with ARIA | VERIFIED | Exports `ImageQualityOverlay`; `role="status"`; `aria-live="polite"`; 4 states (idle/checking/pass/warn) |
| `src/components/admin/PhotoScanner.tsx` | Full scanner modal (min 150 lines) | VERIFIED | 538 lines; `capture="environment"`; `checkImageQuality` wired; `detectPageNumber` non-blocking; IndexedDB via idb-keyval; discard confirm |
| `src/components/sop/SopTable.tsx` | Markdown table renderer (min 60 lines) | VERIFIED | 114 lines; exports `SopTable` and `containsMarkdownTable`; `overflow-x-auto`; sticky thead; `min-h-[44px]` on td |
| `src/components/sop/SectionContent.tsx` | Table detection wired | VERIFIED | Imports `SopTable, containsMarkdownTable`; used in `DefaultContent` and `StepsContent` |
| `src/components/admin/SectionEditor.tsx` | Table rendering + edit helper note | VERIFIED | Imports `SopTable, containsMarkdownTable`; read mode renders table; edit mode shows "Edit as markdown table" note |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `parse/route.ts` | `extract-xlsx.ts` | import + `fileType === 'xlsx'` branch | WIRED | Import confirmed; dispatch branch at line 87 |
| `parse/route.ts` | `gpt-parser.ts` | `parseSopWithGPT(extractedText, fileType)` | WIRED | `fileType` cast as `SourceFileType` passed on line 113 |
| `validators/sop.ts` | `actions/sops.ts` | `isBlockedMacroFile` in `createUploadSession` | WIRED | Import and call confirmed; returns user-facing error message |
| `UploadDropzone.tsx` | `tus-upload.ts` | `tusUpload(...)` for files > `TUS_THRESHOLD` | WIRED | Import confirmed; `if (item.useTus)` branch at line 202; `.start()` called |
| `UploadDropzone.tsx` | `TusUploadProgress.tsx` | renders in queue row for TUS uploads | WIRED | Import confirmed; renders when `item.useTus && item.tusProgress !== undefined` |
| `UploadDropzone.tsx` | `PhotoScanner.tsx` | `scannerOpen` state toggles real PhotoScanner | WIRED | `import { PhotoScanner }` present; `<PhotoScanner open={scannerOpen} onClose onSubmit>` |
| `PhotoScanner.tsx` | `quality-checks.ts` | `checkImageQuality` on each capture | WIRED | Import and call confirmed in capture handler |
| `PhotoScanner.tsx` | `UploadDropzone.tsx` | `onSubmit(files)` passes File[] to queue | WIRED | `onSubmit` callback adds scanned pages to `setQueue` with `useTus` flag |
| `SectionContent.tsx` | `SopTable.tsx` | `containsMarkdownTable` detection + `SopTable` render | WIRED | Import confirmed; used in `DefaultContent` and `StepsContent` |
| `SectionEditor.tsx` | `SopTable.tsx` | read mode render + edit helper note | WIRED | Import confirmed; both read-mode table render and edit helper confirmed |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `extract-image.ts` | `response.choices[0].message.content` | OpenAI `gpt-4o-2024-08-06` chat completion | Yes — live API call with base64 image | FLOWING |
| `extract-xlsx.ts` | `ast` (officeparser output) | `parseOffice(Buffer.from(buffer))` on actual file bytes | Yes — real file extraction | FLOWING |
| `SopTable.tsx` | `table` (parsed from markdown) | `parseMarkdownTable(markdown)` on section.content string | Yes — section data from DB via SectionContent/SectionEditor | FLOWING |
| `UploadDropzone.tsx` TUS path | `tusProgress` (0–100) | `tusUpload onProgress` callback from tus-js-client bytes progress | Yes — live upload byte tracking | FLOWING |
| `PhotoScanner.tsx` pages | `pages` (ScannedPage[]) | Camera `input[capture=environment]` file selection + canvas quality check | Yes — real device camera images | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles with zero errors | `npx tsc --noEmit` | Exit 0, no output | PASS |
| All phase 5 artifact files exist | `ls` checks on 15 files | All 15 present | PASS |
| officeparser in package.json | `grep officeparser package.json` | `"officeparser": "^6.0.7"` | PASS |
| tus-js-client in package.json | `grep tus-js-client package.json` | `"tus-js-client": "^4.3.1"` | PASS |
| heic2any in package.json | `grep heic2any package.json` | `"heic2any": "^0.0.4"` | PASS |
| All 8 phase commits verified | `git log --oneline <hashes>` | All 8 hashes resolve to correct feat commits | PASS |
| Parse route covers all 6 file types | grep dispatch branches | docx/pdf/image/xlsx/pptx/txt all present | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| FILE-01 | 05-02, 05-03 | Admin can upload a photo/image of a printed SOP — OCRed into structured SOP | SATISFIED | `extract-image.ts` GPT-4o vision; `PhotoScanner` for camera capture; wired to parse pipeline |
| FILE-02 | 05-03 | System provides image quality feedback before processing | SATISFIED | `quality-checks.ts` Laplacian blur + resolution; `ImageQualityOverlay` in PhotoScanner |
| FILE-03 | 05-03 | Admin can capture multiple pages sequentially for a single SOP | SATISFIED | PhotoScanner multi-page strip; `onSubmit(files)` passes File[] to dropzone queue |
| FILE-04 | 05-01 | Admin can upload Excel (.xlsx) files — content extracted into structured SOP | SATISFIED | `extract-xlsx.ts` + parse route dispatch + `getSourceFileType` mapping |
| FILE-05 | 05-01 | Admin can upload PowerPoint (.pptx) files — slides extracted into structured SOP | SATISFIED | `extract-pptx.ts` + parse route dispatch + `getSourceFileType` mapping |
| FILE-06 | 05-01 | Admin can upload plain text (.txt) files — structured into SOP | SATISFIED | `extract-txt.ts` + parse route dispatch + `getSourceFileType` mapping |
| FILE-07 | 05-04 | Table structures in Excel/PowerPoint preserved as readable tables in SOP steps | SATISFIED | `SopTable.tsx` renders GFM markdown tables; `extract-xlsx.ts` converts tab-separated to markdown; wired in SectionContent + SectionEditor |
| FILE-08 | 05-01 | AI parsing uses format-specific prompts for improved section detection | SATISFIED | `FORMAT_HINTS` map in `gpt-parser.ts` with xlsx/pptx/txt/image hints; passed via `inputType?` |
| INFRA-01 | 05-02 | Video and large file uploads use resumable upload (TUS) direct to storage | SATISFIED | `tus-upload.ts` with 6MB Supabase chunks; wired in UploadDropzone for files >10MB |
| INFRA-02 | 05-01 | All new intake pathways route through existing SOP structuring pipeline and admin review UI | SATISFIED | All new extractors feed `parseSopWithGPT` which produces `ParsedSop`; parse route writes to same sop_sections/sop_steps tables |

**Orphaned requirements:** None detected. All 10 requirement IDs from REQUIREMENTS.md Phase 5 mapping are claimed by plans and verified.

**Note:** REQUIREMENTS.md marks FILE-07 as `Pending` with `[ ]` checkbox, but actual implementation in `SopTable.tsx` + `SectionContent.tsx` + `SectionEditor.tsx` is complete. The REQUIREMENTS.md tracking field was not updated by the executor. No functional gap.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `PhotoScanner.tsx` | 436 | `{/* Add-page placeholder */}` comment | Info | UI label comment for "Add page" button slot in thumbnail strip — not a stub; the button is fully implemented below the comment |

No functional stubs found. No `TODO`/`FIXME` markers in production paths. No hardcoded empty returns in rendering paths.

---

### Human Verification Required

#### 1. Excel SOP End-to-End Parse

**Test:** Upload a real `.xlsx` file (e.g., a maintenance checklist) via the admin upload UI
**Expected:** File appears in queue, upload completes, AI parse runs, SOP appears in admin review with sections extracted from spreadsheet content. Any tabular data renders via `SopTable` in the review UI.
**Why human:** Requires live `OPENAI_API_KEY` and Supabase instance; build-time check not possible

#### 2. PhotoScanner Quality Feedback on Mobile

**Test:** Open admin SOP upload on a mobile device, tap "Scan document", photograph a printed SOP page
**Expected:** Quality overlay transitions: idle → checking (spinner) → pass (green checkmark) or warn (orange triangle) within approximately 300ms
**Why human:** Laplacian variance on Canvas API requires real image data and mobile device performance; cannot test canvas rendering programmatically

#### 3. Table Horizontal Scroll on Mobile Viewport

**Test:** View an SOP section containing a wide markdown table (5+ columns) on a 375px viewport
**Expected:** Table scrolls horizontally within its container; page-level scroll not triggered; all rows at least 44px tall
**Why human:** Touch scroll containment requires physical device testing

#### 4. TUS Large-File Upload Progress

**Test:** Drop a file larger than 10MB onto the upload dropzone
**Expected:** Queue row shows percentage counter incrementing (not just spinner); upload completes; parse job is triggered
**Why human:** Requires large test file and a live Supabase TUS-enabled storage bucket

---

### Gaps Summary

No gaps found. All 10 observable truths are verified. All 17 artifacts pass existence, substance, wiring, and data-flow checks. All 10 requirement IDs are satisfied by actual code. TypeScript compiles cleanly with zero errors. All 8 phase commits exist and are correctly attributed.

The only open item from REQUIREMENTS.md is the `[ ]` checkbox on FILE-07 — the implementation is complete but the tracking field was not updated. This is a documentation hygiene issue, not a functional gap.

---

_Verified: 2026-04-03T08:30:00Z_
_Verifier: Claude (gsd-verifier)_
