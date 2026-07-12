---
phase: 28-ownership-review-lifecycle-governance-queue
plan: 05
subsystem: frontend
tags: [admin-ui, worker-ui, governance, ownership, review-lifecycle, dashboard]

# Dependency graph
requires:
  - phase: 28-ownership-review-lifecycle-governance-queue
    provides: "setSopOwner/confirmSopCurrent/listGovernanceQueue/GovernanceRow server actions (28-03)"
  - phase: 28-ownership-review-lifecycle-governance-queue
    provides: "/admin/governance queue page + filter chips (28-04) — this plan deep-links into it"
provides:
  - "Admin library (/admin/sops) owner column + overdue badge + one-click confirm-current + owner=me filter"
  - "GovernanceWidget — dashboard counts card mounted on /admin/sops header, deep-linking to /admin/governance?filter="
  - "Worker OverviewTab single passive 'Current as of' caption (D28-07 hard rule closed)"
affects: [admin-sops-page, sop-worker-overview]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Admin-library-only overdue guard (new Date(reviewDueAt) < new Date()) lives EXCLUSIVELY in LibraryReviewCell.tsx — never on a worker route (D28-07)"
    - "Owner labels resolved via existing getTeamMembersWithEmails() — no new member query added"

key-files:
  created:
    - src/components/admin/sops/LibraryReviewCell.tsx
    - src/components/admin/governance/GovernanceWidget.tsx
    - tests/phase28/library-and-worker.spec.ts
  modified:
    - src/app/(protected)/admin/sops/page.tsx
    - src/components/sop/tabs/OverviewTab.tsx
    - src/types/sop.ts

key-decisions:
  - "Sop type's 4 new fields (owner_user_id/review_due_at/last_reviewed_at/last_reviewed_by) made OPTIONAL (?:), not required — matches the existing pipeline_run_id?/flow_graph? precedent and avoids touching unrelated partial-Sop test fixtures across the codebase (src/lib/voice/__tests__/*.test.ts) for an additive extension"
  - "GovernanceWidget mount + import landed in Task 1's commit (same page.tsx header edit block as the owner filter/chip) rather than being split into Task 2's commit via hunk-level staging — file-level commit granularity chosen over patch-splitting churn; zero functional difference, same as the 28-04 precedent of a compile-order file moving one commit earlier"

requirements-completed: [OWN-01, OWN-04, REV-02, REV-03, REV-04, GQ-04]

# Metrics
duration: 25min
completed: 2026-07-12
---

# Phase 28 Plan 05: Admin Library Governance Surfacing + Worker Currency Caption Summary

**Admin library (`/admin/sops`) now shows each SOP's owner, an overdue badge, a one-click "Confirm current" button, and an "Owned by me" filter; the library header gains a governance counts widget deep-linking into the existing `/admin/governance` queue; the worker `OverviewTab` gains exactly ONE passive "Current as of" caption with zero review-state gating anywhere.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-12T08:15:00Z
- **Completed:** 2026-07-12T08:40:00Z
- **Tasks:** 3 completed
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments
- `admin/sops/page.tsx` — extended the sops select (both status branches) to include `owner_user_id, review_due_at`; `?owner=me` adds a real `.eq('owner_user_id', user.id)` filter; "Owned by me" chip added next to the status tabs; owner display labels resolved via the existing `getTeamMembersWithEmails()` (no new member query, per RESEARCH "Don't Hand-Roll").
- `LibraryReviewCell.tsx` (new, client) — renders the owner label, an overdue badge guarded by `new Date(reviewDueAt) < new Date()` (admin-library-ONLY per D28-07), and a wired `confirmSopCurrent(sopId)` button with `useTransition` + inline error surfacing + `router.refresh()` on success — mirrors `GovernanceQueueRow`'s handler shape exactly.
- `GovernanceWidget.tsx` (new, server) — counts `overdue`/`unowned`/`due_soon` from `listGovernanceQueue()`, deep-links each to `/admin/governance?filter=`, renders a muted "All current" state when counts are zero or the read errors; mounted on the `/admin/sops` header.
- `OverviewTab.tsx` — added exactly ONE `<MetaRow label="Current as of" value={formatNzDate(sop.last_reviewed_at ?? sop.published_at)} />` at the same visual weight as `Author`/`Category`/`Revised`. No badge, no conditional, no import of any governance action — verified by a regex source-contract gate that fails the build if a `review_due_at` comparison or conditional ever appears in this file.
- `src/types/sop.ts` — `Sop` extended with 4 optional nullable fields (`owner_user_id?`, `review_due_at?`, `last_reviewed_at?`, `last_reviewed_by?`), matching the existing `pipeline_run_id?`/`flow_graph?` optional-additive style.
- `tests/phase28/library-and-worker.spec.ts` — 12 source-contract assertions covering the owner filter, the wired confirm-current call, the guarded overdue badge, the widget's counts/deep-links, the worker caption, and — critically — that neither the worker walkthrough route nor the worker SOP detail route contain any `review_due_at`/`owner_user_id` gating branch.
- Full gate green: `npx playwright test --project=phase28 --project=phase28-unit` (47 passed, 3 fixme carried from 28-03), `npx tsc --noEmit` clean, `npm run build` clean (bundle gate Δ0 KB — `/sops/[sopId]/page` unaffected, this plan touches no worker-facing client bundle beyond the passive caption text).

## Task Commits

1. **Task 1: Admin library — owner column, overdue badge, confirm-current, owner=me filter** - `e91177b` (feat)
2. **Task 2: Governance dashboard widget + worker currency caption** - `87d2af9` (feat)
3. **Task 3: Source-contract specs — library, worker no-gate, widget** - `17f709f` (test)

_Plan metadata commit (this SUMMARY + STATE/ROADMAP) follows below._

## Files Created/Modified
- `src/components/admin/sops/LibraryReviewCell.tsx` - Owner label + guarded overdue badge + wired confirm-current button
- `src/components/admin/governance/GovernanceWidget.tsx` - Counts card (overdue/unowned/due_soon) deep-linking to the governance queue
- `src/app/(protected)/admin/sops/page.tsx` - Owner+review columns, `?owner=me` filter/chip, owner label map, `LibraryReviewCell`/`GovernanceWidget` mounted
- `src/components/sop/tabs/OverviewTab.tsx` - ONE passive "Current as of" MetaRow, no gating
- `src/types/sop.ts` - `Sop` extended with 4 optional ownership/review fields
- `tests/phase28/library-and-worker.spec.ts` - Source-contract coverage for all of the above + worker no-gate assertions

## Decisions Made
- Made the 4 new `Sop` fields optional rather than required (deviation from the plan's literal `field: string | null` wording) because two pre-existing test files (`src/lib/voice/__tests__/sop-pack.test.ts`, `voice-qa-cache.test.ts`) construct partial `SopWithSections` mock fixtures that would otherwise fail `tsc --noEmit` for an unrelated, purely additive type extension. This matches the codebase's existing precedent (`pipeline_run_id?`, `flow_graph?`) for additive nullable columns.
- `GovernanceWidget`'s mount/import landed in Task 1's `page.tsx` commit rather than Task 2's, since both edits touch the same header block in the same file — avoided a hunk-level `git add -p` split for zero functional benefit (same reasoning as 28-04's OwnerPicker-moved-one-commit-earlier precedent).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Sop type fields made optional instead of required**
- **Found during:** Task 1, `npx tsc --noEmit` after extending `src/types/sop.ts`
- **Issue:** Two existing test files build partial `SopWithSections` mock objects for voice-QA unit tests; adding 4 new *required* fields to `Sop` broke those unrelated fixtures with `Type 'string | null | undefined' is not assignable to type 'string | null'`.
- **Fix:** Changed the 4 new fields to optional (`owner_user_id?: string | null`, etc.) — matches the existing `pipeline_run_id?`/`flow_graph?` optional-additive pattern already in the same interface. Zero behavioral change for any code that does supply the fields (real DB rows always populate them via the select).
- **Files modified:** `src/types/sop.ts`
- **Verification:** `npx tsc --noEmit` clean; full `npm run build` clean.
- **Committed in:** `e91177b` (Task 1 commit)

**2. [Rule 3 - Blocking] Spec's own comment text false-matched its `not.toContain('review_due_at')` assertion**
- **Found during:** Task 3, first run of the new spec
- **Issue:** `OverviewTab.tsx`'s own documentation comment (explaining the D28-07 hard rule) contains the literal substring `review_due_at`, so a bare `expect(src).not.toContain('review_due_at')` assertion failed even though the file has zero functional gating — same false-negative class noted in the 28-03 SUMMARY.
- **Fix:** Removed the redundant bare-substring assertion; kept only the `GATE_PATTERN` regex check, which correctly matches comparison/conditional usage and ignores prose mentions.
- **Files modified:** `tests/phase28/library-and-worker.spec.ts`
- **Verification:** All 12 spec assertions green; full `phase28`/`phase28-unit` suite green (47 passed, 3 fixme).
- **Committed in:** `17f709f` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking, no scope creep, no functional change to the shipped feature)
**Impact on plan:** None on final state or success criteria.

## Issues Encountered
None beyond the two auto-fixed items above.

## User Setup Required
None — no external service configuration required. All reads/writes ride the existing 28-03 server actions and RLS.

## Next Phase Readiness
- Admin library, dashboard widget, and worker caption are all live and wired to existing 28-03/28-04 infrastructure — no new server actions needed.
- D28-07 (worker never gated) is now enforced by an automated regex source-contract test on both `OverviewTab.tsx` and the worker walkthrough/detail routes, closing the loop opened by 28-CONTEXT.md's north-star rule.
- No blockers.

---
*Phase: 28-ownership-review-lifecycle-governance-queue*
*Completed: 2026-07-12*

## Self-Check: PASSED

All created/modified files verified present; all task commit hashes (`e91177b`, `87d2af9`, `17f709f`) verified in git log.
