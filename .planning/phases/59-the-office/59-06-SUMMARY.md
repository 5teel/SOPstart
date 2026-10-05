---
phase: 59-the-office
plan: 06
subsystem: signoff-server
tags: [sign-off, approvals, rls, ledger, capability-matrix, office]
requires: [59-04, 59-05]
provides:
  - "signOffCompletion refuses the caller's own walk and an already-decided walk, awaits recordSignature (supervisor) after the status update, returns logged"
  - "getCompletionForReview(completionId) in src/actions/office.ts: session read first, photos signed only for returned rows, isAssessor / canOverride computed on the server"
  - "src/lib/completions/review.ts: signCompletionPhotos, orderedReviewSteps, assessorFor"
  - "approveStep returns { logged, published }, requestChanges returns { logged }, ApprovalStatus.version"
  - "setApprovalChain refuses a person step unless that user is an admin or safety manager of the session org"
  - "rejected completions are not counted as done in useWorkerSops and all five competency reads"
affects: [59-08, 59-09, 59-15, 59-16]
key-files:
  created:
    - src/lib/completions/review.ts
  modified:
    - src/actions/completions.ts
    - src/actions/approvals.ts
    - src/actions/office.ts
    - src/actions/competency.ts
    - src/hooks/useWorkerSops.ts
    - src/app/(protected)/activity/[completionId]/CompletionDetailClient.tsx
    - scripts/decision-writers.json
    - .planning/codebase/CAPABILITY-MATRIX.md
    - tests/phase59/signoff-actions.spec.ts
    - tests/phase59/approve-actions.spec.ts
    - tests/phase59/capability-matrix.spec.ts
key-decisions:
  - "A walk that is not pending_sign_off is refused ('This walk has already been decided.') so a double submit writes one sign-off row and one ledger row (RESEARCH Pitfall 11)"
  - "A failed counter-signature is logged, not surfaced: the sign-off is already recorded and the status changed"
  - "getCompletionForReview also returns the existing decision (decided) so the panel can show a decided walk without a second read"
requirements-completed: []
completed: 2026-10-05
---

# Phase 59 Plan 06: Sign-off server Summary

**Sign-off can no longer be self-approved, double-submitted or skip its counter-signature; the Office has a session-first completion review read; approval actions report `logged` / `published`; a rejected walk counts as not done everywhere.**

OFF-02 and OFF-03 are not ticked here: the panels (59-08) and the pane (59-09) land later.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | 0accfb0c | own-walk refusal, server counter-signature, `logged`; approvals `logged` / `published` / `version`; chain-member check; writer registry; matrix rows |
| 2 | 29a983ff | `getCompletionForReview`, `src/lib/completions/review.ts`, read-order specs |
| 3 | eaf4c39b | `.neq('status', 'rejected')` on the hook and all five competency reads |

## Verification

- `npx tsc --noEmit` clean; `npm run build` exit 0 (bundle gate: `/page` 832 KB, `/sops/[sopId]/page` 793 KB, both +1 KB, baseline untouched).
- phase59 signoff-actions 10 passed (0 fixme); approve-actions and capability-matrix cases for 59-06 flipped and green (remaining fixme belong to 59-07/08/10/13/15).
- phase56 103 passed (delegated hook for `signOffCompletion` included, publish-gate pin green); phase37 `assessor-ui-signoff` 11; phase29 63; phase58 `walk-actions` and capability-matrix 25; phase35 + phase36 137; phase55 + phase34 162; phase46 15. Live probes were excluded (`--grep-invert "live|probe"`) except phase56 and phase29, which self-skip; no env flag was set.

## Findings

- **competency.ts did count rejected walks; fixed.** All five `sop_completions` reads (lines ~203, 365, 576, 703, 782) now take `.neq('status', 'rejected')`, none needed a justification to skip. Pending stays counted in the worker hook (the work was done and awaits a decision).
- **Approval chain drift (A-02).** `approveStep` / `requestChanges` / `getApprovalStatus` are `requireAdmin()`-guarded, so the matrix cell that let a supervisor approve a named step was wrong; corrected. The `/admin/settings` picker (`page.tsx` lines 80-92) already lists only admins and safety managers, so no UI change; `setApprovalChain` now enforces the same on the server before the write.
- **The old review page's service-role read by id is not carried over.** `getCompletionForReview` reads through the session client with the session org filter; the old page (`activity/[completionId]/page.tsx`) is untouched and retires in 59-15.
- For CLAUDE.md Learnings in 59-16: a UI action that makes a second server call "best effort" after the real one (the old client-side `recordSignature`) is a skippable legal record; do it in the same server action, after the state change.

## Deviations from Plan

**1. [Rule 2 - Missing critical] Already-decided guard.** The plan's behaviour list did not name it, but the prompt's Pitfall 11 requirement (a double submit must not write two ledger rows) needs it: `completion.status !== 'pending_sign_off'` is refused before any write. `status` added to the completion select. The phase37 position pins (`isSignedOffAssessor` once, after the decision branch and org guard; one `if (role === 'supervisor')`) still hold.

**2. [Minor] `CompletionDetailClient.tsx`:** `currentUserId` is no longer destructured (still in the prop type; the page still passes it, removed in 59-15).

**3. [Minor] `approve-actions` "publish gate untouched" case** asserts the `performPublish(supabase, {` call is intact and the phase56 pin spec exists; the hash itself stays enforced by phase56 `publish-gate-pin`, which passed.

## Known Stubs

None.

## Threat Flags

None beyond the register. T-59-22..26b mitigations are in place: session-client read first with a session-org prefix check on every signed path; own walk and already-decided refused before writes; `await recordSignature(` after the status update, pinned as a delegated hook; guards and publish gate unchanged; UUID-only input to the review read; chain members checked against the session org's admins and safety managers.

## Self-Check: PASSED

- Files exist: `src/lib/completions/review.ts`, this SUMMARY.
- Commits in git log: 0accfb0c, 29a983ff, eaf4c39b.
- `grep createAdminClient src/actions/office.ts` returns nothing; `grep recordSignature` on `CompletionDetailClient.tsx` returns nothing.
