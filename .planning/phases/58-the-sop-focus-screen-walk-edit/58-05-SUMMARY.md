---
phase: 58-the-sop-focus-screen-walk-edit
plan: 05
subsystem: publish-gate
tags: [publish-gate, hash-pin, lineage, notifications]
requires: [58-02, 58-03]
provides:
  - "assertPublishGates re-keyed: no_steps / unverified_steps / open_findings, for every SOP"
  - "src/actions/publish-gate.ts: getPublishGateStatus { ready, total, unchecked, openFindings, reasons }"
  - "performPublish notifies and re-points assignments for a version with a published predecessor"
affects: [58-06, 58-12, 58-13, 58-16]
key-files:
  created:
    - src/actions/publish-gate.ts
  modified:
    - src/lib/governance/publish-core.ts
    - src/actions/sop-section-blocks.ts
    - src/app/api/sops/[sopId]/publish/route.ts
    - scripts/verify-gate-check.tsx
    - tests/phase56/publish-gate-pin.spec.ts
    - tests/phase58/publish-gate.spec.ts
key-decisions:
  - "The old builder's getPublishGateStatus stays as a thin mapper onto the new action (bypassed always false) so its chip agrees with the server until 58-16"
  - "BuilderStageShell's publish error text now reads the new codes instead of leaving a dead 'unverified_blocks' branch"
requirements-completed: []
completed: 2026-10-05
---

# Phase 58 Plan 05: Publish gate re-key Summary

**The publish gate now counts focus steps, unticked steps and open AI findings for every SOP, its hash is re-pinned once with the D-16 decision recorded, and publishing a new version re-points and notifies the old version's workers.**

Requirement ids WRK-04 and SOP-04 are not ticked: no UI reads the new status yet (58-12/13) and the deployed eval is what proves them.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | `38ae3217` | gate re-key, `getPublishGateStatus`, re-pin, every gate-pinned spec repointed |
| 2 | `bf4a6081` | lineage predecessor read before the write, `notifyAssignedWorkers` after the ledger row |

## Gate pin

| | sha256 of `assertPublishGates` body |
|---|---|
| old (Phase 56) | `43cd12ec266ec2508c710c8e7faac869b3ae7a128a947940fce29ce5a0935849` |
| new (D-16) | `78120e600bbd91d805a6317a7f98d37e5aa498f27a1ffb4a6519d5e52c962d33` |

The decision text sits in the `publish-gate-pin.spec.ts` header. Task 2 did not touch the gate body, so the hash is unchanged by it. `performPublish` still runs the gate before its first write (pinned, plus a lineage read that writes nothing).

## Guard-sweep hits (all repointed in the Task 1 commit)

| File | Change |
|---|---|
| `tests/phase56/publish-gate-pin.spec.ts` | hash, D-16 header |
| `tests/builder/builder-review-flow.spec.ts` (R10) | `unverified_steps` |
| `tests/builder/builder-edit-stage.spec.ts` (E7) | asserts the route calls `assertPublishGates(` and the gate emits `unverified_steps` (the route comment no longer carries the old literal) |
| `tests/phase26/spine-regression.spec.ts` | `unverified_steps` + 400 regex |
| `tests/phase26/verify-gate.spec.ts` | title / header (it runs the harness) |
| `tests/phase29/publish-core-extraction.spec.ts` | focus-step and open-finding tables replace the `approved` / `unverified_blocks` assertions |
| `tests/phase40/spine-freeze.spec.ts` | `unverified_steps` |
| `tests/integration/scp-verify-checklist.test.ts` | `unverified_steps` |
| `tests/integration/scp-parse-pipeline.test.ts` (SCP-PARSE-06) | not in the plan's list; it pinned the old status action's `ready:` expression. Now asserts the delegation |
| `src/components/admin/verify-checklist/__tests__/publish-gate.integration.test.ts` | four gate tests rewritten onto the new contract |
| `scripts/verify-gate-check.tsx` | fake DB serves `sop_focus_steps` / `sop_ai_findings`; four gate cases plus a lineage-notify case; `actions/versioning` stubbed alongside `lib/decisions/record` |
| `src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx`, `BlockEditShell.tsx` comment, `src/lib/uat/tests.ts` | last `unverified_blocks` literals in `src/` gone |

`tests/phase55/sop-pack.spec.ts`, `tests/phase40/reparse-precondition.spec.ts` and the `ai_prompt` hits in phase26.5 are unrelated to the gate and untouched. The junction/provenance cases in `spine-regression` stay for 58-16.

## Verification

- `npx tsc --noEmit` clean; `npm run build` exit 0, bundle gates Δ 0 KB.
- Green: phase56 (101), phase58 (62 + 53 skipped stubs), phase26 (77), phase29 (83), phase46 (30), phase26.5 (42), phase21-stubs (26), phase21.5-stubs (34), phase21.6-stubs (7), phase15-stubs (80); `npx tsx scripts/verify-gate-check.tsx` prints `VERIFY-GATE OK`.
- Red, not from this plan, logged in `deferred-items.md`: phase40 `dat01-category-column` (58-04's `focus-steps.ts` sops writes), phase55 `deletion-sweep` (58-01's eval skeleton title). The publish-gate integration test file is registered in no project; its four gate tests pass through a throwaway config.

## Freeze note (D-23)

From this commit until 58-14/16, publishing from the old builder is refused: it cannot tick `sop_focus_steps`, and a SOP whose focus steps have not been generated has `no_steps`. The converter/on-ramps (58-07, 58-14) are what make a SOP publishable again.

## Approver-notify residual

`notifyAssignedWorkers` is session-scoped and refuses non-admin / non-safety-manager callers. When a chain approver who is neither completes the final approval, `performPublish` logs the refusal and skips the re-point and notification. The publish and ledger row are unaffected, and workers still reach the new version through the lineage rule in the page resolver (58-11). Same for the old versions-page path, which calls it from an admin session.

## Deviations from Plan

**1. [Rule 3] SCP-PARSE-06 and the `BuilderStageShell` error text were repointed though not in the plan's file list.** The first would have gone red; the second kept a branch for an error code the server can no longer send, and the acceptance grep requires zero `'unverified_blocks'` literals outside phase58.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register: T-58-gate (unconditional three-count gate, gate-before-write pinned), T-58-08 (decision in the pin header), T-58-09 (lineage rows filtered by the session `organisationId`), T-58-10 (notify is fail-soft).

## Self-Check: PASSED

- `src/actions/publish-gate.ts` and this SUMMARY exist; commits `38ae3217` and `bf4a6081` exist.
