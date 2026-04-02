# Phase 5: Expanded File Intake - Research

**Researched:** 2026-03-29
**Domain:** Office file parsing (XLSX, PPTX, TXT), photo OCR with quality gating, multi-page scanner UX, TUS resumable upload, GPT-4o vision, rich table rendering
**Confidence:** HIGH (core decisions backed by existing codebase patterns, official docs, and project research artifacts from STACK.md/ARCHITECTURE.md/PITFALLS.md)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Scanner-style dedicated flow — capture page, see thumbnail, "Add page" button, preview strip at bottom, reorder/delete pages, "Done" submits all as one SOP. Similar to CamScanner or Apple Notes scanner.
- **D-02:** Auto-detect page order via OCR page numbers with manual override — system suggests order based on detected page numbers, admin can drag to reorder.
- **D-03:** No hard page limit — admins scan as many pages as the SOP requires.
- **D-04:** Rich table component for worker-facing SOP display — scrollable rows, sticky headers, zebra striping. Not markdown tables in text content.
- **D-06:** Single unified dropzone for all file formats — expand the existing UploadDropzone to accept docx, pdf, image, xlsx, pptx, txt. One upload area handles everything.
- **D-07:** Separate "Scan" button alongside the dropzone — launches the scanner-style multi-page photo capture flow directly. Clear intent, distinct from single photo upload.
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

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FILE-01 | Admin can upload a photo/image of a printed SOP and the system OCRs it into a structured SOP | GPT-4o vision preferred over Tesseract for photo-first inputs; existing `ocr-fallback.ts` becomes secondary |
| FILE-02 | System provides image quality feedback before processing (blur, glare, rotation detection) | Client-side Laplacian variance for blur; D-08/D-09 pattern; `sharp` for server-side; warn-but-allow UX |
| FILE-03 | Admin can capture multiple pages sequentially to create a single SOP from a multi-page printed document | New `PhotoScanner.tsx` component; page thumbnails + drag reorder; OCR page number detection for auto-order |
| FILE-04 | Admin can upload Excel (.xlsx) files and the system extracts content into a structured SOP | `officeparser` v6 — `parseOffice()` returns AST with tables; feeds to existing `gpt-parser.ts` |
| FILE-05 | Admin can upload PowerPoint (.pptx) files and the system extracts slides into a structured SOP | `officeparser` v6 — same library handles PPTX AST including speaker notes and slide text |
| FILE-06 | Admin can upload plain text (.txt) files and the system structures them into an SOP | No library needed — `await blob.text()` in route handler; feed directly to `gpt-parser.ts` |
| FILE-07 | Table structures in Excel/PowerPoint are preserved as readable tables within SOP steps | `officeparser` AST exposes table nodes; new `SopTable.tsx` component for worker view |
| FILE-08 | AI parsing uses format-specific prompts for improved section detection across all input types | Extend `gpt-parser.ts` to accept optional `inputType` and `formatHint` parameters |
| INFRA-01 | Video and large file uploads use resumable upload (TUS) direct to storage, bypassing server body limits | `tus-js-client` v4.3.1; Supabase TUS endpoint; 6 MB chunks; auth via session token |
| INFRA-02 | All new intake pathways route through the existing SOP structuring pipeline and admin review UI | All extractors converge at `gpt-parser.ts` → `ParsedSopSchema`; `parse_jobs` table extended with `input_type` column |

</phase_requirements>

---

## Summary

Phase 5 extends the existing SOP upload pipeline with four new input pathways: photo/image OCR, Excel (.xlsx), PowerPoint (.pptx), and plain text (.txt). All four converge at the existing `gpt-parser.ts` → `ParsedSopSchema` pipeline, meaning no changes to the admin review UI's core flow. The primary new architectural work is: (1) new server-side extractor modules following the `extract-docx.ts` pattern, (2) a `PhotoScanner.tsx` component for multi-page capture, (3) TUS resumable upload infrastructure for INFRA-01 (targeted at large files now, required for Phase 6 video uploads), (4) the `SopTable.tsx` rich table renderer for the worker view, and (5) a database migration adding `input_type` to `parse_jobs` and extending the `file_type` check constraint.

The key library choices are already locked in project research: `officeparser` v6 (AST output, handles XLSX and PPTX in one package), GPT-4o vision for image OCR (superior to Tesseract on factory-floor photos), `tus-js-client` v4.3.1 for resumable upload, and `sharp` (already installed) for server-side image preprocessing. HEIC images from iOS cameras require client-side conversion via `heic2any` or `heic-to` before upload.

**Primary recommendation:** Follow the `extract-docx.ts` pattern exactly for new extractors. All new file types are routed through the parse route dispatch switch on `file_type`. The `PhotoScanner.tsx` multi-page flow concatenates OCR text from all pages before calling GPT — no special schema changes needed.

---

## Standard Stack

### Core (new additions for Phase 5)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `officeparser` | `^6.0.0` | XLSX + PPTX text/table AST extraction | Only actively-maintained library that handles both formats in one package with typed AST; SheetJS npm package has CVEs; separate PPTX libs are abandoned |
| `tus-js-client` | `^4.3.1` | TUS resumable upload from browser to Supabase Storage | Supabase Storage's TUS endpoint is the only way to bypass Vercel 4.5 MB body limit for large files; tus-js-client is the reference implementation |
| `heic2any` | `^0.0.4` | Client-side HEIC → JPEG conversion | iOS cameras default to HEIC; GPT-4o vision and Tesseract do not accept HEIC; must convert before upload or quality check; client-side keeps server simple |

### Already Installed (extend, do not reinstall)

| Library | Current Version | Phase 5 Usage |
|---------|----------------|---------------|
| `sharp` | `^0.34.5` | Server-side image preprocessing before OCR (deskew, contrast normalization, format normalization) |
| `tesseract.js` | `^7.0.0` | OCR confidence scoring fallback; also used for page-number detection from scanned pages |
| `openai` | `^6.32.0` | GPT-4o vision for photo OCR (`chat.completions.create` with image_url content type) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Canvas API | native browser | Client-side image quality checks (Laplacian variance for blur), thumbnail generation for scanner strip | Always available in browser — no install |
| `heic-to` | `^1.1.0` | Alternative HEIC conversion — better maintained than heic2any as of 2026 | Use if `heic2any` proves unreliable on older iOS; same API surface |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `officeparser` v6 | SheetJS `xlsx` + separate PPTX lib | SheetJS npm package has CVEs and hasn't been published since 0.18.5; separate PPTX libs are unmaintained; officeparser covers both in one maintained package |
| GPT-4o vision for photo OCR | Tesseract.js | Tesseract drops to 75-85% accuracy on factory-floor photos; GPT-4o vision handles glare, blur, perspective distortion significantly better; cost ~$0.002-0.005 per image is acceptable for admin uploads |
| `tus-js-client` | Uppy | Uppy includes tus-js-client internally; for this phase the UI complexity of Uppy is not needed; bare tus-js-client is lighter and gives direct control |
| `heic2any` | Server-side sharp HEIC conversion | Sharp's HEIC support requires libvips compiled with libheif/x265 — not available on Vercel; client-side conversion is safer and keeps server simpler |

**Installation (new packages only):**

```bash
npm install officeparser tus-js-client heic2any
```

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
src/
├── app/
│   └── api/
│       └── sops/
│           └── parse/route.ts          # MODIFIED: add xlsx, pptx, txt, image dispatch
├── components/
│   └── admin/
│       ├── UploadDropzone.tsx          # MODIFIED: add XLSX/PPTX/TXT MIME types + Scan button
│       └── PhotoScanner.tsx            # NEW: multi-page scanner flow (D-01, D-02, D-03)
├── components/
│   └── sop/
│       └── SopTable.tsx                # NEW: rich table renderer (D-04, FILE-07)
├── lib/
│   └── parsers/
│       ├── extract-image.ts            # NEW: GPT-4o vision OCR for single images
│       ├── extract-xlsx.ts             # NEW: officeparser for Excel
│       ├── extract-pptx.ts             # NEW: officeparser for PowerPoint
│       └── extract-txt.ts             # NEW: plain text passthrough
└── supabase/
    └── migrations/
        └── 00011_parse_jobs_input_type.sql  # NEW: add input_type column
```

### Pattern 1: Extractor Module (follow extract-docx.ts exactly)

**What:** Each new file type gets its own `extract-{type}.ts` module in `src/lib/parsers/`. The module receives an `ArrayBuffer`, returns `{ text: string }` (and optionally tables as structured text). The parse route handler calls the appropriate extractor, then passes text to `gpt-parser.ts`.

**When to use:** All new file types follow this pattern — XLSX, PPTX, TXT, and single-image OCR.

**Example (pattern model from existing code):**

```typescript
// src/lib/parsers/extract-txt.ts
export async function extractTxt(buffer: ArrayBuffer): Promise<{ text: string }> {
  const text = Buffer.from(buffer).toString('utf-8')
  return { text: text.trim() }
}
```

```typescript
// src/lib/parsers/extract-xlsx.ts — Source: officeparser v6 API
import { parseOffice } from 'officeparser'

export async function extractXlsx(buffer: ArrayBuffer): Promise<{ text: string }> {
  const ast = await parseOffice(Buffer.from(buffer))
  // ast.content contains paragraphs, tables, etc. as AST nodes
  // ast.toText() returns plain text; tables are serialized as tab-separated rows
  const text = ast.toText()
  return { text }
}
```

### Pattern 2: Parse Route Dispatch (extend existing switch)

**What:** The parse route `src/app/api/sops/parse/route.ts` currently dispatches on `job.file_type`. Add new branches for `'xlsx'`, `'pptx'`, `'txt'`, and update `'image'` to use GPT-4o vision.

**Example:**

```typescript
// In parse/route.ts — extend existing if/else chain
} else if (job.file_type === 'xlsx') {
  const result = await extractXlsx(buffer)
  extractedText = result.text
} else if (job.file_type === 'pptx') {
  const result = await extractPptx(buffer)
  extractedText = result.text
} else if (job.file_type === 'txt') {
  const result = await extractTxt(buffer)
  extractedText = result.text
} else if (job.file_type === 'image') {
  // Phase 5: upgrade from Tesseract to GPT-4o vision
  const result = await extractImage(buffer, job.image_quality_warning ?? false)
  extractedText = result.text
  isOcr = true
}
```

### Pattern 3: Format-Specific GPT Prompts (FILE-08)

**What:** `gpt-parser.ts` accepts an optional `inputType` parameter and appends a format-specific hint to the system prompt. All prompts still produce `ParsedSopSchema` — no schema changes.

**When to use:** Called with `inputType` for every new file type; existing DOCX/PDF calls remain unchanged (backward compatible).

**Example:**

```typescript
// In gpt-parser.ts — extend parseSopWithGPT signature
export async function parseSopWithGPT(
  extractedText: string,
  inputType?: 'docx' | 'pdf' | 'image' | 'xlsx' | 'pptx' | 'txt'
): Promise<ParsedSop>
```

Format hints to add to system prompt per type:
- `xlsx`: "Source is an Excel spreadsheet. Rows and columns represent tabular data — treat table headers as section titles, table cells as steps or parameters. Preserve numerical tolerances exactly."
- `pptx`: "Source is a PowerPoint presentation. Each slide title is a likely section heading. Speaker notes contain procedural steps. Combine slide text and notes."
- `txt`: "Source is a plain text file. It may or may not have consistent formatting. Infer structure from numbering, indentation, and keywords like HAZARD, PPE, WARNING, STEP."
- `image`: "Source is OCR output from a photographed document. It may contain OCR errors, broken words, and missing punctuation. Be lenient with formatting, flag uncertain extractions."

### Pattern 4: TUS Resumable Upload (INFRA-01)

**What:** For large files (future video, and any file >10 MB in this phase), client uploads directly to Supabase Storage via TUS protocol instead of presigned URL. Server action returns TUS endpoint + auth token; client uses `tus-js-client`.

**Why:** Vercel serverless functions have a 4.5 MB hard request body limit. TUS bypasses this entirely — the file goes browser → Supabase Storage directly.

**Supabase TUS endpoint:**
```
https://{project-id}.storage.supabase.co/storage/v1/upload/resumable
```

**Example (tus-js-client v4):**

```typescript
// Source: Supabase Storage TUS docs
import * as tus from 'tus-js-client'

const upload = new tus.Upload(file, {
  endpoint: `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`,
  headers: {
    authorization: `Bearer ${session.access_token}`,
    'x-upsert': 'true',
  },
  chunkSize: 6 * 1024 * 1024, // exactly 6 MB required by Supabase TUS
  metadata: {
    bucketName: 'sop-documents',
    objectName: storagePath,
    contentType: file.type,
  },
  onProgress: (bytesUploaded, bytesTotal) => {
    const pct = ((bytesUploaded / bytesTotal) * 100).toFixed(1)
    // update progress UI
  },
  onSuccess: () => {
    // trigger /api/sops/parse
  },
  onError: (error) => {
    console.error('TUS upload failed:', error)
  },
})
upload.start()
```

**Key constraint:** Chunk size must be exactly 6 MB. Only one client can upload to the same URL simultaneously (409 Conflict if concurrent).

### Pattern 5: PhotoScanner Component (FILE-03)

**What:** `PhotoScanner.tsx` is a client component rendered as a modal/sheet. It manages a local array of scanned pages (each as a `{ imageBlob: Blob, quality: QualityResult, pageNumber: number | null, thumbnailUrl: string }`). When "Done" is clicked, all pages are concatenated as multi-part upload or a single combined text extraction.

**Multi-page concatenation strategy:** Each page is OCR'd individually server-side (via GPT-4o vision). The resulting texts are concatenated in the user-confirmed order before being sent to `gpt-parser.ts` as one combined text. This avoids any schema changes — the parse pipeline sees one document.

**Page order detection:** Tesseract.js (already installed) runs a lightweight pass on each page to detect page numbers in headers/footers. This is done client-side as a suggestion only — the admin drags to override. Tesseract is appropriate here (not GPT-4o) because it's fast client-side and page number extraction from the header/footer corner is a simple text region.

**Client-side quality checks (D-09):** Using the Canvas API's ImageData, compute:
- Blur score via Laplacian variance on grayscale pixels (score < 100 = blurry threshold)
- Resolution check: warn if image is under 600px in the shorter dimension
- Aspect ratio check: warn if extreme skew detected (>20 degrees estimated from EXIF or content)

**Server-side preprocessing with sharp (D-09):** Before calling GPT-4o vision, run the image through `sharp`:
- Convert HEIC → JPEG (handled client-side before upload, but sharp as fallback)
- Normalize contrast (`sharp().normalize()`)
- Apply auto-rotation from EXIF metadata (`.rotate()` with no argument = auto EXIF)
- Resize if >4 MB (GPT-4o vision has a token limit for image inputs)

### Pattern 6: SopTable Component (FILE-07, D-04)

**What:** `SopTable.tsx` renders table data extracted from Excel/PowerPoint sources as a rich responsive table. Table data arrives as structured markdown-table text in `sop_steps[n].text` or as a dedicated content field — the exact storage format must be decided in the plan.

**Recommended storage:** Tables extracted from XLSX/PPTX are represented as GitHub-flavored markdown table syntax in `sop_sections.content` (for parameter tables) or embedded in step text. The `SopTable.tsx` component detects markdown table syntax and renders it as a `<table>` with:
- Sticky header row (`position: sticky; top: 0`)
- Horizontal scroll wrapper (`overflow-x: auto`)
- Zebra striping (alternating row background)
- Large tap targets on mobile (min row height 44px)

This avoids a new database column or separate table data model.

### Anti-Patterns to Avoid

- **Routing file bytes through a Vercel function body for large files:** The 4.5 MB limit is hard. Use TUS for any file type that may be large. For this phase, xlsx/pptx/txt are typically small (<4 MB), so presigned URL upload is fine — TUS is only strictly needed for the video pathway in Phase 6. However, INFRA-01 requires TUS infrastructure to exist now.
- **Using SheetJS (`xlsx` from npm) for Excel parsing:** The npm package has CVEs and hasn't been updated since 2023. Use `officeparser` v6 instead.
- **Replacing mammoth with officeparser for DOCX:** mammoth has better fidelity for styled DOCX content (bold, italic, headings, embedded images). Keep mammoth for DOCX. officeparser is for XLSX, PPTX, and other formats.
- **Running Tesseract.js for primary photo OCR:** Tesseract drops to 75-85% accuracy on factory-floor photos. Use GPT-4o vision as primary; Tesseract only for page number detection and as a cost fallback.
- **Accepting `.xlsm`, `.xlsb`, `.xltm`, `.pptm`, `.potm`, `.ppam`:** These macro-enabled formats must be rejected at the validation layer before any parsing library is invoked. Validate with magic-byte check server-side (the extension can be spoofed).
- **Auto-ordering pages without override:** D-02 requires manual override always available. Page order detection is a suggestion, not enforcement.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| XLSX/PPTX text extraction | Custom XML parser for Office Open XML format | `officeparser` v6 | Office Open XML is a complex ZIP-based format with relationships; edge cases in table cells, merged cells, hidden rows, embedded objects — all handled by officeparser |
| Resumable chunked upload | Custom chunk-and-retry upload logic | `tus-js-client` | TUS handles network interruption, retry with backoff, chunk integrity, concurrent upload conflict — implementing this correctly takes weeks |
| Blur detection algorithm | Custom pixel analysis | Canvas API Laplacian variance (no library, just Canvas ImageData) | The algorithm is 20 lines of canvas code; no library needed, but don't invent a different approach |
| HEIC → JPEG conversion | Custom binary parser | `heic2any` or `heic-to` | HEIC uses HEVC compression which requires libheif; client-side WASM libraries handle this correctly |
| Image deskew/normalization | Custom image processing | `sharp` (already installed) | Sharp's `.normalize()` and `.rotate()` handle 99% of preprocessing needs; sharp is already in package.json |
| Markdown table → HTML | Custom markdown table parser | Parse with a regex or simple split; `SopTable.tsx` renders it | Markdown table parsing from GitHub-flavored markdown is ~15 lines; no extra dependency needed |

**Key insight:** The hardest problem in this phase is not parsing — it's the quality pipeline for photos. The Laplacian variance client-side check + sharp server-side normalization + GPT-4o vision combination handles the quality problem correctly without any custom computer vision.

---

## Common Pitfalls

### Pitfall 1: Macro-Enabled Office Files Execute Code in the Parser

**What goes wrong:** A `.xlsm` or `.pptm` file is uploaded. The parsing library processes it and encounters VBA macro content or XXE payloads in the embedded XML.

**Why it happens:** Office file extensions are not validated; server-side only checks MIME type from the `Content-Type` header, which is client-provided and spoofable.

**How to avoid:** Reject `.xlsm`, `.xlsb`, `.xltm`, `.pptm`, `.potm`, `.ppam` extensions in `getSourceFileType()` and in the `uploadFileSchema` Zod validation. Additionally check magic bytes server-side after download from Storage (XLSX/PPTX are ZIP files starting with `PK\x03\x04`; if the magic bytes don't match, reject). Log the rejection with tenant ID and filename for security audit.

**Warning signs:** Accepting all Office formats without filtering by extension; trusting `Content-Type` header alone.

### Pitfall 2: HEIC Images From iPhone Cameras Are Not Accepted

**What goes wrong:** Admin uses an iPhone (the most common device for factory-floor admins). iPhone camera defaults to HEIC format. The upload dropzone accepts `image/*` but GPT-4o vision API returns an error on HEIC input. OCR fails silently.

**Why it happens:** `image/*` in the HTML accept attribute does not filter to JPEG/PNG only. iOS sends HEIC files and the browser reports their MIME type correctly as `image/heic`.

**How to avoid:** In `UploadDropzone.tsx`, detect `image/heic` or `image/heif` MIME types in `validateAndAddFiles`. Convert to JPEG client-side using `heic2any` before adding to the queue. Show "Converting from HEIC..." status indicator. Also handle `.heic` extension (file extension check as fallback if MIME type is not set).

**Warning signs:** Accepting `image/*` without HEIC conversion; testing only with Android or desktop browser file uploads.

### Pitfall 3: OCR Confidence on Factory Photos is 75–85% Without Preprocessing

**What goes wrong:** A photo of a laminated SOP under fluorescent lighting is OCR'd. Chemical names and numerical tolerances are misread. Admin reviews but misses errors because the original document isn't shown side-by-side.

**Why it happens:** GPT-4o vision without preprocessing on low-quality images still makes systematic errors on domain-specific terminology and numbers. The existing review UI already shows the original document, but only if `presignedUrl` is non-null — images from the scanner flow need to be stored and linked.

**How to avoid:**
- Store each scanned image in Supabase Storage (same `sop-documents` bucket, same path pattern) and set `source_file_path` so the existing `OriginalDocViewer` can show it.
- For multi-page SOPs, store all page images and show a page navigator in the review UI.
- High-risk token flagging: the existing `parse_notes` field from GPT-4o should note when OCR-sourced content has uncertainty. Flag numerical values and chemical names in the prompt.
- D-08 (warn but allow): quality checks gate the UX warning, not upload. The original image is always stored.

**Warning signs:** Not storing scanned images for the admin review; treating OCR output as ground truth without the original image visible.

### Pitfall 4: Multi-Page Photo Batch Has No Session State

**What goes wrong:** Admin is mid-scan (3 pages captured). They switch apps briefly. When they return, the `PhotoScanner.tsx` component has unmounted and all captured thumbnails and Blobs are lost.

**Why it happens:** Captured images are stored only in component state. Mobile browsers can unload background tabs aggressively, especially on iOS.

**How to avoid:** Persist captured page Blobs to IndexedDB via Dexie.js (already installed) for the duration of the scanner session. Use a session key (timestamp-based). Clear the session from IndexedDB on successful "Done" submission or manual discard. This is a scanner-session-only store — not the completion store pattern, just a temporary working set.

**Warning signs:** Storing all captured images in React useState only; no persistence to IndexedDB.

### Pitfall 5: TUS Chunk Size Set Incorrectly

**What goes wrong:** TUS upload fails with a `400 Bad Request` or corruption errors because chunk size is not exactly 6 MB.

**Why it happens:** Supabase's TUS implementation requires exactly 6 MB chunks. The tus-js-client default chunk size is different. Developers initialize `new tus.Upload(file, {})` without explicitly setting `chunkSize`.

**How to avoid:** Always set `chunkSize: 6 * 1024 * 1024` in the tus-js-client constructor. This is a hard Supabase requirement — document it in the implementation code as a comment.

**Warning signs:** Not explicitly setting chunkSize; using tus-js-client defaults.

### Pitfall 6: officeparser v6 AST Table Format Not Understood

**What goes wrong:** `ast.toText()` is called and tables in XLSX/PPTX are serialized as flat text with no column separation. GPT-4o cannot reconstruct the table structure from the text alone.

**Why it happens:** `toText()` may flatten table data. The AST structure needs to be traversed to extract tables as structured text (tab-separated or pipe-separated rows) to preserve column relationships.

**How to avoid:** Do not rely on `ast.toText()` alone for XLSX/PPTX files. Traverse `ast.content` to find table nodes specifically, and serialize them as markdown table syntax (pipes and dashes). This preserves column structure that GPT-4o can then represent faithfully in the SOP. Pass the format hint (FILE-08) to GPT-4o so it knows to look for tabular calibration data.

**Warning signs:** Passing `ast.toText()` directly to GPT-4o for Excel files; receiving SOP output where parameter tables are lost.

### Pitfall 7: parse_jobs file_type Check Constraint Blocks New Types

**What goes wrong:** Inserting a parse job with `file_type = 'xlsx'` fails with a PostgreSQL check constraint violation because the existing constraint only allows `('docx', 'pdf', 'image')`.

**Why it happens:** The migration `00004_parse_jobs.sql` defines `check (file_type in ('docx', 'pdf', 'image'))`. This must be extended before any new file types can be used.

**How to avoid:** The first task in this phase must be a migration that `ALTER TABLE parse_jobs DROP CONSTRAINT` on `file_type` and re-adds it with the new values: `('docx', 'pdf', 'image', 'xlsx', 'pptx', 'txt')`. Also add the `input_type` column per the architecture research.

**Warning signs:** Adding new extractor code before running the database migration; the upload succeeds but the parse job insert fails silently.

### Pitfall 8: getSourceFileType() Returns 'image' for XLSX/PPTX (Silent Wrong Routing)

**What goes wrong:** `getSourceFileType()` currently returns `'image'` as a catch-all default for any MIME type it doesn't recognise. XLSX and PPTX MIME types are not in the existing list, so they both get routed to the image/OCR branch.

**Why it happens:** The function's final line is `return 'image'` — the catch-all is implicit.

**How to avoid:** Update `getSourceFileType()` in `src/lib/validators/sop.ts` to explicitly map:
- `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` → `'xlsx'`
- `application/vnd.ms-excel` → reject (legacy format, see macro pitfall)
- `application/vnd.openxmlformats-officedocument.presentationml.presentation` → `'pptx'`
- `text/plain` → `'txt'`

Change the catch-all from `return 'image'` to an explicit guard that throws if the MIME type is unrecognised.

---

## Code Examples

### GPT-4o Vision for Image OCR

```typescript
// src/lib/parsers/extract-image.ts
// Source: OpenAI Chat Completions API with vision (official docs)
import OpenAI from 'openai'

const openai = new OpenAI()

export async function extractImage(buffer: ArrayBuffer): Promise<{ text: string }> {
  const base64 = Buffer.from(buffer).toString('base64')
  // GPT-4o vision accepts JPEG, PNG, GIF, WEBP
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-2024-08-06',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract all text from this SOP document image. Preserve numbered lists, table structures (use | separators), headings, warnings, and cautions. Output the raw text content only.',
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64}`,
              detail: 'high', // high detail = more tokens, better accuracy for dense documents
            },
          },
        ],
      },
    ],
    max_tokens: 4096,
  })

  const text = response.choices[0]?.message?.content ?? ''
  return { text }
}
```

### Client-Side Blur Detection (Laplacian Variance)

```typescript
// Used in PhotoScanner.tsx — runs in browser, no library needed
// Source: Canvas API + Laplacian variance algorithm (established computer vision technique)
function measureBlur(imageElement: HTMLImageElement): number {
  const canvas = document.createElement('canvas')
  canvas.width = imageElement.naturalWidth
  canvas.height = imageElement.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(imageElement, 0, 0)

  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)

  // Convert to grayscale and apply Laplacian kernel [0,1,0,1,-4,1,0,1,0]
  let sum = 0
  let sumSq = 0
  let count = 0

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4
      // Grayscale: 0.299R + 0.587G + 0.114B
      const gray = (data[idx] * 299 + data[idx + 1] * 587 + data[idx + 2] * 114) / 1000
      const neighbors =
        getGray(data, width, x, y - 1) + getGray(data, width, x, y + 1) +
        getGray(data, width, x - 1, y) + getGray(data, width, x + 1, y)
      const laplacian = Math.abs(4 * gray - neighbors)
      sum += laplacian
      sumSq += laplacian * laplacian
      count++
    }
  }

  const mean = sum / count
  const variance = sumSq / count - mean * mean
  return variance // higher = sharper; threshold ~100 for acceptable sharpness
}

function getGray(data: Uint8ClampedArray, width: number, x: number, y: number): number {
  const idx = (y * width + x) * 4
  return (data[idx] * 299 + data[idx + 1] * 587 + data[idx + 2] * 114) / 1000
}
```

### TUS Upload Integration

```typescript
// src/components/admin/UploadDropzone.tsx — TUS upload flow
// Source: Supabase Storage TUS docs + tus-js-client v4 API
import * as tus from 'tus-js-client'

async function uploadWithTus(
  file: File,
  storagePath: string,
  accessToken: string,
  projectId: string,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`,
      headers: {
        authorization: `Bearer ${accessToken}`,
        'x-upsert': 'true',
      },
      chunkSize: 6 * 1024 * 1024, // REQUIRED: Supabase TUS requires exactly 6 MB chunks
      metadata: {
        bucketName: 'sop-documents',
        objectName: storagePath,
        contentType: file.type,
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        onProgress((bytesUploaded / bytesTotal) * 100)
      },
      onSuccess: () => resolve(),
      onError: (error) => reject(error),
    })
    upload.start()
  })
}
```

### Database Migration (parse_jobs extension)

```sql
-- supabase/migrations/00011_parse_jobs_input_type.sql

-- Step 1: Drop the existing file_type check constraint
-- (PostgreSQL requires DROP + re-ADD to change check constraint values)
alter table public.parse_jobs
  drop constraint if exists parse_jobs_file_type_check;

-- Step 2: Re-add with expanded allowed types
alter table public.parse_jobs
  add constraint parse_jobs_file_type_check
  check (file_type in ('docx', 'pdf', 'image', 'xlsx', 'pptx', 'txt'));

-- Step 3: Add input_type column for Phase 5+ routing
alter table public.parse_jobs
  add column if not exists input_type text
  check (input_type in ('document', 'image', 'xlsx', 'pptx', 'txt', 'video_file', 'youtube_url', 'in_app_recording'));
```

### officeparser v6 Table Extraction

```typescript
// src/lib/parsers/extract-pptx.ts
// Source: officeparser v6 GitHub README (AST API)
import { parseOffice } from 'officeparser'

export async function extractPptx(buffer: ArrayBuffer): Promise<{ text: string }> {
  const ast = await parseOffice(Buffer.from(buffer))

  // Traverse AST to build text with table structure preserved
  const lines: string[] = []
  for (const node of ast.content) {
    if (node.type === 'table') {
      // Serialize as markdown table for GPT comprehension
      const rows = node.rows ?? []
      if (rows.length === 0) continue
      const header = '| ' + rows[0].map((c: { text: string }) => c.text).join(' | ') + ' |'
      const separator = '| ' + rows[0].map(() => '---').join(' | ') + ' |'
      lines.push(header, separator)
      for (const row of rows.slice(1)) {
        lines.push('| ' + row.map((c: { text: string }) => c.text).join(' | ') + ' |')
      }
    } else {
      lines.push(node.text ?? '')
    }
  }

  return { text: lines.join('\n') }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tesseract.js for all image OCR | GPT-4o vision for photo OCR, Tesseract as fallback | GPT-4o vision availability (2023), ARCHITECTURE.md recommendation (2026-03-29) | 20-25% accuracy improvement on real factory-floor photos |
| SheetJS for XLSX | officeparser v6 | SheetJS CVEs (2023), officeparser v6.0.0 release (Dec 2025) | Security + single library for both XLSX and PPTX |
| Presigned URL only | Presigned URL for small files + TUS for large | Supabase Storage TUS support (2023), Phase 5 INFRA-01 requirement | Enables files >4.5 MB bypassing Vercel body limit |

**Deprecated/outdated:**

- SheetJS `xlsx` npm package: unmaintained since 0.18.5 (2023), CVEs in Snyk, do not use
- ExcelJS: no npm release in 12+ months as of 2025, considered potentially abandoned
- Separate PPTX-specific libraries (pptx2json, js-pptx): unmaintained, use officeparser v6

---

## Open Questions

1. **officeparser v6 AST table node structure** (exact property names)
   - What we know: AST has `content` array; nodes have `type` field; tables present
   - What's unclear: Exact property names for rows/cells (need to verify against GitHub README or runtime inspection)
   - Recommendation: Write a one-off test script locally that parses a sample XLSX and logs the AST structure before implementing `extract-xlsx.ts`. Plan for a Wave 0 task to do this.

2. **Multi-page photo submission to parse pipeline**
   - What we know: All pages are OCR'd individually and concatenated; single gpt-parser.ts call
   - What's unclear: Should multiple page images each have their own `sop_images` record, or a single record? How does `OriginalDocViewer` show multiple pages?
   - Recommendation: Store each page image separately in Storage; add a `page_index` column or use filename convention (`original/page-001.jpg`). `OriginalDocViewer` can be extended with a page navigator. Decide in plan.

3. **Table editing in admin review (D-05 — Claude's Discretion)**
   - What we know: Tables are stored as markdown table text in `sop_sections.content`; existing `SectionEditor.tsx` uses a `<textarea>` for content editing
   - What's unclear: Is a visual table editor worth the effort at this stage?
   - Recommendation: Use raw markdown table editing in the textarea (D-05 is Claude's discretion). The existing SectionEditor textarea works — admins editing pipe-table syntax is acceptable for v2.0. A visual editor is deferred. Document this choice in the plan.

4. **HEIC file MIME type detection in different browsers**
   - What we know: iOS Safari reports HEIC as `image/heic`; some browsers may report `image/heif` or fail to report MIME type at all
   - What's unclear: Edge cases where MIME type is missing (files with no extension, renamed files)
   - Recommendation: Check MIME type AND file extension (`.heic`, `.heif`); if either matches, convert. Implement as a pre-validation step in `validateAndAddFiles`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `sharp` (npm) | Server image preprocessing | Already installed | ^0.34.5 | — |
| `tesseract.js` | Page number detection, OCR fallback | Already installed | ^7.0.0 | — |
| `openai` SDK | GPT-4o vision, gpt-parser | Already installed | ^6.32.0 | — |
| `officeparser` | XLSX/PPTX extraction | Not installed | 6.0.0 (latest) | None — required |
| `tus-js-client` | INFRA-01 resumable upload | Not installed | 4.3.1 (latest) | None — required |
| `heic2any` | iOS HEIC conversion | Not installed | ^0.0.4 | `heic-to` as alternative |
| Supabase Storage TUS endpoint | INFRA-01 | Available (Supabase Pro includes TUS) | — | — |
| Canvas API | Client blur detection | Browser native | — | — |

**Missing dependencies with no fallback:**
- `officeparser` — required for FILE-04 and FILE-05
- `tus-js-client` — required for INFRA-01

**Missing dependencies with fallback:**
- `heic2any` — `heic-to` is a compatible alternative

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright 1.58.2 |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test --project=integration` |
| Full suite command | `npx playwright test` |
| Phase 5 test file pattern | Requires new Playwright project `phase5-stubs` (consistent with phase2-stubs, phase3-stubs pattern) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FILE-01 | Image uploaded → OCR text extracted → SOP draft created | integration | `npx playwright test --project=phase5-stubs -g "FILE-01"` | No — Wave 0 |
| FILE-02 | Blurry image shows quality warning; admin can proceed | integration (UI) | `npx playwright test --project=phase5-stubs -g "FILE-02"` | No — Wave 0 |
| FILE-03 | Multi-page scan: capture 2 pages, reorder, submit → combined SOP | integration (UI) | `npx playwright test --project=phase5-stubs -g "FILE-03"` | No — Wave 0 |
| FILE-04 | XLSX uploaded → content extracted → SOP draft | integration | `npx playwright test --project=phase5-stubs -g "FILE-04"` | No — Wave 0 |
| FILE-05 | PPTX uploaded → content extracted → SOP draft | integration | `npx playwright test --project=phase5-stubs -g "FILE-05"` | No — Wave 0 |
| FILE-06 | TXT uploaded → structured SOP draft | integration | `npx playwright test --project=phase5-stubs -g "FILE-06"` | No — Wave 0 |
| FILE-07 | Tables from XLSX/PPTX appear as rendered table in SOP worker view | integration (UI) | `npx playwright test --project=phase5-stubs -g "FILE-07"` | No — Wave 0 |
| FILE-08 | Format-specific prompt applied (xlsx/pptx/txt/image paths) | unit (parser) | `npx playwright test --project=phase5-stubs -g "FILE-08"` | No — Wave 0 |
| INFRA-01 | TUS upload completes and triggers parse pipeline | integration | `npx playwright test --project=phase5-stubs -g "INFRA-01"` | No — Wave 0 |
| INFRA-02 | All new file types appear in admin review UI after parse | integration | `npx playwright test --project=phase5-stubs -g "INFRA-02"` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `npx playwright test --project=phase5-stubs` (stubs only — fast)
- **Per wave merge:** `npx playwright test` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/phase5-stubs.spec.ts` — stub tests for FILE-01 through INFRA-02
- [ ] `playwright.config.ts` — add `phase5-stubs` project (filename regex matching `phase5-stubs`)
- [ ] `npm install officeparser tus-js-client heic2any` — install new dependencies

---

## Sources

### Primary (HIGH confidence)

- Existing codebase: `src/lib/parsers/extract-docx.ts`, `src/app/api/sops/parse/route.ts`, `src/components/admin/UploadDropzone.tsx`, `src/lib/validators/sop.ts`, `src/actions/sops.ts` — implementation patterns confirmed by reading source
- `supabase/migrations/00004_parse_jobs.sql` — confirmed existing `file_type` check constraint values
- `.planning/research/STACK.md` (2026-03-29) — officeparser v6 recommendation, TUS recommendation
- `.planning/research/ARCHITECTURE.md` (2026-03-29) — TUS pattern, parse route extension, `input_type` column, extractor file structure
- `.planning/research/PITFALLS.md` (2026-03-29) — Pitfall 16 (OCR quality), Pitfall 17 (macro files), Pitfall 9 (4.5 MB Vercel limit)
- Supabase Storage TUS documentation (fetched 2026-03-29) — exact endpoint URL, 6 MB chunk requirement, auth header format
- [officeparser GitHub](https://github.com/harshankur/officeParser) — v6.0.0 confirmed, AST API confirmed

### Secondary (MEDIUM confidence)

- [officeparser npm](https://www.npmjs.com/package/officeparser) — version 6.0.0+ confirmed on npm registry
- [tus-js-client npm](https://www.npmjs.com/package/tus-js-client) — version 4.3.1 confirmed on npm registry
- [Laplacian variance blur detection](https://medium.com/revolut/canvas-based-javascript-blur-detection-b92ab1075acf) — Canvas API approach verified by multiple sources
- [heic2any npm](https://www.npmjs.com/package/heic2any) — client-side HEIC conversion, browser compatible
- OpenAI GPT-4o vision API documentation — `image_url` content type, base64 input, `detail: 'high'` parameter

### Tertiary (LOW confidence)

- officeparser v6 exact AST node property names for table rows/cells — not directly verified (README not accessible via WebFetch in this session). Recommend runtime inspection in Wave 0.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — library choices confirmed against npm registry, project research artifacts, and existing codebase
- Architecture: HIGH — patterns directly extrapolated from existing code (extract-docx.ts, parse route, upload dropzone); integration points confirmed by reading source files
- Pitfalls: HIGH — pitfalls 1, 2, 7, 8 directly verified from codebase inspection; pitfalls 3, 4, 5, 6 from project PITFALLS.md and official Supabase docs
- TUS integration: HIGH — endpoint URL, chunk size, auth headers confirmed from Supabase Storage docs
- officeparser AST table properties: LOW — exact field names not confirmed; requires Wave 0 verification

**Research date:** 2026-03-29
**Valid until:** 2026-04-29 (officeparser and tus-js-client are stable; Supabase TUS API is stable; reassess if new officeparser major version releases)
