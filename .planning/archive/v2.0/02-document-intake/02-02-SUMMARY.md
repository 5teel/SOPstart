---
phase: 02-document-intake
plan: "02"
subsystem: api
tags: [openai, mammoth, unpdf, tesseract.js, gpt-4o, zod, supabase-storage, parsing]

# Dependency graph
requires:
  - phase: 02-document-intake/02-01
    provides: sops table, parse_jobs table, sop-images storage bucket, ParsedSopSchema Zod validator, createAdminClient

provides:
  - extractDocx: mammoth-based .docx text + image extraction (base64 embedded images)
  - extractPdf: unpdf-based PDF text extraction
  - ocrFallback: tesseract.js OCR for scanned documents and photographed pages
  - parseSopWithGPT: GPT-4o structured output via zodResponseFormat(ParsedSopSchema)
  - uploadExtractedImages: uploads extracted base64 images to sop-images Storage bucket
  - POST /api/sops/parse: full parse pipeline orchestration (download → extract → OCR fallback → GPT-4o → DB write)

affects: [02-03, 03-review-ui, 04-worker-app]

# Tech tracking
tech-stack:
  added:
    - openai 6.32.0 (GPT-4o structured outputs, zodResponseFormat)
    - mammoth 1.12.0 (.docx text + image extraction)
    - unpdf 1.4.0 (PDF text extraction)
    - sharp 0.34.5 (image processing, available for use)
    - tesseract.js 7.x (OCR fallback for scanned documents)
    - "@tanstack/react-query 5.95.x" (installed for Plan 03 polling UI)
  patterns:
    - zodResponseFormat with ParsedSopSchema for type-safe GPT-4o structured outputs
    - mammoth.images.imgElement callback for base64 image extraction from .docx
    - OCR fallback gated on extractedText.length < 50 (scanned document detection)
    - createAdminClient (service role) in Route Handler — runs without user session
    - Parse job status FSM: queued → processing → completed/failed
    - maxDuration = 300 on route for Vercel Pro long-running parse jobs

key-files:
  created:
    - src/lib/parsers/extract-docx.ts
    - src/lib/parsers/extract-pdf.ts
    - src/lib/parsers/ocr-fallback.ts
    - src/lib/parsers/gpt-parser.ts
    - src/lib/parsers/image-uploader.ts
    - src/app/api/sops/parse/route.ts
  modified:
    - package.json (6 new dependencies added)

key-decisions:
  - "openai SDK 6.x uses chat.completions.parse (not beta.chat.completions.parse) — beta namespace no longer contains chat in v6"
  - "tesseract.js ImageLike requires Buffer not Uint8Array — use Buffer.from(arrayBuffer)"
  - "PDF image extraction skipped for v1 (Research Pitfall 5: @napi-rs/canvas is 50MB+ and may fail on Vercel)"
  - "Image-to-step linking is best-effort by order index — admin can reassign during review"
  - "On parse failure: set sop.status=draft (not uploading) so admin can see it in library and retry"

patterns-established:
  - "Parser modules in src/lib/parsers/ — each file has a single export with a clear interface type"
  - "Route handlers that are long-running use export const maxDuration = 300"
  - "Service role client (createAdminClient) for all route handler DB/Storage operations"

requirements-completed: [PARSE-01, PARSE-02, PARSE-03, PARSE-04]

# Metrics
duration: 3min
completed: "2026-03-24"
---

# Phase 2 Plan 02: Parse Pipeline Summary

**GPT-4o structured SOP parsing pipeline with mammoth+unpdf text extraction, tesseract.js OCR fallback, and an orchestrating POST /api/sops/parse route handler that transitions parse_jobs through queued → processing → completed/failed**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-24T05:18:35Z
- **Completed:** 2026-03-24T05:21:30Z
- **Tasks:** 2
- **Files modified:** 7 (6 created, 1 modified)

## Accomplishments

- Installed openai, mammoth, unpdf, sharp, tesseract.js, and @tanstack/react-query
- Created 5 parser modules covering all document types: .docx (mammoth), PDF (unpdf), OCR fallback (tesseract.js), GPT-4o parse (zodResponseFormat), and image upload
- Built the POST /api/sops/parse route that orchestrates the full pipeline end-to-end, including error handling with status transitions and retry tracking

## Task Commits

Each task was committed atomically:

1. **Task 1: Install parsing dependencies and create extraction modules** - `04864c3` (feat)
2. **Task 2: Parse Route Handler — orchestrates the full pipeline** - `6c62d96` (feat)

**Plan metadata:** `ef1251d` (docs: complete plan)

## Files Created/Modified

- `src/lib/parsers/extract-docx.ts` - mammoth .docx text + base64 image extraction
- `src/lib/parsers/extract-pdf.ts` - unpdf PDF text extraction with page count
- `src/lib/parsers/ocr-fallback.ts` - tesseract.js OCR for scanned documents (Buffer-based)
- `src/lib/parsers/gpt-parser.ts` - GPT-4o structured output via zodResponseFormat(ParsedSopSchema)
- `src/lib/parsers/image-uploader.ts` - uploads base64 images to sop-images Supabase Storage bucket
- `src/app/api/sops/parse/route.ts` - POST handler orchestrating full pipeline with error handling
- `package.json` - added 6 new dependencies

## Decisions Made

- Used `openai.chat.completions.parse` instead of `openai.beta.chat.completions.parse` — OpenAI SDK 6.x moved parse() out of beta
- Skipped PDF image extraction for v1 (per Research Pitfall 5 — @napi-rs/canvas is 50MB+ and Vercel build failures documented)
- Image-to-step linking is best-effort by order index — admin can reassign in review UI
- On parse failure: sop.status remains 'draft' so admins can see it in the library and retry

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] openai.beta.chat.completions.parse does not exist in SDK 6.x**
- **Found during:** Task 1 (TypeScript compile check)
- **Issue:** Plan specified `openai.beta.chat.completions.parse` but OpenAI SDK 6.x removed the `.chat` property from `.beta` — it only exists on the top-level `openai.chat.completions.parse`
- **Fix:** Changed `openai.beta.chat.completions.parse` to `openai.chat.completions.parse` in gpt-parser.ts
- **Files modified:** src/lib/parsers/gpt-parser.ts
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** 04864c3 (Task 1 commit)

**2. [Rule 1 - Bug] tesseract.js ImageLike type does not accept Uint8Array**
- **Found during:** Task 1 (TypeScript compile check)
- **Issue:** Plan passed `new Uint8Array(imageBuffer)` to `Tesseract.recognize()` but tesseract.js types define `ImageLike = string | HTMLImageElement | HTMLCanvasElement | ... | Buffer` — Uint8Array is not in the union
- **Fix:** Changed to `Buffer.from(imageBuffer)` which satisfies the ImageLike type
- **Files modified:** src/lib/parsers/ocr-fallback.ts
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** 04864c3 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bugs)
**Impact on plan:** Both auto-fixes necessary for TypeScript correctness. SDK API changes between docs and installed version. No scope creep.

## User Setup Required

**External services require manual configuration.**

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `OPENAI_API_KEY` | OpenAI API key for GPT-4o structured outputs | OpenAI Dashboard -> API Keys -> Create new secret key |

Add to `.env.local`:
```
OPENAI_API_KEY=sk-...
```

Note: The parse pipeline will not function without a valid OpenAI API key. This is a runtime dependency, not a build-time dependency.

## Next Phase Readiness

- Parse pipeline complete: POST /api/sops/parse processes uploaded SOP documents end-to-end
- triggerParse() server action (from Plan 01) already calls this route after upload
- Plan 03 (admin review UI) can now build against completed parse data in sop_sections/sop_steps tables
- @tanstack/react-query already installed for Plan 03 polling UI

## Self-Check: PASSED

All files confirmed present on disk. All commits confirmed in git history.

| Check | Result |
|-------|--------|
| src/lib/parsers/extract-docx.ts | FOUND |
| src/lib/parsers/extract-pdf.ts | FOUND |
| src/lib/parsers/ocr-fallback.ts | FOUND |
| src/lib/parsers/gpt-parser.ts | FOUND |
| src/lib/parsers/image-uploader.ts | FOUND |
| src/app/api/sops/parse/route.ts | FOUND |
| Commit 04864c3 | FOUND |
| Commit 6c62d96 | FOUND |

---
*Phase: 02-document-intake*
*Completed: 2026-03-24*
