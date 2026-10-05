---
phase: 59-the-office
fixed_at: 2026-10-06T00:00:00Z
review_path: .planning/phases/59-the-office/59-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 59: Code Review Fix Report

**Fixed at:** 2026-10-06
**Source review:** .planning/phases/59-the-office/59-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (CR-01, CR-02, WR-01..05; Info findings out of scope)
- Fixed: 7
- Skipped: 0

Gates after the last fix: `npx tsc --noEmit` clean; `npm run build` exit 0 (bundle gate: `/sops/[sopId]/page` 794 KB, Δ +2 KB; `/page` 833 KB, Δ -1 KB; baselines untouched); `phase59`, `phase56`, `phase55`, `phase46`, `phase37`, `phase15-stubs`, `phase58`, `phase28` with `--grep-invert "live|probe"`: 895 passed, 0 failed. No live probes run. No migration needed. Fixes were applied on the main working tree (the orchestrator's environment block named it and asked for per-file staging; a `/tmp` worktree would have had no `node_modules` for the build and test gates), staging only the files each finding touched.

## Fixed Issues

### CR-01: `recordSignature` is still an exported server action

**Files modified:** `src/actions/completions.ts`, `src/lib/validators/completions.ts`, `tests/phase55/worker-path-contract.spec.ts`, `tests/phase58/walk-actions.spec.ts`, `tests/phase59/signoff-actions.spec.ts`, `scripts/decision-writers.json`, `.planning/codebase/CAPABILITY-MATRIX.md`
**Commit:** 33c3f565
**Applied fix:** Dropped the `export`; `recordSignature` is now an internal helper taking typed `{ completionId, sopId, role }` from its two in-file callers. The endpoint-only guards (zod parse, session role gate, completion re-fetch) went with it since both callers already check role, org and completion; `RecordSignatureSchema` deleted. Both callers kept (`role` stays). Pins in phase55 / phase58 repointed to the real property; phase59 gained "exactly three exports, none named recordSignature". Writer-registry note and matrix row updated. `tests/phase59/capability-matrix.spec.ts` / `phase58` matrix rows still name `recordSignature()`, which still exists.

### CR-02: Re-inviting a pending invitee makes them a passwordless member and breaks their accept link

**Files modified:** `src/actions/auth.ts`, `tests/phase59/people-actions.spec.ts`
**Commit:** 3f6760df
**Applied fix:** `inviteWorker` computes `pending` with the same four conjuncts as `getTeamMembersWithEmails` (this site's org metadata, no membership row, `last_sign_in_at` null, `invited_at` set) after the already-a-member check; a pending invitee goes down the `inviteUserByEmail` branch (Supabase re-sends to an unconfirmed user; no membership insert) and the receipt says "Invite sent". Ledger details now carry `existing_account` only for a true existing account plus `resent`. `acceptInvite` sets the password first and treats a `23505` membership insert as already joined. Deviation from the reviewer's snippet: the org-metadata conjunct is kept (per the orchestrator's guidance), so a person with an un-accepted invite from a different org still takes the add-to-site branch; with the idempotent `acceptInvite` that is no longer a dead end.

### WR-01: `signOffCompletion` already-decided guard is read-then-write

**Files modified:** `src/actions/completions.ts`, `tests/phase59/signoff-actions.spec.ts`
**Commit:** 3a8cefd8
**Applied fix:** The status update moved ahead of every write and became a claim: `.update({ status: newStatus }).eq('id').eq('organisation_id').eq('status', 'pending_sign_off').select('id')`; zero rows returns "This walk has already been decided." before the sign-off row, the ledger row and the counter-signature. The pre-write status read stays as a fast path (its pin holds). No migration (no unique index) was needed. Spec pins the claim chain and the bail position.

### WR-02: One approval writes two ledger rows; the worker's submit row reads "Signed off"

**Files modified:** `src/actions/completions.ts`, `src/lib/decisions/read.ts`, `tests/phase59/signoff-actions.spec.ts`, `tests/phase59/ledger-read.spec.ts`, `scripts/decision-writers.json`
**Commit:** d817b5aa
**Applied fix:** Chose the option consistent with `read.ts` (`CLEARED_KINDS` counts `countersign`, "the worker's own sign_off row on submit is never counted"): an approval is logged once, as `countersign`, by `recordSignature`, which now takes the decision `details` (worker_id, reason, override) and returns `logged`; a rejection is logged once in `signOffCompletion` as `reject`. `KIND_WORDS.sign_off` = "Sent for sign-off" (the worker's submit), `KIND_WORDS.countersign` = "Signed off" (the supervisor's approval); summaries match. `CLEARED_KINDS` unchanged. `signOffCompletion` returns `logged` from whichever row it wrote. Registry entry/note updated (`signOffCompletion` kind `reject`). Flag: **requires human verification** only in the sense that the Decisions tab words changed -- the deployed `office.eval.ts` does not assert the chip text, so the next eval run should eyeball a Sign-offs row.

### WR-03: People tab, This SOP block and OwnerPicker have no try/catch around server actions

**Files modified:** `src/components/office/PeopleTab.tsx`, `src/components/focus/admin/ThisSopBlock.tsx`, `src/components/admin/governance/OwnerPicker.tsx`, `tests/phase59/people-tab.spec.ts`
**Commit:** 576f110a
**Applied fix:** `sendInvite`, `changeRole`, `confirmRemove`, `newCode`, `markReviewed`, `handleOpen`, `handlePick` now mirror `InboxRow.run`: `try` / `catch` sets the UI-SPEC line ("That didn't work. Nothing was changed — try again.") / `finally` re-enables the control. `newCode` gained an inline `codeError` line (it had nowhere to show one). Spec asserts each call sits inside a `try` and each busy flag is cleared in a `finally`.

### WR-04: The SOP focus page counts rejected walks as done

**Files modified:** `src/app/(protected)/sops/[sopId]/page.tsx`, `tests/phase59/signoff-actions.spec.ts`
**Commit:** f7f7a1df
**Applied fix:** `.neq('status', 'rejected')` added to the page's `sop_completions` read. Swept every other `from('sop_completions')` in `src/`: `useCompletions` (activity history, all statuses by design), `assessor.ts` (keyed on approved sign-offs), `signals.ts` / `synthesis-sweep` (agent counts), `office.ts` / `load-inbox.ts` / `observations.ts` (status-filtered or id lookups) -- none infer "done". Spec pins the filter on the page read.

### WR-05: `confirmSopCurrent` admin branch reports success on a zero-row update

**Files modified:** `src/actions/governance.ts`, `tests/phase59/owner-review-meta.spec.ts`
**Commit:** 6a6b50a9
**Applied fix:** The `sops` update now filters `.eq('organisation_id', ctx.organisationId)`, selects `id`, and returns `{ error: 'SOP not found' }` on zero rows before the `sop_review_events` insert and the ledger write, matching `setSopOwner` and the owner path. Spec pins the chain and the bail position.

## Skipped Issues

None.

---

_Fixed: 2026-10-06_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
