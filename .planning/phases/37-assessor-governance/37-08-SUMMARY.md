---
phase: 37-assessor-governance
plan: 08
subsystem: auth
tags: [supabase, rls, migration, competency, react, playwright]

# Dependency graph
requires:
  - phase: 37-assessor-governance
    provides: migration 00056 (assessor governance) + 00057 (cross-org guard restore), isSignedOffAssessor predicate, RecordObservationModal, CompletionDetailClient assessor gate UI
provides:
  - Migration applier that can no longer re-drop the 00057 cross-org write guard on production (applies 00056+00057 in order, assertion pinned to the restored conjunct)
  - Order-independent isSignedOffAssessor predicate (a rejected sign-off row can no longer shadow an approved one)
  - RecordObservationModal per-SOP state reset scoped to every sopId change (not just the open transition)
  - CompletionDetailClient opens the override sheet on a server-side ASSESSOR_OVERRIDE_REQUIRED race instead of stranding the user
affects: [37-assessor-governance, any future phase touching the assessor predicate or migration applier scripts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Migration applier fallback loops an ordered array of migration files instead of a single-file const, with apply-order pinned by index comparison in its regression spec"
    - "Slice-scoped source-contract assertions (window around a specific occurrence, not file-global toContain) to prove wiring survives even when the same token/setter exists elsewhere in the file for an unrelated reason"

key-files:
  created:
    - tests/phase37/gap-migration-and-state.spec.ts
  modified:
    - scripts/apply-phase37-migration.mjs
    - src/lib/competency/assessor.ts
    - src/lib/competency/__tests__/assessor.test.ts
    - src/components/observations/RecordObservationModal.tsx
    - src/app/(protected)/activity/[completionId]/CompletionDetailClient.tsx

key-decisions:
  - "Proved the WR-01 test RED via a temporary local revert of the predicate's Map-based logic (not git stash, which is prohibited in worktrees) — reverted, ran the single test, confirmed FAIL, restored the fix, reran the full 9-test suite GREEN"
  - "WR-04's regression assertion scopes to the ASSESSOR_OVERRIDE_REQUIRED occurrence inside handleApprove specifically (not file-global), because the same string also appears in mapSignOffError's copy-mapping branch and setOverrideSheetOpen(true) already exists elsewhere in the file (handleApproveClick's pre-emptive open) — a file-global assertion would pass on both the broken and fixed versions"

patterns-established:
  - "A migration applier that names N migrations in its cosmetic strings/banners must actually apply all N in every code path (db push success, Management API fallback, manual instructions) — a tool that undercounts what it applies is how a partial-apply regression reopens a previously-closed security hole"

requirements-completed: [ASR-01]

# Metrics
duration: 25min
completed: 2026-07-28
---

# Phase 37 Plan 08: Gap Closure — Migration Applier + Assessor Predicate + UI State Summary

**Fixed the migration applier's own blind spot (it could re-drop the cross-org write guard it exists to protect), made the sign-off predicate immune to row order, and closed two UI state races in the observation modal and sign-off surface.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3 completed
- **Files modified:** 5 modified, 1 created

## Accomplishments
- `scripts/apply-phase37-migration.mjs` now applies 00056 AND 00057 in order on every code path (db push success message, Management API fallback loop, manual-instructions block), and its own post-apply assertion now requires `sop_observation_refs_in_org` alongside the two substrings it already checked — the tool can no longer print `ALL PASS` while the live policy is missing the org-scope guard.
- `isSignedOffAssessor` no longer collapses `completion_sign_offs` rows into a per-completion `Map` (which kept only the last row in unordered query results); `hasSignOff` and `latestPositiveEvidenceAt` now evaluate `.some()`/`.filter()` over every row, so a later `rejected` row can never shadow an earlier `approved` one.
- `RecordObservationModal`'s per-SOP UI state (`assessorStatus`, `requestSent`, `overrideOpen`, `overrideReason`) resets on every `sopId` change via the `[sopId]` effect, not only the modal's open-transition — changing the selected SOP can no longer flash the previous SOP's blocked/override/request state.
- `CompletionDetailClient`'s `handleApprove` error branch now opens the override sheet when the server returns `ASSESSOR_OVERRIDE_REQUIRED` and `canOverride` is true, closing the dead-end race where a stale client-side `isAssessor` skipped the sheet but the server still demanded a reason with no way to supply one.

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration applier must apply 00056+00057 and assert the restored conjunct (CR-02)** - `0ef41cd` (fix)
2. **Task 2: Order-independent sign-off evaluation (WR-01) and two UI state fixes (WR-03, WR-04)** - `a889738` (fix)
3. **Task 3: Regression spec for the applier and the two UI state machines** - `14657b1` (test)

**Plan metadata:** (this commit)

## Files Created/Modified
- `scripts/apply-phase37-migration.mjs` - MIGRATION_FILE → MIGRATION_FILES [00056, 00057]; fallback loops both in order; assertion group 3 pins `sop_observation_refs_in_org`; header/banner/success strings say "00056 + 00057"
- `src/lib/competency/assessor.ts` - `signOffByCompletion` Map removed; `hasSignOff`/`latestPositiveEvidenceAt` computed order-independently over all sign-off rows
- `src/lib/competency/__tests__/assessor.test.ts` - new WR-01 test case (approved + rejected rows on one completion → true), proven RED against the pre-fix Map implementation
- `src/components/observations/RecordObservationModal.tsx` - per-SOP state reset moved into the `[sopId]` effect (runs on every SOP change, not only modal open)
- `src/app/(protected)/activity/[completionId]/CompletionDetailClient.tsx` - `handleApprove`'s error branch opens the override sheet on `ASSESSOR_OVERRIDE_REQUIRED && canOverride`
- `tests/phase37/gap-migration-and-state.spec.ts` (new) - slice-scoped regression guards for CR-02, WR-01, WR-03, WR-04

## Decisions Made
- Proved the WR-01 unit case RED against the pre-fix implementation via a temporary local revert of just the predicate lines (git stash is prohibited in worktree mode per the destructive-git-operations rule) — reverted the Map-based logic, ran only the new test (`-g "WR-01"`), confirmed it failed with `Expected: true, Received: false`, then restored the fix and reran the full 9-test suite green.
- WR-03/WR-04 regression assertions are slice-scoped rather than file-global, per the plan's own guidance: a file-global `toContain` for `setAssessorStatus(null)` etc. would pass on the pre-fix code (those setters already exist in the open-transition block), and a file-global `toContain('setOverrideSheetOpen(true)')` would pass on the pre-fix code too (the setter already exists in `handleApproveClick`'s pre-emptive open). Scoping to the `[sopId]` effect window (WR-03) and to the occurrence inside `handleApprove` specifically (WR-04) is what makes each assertion fail if its fix is reverted.

## Deviations from Plan

None - plan executed exactly as written. All four fixes (CR-02, WR-01, WR-03, WR-04) match the plan's `<action>` blocks verbatim; no additional bugs or missing functionality were discovered while reading the target files.

## Issues Encountered

None. `tsc --noEmit` clean, `npm run build` clean (bundle +2 KB within ±2 KB tolerance), `npx playwright test --project=phase35-unit -g "assessor"` 9/9 green, `npx playwright test --project=phase37` 83 passed / 6 pre-existing skips (zero `test.fixme` in the new file), `npm run test` shows 37 pre-existing failures all confined to unrelated legacy phase stubs (phase3/11/12.5/15/20/21/26/29/32/33) — none touching any file this plan modified, confirmed by grepping the full test-run output for phase37/phase35-unit/assessor.ts/RecordObservationModal/CompletionDetailClient/apply-phase37 failures (zero matches).

## Safety Compliance

`scripts/apply-phase37-migration.mjs` was modified but **never executed** — verified with `node --check` only (exit 0), per the plan's explicit production-DB safety instruction. No live migration was applied or re-applied as part of this plan.

## User Setup Required

None - no external service configuration required. The fixed applier still requires a deliberate operator run against production (unchanged from prior phases); this plan only fixes its logic, it does not run it.

## Next Phase Readiness

- The two blockers from 37-VERIFICATION.md/37-REVIEW.md that gated this closure pass (CR-02, WR-01) are fixed and pinned by regression assertions; WR-03/WR-04 (both Warning-level) are also closed.
- IN-01 (multi-recipient request rows stale after one admin acts) and IN-02 (dead re-validation of `overrideReason` in `completions.ts`) remain deliberately open per the plan's own scope note — both Info-level, each requiring its own small plan rather than a co-located fix.
- No route added/removed/renamed and no user-facing flow changed in this plan — `journeys.ts`/`uat/tests.ts` require no edit (confirmed against the plan's own note).

---
*Phase: 37-assessor-governance*
*Completed: 2026-07-28*

## Self-Check: PASSED

All 6 files created/modified verified present; all 3 task commits (`0ef41cd`, `a889738`, `14657b1`) verified present in git log.
