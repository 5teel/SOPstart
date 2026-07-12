---
phase: 29-approval-chains
plan: 04
subsystem: frontend
tags: [nextjs-server-actions, react-client-components, builder-publish-stage, approval-chains]

requires:
  - phase: 29-02
    provides: approveStep/requestChanges/getApprovalStatus server actions with pendingApproval response shape
provides:
  - src/components/admin/governance/ApprovalChainPanel.tsx (presentational pending-chain display + Approve/Request-changes)
  - PublishStage approvalStatus prop + conditional ApprovalChainPanel mount
  - BuilderStageShell approve/request-changes handlers + pendingApproval-aware handlePublish
  - page.tsx getApprovalStatus fetch threaded to the shell
affects: [29-05 (governance queue Approve action), 29-06 (version history approval display)]

tech-stack:
  added: []
  patterns:
    - "ApprovalChainPanel is purely presentational (props in, callbacks out) — identical contract to PublishStage, no fetch/Supabase/action import inside it"
    - "No-chain SOPs (approvalStatus null) render byte-identically to before this plan — D29-03"
    - "handleApproveStep/handleRequestChanges mirror handlePublish's useCallback+router.refresh shape"

key-files:
  created:
    - src/components/admin/governance/ApprovalChainPanel.tsx
    - tests/phase29/publish-stage-approval.spec.ts
  modified:
    - src/app/(protected)/admin/sops/builder/[sopId]/PublishStage.tsx
    - src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx
    - src/app/(protected)/admin/sops/builder/[sopId]/page.tsx

key-decisions:
  - "Request-changes comment is required client-side (button disabled until non-empty) in addition to the existing server-side guard in requestChanges() — belt and suspenders, not a security boundary (the server re-checks per the threat model)"
  - "handlePublish's success branch now parses the response body and checks pendingApproval explicitly (rather than relying on the pre-existing unconditional router.refresh()) so the wiring is provable at the source-contract level and future changes to the two outcomes can diverge if needed"

requirements-completed: [APR-03, APR-04]

duration: ~20min
completed: 2026-07-12
---

# Phase 29 Plan 04: Builder Publish Stage Approval Surface Summary

**The builder's Publish stage now shows the pending approval chain (step list, who's next) and lets the matching approver Approve or Request-changes in one click, without touching the no-chain publish flow.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3/3
- **Files modified:** 5 (3 created, 3 modified — one file straddles both counts is not the case; see key-files)

## Accomplishments

- `ApprovalChainPanel.tsx` — presentational component rendering the ordered step list with approved/current/waiting chips (derived from `approvals`/`nextStepIndex`), plus a one-click Approve button and a Request-changes control gated behind a required one-line comment. Renders the action controls only when `canAct` (the caller is the next approver). No fetch/Supabase/action import — matches `PublishStage`'s controlled/presentational contract.
- `PublishStage.tsx` gained an optional `approvalStatus` prop (plus `onApproveStep`/`onRequestChanges`/`approvalActionPending`/`approvalError`) and mounts `ApprovalChainPanel` only when `approvalStatus?.state === 'pending'`. The existing "Publish SOP" button and all other markup are completely unchanged for no-chain SOPs.
- `BuilderStageShell.tsx` now fetches nothing itself but accepts `approvalStatus` from the page, owns `handleApproveStep`/`handleRequestChanges` (calling `approveStep`/`requestChanges` from `src/actions/approvals.ts`, mirroring `handlePublish`'s useCallback+router.refresh shape), and threads both the status and handlers to `PublishStage`. `handlePublish`'s success branch now explicitly parses the response body and checks `pendingApproval` — a chained-category publish request is treated as success, not an error, and `router.refresh()` re-fetches the SOP so the panel appears.
- `page.tsx` calls `getApprovalStatus(sopId)` after the existing role-guarded SOP fetch and passes the result down as the `approvalStatus` prop.
- `tests/phase29/publish-stage-approval.spec.ts` — 12 source-contract tests proving real wiring (not bare prop presence): conditional mount ordering, Approve/Request-changes onClick handlers, the comment-length disable guard, `approveStep(`/`requestChanges(` call sites in the shell's handlers, the `<PublishStage`/`<BuilderStageShell` prop-threading, and `pendingApproval` referenced in `handlePublish`.

## Task Commits

1. **Task 1: ApprovalChainPanel.tsx** - `dcad9ad` (feat)
2. **Task 2: Thread approvalStatus through page -> shell -> PublishStage** - `c9329e0` (feat)
3. **Task 3: Source-contract specs** - `820f98b` (test)

## Files Created/Modified

- `src/components/admin/governance/ApprovalChainPanel.tsx` - presentational pending-chain panel
- `src/app/(protected)/admin/sops/builder/[sopId]/PublishStage.tsx` - approvalStatus prop + conditional panel mount
- `src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx` - approve/request-changes handlers, pendingApproval-aware handlePublish
- `src/app/(protected)/admin/sops/builder/[sopId]/page.tsx` - getApprovalStatus fetch
- `tests/phase29/publish-stage-approval.spec.ts` - source-contract specs (12 tests)

## Decisions Made

- Kept the Request-changes required-comment guard on BOTH the client (button disabled) and server (`requestChanges()` already rejects an empty comment) — the client guard is UX only; per the threat model (T-29-04-01) the server re-check is the real gate.
- `handlePublish` now does a small, explicit `pendingApproval` check rather than leaving the unconditional `router.refresh()` implicit — makes the wiring provable at the source-contract level per the plan's acceptance criteria, with no behavior change (both outcomes already refreshed before this plan).

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no new dependencies, no schema changes, no external service configuration.

## Verification

- `npx tsc --noEmit` clean.
- `npm run build` clean; bundle-size gate reported Δ0 KB (admin-only surface, no worker bundle impact).
- `npx playwright test --project=phase29` — 58/58 passed (12 new + 46 pre-existing from 29-01/02/03).

## Next Phase Readiness

- The builder Publish stage now fully surfaces APR-03/APR-04 (pending chain display + one-click approve/request-changes) on top of the 29-02 backend, with the no-chain publish path byte-identical to before.
- Plan 29-05 can add the matching Approve action to the governance queue row (styling/label already in place from 29-02's Rule-3 fix); plan 29-06 can add the version-history approval display via `getApprovalHistory` — neither depends on further changes to this plan's files.
- No blockers.

---
*Phase: 29-approval-chains*
*Completed: 2026-07-12*

## Self-Check: PASSED
