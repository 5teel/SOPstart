---
phase: 04-completion-and-sign-off
plan: 03
subsystem: ui
tags: [react, tanstack-query, supabase, next.js, lightbox, zustand]

# Dependency graph
requires:
  - phase: 04-01
    provides: signOffCompletion server action, sop_completions + completion_sign_offs + completion_photos tables with RLS
  - phase: 04-02
    provides: submitCompletion flow, completionStore, photo capture in walkthrough

provides:
  - Activity page route-branches worker history vs supervisor feed based on role
  - useWorkerCompletions, useSupervisorCompletions, useCompletionDetail TanStack Query hooks
  - CompletionHistoryCard: worker's own completion cards with status, date, photo count, rejection preview
  - CompletionSummaryCard: supervisor feed cards with worker initials, pending border accent
  - ActivityFilter: All/By SOP/By Worker pills with secondary select dropdown
  - CompletionDetailPage: server component fetching completion + steps + presigned photo URLs
  - CompletionDetailClient: summary banner, step-by-step rows with photo thumbnails and lightbox
  - CompletionStepRow: step number, CheckCircle2, timestamp, 80px photo thumbnails
  - RejectReasonSheet: bottom sheet with mandatory reason textarea (min 10 chars), char counter
  - Approve/Reject sign-off bar (supervisor/safety_manager only, hidden when already signed)

affects: [phase-05, supervisor-workflow, completion-lifecycle]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Server component role-branch with client view components (WorkerActivityView/SupervisorActivityView)
    - Supabase select with joins cast via `as unknown as RawRow[]` to bypass TypeScript inference
    - Admin client for presigned read URL generation server-side (bypasses RLS)
    - Abbreviated user_id for worker display names (no profiles table in schema)

key-files:
  created:
    - src/hooks/useCompletions.ts
    - src/app/(protected)/activity/page.tsx
    - src/app/(protected)/activity/WorkerActivityView.tsx
    - src/app/(protected)/activity/SupervisorActivityView.tsx
    - src/app/(protected)/activity/[completionId]/page.tsx
    - src/app/(protected)/activity/[completionId]/CompletionDetailClient.tsx
    - src/components/activity/CompletionHistoryCard.tsx
    - src/components/activity/CompletionSummaryCard.tsx
    - src/components/activity/ActivityFilter.tsx
    - src/components/activity/CompletionStepRow.tsx
    - src/components/activity/RejectReasonSheet.tsx
  modified:
    - src/app/(protected)/activity/SupervisorActivityView.tsx

key-decisions:
  - "Worker display names use abbreviated user_id (Worker {first-8-chars}) — no user_profiles table exists in the schema"
  - "Supabase join select cast as unknown as RawRow[] — generated types don't infer relationship shapes from select strings"
  - "Admin client used for presigned read URLs in server component — bypasses RLS consistently with upload pattern"
  - "display_name column not in organisation_members schema — dropped in favour of user_id abbreviation"

patterns-established:
  - "Role-aware server page: fetch role in server component, render named client view components"
  - "Presigned URLs generated server-side and passed as props to client component (no client-side storage calls)"
  - "Sign-off state managed purely in client component state after server initial render (optimistic-style)"

requirements-completed: [COMP-05, COMP-06]

# Metrics
duration: 7min
completed: 2026-03-26
---

# Phase 4 Plan 03: Activity Feed and Supervisor Sign-off Summary

**Role-aware Activity tab with worker completion history, supervisor feed with filter pills, step-by-step evidence detail, and approve/reject sign-off flow backed by signOffCompletion server action**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-26T01:00:57Z
- **Completed:** 2026-03-26T01:08:46Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Built three TanStack Query hooks (useWorkerCompletions, useSupervisorCompletions, useCompletionDetail) with offlineFirst mode and proper type casting for Supabase join queries
- Delivered role-aware Activity page: workers see own completion history, supervisors/safety_managers see supervised workers' completions with filter pills (All/By SOP/By Worker)
- Completion detail page generates presigned read URLs server-side for all photos, renders step-by-step evidence with photo lightboxes, and presents approve/reject action bar to supervisors

## Task Commits

Each task was committed atomically:

1. **Task 1: Activity page, data hooks, worker history card, supervisor feed with filters** - `2835f19` (feat)
2. **Task 2: Completion detail page with step rows, photo lightbox, and sign-off panel** - `ad56558` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified

- `src/hooks/useCompletions.ts` - Three TanStack Query hooks for worker history, supervisor feed, and detail view
- `src/app/(protected)/activity/page.tsx` - Server component role-branching to WorkerActivityView or SupervisorActivityView
- `src/app/(protected)/activity/WorkerActivityView.tsx` - Worker's own completion history list with empty state
- `src/app/(protected)/activity/SupervisorActivityView.tsx` - Supervisor feed with worker profiles and desktop sidebar layout
- `src/app/(protected)/activity/[completionId]/page.tsx` - Server component fetching completion + steps + presigned photo URLs
- `src/app/(protected)/activity/[completionId]/CompletionDetailClient.tsx` - Interactive detail with approve/reject sign-off bar
- `src/components/activity/CompletionHistoryCard.tsx` - Worker history card (status icon, NZ date, photo count, rejection preview)
- `src/components/activity/CompletionSummaryCard.tsx` - Supervisor feed card (worker initials avatar, border-brand-yellow for pending)
- `src/components/activity/ActivityFilter.tsx` - Filter pills (All/By SOP/By Worker) with secondary select dropdown
- `src/components/activity/CompletionStepRow.tsx` - Step row with step number circle, CheckCircle2, timestamp, thumbnail grid + lightbox
- `src/components/activity/RejectReasonSheet.tsx` - Bottom sheet with mandatory reason textarea (min 10 chars validation)

## Decisions Made

- **Worker display names:** No user_profiles table exists in the schema. Plan referenced `display_name` on `organisation_members` which doesn't exist per database.types.ts. Used abbreviated user_id (`Worker {first-8-chars}`) as display name fallback — consistent with existing pattern in assignments.ts which also falls back to user_id.
- **Supabase join type casting:** Supabase generated types don't infer relationship shapes from `.select()` strings. Used `as unknown as RawRow[]` with explicit interface definitions, consistent with the pattern used throughout the codebase.
- **Admin client for presigned read URLs:** Uses `createAdminClient()` in the server component to generate read URLs, bypassing RLS on the storage bucket — same pattern as `getPhotoUploadUrl` in completions.ts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed non-existent display_name column from organisation_members queries**
- **Found during:** Task 2 (completion detail page)
- **Issue:** Plan specified querying `display_name` from `organisation_members`, but this column doesn't exist in the database schema (database.types.ts). TypeScript error TS2339 on both detail page and SupervisorActivityView.
- **Fix:** Removed display_name from all queries. Worker display name falls back to `Worker ${userId.slice(0, 8)}` — consistent with the pattern in `src/actions/assignments.ts` which also notes "full_name not available without a profiles table".
- **Files modified:** `src/app/(protected)/activity/[completionId]/page.tsx`, `src/app/(protected)/activity/SupervisorActivityView.tsx`
- **Verification:** TypeScript noEmit clean, full build passes
- **Committed in:** `ad56558` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed Supabase join select type inference**
- **Found during:** Task 1 (useCompletions hooks)
- **Issue:** Supabase typed client resolves joined relationship rows as `never` when using `.select()` with nested join syntax — properties like `sops`, `completion_photos`, `completion_sign_offs` were all typed as `never`.
- **Fix:** Added explicit `RawCompletionRow` interface with full shape of joined data, cast query results `as unknown as RawCompletionRow[]` to bypass TypeScript inference.
- **Files modified:** `src/hooks/useCompletions.ts`
- **Verification:** TypeScript noEmit clean
- **Committed in:** `2835f19` (Task 1 commit after rework)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Both fixes necessary for TypeScript correctness. No functionality removed — display name gracefully falls back to user ID abbreviation.

## Issues Encountered

None beyond the two auto-fixed deviations above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 4 is now complete: the full SOP lifecycle (assignment → walkthrough → photo capture → submission → supervisor review) is implemented
- Remaining UI improvement: worker display names could be enhanced if a user_profiles table is added in a future phase
- Activity tab is now fully functional for all three roles (worker, supervisor, safety_manager)

---
*Phase: 04-completion-and-sign-off*
*Completed: 2026-03-26*
