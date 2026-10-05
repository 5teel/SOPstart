---
phase: 59-the-office
reviewed: 2026-10-06T00:00:00Z
depth: standard
files_reviewed: 60
files_reviewed_list:
  - src/actions/office.ts
  - src/actions/auth.ts
  - src/actions/completions.ts
  - src/actions/governance.ts
  - src/actions/approvals.ts
  - src/actions/assignments.ts
  - src/actions/competency.ts
  - src/actions/admin-sop-list.ts
  - src/actions/org-model.ts
  - src/actions/shell.ts
  - src/lib/members/remove.ts
  - src/lib/members/labels.ts
  - src/lib/governance/owner-review.ts
  - src/lib/governance/inbox.ts
  - src/lib/governance/load-inbox.ts
  - src/lib/completions/review.ts
  - src/lib/decisions/read.ts
  - src/lib/decisions/shape.ts
  - src/lib/office/format.ts
  - src/lib/shell/office-tabs.ts
  - src/lib/shell/place.ts
  - src/lib/shell/query-keys.ts
  - src/lib/sop-list/admin-rows.ts
  - src/lib/sop/focus-read.ts
  - src/lib/supabase/middleware.ts
  - src/lib/validators/auth.ts
  - src/app/(protected)/activity/[completionId]/page.tsx
  - src/app/(protected)/activity/[completionId]/CompletionDetailClient.tsx
  - src/app/(protected)/activity/page.tsx
  - src/app/(protected)/admin/training/page.tsx
  - src/app/(protected)/sops/[sopId]/page.tsx
  - src/app/page.tsx
  - supabase/migrations/00073_office_ledger.sql
  - scripts/apply-phase59-migration.mjs
  - scripts/eval-fixtures.mjs
  - scripts/check-bundle-size.ts
  - src/components/office/OfficePane.tsx
  - src/components/office/InboxTab.tsx
  - src/components/office/InboxRow.tsx
  - src/components/office/SignOffPanel.tsx
  - src/components/office/ApprovePanel.tsx
  - src/components/office/ReasonDialog.tsx
  - src/components/office/DecisionsTab.tsx
  - src/components/office/PeopleTab.tsx
  - src/components/admin/governance/OwnerPicker.tsx
  - src/components/admin/governance/OwnerReviewMeta.tsx
  - src/components/admin/governance/AdminMachinePanel.tsx
  - src/components/admin/competency/TrainingBridge.tsx
  - src/components/activity/CompletionStepRow.tsx
  - src/components/shell/ShellFrame.tsx
  - src/components/shell/AdminShell.tsx
  - src/components/shell/WorkerShell.tsx
  - src/components/shell/AdminRoomBodies.tsx
  - src/components/shell/RoomBodies.tsx
  - src/components/focus/FocusFrame.tsx
  - src/components/focus/FocusWalker.tsx
  - src/components/focus/admin/FocusEditor.tsx
  - src/components/focus/admin/ThisSopBlock.tsx
  - src/hooks/useCompletions.ts
  - src/hooks/useWorkerSops.ts
findings:
  critical: 2
  warning: 5
  info: 6
  total: 13
status: issues_found
---

# Phase 59: Code Review Report

**Reviewed:** 2026-10-06
**Depth:** standard
**Files Reviewed:** 60
**Status:** issues_found

## Summary

The trust boundaries the orchestrator asked about hold up well: `office.ts` has no service-role import and every export derives org/actor from the session; `deleteOrgMember` / `markReviewedAsOwner` filter on the session org plus the identity predicate and report zero rows as failure; `getCompletionForReview` and `/activity/[completionId]` read through the session client first and only sign photos that came back (the non-owner redirect happens before any signing); `listDecisions` rides the org+role-scoped `admins_can_read_decisions` policy and validates the cursor as `datetime + uuid`; `officeRedirectFor` is UUID-gated with fixed templates; `setApprovalChain` refuses non-admin/safety-manager approvers and `approveStep` still runs `performPublish` on the final step; `inviteWorker` / `updateMemberRoleSafe` are admin-only with the last-admin guard; invited detection uses four conjuncts. Esc layering (lightbox window-capture → dialog React handler → row document-capture → shell window-bubble, each checking `defaultPrevented` / `aria-modal`) is coherent. The inbox panels mount only for the open row and `SignOffBody` / `ApproveBody` are keyed by record id, so no cross-record leakage. No "block" in user copy; no raw numbered palette classes; every token used (`accent-ok`, `accent-decision`, `accent-measure`, `ai`, `ink-*`, `paper-*`) is declared in `blueprint-theme.css`. Capability matrix and `journeys.ts` were updated in the phase.

Two blockers remain, both of the "parameter / export outlived its legitimate caller" class CLAUDE.md records twice: `recordSignature` is still a client-reachable server action that forges counter-signature + ledger rows with no status or assignment check, and `inviteWorker`'s existing-account branch silently converts a still-pending invitee into a passwordless member and breaks their accept link.

## Critical Issues

### CR-01: `recordSignature` is still an exported server action — any supervisor can forge a counter-signature and a `countersign` ledger row on any undecided completion in the org

**File:** `src/actions/completions.ts:411-475`
**Issue:** Both legitimate callers (`submitCompletion` line 160, `signOffCompletion` line 318) are in the same file, and no client imports it (grep confirms), yet it remains `export async function` in a `'use server'` module, so it is a POST-reachable endpoint for every org member. The guard only checks session role for `role === 'supervisor'` and org membership of the completion; there is no `status === 'signed_off'` check, no `supervisor_assignments` check, and no dedupe. Consequences:
- A supervisor (or SM/admin) calls `recordSignature({ completionId, role: 'supervisor' })` on any `pending_sign_off` completion in the org → an immutable `sop_completion_signatures` row plus a `countersign` ledger row ("Counter-signed a completion") for a walk nobody decided. `countersign` is in `CLEARED_KINDS`, so it also inflates "N cleared today".
- A worker calls it with `role: 'worker'` on their own completion repeatedly → unlimited duplicate worker signatures and `sign_off` ledger rows.
The ledger refuses UPDATE/DELETE for every role, so forged rows are permanent. This is the exact shape of the Phase 55 `recordSignature` finding (`rosterUserId` outlived its caller) — the parameter was removed then, the endpoint was not.
**Fix:**
```ts
// completions.ts — drop the export; both callers are in this file.
async function recordSignature(rawInput: unknown): Promise<...> { ... }
```
If an external caller is ever needed again, add `status` gating (`worker` → status must be `pending_sign_off` and no existing worker signature; `supervisor` → status must be `signed_off` and caller must be the sign-off's `supervisor_id`). Add a source-contract assertion that `completions.ts` has exactly four `export async function`s and none named `recordSignature`.

### CR-02: Re-inviting a pending invitee (or inviting anyone with an un-accepted invite from another org) silently makes them a passwordless member and breaks their accept link

**File:** `src/actions/auth.ts:163-184` (and `acceptInvite` at `:249-259`)
**Issue:** `inviteUserByEmail` creates an `auth.users` row immediately, so a person who was invited but has not accepted already exists in `listUsers`. The new existing-account branch only checks for a membership row, finds none, and inserts `organisation_members` with the chosen role. From that moment: (1) the People tab shows them as **Active** (they have a membership), not Invited; (2) the admin is told "Added to the site"; (3) when the person finally clicks their invite link, `acceptInvite` inserts the membership BEFORE setting the password, hits `unique (organisation_id, user_id)` (00001:20), returns "Failed to complete account setup" and never calls `updateUser({ password })` — the person has no password and no way in. Removing and re-inviting repeats the same path. "Send it again" is the most common thing an admin does with an invite, so this is the primary flow, not an edge.
**Fix:**
```ts
// auth.ts inviteWorker — treat an un-accepted invite as "pending", not "existing"
const pendingInvite = existing && !existing.last_sign_in_at && existing.invited_at
if (existing && !pendingInvite) {
  // ...current add-to-site branch
} else {
  // new OR pending: (re)send the invite; Supabase re-sends for an unconfirmed user
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { ... })
  ...
}
```
And in `acceptInvite`, make the membership insert idempotent (`upsert` on `organisation_id,user_id`, or ignore `23505`) and set the password first so a retry can always finish.

## Warnings

### WR-01: `signOffCompletion`'s "already decided" guard is read-then-write with no uniqueness at the database — two concurrent submits both pass and write two sign-off rows and two ledger rows

**File:** `src/actions/completions.ts:204-228, 272-300`
**Issue:** The comment at :221 says "a double submit must not write a second sign-off or ledger row", but the only protection is a status read at :226 before the insert at :272. Two in-flight requests (double-click before `pending` sets, two supervisors on the same row, or two tabs) both read `pending_sign_off`, both insert into `completion_sign_offs` (no unique index on `completion_id`, 00010:155-166), both write a ledger row. The second could even carry the opposite decision, leaving one completion with an `approved` and a `rejected` row and a status that reflects whichever update landed last.
**Fix:** Claim the status first and refuse on zero rows, then write the records:
```ts
const { data: claimed } = await admin.from('sop_completions')
  .update({ status: newStatus })
  .eq('id', completionId).eq('organisation_id', organisationId).eq('status', 'pending_sign_off')
  .select('id')
if (!claimed?.length) return { success: false, error: 'This walk has already been decided.' }
```
or add `create unique index completion_sign_offs_one_per_completion on completion_sign_offs(completion_id)` in a follow-up migration and treat `23505` as "already decided".

### WR-02: One approval writes two ledger rows (`sign_off` + `countersign`), and the worker's submit row is worded "Signed off"

**File:** `src/actions/completions.ts:289-300, 317-320, 466-472`; `src/lib/decisions/read.ts:40-42, 64`
**Issue:** An approved sign-off records `kind: 'sign_off'` ("Signed off a completion") at :289 and then `recordSignature(role: 'supervisor')` records `kind: 'countersign'` ("Counter-signed a completion") at :466. The Decisions tab shows the same person doing two things at the same second for one decision. `read.ts:58-64` reasons that "the worker's own sign_off row on submit is never counted" — i.e. the author believed `sign_off` was only the worker's row, which is not what :289 does. Separately `KIND_WORDS.sign_off = 'Signed off'` is also applied to the worker's submit row (`summary: 'Signed their completion'`), so the ledger reads as if the worker signed off their own walk.
**Fix:** Pick one row per decision: have `recordSignature` take an internal `{ log: false }` when called from `signOffCompletion` (the `sign_off` row already carries `worker_id`, reason, override), or drop the `sign_off` write at :289 and let `countersign` be the approval row. Give the worker's submit its own kind or word (e.g. `KIND_WORDS` keyed by `(kind, actor === subject worker)` → "Sent for sign-off").

### WR-03: People tab, This SOP block and OwnerPicker have no `try/catch` around server actions — a thrown action leaves the control disabled forever with no message

**File:** `src/components/office/PeopleTab.tsx:161-216`; `src/components/focus/admin/ThisSopBlock.tsx:77-89`; `src/components/admin/governance/OwnerPicker.tsx:55-81`
**Issue:** `sendInvite`, `changeRole`, `confirmRemove`, `newCode`, `markReviewed`, `handleOpen`, `handlePick` all do `setBusy(true); const res = await action(); setBusy(false)`. A rejected promise (network drop, Next action-queue orphan per CLAUDE.md 2026-09-29, 5xx) skips the second `set*`, so Send invite / the role select / Remove / Mark reviewed / the picker stay disabled until reload, nothing is shown, and the rejection is unhandled. `InboxRow.run`, `SignOffPanel.approve` and `ApprovePanel.approve` in the same phase wrap correctly with `FAILED_COPY` — the pattern was known and applied inconsistently.
**Fix:** Mirror `InboxRow.run`:
```ts
try { const res = await inviteWorker(...); ... } catch { setInviteError(FAILED_COPY) } finally { setInviting(false) }
```

### WR-04: The SOP focus page still counts rejected walks as "done" — the phase's `.neq('status','rejected')` sweep missed it

**File:** `src/app/(protected)/sops/[sopId]/page.tsx:80, 131-136`
**Issue:** This phase added `.neq('status', 'rejected')` to `useWorkerSops`, four `competency.ts` reads and `exportTrainingCsv` (D-06: "a rejected completion makes the SOP read as not done"), but the page's own `sop_completions` read at :80 has no status filter. `doneOn` therefore includes a rejected walk, so `updatedSinceLastWalk` is suppressed for a worker whose only walk of this version was rejected, and the "finished an earlier version" logic treats a rejected earlier walk as a finished one. CLAUDE.md rule 5: a sweep keyed on feature names misses the sibling.
**Fix:**
```ts
supabase.from('sop_completions').select('sop_id').neq('status', 'rejected').eq('worker_id', userId).in('sop_id', lineageIds)
```
and grep `from('sop_completions')` once more for any other read that infers "done" (`walk-read.ts`, `worker-signal.ts`).

### WR-05: `confirmSopCurrent` admin branch reports success, writes a review event and a ledger row even when the `sops` update matched zero rows

**File:** `src/actions/governance.ts:254-284`
**Issue:** The update at :254 has no `.select('id')` / length check and no `organisation_id` filter; `setSopOwner` (:147-161) and the new owner branch (`owner-review.ts:41-52`) both check for zero rows explicitly (LR-01). The preceding RLS-scoped read at :238 makes a cross-org hit unlikely, but a SOP deleted between the read and the write still returns `{ success: true, logged: true }`, inserts a `sop_review_events` row (FK on `sop_id` only) and a "Confirmed the SOP is current" ledger row for nothing. This branch is now the inbox's "Mark reviewed" button, so it is the hot path.
**Fix:**
```ts
const { data: updated, error: updateErr } = await supabase.from('sops').update({...}).eq('id', sopId).select('id')
if (updateErr) ...
if (!updated?.length) return { error: 'SOP not found' }
```

## Info

### IN-01: `listDecisions` selects `actor_id` it never uses

**File:** `src/actions/office.ts:224`
**Issue:** `actor_id` is in the select but not in `LedgerRow` nor the returned shape. Harmless, but the file's contract is "no ids reach the client" and the column list should match the type.
**Fix:** Drop `actor_id` from the select string.

### IN-02: Worker detail page ships `supervisor_id` to the client

**File:** `src/app/(protected)/activity/[completionId]/page.tsx:60, 88`
**Issue:** `completion_sign_offs ( id, supervisor_id, ... )` is passed whole as `signOff`; `CompletionDetailClient` reads only `reason` and `created_at`.
**Fix:** Select `decision, reason, created_at` only and narrow the `SignOff` prop type.

### IN-03: `FocusSopMeta` now carries `owner_user_id` and `review_due_at` into every role's client payload

**File:** `src/lib/sop/focus-read.ts:31-32`; `src/app/(protected)/sops/[sopId]/page.tsx:111-119`
**Issue:** The page is careful to compute the owner's *name* only for editors (T-59-30), but `data.sop.owner_user_id` rides inside `data` to `FocusWalker` for workers in browse/walk too. UUID only, so no name leak; just wider than the comment claims.
**Fix:** Strip `owner_user_id` / `review_due_at` from `data.sop` when `owner === null`, or read them in the page and not through `FocusSopMeta`.

### IN-04: Opening the Reject / Send back dialog shows the previous approve error as its own

**File:** `src/components/office/SignOffPanel.tsx:373, 395`; `src/components/office/ApprovePanel.tsx:203, 222`
**Issue:** `setRejectOpen(true)` / `setSendOpen(true)` do not clear `error`, and `ReasonDialog` renders `error` under its field, so a failed Sign off ("You need to be signed off…") appears inside "Reject this walk?" before the user has typed anything.
**Fix:** `onClick={() => { setError(null); setRejectOpen(true) }}` (same for Send back).

### IN-05: Rejection reason has no server-side length cap

**File:** `src/lib/validators/completions.ts:33`; `src/actions/completions.ts:183-187`
**Issue:** `reason: z.string().optional()` — the override reason is `.max(500)` and `ReasonDialog` caps at 500, but a direct call can store an arbitrarily long reason in `completion_sign_offs.reason`, `decisions.details` and the worker notification.
**Fix:** `reason: z.string().trim().max(500).optional()`.

### IN-06: `approveStep` reports `published: false` on an idempotent duplicate of the final step

**File:** `src/actions/approvals.ts:218-247`
**Issue:** On `23505` the function skips the ledger and continues to the final-step branch, which calls `performPublish` again (idempotent?) and sets `published = true` — fine — but if `performPublish` short-circuits on an already-published SOP with an error, the double-click surfaces "v3 can't be published yet: …" via `ApprovePanel`'s `isLast` wording.
**Fix:** On `23505`, return `{ success: true, logged: true, published: sop.status === 'published' }` without re-running the publish path.

---

_Reviewed: 2026-10-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
