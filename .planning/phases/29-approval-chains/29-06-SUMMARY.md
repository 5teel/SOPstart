---
phase: 29-approval-chains
plan: 06
subsystem: testing
tags: [playwright, source-contract, merged-tree-gate, approval-chains, requirements-audit]

requires:
  - phase: 29-01
    provides: migration 00045, resolveNextStepIndex/stepMatchesCaller, performPublish()/assertPublishGates() extraction
  - phase: 29-02
    provides: src/actions/approvals.ts backend, publish-route chain-gate divert, listGovernanceQueue isCallerNextApprover
  - phase: 29-03
    provides: ApprovalChainEditor config UI
  - phase: 29-04
    provides: ApprovalChainPanel + PublishStage/BuilderStageShell wiring
  - phase: 29-05
    provides: GovernanceQueueRow Approve branch, version-history approval log
provides:
  - tests/phase29/phase-gate.spec.ts (5-requirement APR audit manifest, one assertion group per requirement)
  - Confirmed green merged-tree gate — full phase29+phase29-unit suite, phase28+phase28-unit regression, tsc, next build
affects: [v6.0 milestone closeout, Phase 30 (TRN-01..03, REV-05) building on top of the approval-chains surfaces]

tech-stack:
  added: []
  patterns:
    - "Phase-gate manifest spec reads real shipped source files directly (fs.readFileSync) and asserts on real call-site strings — ties each APR requirement to ONE runnable proof instead of scattering the audit across 8 wave specs"

key-files:
  created:
    - tests/phase29/phase-gate.spec.ts
  modified: []

key-decisions:
  - "phase-gate.spec.ts asserts against the actual shipped artifacts (migration SQL, publish route, approvals.ts, ApprovalChainEditor/Panel, GovernanceQueueRow, governance.ts, versions/page.tsx) rather than re-deriving assertions already proven in Wave 1-3 specs — a manifest, not a re-implementation"
  - "No fix-forward needed — all Wave 1-3 work composed cleanly on first run of the full merged-tree gate"

requirements-completed: [APR-01, APR-02, APR-03, APR-04, APR-05]

duration: ~15min
completed: 2026-07-12
---

# Phase 29 Plan 06: Merged-Tree Gate Summary

**Final phase-29 gate: a 5-requirement APR audit manifest spec plus a fully green merged-tree run (phase29+phase29-unit, phase28+phase28-unit regression, tsc, and a real `next build` with Δ0 KB bundle gate) — zero fix-forward required.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2/2
- **Files modified:** 1 (created)

## Accomplishments

- `tests/phase29/phase-gate.spec.ts` — 14 tests, one assertion group per APR requirement (APR-01..05), each reading the real shipped file and asserting on the real call-site/schema evidence:
  - **APR-01:** migration RLS predicate (`current_organisation_id`, never `app_metadata`), publish route no-chain `performPublish(` call, `ApprovalChainEditor` → `setApprovalChain(`.
  - **APR-02:** `sop_approvals` partial unique index (`where action = 'approved'`), publish route `approval_snapshot: chainRow.steps` write, `requestChanges`'s update statement proven to touch only `approval_state` (not `approval_snapshot`).
  - **APR-03:** `GovernanceQueueRow` Approve branch → `approveStep(`, `ApprovalChainPanel` → `onApprove(`/`onRequestChanges(`.
  - **APR-04:** `approveStep`'s final-step branch calling `performPublish(` with `approvalState: 'approved'` (ordering-checked via string-index comparison), `resolveNextStepIndex` imported (not duplicated) by both `approvals.ts` and `governance.ts`, `listGovernanceQueue` computing `isCallerNextApprover`.
  - **APR-05:** `versions/page.tsx` calling `getApprovalHistory(` and filtering rows per version (`approvals.filter((a) => a.sopId === ver.id)`).
- Ran the full merged-tree gate: `phase29-unit` + `phase29` + `phase28-unit` + `phase28` = 152 passed, 3 skipped (pre-existing live-DB `test.fixme` cross-org cases from Phase 28, unchanged), 0 failed.
- `npx tsc --noEmit` — clean, zero errors.
- `npm run build` — clean production build; bundle-size postbuild gate: `/sops/[sopId]/page = 1057 KB (baseline 1057 KB, Δ 0 KB)`; all three isolation checks (worker bundle, source-viewer, Konva) passed.
- Confirmed `journeys.ts` untouched across the whole phase (`git log -- src/lib/journeys/journeys.ts` last touched in Phase 28's `1dc9b7c`) — Phase 29 reused three existing routes (`/admin/governance`, `/admin/sops/builder/[sopId]`, `/admin/sops/[sopId]/versions`), all three already present in the pathways map from prior phases, so no edit was needed and none was made.

## Task Commits

1. **Task 1: 5-requirement audit manifest spec** - `c4ca890` (test)
2. **Task 2: Full merged-tree gate (phase29 + phase28 regression + tsc + build)** - no commit (verification-only task; zero fix-forward, nothing to stage)

## Files Created/Modified

- `tests/phase29/phase-gate.spec.ts` - 14-test audit manifest, one group per APR-01..05

## Decisions Made

- Wrote the manifest to read real source files directly (mirroring the Wave 1-3 spec convention) rather than importing/mocking modules — keeps it a pure source-contract proof consistent with the rest of the phase's test suite, and avoids any live-DB dependency.
- Did not add any new assertions duplicating Wave 1-3 spec depth (e.g. priority ordering, idempotency, comment-guard) — those are already proven in `queue-approve-action.spec.ts`, `approval-actions.spec.ts`, etc. This file's job is the requirement-to-artifact tie, not re-proving behavior.

## Deviations from Plan

None - plan executed exactly as written. The full merged-tree gate passed on the first run with zero fix-forward needed.

## Issues Encountered

None.

## User Setup Required

None - no new dependencies, no schema changes, no external service configuration.

## Verification

- `npx playwright test --project=phase29 -g "APR-0"` — 14/14 passed (Task 1 acceptance criterion).
- `npx playwright test --project=phase29-unit --project=phase29 --project=phase28-unit --project=phase28` — 152 passed, 3 skipped (pre-existing fixme), 0 failed.
- `npx tsc --noEmit` — clean.
- `npm run build` — clean; postbuild bundle-size gate Δ0 KB, all isolation checks passed.
- `journeys.ts` confirmed untouched for the entire phase (last commit touching it predates Phase 29); all three reused admin routes already mapped.

## Next Phase Readiness

- Phase 29 (Approval Chains) is fully complete: all 5 APR requirements (APR-01..05) shipped, audited, and proven with real evidence, zero regressions to Phase 28's governance/publish surfaces, and a clean production build.
- v6.0 milestone: 17/21 requirements now complete (Phase 28's 12 OWN/REV/GQ + Phase 29's 5 APR); Phase 30 (TRN-01..03, REV-05) is the remaining scope.
- No blockers.

---
*Phase: 29-approval-chains*
*Completed: 2026-07-12*

## Self-Check: PASSED
