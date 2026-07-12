---
phase: 29-approval-chains
plan: 05
subsystem: ui
tags: [nextjs-client-components, react, governance-queue, version-history, playwright]

requires:
  - phase: 29-02
    provides: approveStep/getApprovalHistory server actions, GovernanceRow.isCallerNextApprover, awaiting_approval classifier flag
  - phase: 29-04
    provides: ApprovalChainPanel pattern (presentational, props-in/callbacks-out) reused for the queue Approve wiring style
provides:
  - GovernanceQueueRow one-click Approve branch (top priority) wired to approveStep
  - GovernanceFilterChips awaiting_approval chip + GovernanceFilter union extension
  - GovernanceWidget awaiting_approval count + deep-link (GQ-04)
  - versions/page.tsx read-only approval history grouped per version (D29-06)
affects: [29-06+ (if any further approval-chain surfaces build on the queue/version-history UI)]

tech-stack:
  added: []
  patterns:
    - "GovernanceQueueRow's action chain stays a single if/else-if ladder — new branches are PREPENDED (highest priority first), never appended, so priority order is provable by string position in a source-contract test"
    - "versions/page.tsx fetches getApprovalHistory(versionIds) in the SAME effect as getVersionHistory, filters client-side by sopId === ver.id — no new server round-trip per version row"

key-files:
  created:
    - tests/phase29/queue-approve-action.spec.ts
    - tests/phase29/version-history-approvals.spec.ts
  modified:
    - src/components/admin/governance/GovernanceQueueRow.tsx
    - src/components/admin/governance/GovernanceFilterChips.tsx
    - src/components/admin/governance/GovernanceWidget.tsx
    - src/app/(protected)/admin/governance/page.tsx
    - src/app/(protected)/admin/sops/[sopId]/versions/page.tsx

key-decisions:
  - "Approve branch condition mirrors PATTERNS.md §7 exactly: awaiting_approval && isCallerNextApprover, prepended before unowned/stale_role — button visibility is UX-only, approveStep re-runs stepMatchesCaller server-side (T-29-05-01)"
  - "Approval history render is deliberately read-only: no button/action call inside the render block, proven by a negative source-contract assertion (no approveStep/requestChanges/cloneSopAsDraft/restoreVersionAsNew/uploadNewVersion call inside the verApprovals block)"

requirements-completed: [APR-03, APR-04, APR-05]

duration: ~15min
completed: 2026-07-12
---

# Phase 29 Plan 05: Queue Approve Action + Version History Approval Log Summary

**Governance queue rows now show a top-priority one-click Approve button when the caller is the next approver, every admin sees an awaiting-approval count/filter on the queue and dashboard widget, and the version-history page renders the read-only sop_approvals log grouped by version.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 3/3
- **Files modified:** 7 (5 modified, 2 created)

## Accomplishments

- `GovernanceQueueRow.tsx` — new top-priority branch: `row.flags.includes('awaiting_approval') && row.isCallerNextApprover` renders an "Approve" button wired to `approveStep(row.id)` inside a `useTransition`, mirroring `handleConfirmCurrent`'s error-surfacing + `router.refresh()` shape. `FLAG_STYLE`/`FLAG_LABEL` for `awaiting_approval` were already in place from 29-02's Rule-3 fix.
- `GovernanceFilterChips.tsx` — `GovernanceFilter` union and `CHIPS` array both gained `awaiting_approval`; `governance/page.tsx`'s `counts` record extended to match (the page's `visibleRows` filter already worked generically off `r.flags.includes(activeFilter)`, so no further edit needed there).
- `GovernanceWidget.tsx` — `counts.awaiting_approval` counter + a new deep-link chip to `/admin/governance?filter=awaiting_approval`, satisfying GQ-04's "overdue / unowned / awaiting approval" requirement text.
- `versions/page.tsx` — the existing `loadVersions` effect now also calls `getApprovalHistory(result.versions.map(v => v.id))` and stores the rows in state; each version row in the `versions.map` render filters `approvals` by `sopId === ver.id` and renders a read-only list (approver label, action, step label, NZ date, optional comment). Approver + step labels are fully resolved server-side by `getApprovalHistory` (reuses `getOrgMembers()` and `approval_snapshot[step_index].label` per 29-02) — no second member query, no new column.
- Two new source-contract spec files proving the wiring: Approve-branch priority order + `approveStep(` call site + filter chip/widget count (`queue-approve-action.spec.ts`), and the `getApprovalHistory(` fetch + per-version filter + read-only render block (`version-history-approvals.spec.ts`).

## Task Commits

1. **Task 1: Queue row Approve branch + awaiting_approval chip + widget count** - `22d2501` (feat)
2. **Task 2: Version-history approval log (grouped by version)** - `5630692` (feat)
3. **Task 3: Source-contract specs (queue Approve wiring + version history)** - `cc5ad50` (test)

## Files Created/Modified

- `src/components/admin/governance/GovernanceQueueRow.tsx` - top-priority Approve branch, wired to `approveStep`
- `src/components/admin/governance/GovernanceFilterChips.tsx` - `awaiting_approval` chip + `GovernanceFilter` union
- `src/components/admin/governance/GovernanceWidget.tsx` - `awaiting_approval` count + deep-link chip
- `src/app/(protected)/admin/governance/page.tsx` - `counts` record extended for the new filter value
- `src/app/(protected)/admin/sops/[sopId]/versions/page.tsx` - fetches + renders read-only approval history per version
- `tests/phase29/queue-approve-action.spec.ts` - source-contract specs (Approve wiring + priority order + chip/widget count)
- `tests/phase29/version-history-approvals.spec.ts` - source-contract specs (fetch + per-version filter + read-only render)

## Decisions Made

- Kept the Approve branch's onClick simple (`onClick={handleApprove}`, no inline arrow) matching the existing `handleConfirmCurrent` button's convention in the same file — no new interaction pattern introduced.
- Version-history approval rows render with the exact same `text-xs text-[var(--ink-500)]` / paper-ink styling used by the rest of the page (no new component needed for a short read-only list).

## Deviations from Plan

None — plan executed exactly as written. One incidental TypeScript narrowing fix (see below) was required to compile the version-history fetch.

### Auto-fixed Issues

**1. [Rule 1 - Bug] Narrowed getApprovalHistory's discriminated union before reading `.rows`**
- **Found during:** Task 2 (`npx tsc --noEmit`)
- **Issue:** `getApprovalHistory` returns `{ success: true; rows: [...] } | { error: string }`; accessing `.success`/`.rows` directly on the union without narrowing failed `tsc` ("Property does not exist on type").
- **Fix:** Used the same `'success' in approvalsResult && approvalsResult.success` narrowing pattern already used elsewhere in the codebase for this exact return shape.
- **Files modified:** `src/app/(protected)/admin/sops/[sopId]/versions/page.tsx`
- **Verification:** `npx tsc --noEmit` clean.
- **Committed in:** `5630692` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking TypeScript narrowing fix, no behavior change)
**Impact on plan:** No scope creep.

## Issues Encountered

None.

## User Setup Required

None — no new dependencies, no schema changes, no external service configuration.

## Verification

- `npx tsc --noEmit` clean.
- `npm run build` clean; bundle-size gate reported Δ0 KB (admin-only surfaces, no worker bundle impact).
- `npx playwright test --project=phase29 --project=phase29-unit --project=phase28 --project=phase28-unit` — 139 passed, 3 skipped (pre-existing `test.fixme` runtime cross-org cases per the Railway-only-testing convention), 0 failed. No regressions in phase28 governance queue/widget specs (additive edits only).

## Next Phase Readiness

- All three of Phase 29's locked approval surfaces (D29-05 builder publish stage from 29-04, governance queue from this plan, version history from this plan) are complete and wired to the single 29-02 backend.
- APR-03/APR-04/APR-05 all have UI coverage now; no further approval-chain UI work is outstanding per the CONTEXT.md decisions.
- No blockers.

---
*Phase: 29-approval-chains*
*Completed: 2026-07-12*

## Self-Check: PASSED
