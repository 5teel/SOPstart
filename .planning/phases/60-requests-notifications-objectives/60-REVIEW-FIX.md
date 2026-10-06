---
phase: 60-requests-notifications-objectives
fixed_at: 2026-10-06T00:00:00Z
review_path: .planning/phases/60-requests-notifications-objectives/60-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 60: Code Review Fix Report

**Fixed at:** 2026-10-06
**Source review:** .planning/phases/60-requests-notifications-objectives/60-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (WR-01..WR-07; no criticals, Info items out of scope)
- Fixed: 7
- Skipped: 0

Gates after the fixes: `npx tsc --noEmit` clean; `npm run build` exit 0 with the bundle gate inside tolerance (`/sops/[sopId]/page` 794 KB vs 795 baseline, Δ -1 KB; `/page` 836 KB vs 834, Δ +2 KB; baseline untouched). Projects `phase60`, `phase56`, `phase59`, `phase58`, `phase55`, `phase15-stubs` with `--grep-invert "live|probe"`: 810 passed, 3 skipped, 4 failed in the worktree — all four (`phase58/fork-draft.spec.ts` x2, `phase59/owner-review-meta.spec.ts` x2) read untouched source files (`governance.ts`, `versioning.ts`) without `\r\n` normalisation and fail only because the fresh worktree checkout is CRLF (the 2026-07-18 learning); they pass on the main tree, and the committed blobs are LF (`git ls-files --eol` i/lf, clean 2-line diffs). No migration was needed. Nothing pushed.

## Fixed Issues

### WR-01: `approve_next` dedupe key collides across reject / re-request cycles

**Files modified:** `src/lib/notifications/kinds.ts`, `src/lib/notifications/write.ts`, `tests/phase60/notification-places.spec.ts`, `tests/phase60/notification-triggers.spec.ts`
**Commit:** 919872bf
**Applied fix:** `DedupeInput` for `approve_next` gains `cycle`; the key is `approve_next:<sop>:<version>:<cycle>:<step>`. Rather than threading a count through both callers, `notifyNextApprover` reads it once via a private `sendBackCount()` (service-role count of `sop_approvals` rows with `action = 'changes_requested'` for the session org, SOP and version). Both the publish divert and `approveStep` get it for free. Pinned: key shape and cycle-discrimination case in the kinds spec; the count call, org filter and action filter in the triggers spec.

### WR-02: Worker-facing titles and My-requests labels ship an email

**Files modified:** `src/lib/members/labels.ts`, `src/actions/requests.ts`, `src/actions/asks.ts`, `tests/phase60/notification-places.spec.ts`
**Commit:** a41c6001
**Applied fix:** New `nameForWorker(label)` (full name or null) beside `memberLabel`. Used for the `observe_accepted` and `ask_declined` titles (the title helper already prints "Someone" for null) and for `listMyRequests` labels (`answeredByLabel` falls back to "an admin", `targetLabel` to "a team member"). `requests.ts` no longer imports `memberLabel`. The asker-facing `targetLabel` in `askToDoSop` (supervisor+ only, T-60-30 accepted) is unchanged. Pinned with a behavioural case plus source-contract strings.

### WR-03: `notifyAssignedWorkers` notifies the actor and repoints without an org filter

**Files modified:** `src/actions/versioning.ts`, `tests/phase60/notification-triggers.spec.ts`
**Commit:** c5d1a25c
**Applied fix:** `userIds` filters out the session `userId`; the service-role `sop_assignments` update adds `.eq('organisation_id', organisationId)`. Both pinned in the existing `notifyAssignedWorkers` case.

### WR-04: Decline / stop revert rewrites `answered_by` and `decided_at`

**Files modified:** `src/lib/requests/ask-core.ts`, `tests/phase60/ask-do-sop.spec.ts`
**Commit:** 6c5f5678
**Applied fix:** `created_at` joins `CLAIM_COLUMNS` / `ClaimedAsk`; the two inline reverts become one `restoreAccepted()` that writes `answered_by: claimed.raised_by_user, decided_at: claimed.created_at, answer_note: null` under the session org. New spec case pins the helper, the column list and that neither core still writes `answered_by: userId` on revert.

### WR-05: Agent objective ledger row loses the SOP and the session user

**Files modified:** `src/lib/ai-fields/registry.ts`, `src/lib/ai-fields/registrations/objectives.ts`, `src/actions/ai-fields.ts`, `tests/phase60/ai-objective-fields.spec.ts`
**Commit:** 5b547af6
**Applied fix:** The `applied` `WriteResult` may carry `subject: { type, id }`; the objective descriptors return the subject `setObjectiveCore` resolved (lineage root, org-checked). `applyAiWrite` sets `sopId: serverSopId ?? (subject.type === 'sop' ? subject.id : null)` and writes `session_user_id`, `subject_type`, `subject_id` into `details` next to `field_id`. `agentName` was already a closed `z.enum(AGENT_NAMES)` (pinned by the phase56 writers sweep), so no change there. Pinned in the ai-objective-fields spec.

### WR-06: `review-due` sweep filters null dates before picking the latest version

**Files modified:** `src/lib/cron/sweeps.ts`, `tests/phase60/review-due.spec.ts`
**Commit:** 50257ab8
**Applied fix:** Dropped `.not('review_due_at', 'is', null)` from the sweep query; `reviewDueTargets` already runs `latestPublished` first and then skips a missing date. New case: a lineage whose newest version has no date yields no target, and the sweep source no longer pre-filters on the date.

### WR-07: Overview mark-read never surfaces a failed update

**Files modified:** `src/components/shell/SiteOverview.tsx`, `tests/phase60/overview-structure.spec.ts`
**Commit:** 889eca62
**Applied fix:** The race now resolves `{ error }` on both branches (the 3 s timer resolves `{ error: Error('timeout') }`); on any error (or a thrown one) the optimistic `setDimmed` is reverted for that row. The place still opens and both query keys are still invalidated. Pinned in the overview-structure spec.

## Skipped Issues

None.

---

_Fixed: 2026-10-06_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
