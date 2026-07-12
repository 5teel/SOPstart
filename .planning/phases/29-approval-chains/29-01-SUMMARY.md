---
phase: 29-approval-chains
plan: 01
subsystem: database
tags: [supabase, rls, postgres, zod, nextjs-server-actions, playwright]

requires:
  - phase: 28-ownership-review-lifecycle-governance-queue
    provides: sop_review_cadences/sop_review_events settings-table + append-only shapes, current_organisation_id() RLS predicate fix, requireAdmin() pattern, publish route review-clock reset
provides:
  - Migration 00045 live (approval_chains, sop_approvals, sops.approval_state/approval_snapshot)
  - src/lib/governance/approvals.ts pure chain-progression logic (resolveNextStepIndex, stepMatchesCaller, isChainComplete)
  - src/lib/validators/approvals.ts Zod schemas (chainStepSchema, approvalChainSchema)
  - src/lib/governance/publish-core.ts performPublish()/assertPublishGates() — single source of publish truth
  - Thin publish route delegating to performPublish, byte-identical no-chain response
  - phase29/phase29-unit Playwright projects registered
affects: [29-02 (chain config UI + approveStep/requestChanges actions + governance queue awaiting_approval), 29-03+ (version history approval display)]

tech-stack:
  added: []
  patterns:
    - "performPublish()/assertPublishGates() extraction — the ONE function both the no-chain route path and the future approveStep final-step branch call, so 'byte-identical' and 'same publish logic' claims are literally true"
    - "Partial unique index (where action='approved') for idempotent-approve guard — never a blanket unique(sop_id,version,step_index), which would break multi-cycle reject/resubmit"

key-files:
  created:
    - supabase/migrations/00045_approval_chains.sql
    - scripts/apply-phase29-migration.mjs
    - src/lib/governance/approvals.ts
    - src/lib/validators/approvals.ts
    - src/lib/governance/publish-core.ts
    - src/lib/governance/__tests__/approvals.test.ts
    - tests/phase29/approval-schema.spec.ts
    - tests/phase29/publish-core-extraction.spec.ts
  modified:
    - src/types/database.types.ts
    - playwright.config.ts
    - src/app/api/sops/[sopId]/publish/route.ts
    - tests/phase28/governance-actions.spec.ts

key-decisions:
  - "approval_chains RLS uses current_organisation_id() from day one (never app_metadata) — closes the HR-01 bug class before it ships, instead of retroactively fixing it like Phase 28 had to"
  - "sop_approvals idempotency guard is a partial unique index scoped to action='approved', not a blanket 3-column unique constraint"
  - "assertPublishGates() factored out of performPublish() so Plan 29-02's chain-gate can run the identical gates before diverting an SOP into pending_approval"
  - "tests/phase28/governance-actions.spec.ts repointed at publish-core.ts (not the route) since the logic it asserts on moved there verbatim"

patterns-established:
  - "Settings table + append-only audit table pair for a new governance feature (approval_chains/sop_approvals) mirrors sop_review_cadences/sop_review_events exactly"

requirements-completed: [APR-01, APR-02, APR-04]

duration: ~35min
completed: 2026-07-12
---

# Phase 29 Plan 01: Approval Chains Foundation Summary

**Migration 00045 (approval_chains + sop_approvals + sops.approval_state/approval_snapshot) live on prod; pure chain-progression logic module; performPublish() extracted from the publish route as the single shared publish function, proven byte-identical for the no-chain path.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-07-12T08:47:13Z
- **Tasks:** 3/3
- **Files modified:** 12

## Accomplishments
- Migration 00045 pushed and verified live via `to_regclass`/`information_schema` (bypassing the PostgREST schema-cache staleness trap) — `approval_chains`, `sop_approvals`, and the two new `sops` columns all confirmed present.
- Pure, unit-tested chain-progression module (`resolveNextStepIndex`/`stepMatchesCaller`/`isChainComplete`) with zero I/O, mirroring the `classify.ts` extraction discipline.
- `performPublish()`/`assertPublishGates()` extracted from the publish route — the route is now a ~40-line thin caller, and the no-chain response shape (including the `unverified_blocks` `count` field) is byte-identical to pre-Phase-29 behavior.

## Task Commits

1. **Task 1: Migration 00045 + unattended live push + database.types.ts** - `955c1d4` (feat)
2. **Task 2: Pure approvals.ts + Zod validators + phase29 registration + unit tests** - `f2f1b6c` (test)
3. **Task 3: Extract performPublish() + rewire publish route + byte-identical proof** - `f150f4b` (refactor)

## Files Created/Modified
- `supabase/migrations/00045_approval_chains.sql` - sops columns + approval_chains + sop_approvals, correct RLS predicate + partial unique index
- `scripts/apply-phase29-migration.mjs` - db push + Management API cache-bypassing verification (copies apply-phase26.5 shape, adds raw-SQL fallback if push lacks a password)
- `src/types/database.types.ts` - added `approval_state`/`approval_snapshot` to sops Row/Insert/Update
- `src/lib/governance/approvals.ts` - resolveNextStepIndex/stepMatchesCaller/isChainComplete/ChainStep
- `src/lib/validators/approvals.ts` - chainStepSchema/approvalChainSchema
- `src/lib/governance/__tests__/approvals.test.ts` - 8 unit tests, phase29-unit
- `playwright.config.ts` - phase29/phase29-unit projects registered
- `tests/phase29/approval-schema.spec.ts` - migration RLS predicate + partial index source-contract
- `src/lib/governance/publish-core.ts` - performPublish()/assertPublishGates()
- `src/app/api/sops/[sopId]/publish/route.ts` - thin caller delegating to performPublish
- `tests/phase29/publish-core-extraction.spec.ts` - relocation proof + no approval_chains branch yet
- `tests/phase28/governance-actions.spec.ts` - PUBLISH_ROUTE constant repointed at publish-core.ts (logic moved there verbatim)

## Decisions Made
- Used the 00044-fixed `current_organisation_id()` RLS predicate directly in migration 00045 rather than the (buggy) predicate 00043 originally shipped with — closes the HR-01 bug class at the source instead of needing a follow-up fix migration.
- `sop_approvals`'s idempotent-approve guard is a partial unique index (`where action = 'approved'`), not a blanket 3-column unique constraint, per RESEARCH Pitfall 4 — preserves legitimate multi-cycle reject/resubmit flows.
- `assertPublishGates()` exported as a standalone function (not inlined in `performPublish`) specifically so Plan 29-02 can call the identical gate checks before diverting an SOP into `pending_approval`, per the locked D29-03 ordering.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `tests/phase28/governance-actions.spec.ts` PUBLISH_ROUTE constant repointed to publish-core.ts**
- **Found during:** Task 3 (extraction verification)
- **Issue:** Three phase28 source-contract tests (`resets review_due_at...`, `inserts a 'superseded' sop_review_events row...`, `review-clock reset is non-fatal...`) read `route.ts` directly and failed once the review-clock-reset/superseded-event logic they assert on was relocated verbatim into `publish-core.ts` — the plan's own instruction "Phase 28 publish specs MUST stay green" required fixing the read target, not the logic (which is unchanged, just moved).
- **Fix:** Updated the `PUBLISH_ROUTE` path constant in `tests/phase28/governance-actions.spec.ts` to point at `src/lib/governance/publish-core.ts`, with a comment explaining the Phase 29 relocation.
- **Files modified:** `tests/phase28/governance-actions.spec.ts`
- **Verification:** `npx playwright test --project=phase28 --project=phase28-unit` — 57 passed, 3 fixme (unchanged from pre-Phase-29 baseline).
- **Committed in:** `f150f4b` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug/test-target-drift)
**Impact on plan:** Necessary fallout of a same-plan extraction the plan itself mandated ("Phase 28 publish specs MUST stay green — run them"). No scope creep; no logic changed.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required. `.env.local` already carried `SUPABASE_ACCESS_TOKEN` from prior phases, used for the unattended migration push.

## Next Phase Readiness
- Schema, pure resolver, Zod validators, and `performPublish()`/`assertPublishGates()` are all live and unit-tested — Plan 29-02 can build `src/actions/approvals.ts` (setApprovalChain/approveStep/requestChanges), the chain-gate insertion into the publish route, and the governance queue `awaiting_approval` extension directly on top of this foundation with no further schema or extraction work needed.
- `npx tsc --noEmit` and `npm run build` both clean; bundle gate unchanged (Δ0 KB — server-only route, no worker bundle impact).
- No blockers.

---
*Phase: 29-approval-chains*
*Completed: 2026-07-12*

## Self-Check: PASSED
