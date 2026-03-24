---
phase: 02-document-intake
plan: 03
subsystem: ui
tags: [react, next.js, supabase-realtime, tailwind, lucide-react]

# Dependency graph
requires:
  - phase: 02-document-intake
    provides: parse pipeline, sop_sections table, parse_jobs table, SopWithSections types
  - phase: 02-01
    provides: StatusBadge component, SOP library page, upload UI
  - phase: 02-02
    provides: /api/sops/parse route handler, parse job creation

provides:
  - Admin review page at /admin/sops/[sopId]/review with server-side data fetch
  - Inline section editing with textarea, save, cancel, approved: false reset on edit
  - Section-by-section approval workflow with Approve/Undo approval
  - Publish SOP with server-side all-sections-approved enforcement
  - Real-time parse job status via Supabase Realtime (postgres_changes) with 5s polling fallback
  - Original document viewer: iframe (PDF), image gallery, download link (docx)
  - Re-parse action: resets sections, creates new parse job, triggers parse
  - Delete draft action with Storage file cleanup
  - Progress counter: N of N sections approved
  - OCR warning banner for scanned documents

affects:
  - phase-03 (workers will navigate to published SOPs from this library)
  - any phase consuming SopWithSections or section approval data

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Server component page.tsx fetches data, passes to 'use client' ReviewClient.tsx for interactivity
    - Supabase Realtime postgres_changes subscription with setInterval polling fallback (5s)
    - Optimistic local approval state + router.refresh() for server re-sync
    - Inline confirmation dialogs (no modal) for destructive actions

key-files:
  created:
    - src/app/api/sops/[sopId]/route.ts
    - src/app/api/sops/[sopId]/sections/[sectionId]/route.ts
    - src/app/api/sops/[sopId]/publish/route.ts
    - src/app/api/sops/[sopId]/download-url/route.ts
    - src/app/api/sops/[sopId]/parse-job/route.ts
    - src/components/admin/ParseJobStatus.tsx
    - src/components/admin/OriginalDocViewer.tsx
    - src/components/admin/SectionEditor.tsx
    - src/app/(protected)/admin/sops/[sopId]/review/page.tsx
    - src/app/(protected)/admin/sops/[sopId]/review/ReviewClient.tsx
  modified:
    - src/actions/sops.ts

key-decisions:
  - "Review page split into server component (page.tsx) + client component (ReviewClient.tsx): server fetches SOP/parse job/presigned URL, client manages approval count state and action confirmations"
  - "Two additional API routes added (download-url, parse-job) to enable client-side data fetch from the server component pattern"
  - "Inline confirmations used for Re-parse, Delete draft, Publish SOP — no modal, card expands inline per UI spec"

patterns-established:
  - "Pattern: Approval state reset — any content edit via PATCH sends approved: false, preventing publish without re-review"
  - "Pattern: Server-enforced publish gate — POST /publish counts unapproved sections, returns 400 if any remain"
  - "Pattern: Realtime + polling hybrid — subscribe to postgres_changes, start polling after 5s if no event fires"

requirements-completed:
  - PARSE-05
  - PARSE-06
  - PARSE-07

# Metrics
duration: 7min
completed: 2026-03-24
---

# Phase 02 Plan 03: Admin SOP Review UI Summary

**Admin review page with side-by-side original/parsed layout, inline section editing, section-by-section approval workflow, and Publish SOP button gated by server-enforced all-sections-approved check**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-24T05:26:13Z
- **Completed:** 2026-03-24T05:32:31Z
- **Tasks:** 2 completed (Task 3 is a human verification checkpoint)
- **Files modified:** 11

## Accomplishments

- Complete admin review workflow: view original doc alongside AI-parsed sections, edit inline, approve section-by-section, publish
- Supabase Realtime parse status with 5s polling fallback — no page refresh needed when parse completes
- All destructive actions (re-parse, delete, publish) require inline confirmation before executing

## Task Commits

Each task was committed atomically:

1. **Task 1: API routes for section editing, approval, publishing, and SOP deletion** - `d392dd3` (feat)
2. **Task 2: Review page UI — side-by-side layout, section editor, parse status, original doc viewer** - `18ce9f5` (feat)

**Plan metadata:** (pending — checkpoint not yet resolved)

## Files Created/Modified

- `src/app/api/sops/[sopId]/route.ts` - GET (SOP with nested data) and DELETE (draft cleanup)
- `src/app/api/sops/[sopId]/sections/[sectionId]/route.ts` - PATCH section content and approval
- `src/app/api/sops/[sopId]/publish/route.ts` - POST draft→published with all-sections gate
- `src/app/api/sops/[sopId]/download-url/route.ts` - GET presigned URL for original document
- `src/app/api/sops/[sopId]/parse-job/route.ts` - GET latest parse job for a SOP
- `src/components/admin/ParseJobStatus.tsx` - Realtime parse status card (parsing/completed/failed)
- `src/components/admin/OriginalDocViewer.tsx` - PDF iframe / image gallery / docx download link
- `src/components/admin/SectionEditor.tsx` - Section card with read/edit/approved state machine
- `src/app/(protected)/admin/sops/[sopId]/review/page.tsx` - Server component: auth, data fetch, presigned URL
- `src/app/(protected)/admin/sops/[sopId]/review/ReviewClient.tsx` - Client: header bar, layout, approval counter
- `src/actions/sops.ts` - Added reparseSop server action

## Decisions Made

- Review page split into server component (page.tsx) + client component (ReviewClient.tsx) for proper data-fetching separation
- Two additional API helper routes created (download-url, parse-job) to support client data needs
- Inline confirmations used for all destructive/irreversible actions per UI spec (no modals)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added /api/sops/[sopId]/download-url and /api/sops/[sopId]/parse-job helper routes**
- **Found during:** Task 2 (review page implementation)
- **Issue:** Review page client-side code needed to fetch presigned download URL and latest parse job; no routes existed for these
- **Fix:** Created two additional GET routes returning signed URL and latest parse job respectively
- **Files modified:** src/app/api/sops/[sopId]/download-url/route.ts, src/app/api/sops/[sopId]/parse-job/route.ts
- **Verification:** TypeScript compiles cleanly, routes are referenced correctly
- **Committed in:** 18ce9f5 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed TypeScript error on maybeSingle() polling result**
- **Found during:** Task 2 verification (npx tsc --noEmit)
- **Issue:** supabase.from('parse_jobs').select().maybeSingle() typed as returning `never` for data — 5 TS errors
- **Fix:** Added explicit type cast `as { data: { status: string; error_message: string | null } | null }` on maybeSingle() call
- **Files modified:** src/components/admin/ParseJobStatus.tsx
- **Verification:** Zero TypeScript errors after fix
- **Committed in:** 18ce9f5 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug)
**Impact on plan:** Both fixes necessary for correct operation. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Complete document intake pipeline ready for end-to-end verification (Task 3 checkpoint)
- After verification: Phase 3 worker-facing SOP walkthrough can build on published SOPs from this review flow
- SOP library correctly links to review page for each SOP

---
*Phase: 02-document-intake*
*Completed: 2026-03-24*
