---
phase: 02-document-intake
plan: 01
subsystem: database, ui, api
tags: [supabase, postgres, rls, storage, next.js, zod, lucide-react, server-actions, presigned-urls]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: organisations table, current_organisation_id() helper, current_user_role() helper, JWT claims (org_id + role), createAdminClient, createClient patterns, auth server actions pattern

provides:
  - SOP normalised schema: sops, sop_sections, sop_steps, sop_images tables with RLS
  - parse_jobs table with FSM constraints and Realtime publication
  - sop-documents and sop-images Supabase Storage buckets with org-scoped RLS
  - TypeScript types: Sop, SopSection, SopStep, SopImage, ParseJob, UploadSession
  - Zod validators: ParsedSopSchema (GPT-4o structured output), uploadFileSchema, uploadSessionSchema
  - createUploadSession server action: creates SOP record + presigned upload URL + parse_job row
  - triggerParse server action: sets status to parsing and fires async parse request
  - UploadDropzone client component with drag-drop, file browser, camera capture, queue, and upload flow
  - StatusBadge component for SopStatus and ParseJobStatus
  - /admin/sops — SOP library page with filter tabs and empty state
  - /admin/sops/upload — upload page with admin role gate

affects:
  - 02-02 (AI parse pipeline reads parse_jobs, writes to sops/sop_sections/sop_steps)
  - 02-03 (review page reads sop_sections/sop_steps, uses StatusBadge)
  - 03-walkthrough (reads published sops)

# Tech tracking
tech-stack:
  added:
    - lucide-react (icons: Upload, FileText, Image, X, CheckCircle, Loader2)
  patterns:
    - Presigned URL upload: createUploadSession creates DB record + presigned URL atomically, client uploads directly to Storage
    - Fire-and-forget async trigger: triggerParse updates status then calls API route without awaiting
    - Org-scoped storage paths: {org_id}/{sop_id}/original/{filename}
    - RLS via join: sop_sections/sop_steps/sop_images use subquery joins to sops.organisation_id

key-files:
  created:
    - supabase/migrations/00003_sop_schema.sql
    - supabase/migrations/00004_parse_jobs.sql
    - supabase/migrations/00005_sop_storage_rls.sql
    - src/types/sop.ts
    - src/lib/validators/sop.ts
    - src/actions/sops.ts
    - src/components/admin/UploadDropzone.tsx
    - src/components/admin/StatusBadge.tsx
    - src/app/(protected)/admin/sops/page.tsx
    - src/app/(protected)/admin/sops/upload/page.tsx
  modified:
    - src/types/database.types.ts (regenerated with new tables)
    - package.json (added lucide-react)

key-decisions:
  - "Presigned URL upload pattern: server action creates SOP record and signed URL atomically; client uploads directly to Storage bypassing server file buffer limits"
  - "parse_jobs added to supabase_realtime publication at migration time to enable live status updates in admin UI"
  - "Storage path structure: {org_id}/{sop_id}/original/{filename} enables org-scoped RLS without custom functions"
  - "lucide-react installed as dependency: not in Phase 1 but required by UI spec for upload/file icons"

patterns-established:
  - "Upload server action pattern: validate with Zod -> get JWT claims for org/role -> admin client for DB inserts -> presigned URL -> return session array"
  - "Admin role gate pattern: check organisation_members.role in ['admin', 'safety_manager'] before rendering page content"
  - "RLS via join pattern for child tables: EXISTS subquery back to parent sops table for org scoping"

requirements-completed: [PARSE-01, PARSE-02, PARSE-07]

# Metrics
duration: 6min
completed: 2026-03-24
---

# Phase 02 Plan 01: SOP Schema and Upload UI Summary

**Normalised SOP data model (4 tables + parse_jobs + 2 storage buckets) with presigned URL upload flow, drag-drop admin UI, and SOP library page**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-24T05:10:32Z
- **Completed:** 2026-03-24T05:15:51Z
- **Tasks:** 2
- **Files modified:** 10 created, 2 modified

## Accomplishments

- SOP normalised schema with sops, sop_sections, sop_steps, sop_images, parse_jobs — all with RLS policies using existing current_organisation_id() and current_user_role() helpers
- Storage buckets sop-documents and sop-images with org-scoped access control; parse_jobs added to Realtime publication for live status tracking
- Full upload flow: UploadDropzone -> createUploadSession server action -> presigned URL -> Supabase Storage -> triggerParse fires async pipeline
- SOP library at /admin/sops with filter tabs (All, Drafts, Published, Needs attention) and empty state; upload page at /admin/sops/upload with admin role gate

## Task Commits

1. **Task 1: SOP database schema, types, and validators** - `907c88b` (feat)
2. **Task 2: Upload UI, server actions, and SOP library page** - `237d721` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `supabase/migrations/00003_sop_schema.sql` - sops, sop_sections, sop_steps, sop_images tables with RLS
- `supabase/migrations/00004_parse_jobs.sql` - parse_jobs with status FSM check constraints and Realtime publication
- `supabase/migrations/00005_sop_storage_rls.sql` - sop-documents and sop-images buckets with org-scoped storage policies
- `src/types/sop.ts` - TypeScript interfaces: Sop, SopSection, SopStep, SopImage, ParseJob, UploadSession
- `src/lib/validators/sop.ts` - Zod schemas: ParsedSopSchema (GPT-4o structured output), uploadFileSchema, uploadSessionSchema, getSourceFileType
- `src/actions/sops.ts` - Server actions: createUploadSession (presigned URL flow), triggerParse (fire-and-forget)
- `src/components/admin/UploadDropzone.tsx` - Drag-drop upload zone with file browser, camera capture, queue, and upload flow
- `src/components/admin/StatusBadge.tsx` - Status badge for SopStatus and ParseJobStatus
- `src/app/(protected)/admin/sops/page.tsx` - SOP library with filter tabs and empty state
- `src/app/(protected)/admin/sops/upload/page.tsx` - Upload page with admin role gate
- `src/types/database.types.ts` - Regenerated with new tables

## Decisions Made

- Presigned URL upload: server action creates SOP record and signed URL atomically; client uploads directly to Storage, bypassing 4MB Next.js server body limit
- parse_jobs Realtime: added to supabase_realtime publication at migration time — required for Phase 2 plan 03 admin review page live updates
- lucide-react installed: UI spec requires specific icons (Upload, FileText, Image, X, CheckCircle, Loader2) — package wasn't in Phase 1 dependencies

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Applied migrations to local Supabase before type generation**
- **Found during:** Task 2 verification
- **Issue:** Generated database.types.ts did not include sops table because migrations hadn't been applied to the local instance yet — TypeScript was rejecting `.from('sops')` as unknown table
- **Fix:** Ran `npx supabase db push --local` to apply 00003/00004/00005, then regenerated types
- **Files modified:** src/types/database.types.ts
- **Verification:** npx tsc --noEmit — zero errors
- **Committed in:** 237d721 (Task 2 commit)

**2. [Rule 3 - Blocking] Installed lucide-react package**
- **Found during:** Task 2 verification
- **Issue:** lucide-react not in package.json; UploadDropzone imports were failing TypeScript check
- **Fix:** npm install lucide-react
- **Files modified:** package.json, package-lock.json
- **Verification:** TypeScript module resolution succeeds
- **Committed in:** 237d721 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both were prerequisite steps (apply migrations, install dependency) required for the planned code to compile. No scope creep.

## Issues Encountered

None beyond the two auto-fixed blocking issues above.

## User Setup Required

None — migrations applied to local Supabase automatically. Storage buckets and Realtime publication are configured via migrations.

## Next Phase Readiness

- SOP data foundation complete: sops + parse_jobs tables ready for Phase 2 plan 02 (AI parse pipeline)
- Presigned URL upload flow operational: files reach sop-documents bucket, parse_jobs rows are queued
- StatusBadge available for Phase 2 plan 03 (admin review page)
- parse_jobs Realtime enabled for live status polling in review UI

---
*Phase: 02-document-intake*
*Completed: 2026-03-24*

## Self-Check: PASSED

All 10 created files confirmed present on disk. Task commits 907c88b and 237d721 confirmed in git log.
