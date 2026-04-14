---
phase: 02-document-intake
plan: 03
subsystem: ui
tags: [react, next.js, supabase-realtime, tailwind, lucide-react, mammoth, openai]

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
  - "Parse triggered client-side: Next.js 16 aborts fire-and-forget fetch in server actions — call /api/sops/parse directly from ReviewClient and UploadDropzone"
  - "mammoth requires Buffer.from() input: arrayBuffer option fails silently with 'Could not find file in options'"
  - "OpenAI structured outputs use .nullable() not .optional(): required by OpenAI structured output spec"

patterns-established:
  - "Pattern: Approval state reset — any content edit via PATCH sends approved: false, preventing publish without re-review"
  - "Pattern: Server-enforced publish gate — POST /publish counts unapproved sections, returns 400 if any remain"
  - "Pattern: Realtime + polling hybrid — subscribe to postgres_changes, start polling after 5s if no event fires"
  - "Pattern: Parse triggered from client not server — avoid fire-and-forget fetch in server actions in Next.js 16"

requirements-completed:
  - PARSE-05
  - PARSE-06
  - PARSE-07

# Metrics
duration: ~2h (including live testing and bug-fix iteration)
completed: 2026-03-25
---

# Phase 02 Plan 03: Admin SOP Review UI Summary

**Admin review page with side-by-side original/parsed layout, inline section editing, section-by-section approval workflow, and Publish SOP button gated by server-enforced all-sections-approved check — full parse pipeline working end-to-end**

## Performance

- **Duration:** ~2h (including live testing and bug-fix iteration)
- **Started:** 2026-03-24T05:26:13Z
- **Completed:** 2026-03-25T00:10:00Z (approx)
- **Tasks:** 3 (2 implementation + 1 human verification checkpoint — APPROVED)
- **Files modified:** 18

## Accomplishments

- Full document intake pipeline working end-to-end: upload .docx/PDF -> async GPT-4o parse -> admin review page with original doc alongside AI output -> inline section editing -> per-section approval -> publish to SOP library
- Complete admin review workflow: view original doc alongside AI-parsed sections, edit inline, approve section-by-section, publish — with Supabase Realtime parse status and 5s polling fallback
- All destructive actions (re-parse, delete, publish) require inline confirmation before executing
- Seven runtime bugs discovered and fixed during live end-to-end testing (Next.js 16 server action limitation, mammoth Buffer requirement, OpenAI .nullable() requirement, hydration mismatch, missing nav links)

## Task Commits

Each task was committed atomically:

1. **Task 1: API routes for section editing, approval, publishing, and SOP deletion** - `d392dd3` (feat)
2. **Task 2: Review page UI — side-by-side layout, section editor, parse status, original doc viewer** - `18ce9f5` (feat)
3. **Task 3: Checkpoint — human verification of complete document intake flow** - APPROVED

**Bug-fix commits during live testing:**
- `72ae3d8` — Link dashboard to upload page and SOP library, fix dev port
- `3d86e12` — Prevent hydration mismatch in OnlineStatusBanner
- `9ce7c96` — Add login and sign-up links to landing page
- `0a78e45` — Trigger parse from client instead of server action
- `11b9c37` — Use Buffer.from() for mammoth input
- `7dc9e5d` — Use .nullable() instead of .optional() for GPT-4o schemas
- `c14e9fe` — Remove all server-side fire-and-forget parse triggers

**Plan metadata:** (see final commit below)

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
- `src/actions/sops.ts` - Added reparseSop server action; removed fire-and-forget parse trigger
- `src/app/(protected)/dashboard/page.tsx` - Added Upload SOP and SOP Library navigation links
- `src/app/page.tsx` - Added login and sign-up links to landing page
- `src/components/admin/UploadDropzone.tsx` - Trigger parse API from client after upload
- `src/components/layout/OnlineStatusBanner.tsx` - Defer mount to fix SSR/client hydration mismatch
- `src/lib/parsers/extract-docx.ts` - Use Buffer.from() for mammoth input
- `src/lib/validators/sop.ts` - Use .nullable() instead of .optional() for OpenAI structured output schemas

## Decisions Made

- Review page split into server component (page.tsx) + client component (ReviewClient.tsx) for proper data-fetching separation
- Two additional API helper routes created (download-url, parse-job) to support client data needs
- Inline confirmations used for all destructive/irreversible actions per UI spec (no modals)
- Parse triggered client-side: Next.js 16 aborts fire-and-forget fetch in server actions — call /api/sops/parse directly from UploadDropzone and ReviewClient
- mammoth requires Buffer.from() input: arrayBuffer option fails silently
- OpenAI structured outputs require .nullable() not .optional() on optional schema fields

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

**3. [Rule 1 - Bug] Dashboard had no navigation links to Upload or SOP Library**
- **Found during:** Live testing (post Task 2)
- **Issue:** Dashboard showed no way to reach Upload or SOP Library; app was effectively un-navigable after login
- **Fix:** Added Upload SOP and SOP Library links to dashboard
- **Files modified:** `src/app/(protected)/dashboard/page.tsx`
- **Committed in:** `72ae3d8`

**4. [Rule 1 - Bug] Hydration mismatch in OnlineStatusBanner**
- **Found during:** Live testing (post Task 2)
- **Issue:** OnlineStatusBanner rendered different content on server vs client (navigator.onLine unavailable server-side), causing React hydration error
- **Fix:** Defer rendering until after mount using useEffect + mounted state flag
- **Files modified:** `src/components/layout/OnlineStatusBanner.tsx`
- **Committed in:** `3d86e12`

**5. [Rule 1 - Bug] Landing page had no auth links**
- **Found during:** Live testing (post Task 2)
- **Issue:** Landing page offered no path to login or sign-up; new users had to guess the URL
- **Fix:** Added login and sign-up links to landing page
- **Files modified:** `src/app/page.tsx`
- **Committed in:** `9ce7c96`

**6. [Rule 1 - Bug] Server-action fire-and-forget fetch aborted by Next.js 16**
- **Found during:** Live testing — upload completed but parse never started
- **Issue:** Next.js 16 aborts pending fetch requests when a server action function returns; parse trigger inside server action never executes
- **Fix:** Remove parse trigger from server action; call /api/sops/parse directly from UploadDropzone (client) after the upload server action returns
- **Files modified:** `src/actions/sops.ts`, `src/components/admin/UploadDropzone.tsx`, `src/app/(protected)/admin/sops/[sopId]/review/ReviewClient.tsx`
- **Committed in:** `0a78e45`, `c14e9fe`

**7. [Rule 1 - Bug] mammoth arrayBuffer option fails silently**
- **Found during:** Live testing — .docx files returned empty text extraction
- **Issue:** mammoth's arrayBuffer option fails with "Could not find file in options" when given a raw ArrayBuffer; must use Node.js Buffer
- **Fix:** Wrap arrayBuffer in Buffer.from() before passing to mammoth
- **Files modified:** `src/lib/parsers/extract-docx.ts`
- **Committed in:** `11b9c37`

**8. [Rule 1 - Bug] OpenAI structured output schema used .optional() instead of .nullable()**
- **Found during:** Live testing — GPT-4o parse returned validation error on optional fields
- **Issue:** OpenAI structured outputs require .nullable() on optional fields; .optional() (key omission) is not supported in the structured output spec
- **Fix:** Replace all .optional() with .nullable() in the GPT-4o Zod schema
- **Files modified:** `src/lib/validators/sop.ts`
- **Committed in:** `7dc9e5d`

---

**Total deviations:** 8 auto-fixed (all Rule 1 bugs — 2 from Task 2 implementation, 6 found during live end-to-end testing)
**Impact on plan:** All fixes were essential for the parsing pipeline to function. The Next.js 16 server action limitation and mammoth/OpenAI API quirks are runtime-only issues not detectable without real execution. No scope creep.

## Issues Encountered

The parsing pipeline required iterative debugging during live testing because several issues only manifest with real file uploads and API calls:

1. Next.js 16 server action limitation — required moving parse trigger to client (see deviation 6 above)
2. mammoth Buffer requirement — silent failure with no error thrown, only detected by testing with a real .docx file
3. OpenAI .nullable() requirement — structured output validation failure returned by OpenAI API at runtime

All issues were resolved within the session. The pipeline is confirmed working end-to-end: .docx upload, text extraction via mammoth, GPT-4o structured parse, section display in review UI, inline editing, approval, and publish.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 2 Document Intake is fully complete and verified: SOPs can be uploaded, parsed, reviewed, edited, approved, and published
- Published SOPs are in the sops table with status = 'published' and all sections in sop_sections
- Phase 3 Worker Experience can begin: SOP library data is ready for the worker walkthrough UI and offline sync engine
- No blockers for Phase 3

---
*Phase: 02-document-intake*
*Completed: 2026-03-25*
