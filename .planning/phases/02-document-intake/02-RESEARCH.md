# Phase 2: Document Intake - Research

**Researched:** 2026-03-24
**Domain:** Document upload pipeline, async job queues, GPT-4o structured outputs, admin review UI
**Confidence:** HIGH (core patterns verified via official docs and codebase inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Three upload methods: drag-and-drop zone, file browser button, AND camera capture for photographing individual pages
- **D-02:** Batch upload supported — admin can upload multiple files at once, they queue for parsing, admin reviews each one individually
- **D-03:** 50MB file size limit per upload
- **D-04:** Progress indicator during parsing with relaxed NZ-flavoured messaging: "Grab a hot drink or take a smoko while we process your SOPs — we'll notify you when they're ready"
- **D-05:** Parsing runs in background (async) — admin gets in-app notification when parsing completes
- **D-06:** Upload accepts .docx, .pdf, and image files (jpg, png) for photographed pages
- **D-07:** GPT-4o with structured outputs for parsing — research-verified 100% schema reliability
- **D-08:** Best-effort OCR for scanned PDFs and photographed pages — try OCR if text extraction fails, but don't guarantee quality. Flag low-quality OCR results for admin attention
- **D-09:** ALL sections are extracted — AI identifies every section present in the document (not locked to a fixed set)
- **D-10:** Every parsed SOP requires full admin review before publishing — no auto-publish regardless of confidence level
- **D-11:** Text extraction via mammoth (.docx) + unpdf (.pdf) feeding into GPT-4o structured output
- **D-12:** Image extraction — pull embedded images from documents and associate them with the step/section they belong to
- **D-13:** Side-by-side layout — original document on the left, parsed structured output on the right
- **D-14:** Inline editing — click any section to edit text directly in place (no modals)
- **D-15:** Section-by-section approval — admin must approve each section individually, then publish the whole SOP
- **D-16:** Reparse option available — admin can click "Re-parse" to run AI again on the same document
- **D-17:** Delete and re-upload also available — admin can discard a draft and start over
- **D-18:** All parsed SOPs start in "draft" state — only move to "published" after all sections approved
- **D-19:** Fully flexible section types — AI detects whatever sections the document has and labels them
- **D-20:** Rich steps — each step has: text, optional images, optional warnings/cautions, optional tips, optional required tools, optional time estimates
- **D-21:** Images extracted and displayed inline — stored in Supabase Storage, displayed within the step/section they belong to
- **D-22:** Extended metadata per SOP: title, SOP number, revision date, author, category/department, related SOPs, applicable equipment, required certifications

### Claude's Discretion

- Exact Zod schema structure for SOP parsing response
- Database schema design for normalised SOP data model (sops, sop_sections, sop_steps, sop_images)
- Async job queue implementation details (parse_jobs table vs Edge Functions)
- Side-by-side UI layout details (scroll sync, responsive breakpoints)
- Inline editor component choice
- Notification mechanism for parse completion (polling vs Supabase Realtime)
- OCR library/service selection for scanned documents

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PARSE-01 | Admin can upload SOP documents in Word (.docx) format | mammoth library extracts text + images from .docx; upload via presigned URL flow to Supabase Storage |
| PARSE-02 | Admin can upload SOP documents in PDF format | unpdf extracts text from PDF; image extraction requires official pdfjs build + @napi-rs/canvas |
| PARSE-03 | AI automatically parses uploaded documents into structured sections | GPT-4o with zodResponseFormat (openai SDK 6.7.0+ supports Zod v4); flexible section detection via schema |
| PARSE-04 | AI extracts embedded images and figures from uploaded documents | mammoth convertImage callback yields base64; unpdf extractImages per page; images stored in Supabase Storage |
| PARSE-05 | Admin can review parsed SOP alongside original document before publishing | Side-by-side review UI; original doc iframe/viewer left, structured output right |
| PARSE-06 | Admin can edit/correct parsed sections before publishing | Inline editing via contentEditable or textarea toggling per section; no modals required |
| PARSE-07 | Parsed SOPs remain in draft state until admin explicitly publishes them | parse_jobs + sops status FSM: uploading → parsing → draft → published |
</phase_requirements>

---

## Summary

Phase 2 builds three connected systems: a file upload pipeline (Supabase Storage with presigned URLs), an async parsing pipeline (parse_jobs table + Next.js Route Handler processor + GPT-4o), and an admin review UI (side-by-side diff view with inline editing and section approval). All three are buildable on the Phase 1 foundation — the RLS patterns, server action conventions, Zod schema approach, and Supabase client setup are directly reusable.

The most technically significant decisions in this phase are: (1) the job queue mechanism — a `parse_jobs` table polled by a Route Handler is simpler to implement than Supabase Edge Functions and avoids Deno runtime compatibility issues with mammoth/unpdf; (2) Zod v4 compatibility with OpenAI — confirmed working with openai SDK 6.7.0+, but zodResponseFormat requires wrapping in `z.object()` not bare arrays; (3) mammoth MUST use `--webpack` build (not Turbopack) due to a known Next.js issue — this is already addressed in STATE.md; (4) PDF image extraction requires the full pdfjs build with `@napi-rs/canvas`, which is heavy — a simpler approach is to skip PDF image extraction on first pass and let admins upload images separately if needed.

**Primary recommendation:** Implement the job queue as a `parse_jobs` Postgres table with a Next.js API Route Handler that processes one job per invocation, triggered by the client after upload and notified via Supabase Realtime subscription. This avoids Edge Function Deno runtime complexity while keeping the architecture simple and testable.

---

## Standard Stack

### Core (additions to Phase 1 stack)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| openai | 6.32.0 | GPT-4o structured outputs for parsing | Official SDK; 6.7.0+ confirmed Zod v4 compatible; zodResponseFormat helper handles schema conversion automatically |
| mammoth | 1.12.0 | .docx text + image extraction | Best Node.js .docx parser; extracts embedded images as base64 via convertImage callback; TypeScript types included |
| unpdf | 1.4.0 | PDF text extraction | Modern, Edge+Node compatible replacement for pdf-parse; mergePages option for full-doc text |
| @tanstack/react-query | 5.95.0 | Polling parse job status on admin UI | Already in stack research; useQuery with refetchInterval for job polling |
| sharp | 0.34.5 | Resize extracted images before Storage upload | Already in stack research; required for image size management |

### Supporting (for OCR fallback)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tesseract.js | 5.x | OCR on scanned PDFs and photographed pages | Only when unpdf/mammoth text extraction yields <50 characters — best-effort fallback; flag result confidence as LOW |

### Packages NOT yet installed (need adding)

```bash
npm install openai mammoth unpdf sharp @tanstack/react-query tesseract.js
npm install -D @types/mammoth
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| parse_jobs table (poll) | Supabase Edge Function + pg_cron | Edge Functions run Deno — mammoth and unpdf are Node.js libraries; would require rewriting the extraction layer or using fetch-based alternatives. Avoid for v1. |
| parse_jobs table (poll) | BullMQ on Vercel | Needs Redis; adds infra cost and operational complexity. No benefit at v1 scale (< 50 parse jobs/day). |
| Supabase Realtime for completion notification | Client polling (setInterval) | Realtime is cleaner UX and already available via Supabase SDK. Use Realtime; fall back to 5s polling if channel fails. |
| tesseract.js (server-side) | Google Vision API / AWS Textract | Cloud APIs are higher quality but add per-call cost and external dependency. tesseract.js is free and sufficient for "best effort" quality requirement. |
| zodResponseFormat | z.toJSONSchema() manually | zodResponseFormat is cleaner and handles schema name wrapping automatically. Use zodResponseFormat — it works with Zod v4 as of openai 6.7.0. |

---

## Architecture Patterns

### Recommended Project Structure (Phase 2 additions)

```
src/
├── app/
│   ├── (protected)/
│   │   └── admin/
│   │       └── sops/
│   │           ├── page.tsx              # SOP list for admin
│   │           ├── upload/
│   │           │   └── page.tsx          # Upload dropzone UI
│   │           └── [sopId]/
│   │               └── review/
│   │                   └── page.tsx      # Side-by-side review UI
│   └── api/
│       └── sops/
│           ├── upload/
│           │   └── route.ts              # Create presigned URL + parse_jobs row
│           ├── parse/
│           │   └── route.ts              # Job processor (called after upload)
│           └── [sopId]/
│               ├── route.ts              # GET/PATCH sop record
│               ├── sections/
│               │   └── [sectionId]/
│               │       └── route.ts      # PATCH section content + approval
│               └── publish/
│                   └── route.ts          # POST → draft → published transition
├── actions/
│   └── sops.ts                           # Server actions: createUploadUrl, approveSop, etc.
├── components/
│   └── admin/
│       ├── UploadDropzone.tsx            # Drag-drop + file picker + camera
│       ├── ParseJobStatus.tsx            # Realtime job status card (smoko messaging)
│       ├── SopReviewLayout.tsx           # Side-by-side parent layout
│       ├── OriginalDocViewer.tsx         # Left: iframe/image viewer of source doc
│       ├── ParsedSopEditor.tsx           # Right: section list with approve/edit
│       └── SectionEditor.tsx             # Inline edit + approve per section
├── lib/
│   ├── parsers/
│   │   ├── extract-docx.ts              # mammoth text + image extraction
│   │   ├── extract-pdf.ts               # unpdf text extraction
│   │   ├── ocr-fallback.ts              # tesseract.js best-effort OCR
│   │   └── gpt-parser.ts               # GPT-4o structured output call
│   └── validators/
│       └── sop.ts                        # Zod schema for SOP parse output
├── types/
│   └── sop.ts                            # SOP, SopSection, SopStep, SopImage types
└── supabase/
    └── migrations/
        ├── 00003_sop_schema.sql           # sops, sop_sections, sop_steps, sop_images
        ├── 00004_parse_jobs.sql           # parse_jobs table + indexes
        └── 00005_sop_rls.sql              # RLS policies for all new tables
```

### Pattern 1: Presigned URL Upload Flow

**What:** Client never sends file bytes through the Next.js API. Instead: server action creates a presigned upload URL → client uploads directly to Supabase Storage → server action records the job.

**Why:** Next.js server actions have a 1MB body limit by default. The 50MB file limit requires direct-to-storage upload.

**Example:**
```typescript
// src/actions/sops.ts
'use server'
export async function createUploadSession(files: { name: string; size: number; type: string }[]) {
  // Validate: max 50MB, accepted types only
  // Create sop records (status: 'uploading')
  // Create parse_jobs rows (status: 'queued')
  const admin = createAdminClient()
  const sessions = await Promise.all(files.map(async (file) => {
    const path = `${organisationId}/${sopId}/${file.name}`
    const { data } = await admin.storage.from('sop-documents').createSignedUploadUrl(path)
    return { sopId, uploadUrl: data.signedUrl, token: data.token, path }
  }))
  return sessions
}

// Client: upload directly to Storage using the token
await supabase.storage.from('sop-documents').uploadToSignedUrl(path, token, fileBuffer)
// Then call triggerParse(sopId) server action
```

**Confidence:** HIGH — verified against Supabase JS docs and community examples

### Pattern 2: parse_jobs Table FSM

**What:** A Postgres table tracks each parse job through states. The client triggers parsing after upload; a Route Handler processes it asynchronously. Supabase Realtime notifies the admin UI when status changes.

**States:**
```
queued → processing → completed
                   → failed (with error_message, retry_count)
```

**Schema:**
```sql
create table public.parse_jobs (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  sop_id          uuid not null references public.sops(id) on delete cascade,
  status          text not null default 'queued'
                  check (status in ('queued', 'processing', 'completed', 'failed')),
  file_path       text not null,          -- Supabase Storage path
  file_type       text not null,          -- 'docx' | 'pdf' | 'image'
  error_message   text,
  retry_count     int not null default 0,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now()
);
```

**Realtime subscription (admin UI):**
```typescript
// src/components/admin/ParseJobStatus.tsx
useEffect(() => {
  const channel = supabase
    .channel(`parse-job-${jobId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'parse_jobs',
      filter: `id=eq.${jobId}`,
    }, (payload) => {
      setJobStatus(payload.new.status)
    })
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}, [jobId])
```

**Confidence:** HIGH — Supabase Realtime filter syntax verified

### Pattern 3: GPT-4o Structured Output with Zod v4

**What:** Zod v4 schema defines the SOP structure. `zodResponseFormat` from the openai SDK converts it to JSON Schema for the API call. The response is automatically parsed and typed.

**Critical dependency:** openai SDK must be 6.7.0+ for Zod v4 compatibility. The project specifies `openai@6.32.0` in STACK.md — confirmed compatible.

**Example:**
```typescript
// src/lib/validators/sop.ts
import { z } from 'zod'

export const SopStepSchema = z.object({
  order: z.number().int(),
  text: z.string(),
  warning: z.string().optional(),
  caution: z.string().optional(),
  tip: z.string().optional(),
  required_tools: z.array(z.string()).optional(),
  time_estimate_minutes: z.number().optional(),
  has_image: z.boolean(), // flag; actual image stored separately
})

export const SopSectionSchema = z.object({
  order: z.number().int(),
  type: z.string(),           // AI-detected: "Hazards", "PPE", "Steps", etc.
  title: z.string(),
  content: z.string().optional(),   // for non-step sections (narrative text)
  steps: z.array(SopStepSchema).optional(),
  confidence: z.number().min(0).max(1),
})

export const ParsedSopSchema = z.object({
  title: z.string(),
  sop_number: z.string().optional(),
  revision_date: z.string().optional(),
  author: z.string().optional(),
  category: z.string().optional(),
  related_sops: z.array(z.string()).optional(),
  applicable_equipment: z.array(z.string()).optional(),
  required_certifications: z.array(z.string()).optional(),
  sections: z.array(SopSectionSchema),
  overall_confidence: z.number().min(0).max(1),
  parse_notes: z.string().optional(), // AI notes on quality issues
})

export type ParsedSop = z.infer<typeof ParsedSopSchema>
```

```typescript
// src/lib/parsers/gpt-parser.ts
import OpenAI from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'
import { ParsedSopSchema } from '@/lib/validators/sop'

const openai = new OpenAI()

export async function parseSopWithGPT(extractedText: string): Promise<ParsedSop> {
  const completion = await openai.beta.chat.completions.parse({
    model: 'gpt-4o-2024-08-06',
    messages: [
      {
        role: 'system',
        content: `You are an expert at parsing Standard Operating Procedure (SOP) documents.
Extract ALL sections present in the document. Detect section types from their headings and content.
Common section types include: Hazards, PPE, Steps/Procedure, Emergency Procedures, Scope, Training,
Maintenance, References, Competency Assessment — but include any section the document contains.
Assign confidence scores: 1.0 = very clean extraction, 0.0 = likely OCR errors or ambiguous structure.
Flag parse_notes if the source document quality is poor.`,
      },
      {
        role: 'user',
        content: `Parse this SOP document:\n\n${extractedText}`,
      },
    ],
    response_format: zodResponseFormat(ParsedSopSchema, 'parsed_sop'),
  })
  return completion.choices[0].message.parsed!
}
```

**Confidence:** HIGH — zodResponseFormat with Zod v4 confirmed working in openai 6.7.0+ (community thread verified)

### Pattern 4: mammoth Image Extraction

**What:** mammoth's `convertImage` callback intercepts each embedded image during HTML conversion, yielding base64 data that can be uploaded to Supabase Storage.

**Critical note:** mammoth FAILS with Turbopack. Build with `next build --webpack`. This is already handled in STATE.md (`next build --webpack` is in the build script).

**Example:**
```typescript
// src/lib/parsers/extract-docx.ts
import mammoth from 'mammoth'

interface ExtractedImage {
  base64: string
  contentType: string
  index: number
}

export async function extractDocx(buffer: ArrayBuffer) {
  const images: ExtractedImage[] = []
  let imageIndex = 0

  const result = await mammoth.convertToHtml(
    { arrayBuffer: buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const base64 = await image.read('base64')
        images.push({ base64, contentType: image.contentType, index: imageIndex++ })
        // Return a placeholder src — we'll replace with Storage URL after upload
        return { src: `__IMAGE_${imageIndex - 1}__` }
      }),
    }
  )

  return {
    html: result.value,
    text: result.value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
    images,
    warnings: result.messages,
  }
}
```

**Confidence:** HIGH — verified against mammoth README; base64 extraction is the documented pattern

### Pattern 5: Section-by-Section Approval FSM

**What:** Each `sop_section` has an `approved` boolean. An SOP can only be published when all sections are approved. The UI enforces this — publish button is disabled until all sections have been explicitly approved.

**State logic:**
```
SOP status: 'draft' (all sections unapproved initially)
Each section: approved = false initially
Admin approves section → section.approved = true
All sections approved → publish button enabled
Admin clicks publish → sop.status = 'published', sop.published_at = now()
```

**Server action:**
```typescript
// src/actions/sops.ts
export async function approveSection(sectionId: string) {
  const supabase = await createClient()
  await supabase.from('sop_sections').update({ approved: true }).eq('id', sectionId)
  // Check if all sections are now approved → enable publish button (client-side check)
}

export async function publishSop(sopId: string) {
  const supabase = await createClient()
  // Verify all sections approved server-side
  const { count } = await supabase
    .from('sop_sections')
    .select('*', { count: 'exact', head: true })
    .eq('sop_id', sopId)
    .eq('approved', false)
  if (count && count > 0) return { error: 'All sections must be approved before publishing' }
  await supabase.from('sops').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', sopId)
  return { success: true }
}
```

### Anti-Patterns to Avoid

- **Synchronous parsing in the request cycle:** LLM calls take 30–120s. Vercel Hobby = 10s timeout, Pro = 60s. Always async. Use parse_jobs table + separate Route Handler invocation.
- **Auto-publish on high confidence:** Decision D-10 locks this. No confidence threshold bypasses admin review.
- **Storing extracted images as base64 in Postgres:** Store in Supabase Storage, save only the Storage path/URL. Base64 in DB bloats rows and breaks query performance.
- **Using Turbopack with mammoth:** Known incompatibility. `next build --webpack` is required (already set).
- **Requesting raw file bytes through a server action:** Default body limit is 1MB. Use presigned URL pattern.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON Schema from Zod | Custom schema converter | `zodResponseFormat` from `openai/helpers/zod` | Handles null handling, $ref flattening, additionalProperties — OpenAI has specific requirements that are easy to get wrong |
| .docx text extraction | Custom XML parser | `mammoth` | DOCX is a zip of XML + assets; mammoth handles the full spec including styles, tables, nested lists |
| PDF text extraction | Custom pdfjs integration | `unpdf` | unpdf wraps pdfjs correctly for serverless; raw pdfjs is 3MB, complex API |
| OCR for images | Custom canvas analysis | `tesseract.js` | 100+ language neural OCR engine; pure JS |
| Direct file upload | Pipe bytes through server action | Supabase Storage presigned URLs | Avoids body size limits; uploads directly to S3-backed storage |
| Realtime job status | WebSocket server | Supabase Realtime postgres_changes | Built-in; handles auth, reconnection, channel cleanup |

**Key insight:** The document extraction + AI parsing stack is a solved problem with well-maintained libraries. Custom solutions for any part of this pipeline add weeks of work to handle edge cases (embedded tables, multi-column PDFs, special characters in Word) that the libraries already handle.

---

## Common Pitfalls

### Pitfall 1: mammoth + Turbopack Incompatibility
**What goes wrong:** `next dev` works fine (Turbopack default in Next.js 16) but the Route Handler that calls mammoth throws "uncompressed data size mismatch" or silently fails.
**Why it happens:** Turbopack handles WASM/binary differently from webpack; mammoth uses a native zip parser that conflicts.
**How to avoid:** Ensure `package.json` build script uses `next build --webpack`. Already done per STATE.md. Also add `next dev --webpack` to the dev script for consistency.
**Warning signs:** mammoth works in test scripts but fails when called from a Route Handler during dev.

### Pitfall 2: OpenAI Structured Output Schema Violations
**What goes wrong:** GPT-4o returns an error: "Invalid schema for response_format" or silently falls back to unstructured JSON.
**Why it happens:** OpenAI structured outputs have strict schema requirements: all properties must be required OR use strict mode with `z.optional()` correctly handled, no `$ref` in the final schema, schema must be a JSON object at top level (not array), `additionalProperties: false` required.
**How to avoid:** Use `zodResponseFormat` from `openai/helpers/zod` — it handles these transformations. Never pass `z.toJSONSchema()` output directly; it may include `$ref` for reused schemas.
**Warning signs:** Any non-object at the top level of the schema; `z.array()` used as the root type.

### Pitfall 3: parse_jobs Table Not in Supabase Realtime Publication
**What goes wrong:** Admin UI subscribes to `parse_jobs` changes, but no events arrive — job completes but the UI stays stuck on "parsing..."
**Why it happens:** Supabase Realtime requires tables to be added to the `supabase_realtime` publication. This is NOT automatic.
**How to avoid:** Add to migration: `alter publication supabase_realtime add table public.parse_jobs;`
**Warning signs:** Subscription channel connects without error but no events fire; `status` updates in DB are confirmed but not received by client.

### Pitfall 4: Presigned Upload URL Expiry
**What goes wrong:** Admin selects files, gets distracted for 2 hours, then uploads — Supabase returns 400 on the upload attempt. The file never reaches Storage. No parse job is created. Admin has no feedback.
**Why it happens:** Supabase signed upload URLs expire after exactly 2 hours (not configurable).
**How to avoid:** Create the presigned URL as late as possible — immediately before initiating the client-side upload, not when the file is selected. Show a clear error on 400 with "Please re-select your file to generate a new upload link."
**Warning signs:** URL creation and upload happen in separate user interactions with potential long delay between.

### Pitfall 5: PDF Image Extraction Weight
**What goes wrong:** `extractImages` from unpdf requires `@napi-rs/canvas` and the full pdfjs build. Installing these adds ~50MB to the production bundle and may fail on Vercel's lambda size limits.
**Why it happens:** PDF image extraction is computationally expensive and requires native bindings.
**How to avoid:** For v1, skip PDF image extraction from source documents. The GPT-4o parser can still describe where images should appear. Admins can manually attach images during the review step. Flag in the review UI: "Image extraction from PDF is not available — please add images manually." Only .docx and photo uploads support automatic image extraction.
**Warning signs:** `npm install @napi-rs/canvas` fails or produces warnings about native bindings on the deployment platform.

### Pitfall 6: Vercel Serverless Function Timeout on Parse
**What goes wrong:** A large, complex SOP (50MB, 100+ pages) takes >60 seconds to parse. The Vercel function times out. The parse job is left in `processing` status with no cleanup.
**Why it happens:** Vercel Pro = 60s default; Hobby = 10s. GPT-4o parsing can take 30–120s.
**How to avoid:** Add `export const maxDuration = 300` to the parse Route Handler (requires Vercel Pro). For Hobby/free tier: break large documents into chunks, parse in sections, reassemble. Add a job timeout guard: if `started_at` is >5 minutes ago and status is still `processing`, mark as `failed` with message "Parsing timed out — please re-parse."
**Warning signs:** Parse jobs stuck in `processing` state; no error message.

### Pitfall 7: RLS Blocks Service Role Client on Storage
**What goes wrong:** The parse Route Handler uses `createAdminClient()` (service role) to read the uploaded file from Supabase Storage, but the storage RLS policy requires the file path to match the current user's org — which is not set in service role context.
**Why it happens:** Service role bypasses RLS on Postgres tables, but Supabase Storage has its own access control layer that does NOT automatically grant service role unrestricted access via the JS client's storage API.
**How to avoid:** The service role client DOES bypass storage RLS. Confirm by using `createAdminClient()` in the parse route — it will work. The parse route should always use the admin client, never the session client, since it runs in a background context without a user session.
**Warning signs:** 400/403 errors in the parse Route Handler when calling `admin.storage.from(...).download(path)`.

---

## Code Examples

Verified patterns from official sources and codebase conventions:

### Supabase Storage: Presigned Upload URL
```typescript
// Source: Supabase JS docs + community examples
const admin = createAdminClient()
const path = `${organisationId}/${sopId}/original/${fileName}`
const { data, error } = await admin.storage
  .from('sop-documents')
  .createSignedUploadUrl(path, { upsert: false })

// Returns: { signedUrl: string, token: string, path: string }
// Client uploads directly:
const { error: uploadError } = await supabase.storage
  .from('sop-documents')
  .uploadToSignedUrl(data.path, data.token, fileBuffer, {
    contentType: file.type
  })
```

### Supabase Storage: Org-Scoped RLS Policy
```sql
-- Source: Supabase storage access control docs
-- File path convention: {organisation_id}/{sop_id}/original/{filename}
create policy "org_members_can_view_sop_docs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'sop-documents'
    and (storage.foldername(name))[1] = public.current_organisation_id()::text
  );

create policy "admins_can_upload_sop_docs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'sop-documents'
    and (storage.foldername(name))[1] = public.current_organisation_id()::text
    and public.current_user_role() in ('admin', 'safety_manager')
  );
```

### Realtime: Listen to Parse Job Completion
```typescript
// Source: Supabase Realtime postgres_changes docs
// Note: parse_jobs table MUST be added to supabase_realtime publication in migration
const channel = supabase
  .channel(`parse-job-${jobId}`)
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'parse_jobs',
      filter: `id=eq.${jobId}`,
    },
    (payload) => {
      const job = payload.new as ParseJob
      if (job.status === 'completed') onComplete(job.sop_id)
      if (job.status === 'failed') onError(job.error_message)
    }
  )
  .subscribe()
```

### GPT-4o: Structured Output with Zod v4
```typescript
// Source: OpenAI SDK docs + community confirmed working pattern (openai 6.7.0+)
import { zodResponseFormat } from 'openai/helpers/zod'
import { ParsedSopSchema } from '@/lib/validators/sop'

const completion = await openai.beta.chat.completions.parse({
  model: 'gpt-4o-2024-08-06',
  messages: [{ role: 'user', content: text }],
  response_format: zodResponseFormat(ParsedSopSchema, 'parsed_sop'),
})
const parsed = completion.choices[0].message.parsed
// parsed is fully typed as z.infer<typeof ParsedSopSchema>
```

### mammoth: Text + Image Extraction
```typescript
// Source: mammoth README
import mammoth from 'mammoth'
const result = await mammoth.convertToHtml(
  { arrayBuffer: buffer },
  { convertImage: mammoth.images.imgElement(async (image) => {
      const b64 = await image.read('base64')
      // Store to Supabase Storage, return Storage URL
      return { src: await uploadImageToStorage(b64, image.contentType) }
  })}
)
// result.value = HTML with Storage URLs for images
// result.messages = warnings about conversion quality
```

### unpdf: PDF Text Extraction
```typescript
// Source: unpdf README
import { extractText, getDocumentProxy } from 'unpdf'
const buffer = await storageFile.arrayBuffer()
const pdf = await getDocumentProxy(new Uint8Array(buffer))
const { totalPages, text } = await extractText(pdf, { mergePages: true })
// text = full document as single string
```

### Server Action Pattern (reusing Phase 1 convention)
```typescript
// src/actions/sops.ts — follows same pattern as src/actions/auth.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { uploadSessionSchema } from '@/lib/validators/sop'

export async function createUploadSession(formData: { files: FileInfo[] }) {
  const result = uploadSessionSchema.safeParse(formData)
  if (!result.success) return { error: result.error.issues[0]?.message }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // ... create sop rows, presigned URLs, parse_jobs rows
  return { sessions }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pdf-parse` for PDF text | `unpdf` | 2023 | unpdf works in Edge + Node; pdf-parse is Node.js only and unmaintained |
| Manual JSON Schema for OpenAI | `zodResponseFormat` helper | 2024 | zodResponseFormat auto-handles schema constraints; simpler code |
| `zod-to-json-schema` package | `zodResponseFormat` or `z.toJSONSchema()` | 2025 | zod-to-json-schema maintenance ended; Zod v4 has native JSON Schema; openai SDK handles conversion internally |
| Edge Functions for background jobs | parse_jobs table + Route Handler | Project decision | Deno runtime incompatibility with mammoth/unpdf; table-based queue is simpler and testable |

**Deprecated/outdated:**
- `pdf-parse`: unmaintained, Node.js-only. Use `unpdf`.
- `zod-to-json-schema`: maintenance ended November 2025. Use `zodResponseFormat` from openai SDK or `z.toJSONSchema()` natively in Zod v4.
- `shadowwalker/next-pwa`: abandoned. Project already uses `@serwist/next`.
- Turbopack with mammoth: known incompatibility. Build with `--webpack` (already configured).

---

## Open Questions

1. **PDF image extraction for v1**
   - What we know: `unpdf`'s `extractImages` requires `@napi-rs/canvas` + full pdfjs build, which may hit Vercel bundle size limits
   - What's unclear: Whether the bundle impact is acceptable on the chosen Vercel plan
   - Recommendation: Skip PDF image extraction for v1 — use mammoth image extraction for .docx, show "Add images manually" notice for PDFs. Revisit in v2.

2. **Parse Route Handler timeout tier**
   - What we know: Vercel Hobby = 10s max, Pro = 60s, Fluid Compute = up to 800s
   - What's unclear: Which Vercel plan this project targets
   - Recommendation: Plan for Vercel Pro (60s) as baseline. Add `export const maxDuration = 60` to the parse Route Handler. For documents that exceed this, split into chunks server-side and parse in two passes (metadata + structure first, then step content). Add a retry mechanism with `retry_count` in parse_jobs.

3. **Inline editor component choice (Claude's Discretion)**
   - What we know: Requirement is inline editing, no modals
   - Recommendation: Use native HTML `contentEditable` with `onBlur` save for simplicity — no extra library. For multi-line step text, toggle between `<p contentEditable>` display mode and `<textarea>` edit mode. This avoids adding a rich-text editor dependency for what is essentially plain-text editing.

4. **Original document viewer on left side**
   - What we know: Side-by-side layout, original on left
   - Recommendation: For .docx, render the mammoth-extracted HTML in a styled `<div>` (not an `<iframe>`); for PDF, use a Supabase Storage signed URL in an `<iframe>` pointing to the raw PDF. For uploaded images (photos), use a simple `<img>` with pan/zoom. No PDF.js viewer needed in the UI — the browser's built-in PDF renderer handles it.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright 1.58.2 |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test --project=integration tests/sop-intake.test.ts` |
| Full suite command | `npx playwright test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PARSE-01 | Admin can upload .docx and see parse job created | integration | `npx playwright test tests/sop-intake.test.ts --grep "docx upload"` | Wave 0 |
| PARSE-02 | Admin can upload PDF and see parse job created | integration | `npx playwright test tests/sop-intake.test.ts --grep "pdf upload"` | Wave 0 |
| PARSE-03 | Uploaded doc produces structured sections in DB | integration | `npx playwright test tests/sop-parsing.test.ts --grep "structured sections"` | Wave 0 |
| PARSE-04 | Embedded images extracted and stored in Storage | integration | `npx playwright test tests/sop-parsing.test.ts --grep "image extraction"` | Wave 0 |
| PARSE-05 | Review UI shows original doc alongside parsed output | e2e | `npx playwright test tests/sop-review.test.ts --grep "side-by-side"` | Wave 0 |
| PARSE-06 | Admin can edit section text inline and it persists | e2e | `npx playwright test tests/sop-review.test.ts --grep "inline edit"` | Wave 0 |
| PARSE-07 | SOP stays draft until all sections approved then publish | integration | `npx playwright test tests/sop-review.test.ts --grep "publish workflow"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx playwright test tests/sop-intake.test.ts -x` (fast path, upload only)
- **Per wave merge:** `npx playwright test --project=integration`
- **Phase gate:** Full suite green (`npx playwright test`) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/sop-intake.test.ts` — covers PARSE-01, PARSE-02 (upload flows)
- [ ] `tests/sop-parsing.test.ts` — covers PARSE-03, PARSE-04 (parsing pipeline)
- [ ] `tests/sop-review.test.ts` — covers PARSE-05, PARSE-06, PARSE-07 (review UI)
- [ ] Test fixtures: pre-parsed SOP seed data for review UI tests (to avoid GPT-4o API calls in CI)

---

## Database Schema (Recommended)

```sql
-- Migration: 00003_sop_schema.sql

create type public.sop_status as enum ('uploading', 'parsing', 'draft', 'published', 'archived');

create table public.sops (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  status          public.sop_status not null default 'uploading',
  -- Metadata (D-22)
  title           text,
  sop_number      text,
  revision_date   text,
  author          text,
  category        text,
  related_sops    text[] default '{}',
  applicable_equipment text[] default '{}',
  required_certifications text[] default '{}',
  -- Storage
  original_file_path text,          -- Supabase Storage path of original document
  file_type       text,              -- 'docx' | 'pdf' | 'image'
  -- Timestamps
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.sop_sections (
  id              uuid primary key default gen_random_uuid(),
  sop_id          uuid not null references public.sops(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  order_index     int not null,
  type            text not null,     -- AI-detected type: 'Hazards', 'PPE', 'Steps', etc.
  title           text not null,
  content         text,              -- narrative text for non-step sections
  confidence      numeric(3,2) default 1.0,
  approved        boolean not null default false,
  created_at      timestamptz not null default now()
);

create table public.sop_steps (
  id              uuid primary key default gen_random_uuid(),
  section_id      uuid not null references public.sop_sections(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  order_index     int not null,
  text            text not null,
  warning         text,
  caution         text,
  tip             text,
  required_tools  text[] default '{}',
  time_estimate_minutes int,
  created_at      timestamptz not null default now()
);

create table public.sop_images (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  sop_id          uuid not null references public.sops(id) on delete cascade,
  step_id         uuid references public.sop_steps(id) on delete set null,
  section_id      uuid references public.sop_sections(id) on delete set null,
  storage_path    text not null,     -- Supabase Storage path
  content_type    text not null,
  order_index     int not null default 0,
  created_at      timestamptz not null default now()
);

-- Indexes
create index idx_sops_org_id on public.sops (organisation_id);
create index idx_sop_sections_sop_id on public.sop_sections (sop_id);
create index idx_sop_steps_section_id on public.sop_steps (section_id);
create index idx_sop_images_sop_id on public.sop_images (sop_id);
create index idx_sop_images_step_id on public.sop_images (step_id);

-- Enable RLS
alter table public.sops enable row level security;
alter table public.sop_sections enable row level security;
alter table public.sop_steps enable row level security;
alter table public.sop_images enable row level security;
```

```sql
-- Migration: 00004_parse_jobs.sql

create table public.parse_jobs (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  sop_id          uuid not null references public.sops(id) on delete cascade,
  status          text not null default 'queued'
                  check (status in ('queued', 'processing', 'completed', 'failed')),
  file_path       text not null,
  file_type       text not null check (file_type in ('docx', 'pdf', 'image')),
  error_message   text,
  retry_count     int not null default 0,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now()
);

create index idx_parse_jobs_org_id on public.parse_jobs (organisation_id);
create index idx_parse_jobs_sop_id on public.parse_jobs (sop_id);
create index idx_parse_jobs_status on public.parse_jobs (status);

alter table public.parse_jobs enable row level security;

-- Add to Realtime publication (CRITICAL for admin notification)
alter publication supabase_realtime add table public.parse_jobs;
```

---

## Sources

### Primary (HIGH confidence)
- mammoth README (github.com/mwilliamson/mammoth.js) — image extraction API, convertImage callback, base64 output
- unpdf README (github.com/unjs/unpdf) — extractText API, mergePages option, page-by-page processing
- Zod v4 docs (zod.dev/json-schema) — z.toJSONSchema() API, OpenAI compatibility
- Supabase JS docs (supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl) — presigned upload URL API
- Supabase Realtime postgres_changes docs — filter syntax, publication setup requirement
- Supabase Storage access control docs — storage.foldername() helper, RLS on storage.objects
- Phase 1 codebase (src/actions/auth.ts, src/lib/supabase/admin.ts, supabase/migrations/) — established patterns

### Secondary (MEDIUM confidence)
- OpenAI community forum: openai SDK 6.7.0+ confirmed Zod v4 compatible; zodResponseFormat fix
- WebSearch: Vercel function timeout limits (Hobby 10s, Pro 60s, Fluid Compute 800s)
- WebSearch: mammoth + Turbopack incompatibility (github.com/vercel/next.js/issues/72863)
- jigz.dev: Supabase table-based job queue pattern with pg_cron polling

### Tertiary (LOW confidence)
- tesseract.js for server-side OCR (Node.js usage confirmed; performance in Vercel serverless context unverified)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — mammoth, unpdf, openai SDK all verified via official docs and community
- Architecture (presigned URLs, job queue, Realtime): HIGH — verified patterns
- GPT-4o Zod v4 compatibility: HIGH — community thread confirmed fix in openai 6.7.0
- mammoth Turbopack issue: HIGH — GitHub issue confirmed
- PDF image extraction risk: HIGH — documented limitation
- OCR approach: MEDIUM — tesseract.js Node.js usage confirmed; Vercel lambda performance unverified

**Research date:** 2026-03-24
**Valid until:** 2026-06-24 (90 days — stable libraries, unlikely to change)
