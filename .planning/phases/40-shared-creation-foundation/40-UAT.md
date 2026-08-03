---
status: testing
phase: 40-shared-creation-foundation
source:
  - 40-01-SUMMARY.md through 40-14-SUMMARY.md (14 plans)
started: 2026-08-03
updated: 2026-08-03
---

## Current Test

number: 3
name: Upload a WebP photo
expected: |
  Same dropzone, drop a .webp image. It uploads and parses like any other photo.
  It does NOT get accepted and then rejected with a "file type" error part-way
  through.
awaiting: user response

## Tests

### 1. Fresh deploy loads
expected: On sopstart.com signed in as an admin, the site loads and the header shows SOPs, Sign-off, Manage SOPs, Create New SOP, Content, Team, Settings. No error screen, no blank page.
result: pass

### 2. Upload a document
expected: Create New SOP → Upload a document → drop a Word or PDF file. Progress runs to 100%, then a confirmation appears with a link to open the draft. The draft opens in the builder with the document's content parsed into sections.
result: pass
reported: "Upload → parse → builder hand-off all worked (SOP 'Replacing a Desktop Computer Keyboard at a Workstation', 33 steps across sections). User raised a separate, out-of-scope complaint about the builder's approval UX at this point — logged under Out-of-Scope Findings below, not as a Phase 40 gap."

### 3. Upload a WebP photo
expected: Same dropzone, drop a .webp image. It uploads and parses like any other photo. It does NOT get accepted and then rejected with a "file type" error part-way through.
result: issue
reported: "Upload failed"
severity: blocker
root_cause: "A THIRD accept list nobody unified. Plan 40-10 closed the drift between the client validator (file-intake.ts ACCEPTED_MIME_TYPES, 12 types) and the server zod schema (validators/sop.ts, now derived from it) — but the sop-documents storage bucket carries its own allowed_mime_types, set in migration 00005 and never updated since. Confirmed live via the Management API: the bucket allows exactly 4 types (docx, pdf, image/jpeg, image/png). Everything Phase 5 and later added to the code accept lists — xlsx, pptx, txt, webp — clears both code checks and then dies at supabase.storage.uploadToSignedUrl, which UploadDropzone.tsx reports as the generic 'Upload failed'. HEIC is unaffected (converted to JPEG client-side before upload); video is unaffected (uploads to sop-videos, which has no MIME restriction)."

### 4. Upload a video
expected: Create New SOP → Upload a document → drop an MP4. Progress runs to 100% and the SOP appears with transcription running.
result: pass
reported: "Verified 2026-08-03 as plan 40-14's blocking human checkpoint — 10.6MB MP4 uploaded to 100% and landed as a draft. The missing confirmation panel found during that run was fixed in dd4477c and is re-covered by test 2."

### 5. The three drafting surfaces ask for the same things
expected: Open Create New SOP → "Talk it through", then go back and open "Describe it", then "Start blank". All three ask for a title, a department, and a category, laid out the same way, with the same category options in the dropdown.
result: [pending]

### 6. Categories show up in the library
expected: Manage SOPs — SOPs show a category label. Note: only 6 of 24 existing SOPs had a category that could be matched during the migration, so roughly 18 may show no category. That is expected. What matters is that no SOP shows a broken, blank-but-styled, or duplicated category chip.
result: [pending]

### 7. Editing or restoring a version keeps the category
expected: Open a SOP that HAS a category → Versions → "Edit into new version". The new draft still shows the same category. Then on a SOP with several versions, use "Restore" on an older one — that new draft also keeps its category.
result: [pending]

### 8. Parse progress is readable
expected: While a document is parsing, the status shows plain-language stages (e.g. "Uploading", "Reading the document", "Writing the steps") that advance on their own without a page refresh. Not raw job codes or a stuck spinner.
result: [pending]

### 9. Video-generate progress looks the same
expected: Create New SOP → Upload a document → "Generate video SOP". The progress display uses the same style and plain-language stages as the document parse in test 8, not a different-looking stepper.
result: [pending]

### 10. Retry appears only where it can work
expected: If a document upload fails, a "Try again" button appears and retrying actually restarts it. On a failed AI-written draft ("Describe it"), there is NO "Try again" button — instead a line telling you to start a new draft.
result: [pending]

### 11. Creation pages look like one product
expected: Click through Upload a document, Describe it, Start blank, and a SOP's Versions page. Each has a title and description in the same position and style, and the back-links say where they actually go. No page has a differently-styled header or a back-link to a page that does not exist.
result: [pending]

## Summary

total: 11
passed: 3
issues: 0
pending: 8
skipped: 0

## Gaps

- truth: "DUP-01: one accept list — a file the dropzone accepts is a file the system stores"
  status: failed
  reason: "User reported: Upload failed (.webp, 87KB). The sop-documents bucket's allowed_mime_types is a third accept list, unchanged since migration 00005, allowing only docx/pdf/jpeg/png. xlsx, pptx, txt and webp all clear the client validator and the server zod schema and are then rejected by storage."
  severity: blocker
  test: 3
  artifacts:
    - path: "supabase/migrations/00005_sop_storage_rls.sql"
      issue: "sop-documents allowed_mime_types set to 4 types at bucket creation; no later migration updates it, so every format added by Phase 5 (xlsx/pptx/txt) and Phase 40 (webp) is rejected at the storage layer"
    - path: "src/lib/upload/file-intake.ts"
      issue: "ACCEPTED_MIME_TYPES advertises 12 types; INTAKE_HINT (line 75) prints all of them to the user on the upload page"
  missing:
    - "A migration updating sop-documents.allowed_mime_types to match ACCEPTED_MIME_TYPES, minus video (routes to sop-videos) and minus heic/heif (converted to JPEG client-side before upload)"
    - "A guard test pinning the bucket list against ACCEPTED_MIME_TYPES so a fourth divergence cannot ship silently"

## Out-of-Scope Findings

Raised during Phase 40 UAT but NOT Phase 40 regressions — Phase 40 never touched
the builder. Recorded here so they route to Phase 42 / the builder-redesign work
rather than being planned as phase-40 gap closure.

### OOS-1 — The approval surface withholds its own tools (major)

Reported 2026-08-04 while opening the draft from test 2:

> "the interface sucks at helping the approver navigate and approve each step ...
> none of them actually aid the approver to make judgements on the effectiveness
> of the AI parse of the source material or the quality of the step or where the
> current step they are approving sits in relation to the rest of the SOP or the
> relationship it has to the previous or next steps themselves."

**Diagnosis (code-confirmed, not speculation):** the user was on the **Edit**
stage. The **Check** stage (`ReviewStation.tsx`) already provides source-vs-parse
comparison (zone 3 SourceViewerPane), an ordered checklist with an active index
(prev/next relationship), per-block "✓ Looks right — verify step", `j`/`k`/`a`/`d`
keybinds, and a "Step 2 of 3" orientation strip with progress. The Edit stage
surfaces the verify-gate LOCK MESSAGE and the "5 of 33 steps checked" counter
while offering none of the verification tooling, and nothing routes an approver
with unverified blocks to Check.

Likely fix is routing/affordance, not a redesign of Check.

### OOS-2 — Builder ignores the max-w-5xl rail (minor)

The builder shell is full-bleed. Justified for Check's 3-pane layout; not
justified for Edit, which is a single document canvas, and it visibly breaks the
one-page-width standard set in `5060473` / `985524c`.

### OOS-3 — Two components each draw their own chrome row (minor)

`SAVED` and `⚇ Agent layer` render from `BuilderClient.tsx` (stage content, lines
192/246); `Tools for this SOP` renders from `BuilderStageShell.tsx` (frame, line
110). One conceptual toolbar with two owners, so the controls land on opposite
sides of the screen.

### OOS-4 — Four competing heading tiers (minor)

Wayfinder bar (58px) + tools row (36px) + OrientationStrip + section headings all
stack before any SOP content, with no clear primary.
