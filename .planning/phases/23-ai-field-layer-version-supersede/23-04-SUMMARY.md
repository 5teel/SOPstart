---
phase: 23-ai-field-layer-version-supersede
plan: "04"
subsystem: ai-field-layer
tags: [ai-fields, approval-gate, write-api, inline-diff, security]
dependency_graph:
  requires: ["23-01", "23-02"]
  provides: ["AFL-AI-02"]
  affects: []
tech_stack:
  added: []
  patterns:
    - Injectable AdminInsertFn seam for unit-testable approval gate
    - gateWrite as SINGLE write path (route never calls descriptor.write() directly)
    - A6 ambiguity fail-safe: sopId + undefined sopIsPublished → require approval
    - Stale-proposal guard: sop_version validated before acceptProposal applies
key_files:
  created:
    - src/lib/ai-fields/approval.ts
    - src/actions/ai-fields.ts
    - src/app/api/ai-fields/write/route.ts
    - src/components/ai-fields/InlineProposalDiff.tsx
    - src/lib/ai-fields/__tests__/approval.test.ts
  modified:
    - src/lib/validators/ai-fields.ts
decisions:
  - Injectable AdminInsertFn seam avoids live-DB dependency in unit tests; production path uses default
  - gateWrite exported from approval.ts (not actions/) so it can be unit-tested in phase23-unit without 'use server' boundary
  - AcceptProposalSchema/RejectProposalSchema added to validators/ai-fields.ts (single schema source of truth)
  - Route resolves sopIsPublished from sop.status before delegating to applyAiWrite — closes A6 ambiguity before gating
  - FieldDescriptor<string> annotations in tests changed to FieldDescriptor to resolve TypeScript contravariance
metrics:
  duration: "450s (~7.5min)"
  completed: "2026-06-26"
  tasks_completed: 3
  files_created: 5
  files_modified: 1
requirements: [AFL-AI-02]
---

# Phase 23 Plan 04: AI Write Layer — Tiered Approval Gate + Write Route + Inline Diff Summary

**One-liner:** Tiered approval gate (gateWrite) with D-01/D-02/A6 fail-safe, POST write route as v5.0 agent entrypoint, and inline Accept/Reject diff component — privilege-escalation surface locked.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | gateWrite unit tests (failing) | 3e35fec | approval.test.ts |
| 1 (GREEN) | gateWrite tiered approval gate + validator schemas | 9b29160 | approval.ts, validators/ai-fields.ts, approval.test.ts |
| 2 | Write API route + applyAiWrite/acceptProposal/rejectProposal | 537cae5 | ai-fields.ts, write/route.ts |
| 3 | InlineProposalDiff component (D-03) | d69ea2e | InlineProposalDiff.tsx |

## What Was Built

### approval.ts — gateWrite tiered gate (D-01/D-02/A6)

`gateWrite(descriptor, context, newValue, currentValue, adminInsert?)`:
- **Low-stake + draft SOP**: calls `descriptor.write()` exactly once → `{outcome:'applied'}`
- **High-stake OR published SOP**: NEVER calls `descriptor.write()` → inserts pending row → `{outcome:'pending_approval', proposalId}`
- **A6 fail-safe**: `sopId` present but `sopIsPublished` undefined → treated as high-stake (require approval)

`isHighStakeContext(descriptor, context)` covers all three escalation paths:
- `descriptor.stakeLevel === 'high'`
- `context.sopIsPublished === true` (D-02)
- `context.sopId !== undefined && context.sopIsPublished === undefined` (A6)

Injectable `AdminInsertFn` seam: tests pass a fake insert that returns a stable proposalId; production omits it (default uses `createAdminClient()`).

### src/actions/ai-fields.ts — Server actions

- `applyAiWrite`: Zod-validates, auth guards, calls `gateWrite` — the SINGLE write path (T-23-04-02)
- `acceptProposal`: admin-only + org-scope; validates `sop_version` staleness before applying (T-23-04-03); uses `createAdminClient` (CLAUDE.md 2026-06-15)
- `rejectProposal`: admin-only + org-scope; sets status='rejected' via admin client

### src/app/api/ai-fields/write/route.ts — POST write route (D-04)

v5.0 conversational-agent entrypoint:
- Imports `@/lib/ai-fields/registrations` as side-effect (RESEARCH Pitfall 3)
- Resolves `sopIsPublished` from `sop.status` before gating → closes A6 ambiguity window for all route calls
- Delegates exclusively to `applyAiWrite` — never calls `descriptor.write()` directly

### src/components/ai-fields/InlineProposalDiff.tsx — Inline diff component (D-03)

- Renders at the field where a pending proposal exists — no central queue (D-03 invariant)
- Block-content fields: reuses `diffBlockContent` from D-07 for per-field side-by-side diffs
- Scalar fields: plain struck-through old → highlighted new
- Accept (green-accent) and Reject (ink-neutral) buttons both wired to server actions (CLAUDE.md 2026-06-05)
- `router.refresh()` called after both actions for server component re-fetch
- `data-inline-proposal-diff` test hook
- Design tokens: paper/ink palette, JetBrains Mono for diff values

### src/lib/validators/ai-fields.ts — Extended

Added `AcceptProposalSchema` and `RejectProposalSchema` (both `{ proposalId: uuid }`).

## Verification Results

```
npx playwright test --project=phase23-unit -g "approval|gate"   → 9 passed
npx playwright test --project=phase23-stubs -g "AFL-AI-02"      → 4 passed
grep gateWrite src/actions/ai-fields.ts                         → single write path confirmed
npx tsc --noEmit                                                 → clean
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FieldDescriptor<string> contravariance in unit tests**
- **Found during:** Task 1 TypeScript check after GREEN implementation
- **Issue:** `FieldDescriptor<string>` is not assignable to `FieldDescriptor<unknown>` due to TypeScript's contravariance on the `write` function's `newValue` parameter.
- **Fix:** Changed test descriptor type annotations from `FieldDescriptor<string>` to `FieldDescriptor` (the base `unknown` type). This is the correct approach — `gateWrite` operates on `FieldDescriptor<unknown>` and tests should match.
- **Files modified:** `src/lib/ai-fields/__tests__/approval.test.ts`
- **Commit:** 9b29160

## Threat Surface Scan

All STRIDE threats from the plan's `<threat_model>` are mitigated:

| Threat | Status |
|--------|--------|
| T-23-04-01: Auto-applied write reaches published-SOP field | MITIGATED — `isHighStakeContext` + A6 fail-safe; unit test asserts write spy NOT called for high-stake |
| T-23-04-02: Route bypasses gateWrite | MITIGATED — `applyAiWrite` is the only write path; route delegates exclusively; `acceptProposal` is the only place `descriptor.write()` is called directly |
| T-23-04-03: Stale proposal applied after re-publish | MITIGATED — `acceptProposal` validates `sop_version` still matches before applying |
| T-23-04-04: Cross-org proposal read/accept | MITIGATED — admin client queries filtered by `organisation_id` from JWT; admin role guard |
| T-23-04-05: Forged proposalId/unknown fieldId | MITIGATED — Zod uuid validation; `getField` allow-list; proposal load filtered by org |

No new threat surface introduced beyond the plan's documented boundaries.

## Known Stubs

None — all handlers are wired; no placeholder text or empty onClick callbacks.

## Self-Check: PASSED

Files exist:
- [x] `src/lib/ai-fields/approval.ts` — FOUND
- [x] `src/actions/ai-fields.ts` — FOUND
- [x] `src/app/api/ai-fields/write/route.ts` — FOUND
- [x] `src/components/ai-fields/InlineProposalDiff.tsx` — FOUND
- [x] `src/lib/ai-fields/__tests__/approval.test.ts` — FOUND
- [x] `src/lib/validators/ai-fields.ts` (modified) — FOUND

Commits exist:
- [x] 3e35fec (RED tests)
- [x] 9b29160 (GREEN implementation)
- [x] 537cae5 (write route + actions)
- [x] d69ea2e (InlineProposalDiff)
