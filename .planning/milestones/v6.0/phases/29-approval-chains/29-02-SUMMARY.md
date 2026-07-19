---
phase: 29-approval-chains
plan: 02
subsystem: backend
tags: [nextjs-server-actions, supabase, rls, zod, playwright, governance-queue]

requires:
  - phase: 29-01
    provides: approval_chains/sop_approvals schema, resolveNextStepIndex/stepMatchesCaller pure resolver, performPublish()/assertPublishGates() extraction, phase29/phase29-unit Playwright projects
provides:
  - src/actions/approvals.ts (setApprovalChain, getApprovalChains, approveStep, requestChanges, getApprovalStatus, getApprovalHistory)
  - src/actions/governance.ts requireAdmin() exported with role; listGovernanceQueue computes isCallerNextApprover
  - Publish-route chain-gate divert into approval_state='pending' (locked assertPublishGates-before-divert ordering)
  - src/lib/governance/classify.ts awaiting_approval flag
affects: [29-03+ (chain config UI, ApprovalChainPanel in builder PublishStage, GovernanceQueueRow Approve action, version history approval display)]

tech-stack:
  added: []
  patterns:
    - "requireAdmin() exported once from governance.ts and reused by approvals.ts — single source of auth/org/role resolution, never duplicated"
    - "approveStep's final-step branch calls the SAME performPublish() the no-chain publish route calls — one publish path, not a parallel pipeline (D29-03)"
    - "assertPublishGates() runs BEFORE the pending-approval divert in the publish route (locked ordering) — an unverified/unapproved SOP can never enter pending_approval"
    - "isCallerNextApprover kept OUT of the pure classifyGovernanceRow input — it's a per-viewer concern computed in listGovernanceQueue and surfaced on GovernanceRow, not baked into the classifier"

key-files:
  created:
    - src/actions/approvals.ts
    - tests/phase29/approval-actions.spec.ts
    - tests/phase29/publish-chain-gate.spec.ts
    - tests/phase29/queue-classifier.spec.ts
  modified:
    - src/actions/governance.ts
    - src/app/api/sops/[sopId]/publish/route.ts
    - src/lib/governance/classify.ts
    - src/lib/governance/__tests__/classify.test.ts
    - src/components/admin/governance/GovernanceQueueRow.tsx
    - tests/phase29/publish-core-extraction.spec.ts

key-decisions:
  - "requireAdmin() changed from private to exported, AdminCtx extended with role — additive, existing { userId, organisationId } destructures unaffected"
  - "approveStep/requestChanges use the PLAIN session client throughout (never createAdminClient) — every caller is already admin/safety_manager per the two D29-05-locked surfaces, so admins_can_update_sops already covers every sops write this phase makes"
  - "GovernanceQueueRow.tsx FLAG_STYLE/FLAG_LABEL extended with an awaiting_approval entry as a Rule-3 blocking fix (Record<GovernanceFlag,string> exhaustiveness) — the isCallerNextApprover-gated Approve button itself is out of scope for this backend-only plan"

requirements-completed: [APR-01, APR-02, APR-03, APR-04]

duration: ~30min
completed: 2026-07-12
---

# Phase 29 Plan 02: Approval Chains Backend Summary

**The full approval state machine: chain CRUD, one-click approve/request-changes, the publish-route chain-gate divert into pending_approval, and the governance queue awaiting_approval flag — all wired to the single shared performPublish() and the pure resolveNextStepIndex/stepMatchesCaller resolver from 29-01.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-07-12T09:05:27Z
- **Tasks:** 3/3
- **Files modified:** 11

## Accomplishments

- `src/actions/approvals.ts` — the whole chain-progression action layer: `setApprovalChain` (service-role, org from JWT-derived ctx only), `getApprovalChains`, `approveStep` (server-side `stepMatchesCaller` gate before insert, idempotent on 23505, final-step branch auto-completes publish via `performPublish`), `requestChanges` (required comment, clears `approval_state` to null, leaves `approval_snapshot` in place), `getApprovalStatus` and `getApprovalHistory` (reuses `getOrgMembers()` for approver labels, resolves step labels from `approval_snapshot` — no redundant schema).
- `requireAdmin()` in `governance.ts` is now exported and its ctx carries `role`, so `approvals.ts` reuses the identical auth/org/role resolution instead of duplicating it.
- Publish route now runs `assertPublishGates()` BEFORE any pending-approval divert (locked D29-03 ordering) — an SOP with unapproved sections or unverified blocks can never enter `pending_approval`, chain or no chain. Chained-category SOPs are diverted into `approval_state='pending'` + a snapshot of the current chain steps; the divert is idempotent on repeat "request publish" clicks. No-chain categories fall through to `performPublish()` byte-identically.
- `classify.ts` gained the `awaiting_approval` flag (pushed on `hasPendingApproval`); `listGovernanceQueue` selects the new `sops.approval_state/approval_snapshot/version` columns and computes `isCallerNextApprover` per row — but only queries `sop_approvals` for rows that are actually pending, skipping the extra query entirely for the common case.

## Task Commits

1. **Task 1: approval action layer + export requireAdmin with role** - `ba741a7` (feat)
2. **Task 2: publish-route chain-gate divert into pending_approval** - `c735f80` (feat)
3. **Task 3: governance queue awaiting_approval flag + isCallerNextApprover** - `c21e8fe` (feat)

## Files Created/Modified

- `src/actions/approvals.ts` - setApprovalChain/getApprovalChains/approveStep/requestChanges/getApprovalStatus/getApprovalHistory
- `src/actions/governance.ts` - requireAdmin exported with role; listGovernanceQueue computes isCallerNextApprover (pending rows only)
- `src/app/api/sops/[sopId]/publish/route.ts` - chain-gate divert, assertPublishGates-before-divert locked ordering
- `src/lib/governance/classify.ts` - awaiting_approval flag on hasPendingApproval
- `src/lib/governance/__tests__/classify.test.ts` - awaiting_approval unit cases added
- `src/components/admin/governance/GovernanceQueueRow.tsx` - FLAG_STYLE/FLAG_LABEL exhaustiveness fix for the new flag
- `tests/phase29/approval-actions.spec.ts` - source-contract proof of the action layer wiring
- `tests/phase29/publish-chain-gate.spec.ts` - source-contract proof of the chain-gate divert + locked ordering
- `tests/phase29/publish-core-extraction.spec.ts` - updated to the post-chain-gate contract (old "no approval_chains branch" assertion removed)
- `tests/phase29/queue-classifier.spec.ts` - source-contract proof of the classifier + queue wiring

## Decisions Made

- Kept `isCallerNextApprover` OUT of the pure `classifyGovernanceRow` input (per the plan's explicit instruction) — it's a per-viewer concern computed in `listGovernanceQueue` and surfaced on `GovernanceRow`, not baked into the org-wide classifier.
- Every write this phase makes to `sops` (entering pending, final-approval publish, request-changes reset) uses the plain session client, never `createAdminClient()` — Pitfall 1/3 scoping (every approver is already admin/safety_manager) means `admins_can_update_sops` already covers these writes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking fix] GovernanceQueueRow.tsx FLAG_STYLE/FLAG_LABEL exhaustiveness**
- **Found during:** Task 3 (`npx tsc --noEmit` after extending `GovernanceFlag` with `'awaiting_approval'`)
- **Issue:** `FLAG_STYLE`/`FLAG_LABEL` are typed `Record<GovernanceRow['flags'][number], string>` — adding a new `GovernanceFlag` union member without extending these two maps broke `tsc`/`next build` with "Property 'awaiting_approval' is missing".
- **Fix:** Added the `awaiting_approval` entry to both maps, using the exact styling/label PATTERNS.md § 7 specifies (`bg-[var(--accent-signoff)]/20 text-[var(--accent-signoff)]` / `'Awaiting approval'`) so a later UI plan can wire the actual Approve-button branch against an already-correct label/style without revisiting this file.
- **Files modified:** `src/components/admin/governance/GovernanceQueueRow.tsx`
- **Verification:** `npx tsc --noEmit` clean; `npm run build` clean (bundle gate Δ0 KB).
- **Committed in:** `c21e8fe` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking TypeScript exhaustiveness fix, no behavior change beyond the minimum needed to compile)
**Impact on plan:** No scope creep — the isCallerNextApprover-gated Approve button UI itself remains out of scope for this backend-only plan, per PATTERNS.md § 7 (a later plan's work).

## Issues Encountered

Interleaved Task 1 and Task 3 edits into `governance.ts` mid-execution while reading ahead in the plan; caught before committing and split back into the correct per-task diffs (Task 1 committed only the `requireAdmin` export/role change, Task 3 committed the `listGovernanceQueue` extension alongside `classify.ts`) so each commit's scope matches its task exactly.

## User Setup Required

None — no external service configuration required, no new dependencies, no schema changes (migration 00045 already live from 29-01).

## Next Phase Readiness

- The full backend approval state machine (chain CRUD, approve/request-changes, publish-route divert, queue flag) is live, unit-tested, and wired to the single shared `performPublish()`/pure resolver from 29-01.
- Plan 29-03+ can build the chain config UI (`ApprovalChainEditor` on `/admin/governance`), the `ApprovalChainPanel` in the builder `PublishStage` (via `getApprovalStatus`), the `GovernanceQueueRow` Approve-action branch (styling/label already in place from this plan's Rule-3 fix), and the version-history approval display (via `getApprovalHistory`) directly on top of this backend with no further schema or action-layer work needed.
- `npx tsc --noEmit` and `npm run build` both clean; bundle gate unchanged (Δ0 KB — server-only/backend changes, no worker bundle impact).
- Runtime cross-org write-isolation for `setApprovalChain`/`approveStep`/`requestChanges` carried as `test.fixme` per the Railway-only-testing convention (phase27/28/29-01 precedent) — no live-DB runtime tests were added or removed by this plan.
- No blockers.

---
*Phase: 29-approval-chains*
*Completed: 2026-07-12*

## Self-Check: PASSED
