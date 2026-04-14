# Phase 2: Document Intake - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can upload SOP documents (Word, PDF, or photos of pages), AI parses them into structured sections with extracted images, admin reviews each section side-by-side with the original, edits inline, approves section-by-section, and publishes to the SOP library. This phase delivers the SOP data model, async parsing pipeline, and admin review UI. No worker-facing features — workers don't see SOPs until Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Upload Experience
- **D-01:** Three upload methods: drag-and-drop zone, file browser button, AND camera capture for photographing individual pages
- **D-02:** Batch upload supported — admin can upload multiple files at once, they queue for parsing, admin reviews each one individually
- **D-03:** 50MB file size limit per upload
- **D-04:** Progress indicator during parsing with relaxed NZ-flavoured messaging: "Grab a hot drink or take a smoko while we process your SOPs — we'll notify you when they're ready"
- **D-05:** Parsing runs in background (async) — admin gets in-app notification when parsing completes
- **D-06:** Upload accepts .docx, .pdf, and image files (jpg, png) for photographed pages

### AI Parsing Approach
- **D-07:** GPT-4o with structured outputs for parsing — research-verified 100% schema reliability
- **D-08:** Best-effort OCR for scanned PDFs and photographed pages — try OCR if text extraction fails, but don't guarantee quality. Flag low-quality OCR results for admin attention
- **D-09:** ALL sections are extracted — AI identifies every section present in the document (not locked to a fixed set)
- **D-10:** Every parsed SOP requires full admin review before publishing — no auto-publish regardless of confidence level
- **D-11:** Text extraction via mammoth (.docx) + unpdf (.pdf) feeding into GPT-4o structured output
- **D-12:** Image extraction — pull embedded images from documents and associate them with the step/section they belong to

### Admin Review UI
- **D-13:** Side-by-side layout — original document on the left, parsed structured output on the right
- **D-14:** Inline editing — click any section to edit text directly in place (no modals)
- **D-15:** Section-by-section approval — admin must approve each section individually, then publish the whole SOP
- **D-16:** Reparse option available — admin can click "Re-parse" to run AI again on the same document
- **D-17:** Delete and re-upload also available — admin can discard a draft and start over
- **D-18:** All parsed SOPs start in "draft" state — only move to "published" after all sections approved

### SOP Structure Model
- **D-19:** Fully flexible section types — AI detects whatever sections the document has and labels them (not locked to a fixed set). Common types include: Hazards, PPE, Steps, Emergency, Training, Maintenance, Scope, References, Competency Assessment, but any section type is valid
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Vision, core value, constraints, NZ market context
- `.planning/REQUIREMENTS.md` — PARSE-01 through PARSE-07 are this phase's requirements
- `.planning/ROADMAP.md` — Phase 2 details, success criteria, plan breakdown

### Research
- `.planning/research/STACK.md` — GPT-4o structured outputs, mammoth, unpdf, Supabase Storage
- `.planning/research/ARCHITECTURE.md` — Async parsing pipeline architecture, SOP normalised data model
- `.planning/research/PITFALLS.md` — AI parser hallucination risks, admin review gate requirements

### Phase 1 Output (build on this)
- `src/lib/supabase/server.ts` — Server-side Supabase client (use for API routes)
- `src/lib/supabase/admin.ts` — Admin client with service role key (use for parsing pipeline)
- `src/types/auth.ts` — AppRole type, JWT claims (for RLS context)
- `src/types/database.types.ts` — Generated Supabase types (extend with SOP tables)
- `supabase/migrations/` — Existing schema (add new migrations for SOP tables)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/supabase/admin.ts` — Service role client for server-side operations (parsing pipeline needs this)
- `src/lib/supabase/server.ts` — Authenticated client for API routes
- `src/actions/auth.ts` — Pattern for server actions with Zod validation (reuse for SOP actions)
- `src/lib/validators/auth.ts` — Zod schema pattern (reuse for SOP validators)
- `src/types/database.types.ts` — Supabase generated types (extend with SOP tables)

### Established Patterns
- Server actions with Zod validation in `src/actions/`
- Supabase RLS with `organisation_id` scoping on all tables
- React Hook Form + Zod for client-side forms
- Tailwind v4 with industrial dark palette (steel-900 backgrounds, brand-yellow/orange accents)

### Integration Points
- New Supabase migrations extend existing schema
- New server actions follow same pattern as auth actions
- Admin review UI lives under `src/app/(protected)/admin/` route group
- Supabase Storage bucket for SOP documents and extracted images
- RLS policies on all new SOP tables using `current_organisation_id()` helper

</code_context>

<specifics>
## Specific Ideas

- **NZ personality in UX** — "smoko" messaging during parse wait time. Keep the tone friendly and relaxed for NZ trades workers.
- **Photo capture for SOPs** — Some SOPs may only exist as physical printouts on-site. Camera capture of individual pages is a real use case, not just a nice-to-have.
- **Section-by-section approval** — Admin must deliberately approve each section. This prevents accidentally publishing badly-parsed safety content.
- **Rich steps** — Industrial SOPs need warnings, cautions, required tools, and time estimates per step. Not just text + image.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-document-intake*
*Context gathered: 2026-03-24*
