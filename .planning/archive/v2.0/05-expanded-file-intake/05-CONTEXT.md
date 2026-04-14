# Phase 5: Expanded File Intake - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the SOP upload pipeline to accept photos (with OCR), Excel (.xlsx), PowerPoint (.pptx), and plain text (.txt) files — all routed through the existing GPT-4o structuring pipeline and admin review UI. Establish TUS resumable upload infrastructure for large files. Add a scanner-style multi-page photo capture flow. Add format-specific AI prompts for improved section detection across all input types.

</domain>

<decisions>
## Implementation Decisions

### Multi-Page Photo Scanning
- **D-01:** Scanner-style dedicated flow: capture page → see thumbnail → "Add page" button → preview strip at bottom → reorder/delete pages → "Done" submits all as one SOP. Similar to CamScanner or Apple Notes scanner.
- **D-02:** Auto-detect page order via OCR page numbers with manual override — system suggests order based on detected page numbers, admin can drag to reorder.
- **D-03:** No hard page limit — admins scan as many pages as the SOP requires.

### Table Rendering in SOPs
- **D-04:** Rich table component for worker-facing SOP display — scrollable rows, sticky headers, zebra striping. Not markdown tables in text content.
- **D-05:** Claude's Discretion: admin table editing approach during review (visual editor vs raw markdown — pick based on effort vs value).

### Upload UX
- **D-06:** Single unified dropzone for all file formats — expand the existing UploadDropzone to accept docx, pdf, image, xlsx, pptx, txt. One upload area handles everything.
- **D-07:** Separate "Scan" button alongside the dropzone — launches the scanner-style multi-page photo capture flow directly. Clear intent, distinct from single photo upload.

### Image Quality Gating
- **D-08:** Warn but allow — show warning overlay on photos that fail quality checks ("Image may be hard to read — retake recommended") but let admin proceed. Respects admin judgment.
- **D-09:** Quality checks run on both client and server — client does quick blur/resolution checks for instant feedback, server does deeper analysis (deskew, contrast normalization) before OCR.

### Claude's Discretion
- Table editing UX in admin review (D-05)
- TUS library choice and integration pattern (tus-js-client vs Supabase native TUS)
- Format-specific prompt engineering approach per file type
- Client-side image quality check algorithm (Laplacian variance for blur, etc.)
- Server-side preprocessing library choice (sharp, OpenCV bindings, etc.)
- officeparser vs separate xlsx/pptx parsing libraries
- How to extend `getSourceFileType()` and parse route routing logic

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Vision, core value, constraints, NZ market context
- `.planning/REQUIREMENTS.md` — FILE-01 through FILE-08, INFRA-01, INFRA-02 are this phase's requirements
- `.planning/ROADMAP.md` — Phase 5 details, success criteria

### Research (v2.0)
- `.planning/research/STACK.md` — officeparser v6 recommendation, @ffmpeg/ffmpeg WASM, TUS upload approach
- `.planning/research/ARCHITECTURE.md` — TUS resumable upload pattern, parse_jobs.input_type column, format routing
- `.planning/research/PITFALLS.md` — Macro-enabled Office files must be rejected, OCR accuracy on factory-floor photos, HEIC conversion needed
- `.planning/research/FEATURES.md` — Photo OCR table stakes, multi-page scanning UX, Excel/PPTX complexity notes

### Prior Phase Context
- `.planning/phases/02-document-intake/02-CONTEXT.md` — Upload experience decisions, AI parsing approach, admin review UI decisions (all carry forward)

### Existing Code (extend these)
- `src/components/admin/UploadDropzone.tsx` — Current upload UI (extend MIME types, add Scan button)
- `src/lib/parsers/gpt-parser.ts` — GPT-4o structuring (reuse for all new formats)
- `src/lib/parsers/extract-docx.ts` — DOCX extraction pattern (model new extractors after this)
- `src/lib/parsers/extract-pdf.ts` — PDF extraction pattern
- `src/lib/parsers/ocr-fallback.ts` — OCR with confidence scoring
- `src/lib/validators/sop.ts` — `getSourceFileType()` and file validation schemas (extend)
- `src/app/api/sops/parse/route.ts` — Parse orchestrator (add format routing here)
- `src/actions/sops.ts` — `createUploadSession()` server action (extend for new types)
- `src/app/(protected)/admin/sops/[sopId]/review/ReviewClient.tsx` — Admin review (add table rendering)
- `src/components/admin/SectionEditor.tsx` — Section editor (may need table editing support)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `UploadDropzone.tsx` — File upload with drag-drop, file browser, camera capture, multi-file queue with status indicators. Extend `accept` MIME types.
- `gpt-parser.ts` — GPT-4o structured output parser with `ParsedSopSchema`. Reuse unchanged for all new formats — just feed extracted text.
- `ocr-fallback.ts` — Tesseract.js OCR with confidence scoring. Extend for photo-first workflow.
- `ParseJobStatus.tsx` — Real-time parsing progress with Supabase Realtime + polling fallback. Reuse for new format types.
- `SectionEditor.tsx` — Inline section editing with approval flow. Extend for table content.
- `StatusBadge.tsx` — Status display with color coding. Already supports all SOP/parse states.
- `OriginalDocViewer.tsx` — Original document display. Extend for new format previews.

### Established Patterns
- Presigned URL upload: server action creates SOP record + signed URL, client uploads directly to Storage
- Async parse pipeline: upload → parse_jobs → route handler processes → updates DB
- Parse route dispatches by file type: docx → mammoth, pdf → unpdf, image → tesseract fallback
- `getSourceFileType(mimeType)` maps MIME to internal type ('docx' | 'pdf' | 'image')
- Supabase Realtime on `parse_jobs` for live status updates

### Integration Points
- `getSourceFileType()` in `src/lib/validators/sop.ts` — add 'xlsx', 'pptx', 'txt' types
- `parse/route.ts` — add extraction branches for new types
- `src/lib/parsers/` — new extraction modules: `extract-xlsx.ts`, `extract-pptx.ts`, `extract-txt.ts`
- `UploadDropzone.tsx` — extend MIME types, add "Scan" button entry point
- New component: `PhotoScanner.tsx` — scanner-style multi-page capture flow
- New component: `SopTable.tsx` — rich table renderer for worker SOP view
- Database: add `input_type` column to `parse_jobs` if not present

</code_context>

<specifics>
## Specific Ideas

- **Scanner-style flow** modelled after CamScanner/Apple Notes — thumbnail strip, page reorder, "Add page" button. Should feel native on mobile.
- **Auto page order detection** — OCR page numbers as suggestion, not enforcement. Admin always has final say on order.
- **Rich table component** for workers — large tap targets, scrollable, readable on phone screens. Tables from Excel/PPTX SOPs are often calibration data or parameter tables.
- **Unified dropzone** — don't fragment the upload UX. One place to upload anything. The separate "Scan" button is the only exception because scanning is a fundamentally different interaction.
- **Warn but allow** on image quality — factory floor admins know their documents. Don't block them with false positives.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-expanded-file-intake*
*Context gathered: 2026-04-03*
