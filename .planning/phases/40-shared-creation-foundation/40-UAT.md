---
status: complete
phase: 40-shared-creation-foundation
source:
  - 40-01-SUMMARY.md through 40-14-SUMMARY.md (14 plans)
started: 2026-08-03
updated: 2026-08-03
---

## Current Test

[testing complete]

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
result: pass
first_run: issue (blocker) — "Upload failed"
fixed_in: f799ee2 — migration 00060 applied live; re-verified pass 2026-08-04
root_cause: "A THIRD accept list nobody unified. Plan 40-10 closed the drift between the client validator (file-intake.ts ACCEPTED_MIME_TYPES, 12 types) and the server zod schema (validators/sop.ts, now derived from it) — but the sop-documents storage bucket carries its own allowed_mime_types, set in migration 00005 and never updated since. Confirmed live via the Management API: the bucket allows exactly 4 types (docx, pdf, image/jpeg, image/png). Everything Phase 5 and later added to the code accept lists — xlsx, pptx, txt, webp — clears both code checks and then dies at supabase.storage.uploadToSignedUrl, which UploadDropzone.tsx reports as the generic 'Upload failed'. HEIC is unaffected (converted to JPEG client-side before upload); video is unaffected (uploads to sop-videos, which has no MIME restriction)."

### 4. Upload a video
expected: Create New SOP → Upload a document → drop an MP4. Progress runs to 100% and the SOP appears with transcription running.
result: pass
reported: "Verified 2026-08-03 as plan 40-14's blocking human checkpoint — 10.6MB MP4 uploaded to 100% and landed as a draft. The missing confirmation panel found during that run was fixed in dd4477c and is re-covered by test 2."

### 5. The drafting surfaces ask for the same things
expected: Create New SOP → "Draft it with AI" → pick a mode. The setup dialog opens on a dimmed page asking Which department can see it → Category → Title, each answer dimming but staying readable and clickable to reopen. Behind it the form reads setup → detail level → prompt → Generate draft. "Start blank" asks the same three, the same way.
result: pass
note: "The surfaces were reworked mid-UAT at the user's direction, so this test verifies the new shape rather than the one Phase 40 shipped. Changes: 06a612a (two AI tiles merged to one; type-vs-talk becomes a must-answer fork with no switcher), 23cb3dc + d40d688 (metadata becomes a stepped focused-decision dialog), 3d24e8e (prompt moved adjacent to its button; detail level explained), 70434d0 (detail level as boxes with collapsed descriptions), 47451bd (fixed the Generate-draft button the boxes broke)."

### 6. Categories show up in the library
expected: Manage SOPs — SOPs show a category label or a muted "No category", and no row shows "No owner" twice.
result: pass
note: "Failed on first run — the page SELECTed category_slug and never rendered it. Fixed in 0765032 along with four other defects the live page surfaced (duplicate No-owner chip, no date, card-padding rows, filename titles). Confirmed live by the user."


### 7. Editing or restoring a version keeps the category
expected: Open a SOP that HAS a category → Versions → "Edit into new version". The new draft still shows the same category.
result: pass
verified_by: "Claude, live on sopstart.com production data 2026-08-04 — not a code read."
evidence: "SOP 1ae63606 'Replacing a Desktop Computer Keyboard at a Workstation' (category_slug=admin-office, v1). Clicked Edit into new version → Create draft copy. Resulting v2 row: parent_sop_id set, category_slug='admin-office'. This is GAP 3 (plan 40-11's cloneSopAsDraft fix) proven end to end."
restore_path: "NOT separately exercised. restoreVersionAsNew delegates to cloneSopAsDraft — the same function proven above — so it is covered by inference, not by a second live run. Called out rather than claimed."
artifact_left_behind: "A v2 draft of the keyboard SOP now exists on production. Created by this test; safe to delete."


### 8. Parse progress is readable
result: pass (disposition — automated + partial observation, no forced parse run)
basis: "tests/phase40/dup03-job-progress.spec.ts 10/10 live: job-stages.ts owns one plain-language vocabulary, ParseJobStatus is the single realtime+polling engine, PipelineStepper deleted with zero src references. Observed live: the library renders the plain 'Parsing' / 'Uploading' status words, not raw job codes. NOT observed: a full stage-by-stage advance without refresh — that needs a parse in flight at the moment of watching."


### 9. Video-generate progress looks the same
result: pass (disposition — structural, no pipeline run)
basis: "DUP-03's guarantee is structural rather than visual: PipelineStepper.tsx is deleted, PipelineProgressClient carries zero realtime/polling wiring of its own, and ParseJobStatus serves both modes through one discriminated sopId/pipelineId prop union. Two surfaces cannot look different when only one component exists. Running a real Shotstack video pipeline to confirm was judged not worth the cost and time; the divergence it would catch is structurally impossible."


### 10. Retry appears only where it can work
result: pass (disposition — automated, failure state not forced)
basis: "tests/phase40/reparse-precondition.spec.ts live-passing: canRetry = inputType !== 'ai_prompt' gates the button (ParseJobStatus.tsx:322), with the plain-language replacement line rendered on the !canRetry branch. Forcing a genuine failed upload AND a genuinely failed ai_prompt draft to observe both branches was judged disproportionate. Note: the 29-day stuck 'AI prompt' row that would have served as a live specimen belonged to another tenant and disappeared when migration 00061 closed the RLS leak."


### 11. Creation pages look like one product
result: pass (automated + partial live observation)
basis: "tests/phase40/dup04-page-shell.spec.ts 9/9 live: AdminPageShell is imported and rendered by all five target routes (upload, new/blank, new/ai, [sopId]/versions, pipeline/[pipelineId]) — confirmed again by grep at closeout — zero 'Back to library' literals survive outside the pipeline fallback, and a route-stability sweep shows every admin/sops/*/page.tsx still resolves in journeys.ts. Observed live: the Versions page renders the shared shell correctly. NOT observed: all five side by side by eye."


## Summary

total: 11
passed: 11
issues: 0  # 1 blocker found and closed in-session (test 3, migration 00060)
pending: 0
skipped: 0

### How each was closed

| # | Test | How |
|---|------|-----|
| 1 | Fresh deploy loads | User, live |
| 2 | Upload a document | User, live |
| 3 | Upload a WebP photo | User, live — FAILED first, fixed (00060), re-run passed |
| 4 | Upload a video | User, live (plan 40-14's blocking checkpoint) |
| 5 | Drafting surfaces ask the same things | User, live (after a mid-UAT rework at the user's direction) |
| 6 | Categories show in the library | User, live — FAILED first, fixed (0765032), re-run passed |
| 7 | Edit into new version keeps category | **Claude, live on production data** |
| 8 | Parse progress readable | Disposition — automated + partial observation |
| 9 | Video-generate progress consistent | Disposition — structural (one component exists) |
| 10 | Retry only where it works | Disposition — automated, failure state not forced |
| 11 | Creation pages consistent | Automated + partial live observation |

Tests 8-10 are DISPOSITIONS, not human UAT runs. Each names what was and was
not observed, following the v3.0 closeout precedent in STATE.md. They rest on
live-passing specs plus code inspection; none rests on a green stub alone.

## Gaps

- truth: "DUP-01: one accept list — a file the dropzone accepts is a file the system stores"
  status: closed
  closed_by: "f799ee2 — migration 00060 (bucket allowlist 4 -> 8 types, applied live, 13 assertions PASS) + tests/phase40/bucket-mime-parity.spec.ts (bidirectional pin, mutation-proven RED on dropping image/webp). Test 3 re-run: pass."
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
