---
phase: 60-requests-notifications-objectives
reviewed: 2026-10-06T00:00:00Z
depth: standard
files_reviewed: 62
files_reviewed_list:
  - supabase/migrations/00074_requests_notifications_objectives.sql
  - src/actions/requests.ts
  - src/actions/asks.ts
  - src/actions/objectives.ts
  - src/actions/office.ts
  - src/actions/ai-fields.ts
  - src/actions/approvals.ts
  - src/actions/completions.ts
  - src/actions/sops.ts
  - src/actions/shell.ts
  - src/actions/assignments.ts
  - src/actions/focus-steps.ts
  - src/actions/versions.ts
  - src/actions/versioning.ts
  - src/lib/requests/core.ts
  - src/lib/requests/ask-core.ts
  - src/lib/requests/agent.ts
  - src/lib/requests/model.ts
  - src/lib/notifications/write.ts
  - src/lib/notifications/kinds.ts
  - src/lib/notifications/places.ts
  - src/lib/notifications/review-due.ts
  - src/lib/objectives/core.ts
  - src/lib/objectives/model.ts
  - src/lib/cron/auth.ts
  - src/lib/cron/route.ts
  - src/lib/cron/sweeps.ts
  - src/app/api/cron/review-due/route.ts
  - src/app/api/cron/machines-without-sops/route.ts
  - src/app/api/ai-fields/read/route.ts
  - src/app/api/sops/[sopId]/publish/route.ts
  - src/lib/ai-fields/registrations/objectives.ts
  - src/lib/ai-fields/registrations/index.ts
  - src/lib/validators/ai-fields.ts
  - src/lib/governance/inbox.ts
  - src/lib/governance/load-inbox.ts
  - src/lib/decisions/read.ts
  - src/lib/decisions/shape.ts
  - src/lib/agent-layer/signals.ts
  - src/lib/agent-layer/synthesis.ts
  - src/lib/shell/office-tabs.ts
  - src/lib/shell/overview-focus.ts
  - src/lib/shell/query-keys.ts
  - src/lib/sop/focus-path.ts
  - src/lib/sop/focus-read.ts
  - src/lib/supabase/middleware.ts
  - scripts/apply-phase60-migration.mjs
  - scripts/eval-fixtures.mjs
  - scripts/verify-gate-check.tsx
  - scripts/check-bundle-size.ts
  - src/components/shell/SiteOverview.tsx
  - src/components/shell/NotificationBell.tsx
  - src/components/shell/ShellFrame.tsx
  - src/components/shell/AdminShell.tsx
  - src/components/shell/WorkerShell.tsx
  - src/components/shell/ObjectiveLine.tsx
  - src/components/shell/ObjectiveSlot.tsx
  - src/components/shell/WorkerObjective.tsx
  - src/components/requests/RequestComposer.tsx
  - src/components/requests/AskPicker.tsx
  - src/components/requests/ObjectiveEditor.tsx
  - src/components/requests/DialogShell.tsx
  - src/components/office/RequestsTab.tsx
  - src/components/office/RequestRow.tsx
  - src/components/office/OfficePane.tsx
  - src/components/office/InboxTab.tsx
  - src/components/office/InboxRow.tsx
  - src/components/office/PeopleTab.tsx
  - src/components/office/ReasonDialog.tsx
  - src/components/focus/BrowseDocument.tsx
  - src/components/focus/admin/ThisSopBlock.tsx
  - src/components/sop/plant/MachinePanel.tsx
  - src/components/admin/governance/AdminMachinePanel.tsx
findings:
  critical: 0
  warning: 7
  info: 8
  total: 15
status: issues_found
---

# Phase 60: Code Review Report

**Reviewed:** 2026-10-06
**Depth:** standard
**Files Reviewed:** 62
**Status:** issues_found

## Summary

Phase 60 adds `requests`, `notifications`, `objectives` (00074), thin session-derived actions over service-role cores, five notification triggers, two bearer-authenticated cron routes, agent-raised requests and agent-set objectives through the AI-field interface, the Office Requests tab, the site overview + bell (browser-client reads under RLS), three lazy editors, and deletes the assign screen.

The trust boundaries hold. Checked against the ten verification points:

1. **Session-derived org/actor, subject ids checked against the org.** Every new action (`raiseRequest`, `withdrawRequest`, `answerRequest`, `askToDoSop`, `declineAsk`, `stopAsking`, `listAskTargets`, `setObjective`, `clearObjective`, `confirmObjective`) takes org/user/role from `getSessionContext()`, and every client-supplied id is filtered by the session org before use (`subjectInOrg`, `claimOpenRequest`, `resolveSubject`, `lineageSopIds`, the member lookup in `askToDoSopCore`). The three new action files import no service-role client. Pre-existing admin-client imports remain in six touched action files (IN-07). One touched legacy action (`notifyAssignedWorkers`) still re-points `sop_assignments` with a service-role update that carries no org filter (WR-03).
2. **00074 RLS.** `WITH CHECK` restates `USING` on `notifications_mark_own_read`; the column grant leaves only `read_at` writable (`revoke update` then `grant update (read_at)`); `requests_read` is org-conjoined and limited to raiser / target / answerer / role-target / open-for-office-roles; `objectives_read_org` is org-wide with no write policy; no sibling policy lacks an org conjunct. The applier script pins every one of these with `has_column_privilege` / `pg_policies` assertions.
3. **Ledger.** Exactly one `recordDecision()` per decision; `claimOpenRequest` / `declineAskCore` / `stopAskingCore` / `confirmObjectiveCore` are zero-row-aware claims, so a second answer writes no row and no notice. Cron and agent paths write nothing. `scripts/decision-writers.json` carries entries for every new writer and allow-reasons for every core. One gap: the agent objective ledger row loses `sopId` (WR-05).
4. **`askToDoSopCore`.** Assignment first, request second, `undo()` on request failure (delete an inserted row, restore `assigned_by` on a taken-over row). `declineAskCore` matches only `target_user_id = caller`, so a role ask cannot be declined by one person. The SOP and the target person are both checked against the session org.
5. **Cron.** `isCronAuthorized` fails closed on an unset secret, length-checks then `timingSafeEqual`; `handleCron` returns 401 before `request.text()`; POST is the only export; proxy exemption is an exact-path `includes`; the optional body narrows to one org and is parsed only after auth; sweeps dedupe on `(user_id, dedupe_key)` with `ignoreDuplicates`; 50 orgs x 2000 rows caps.
6. **Notification writers.** `notify` keeps only org members with a safe `place`; `notifyNextApprover` and `signOffRecipients` drop the actor; a user-id chain step resolves to `[userId]`, a role step through `membersWithRole`. `place` is built from fixed templates and UUID-gated `focusHref`, re-checked by `isSafePlace` on the client, and DB-checked (`'/%'`, not `'//%'`, <= 300). Exception: `notifyAssignedWorkers` does not drop the actor (WR-03), and the `approve_next` dedupe key is too coarse (WR-01).
7. **AI-field objectives.** `setObjectiveCore` re-reads the session and gates on admin/SM; `resolveSubject` checks the subject against the session org; `agentName` is validated against the closed `AGENT_NAMES` list and overwritten into context by `applyAiWrite`; `packSopForPrompt` is untouched (`sop-pack.ts` has no diff). The agent name is still chosen by the session user (WR-05).
8. **Browser-client notifications.** Reads and mark-read go through `createClient()` with no server action; the `as never` cast is covered by the column grant + RLS; navigation happens only inside `open()` (click handler); the bell calls `select({ kind: 'overview' })` then `requestOverviewSection()` — no router.
9. **Lazy modules.** No `.css` import in any of the nine lazy files; every editor/picker/composer mounts fresh (`{open && <Dialog/>}`), and `ShellFrame` keys the detail pane on `placeKey` so a machine/department editor remounts on place change. Esc layering: `DialogShell` (`aria-modal` + preventDefault + stopPropagation) → row/picker (capture + preventDefault) → `ShellFrame` (checks `defaultPrevented` and `[aria-modal]`).
10. **Copy/tokens.** No "assignment" / "block" in user-facing copy; every colour class resolves to a `--color-*` line in `blueprint-theme.css` (`accent-ok`, `ai`, `accent-measure`, `accent-decision`, `ink-*`, `paper-*`); numeric scale only (`h-18`, `min-h-9`, `w-72`); no bare `var(--x)`.

No blockers. Seven warnings, mostly in the notification triggers and the data shape of the undo/ledger paths; eight info items.

## Warnings

### WR-01: `approve_next` dedupe key collides across reject / re-request cycles, so the second-round approver is never told

**File:** `src/lib/notifications/kinds.ts:79`, `src/lib/notifications/write.ts:84`
**Issue:** The key is `approve_next:${sopId}:${version}:${step}`. `requestChanges` clears `approval_state` but the draft keeps its version number; when the author re-requests publish, the divert in `publish/route.ts:87` calls `notifyNextApprover` with the same `(sopId, version, 0)`, `notify` upserts with `ignoreDuplicates: true`, and nothing is written. The step-one approver who already read (or ignored) the first-round row gets no second notice; the same holds for every later step after a send-back. D-08 trigger 1 is silently one-shot per version.
**Fix:** Include a per-cycle discriminator in the key — the count of `sop_approvals` rows with `action = 'changes_requested'` for that version is already read in `approveStep`; simplest is to pass it through:
```ts
// kinds.ts
| { kind: 'approve_next'; sopId: string; version: number; step: number; cycle: number }
case 'approve_next': return `approve_next:${input.sopId}:${input.version}:${input.cycle}:${input.step}`
```
and in the publish route count `changes_requested` rows for `(sopId, version)` before the divert (one extra read).

### WR-02: Worker-facing notification titles and My-requests labels ship an admin's or supervisor's email

**File:** `src/actions/requests.ts:133`, `src/actions/requests.ts:178-179`, `src/actions/asks.ts:132`, `src/lib/notifications/kinds.ts:34`
**Issue:** `memberLabel()` falls back to the email when `full_name` is unset. `answerRequest` builds the `observe_accepted` title with `memberLabel(labels.get(userId))`, `listMyRequests` returns `answeredByLabel` / `targetLabel` through the same helper, and `declineAsk` does the same for the asker. `first()` in `kinds.ts` splits on whitespace, so an email survives whole. The recipient of all three is the worker who raised the request. `src/lib/objectives/model.ts:31` (`setByWords`) and `completions.ts:171` (`fullName ?? null`) both encode the opposite rule (T-60-12: no admin email to a worker). Two surfaces disagree on the same question.
**Fix:** Route every worker-facing name through one helper and use it in the three sites:
```ts
// src/lib/members/labels.ts
export const nameForWorker = (l: UserLabel | null | undefined) => l?.fullName ?? null
```
`notificationTitle({ ..., name: nameForWorker(labels.get(userId)) })` (the title already prints "Someone" for null), and `answeredByLabel: r.answered_by ? (nameForWorker(labels.get(r.answered_by)) ?? 'an admin') : null`.

### WR-03: `notifyAssignedWorkers` notifies the actor and re-points `sop_assignments` with a service-role update that has no org filter

**File:** `src/actions/versioning.ts:211-261`
**Issue:** Phase 60 moved this trigger onto `notify`, but (a) `userIds` includes the publishing admin when an `admin`-role assignment exists, so the actor gets "has a new version" for their own publish — every other trigger drops the actor; (b) `oldSopId` is never checked against the session org; the `assignments` read is RLS-scoped (so a foreign id returns nothing and the function exits early), but the service-role `update({ sop_id: newSopId }).eq('sop_id', oldSopId)` at line 257 carries no `organisation_id` filter, which is the 2026-06-15 / 2026-07-28 class. It is safe today only because of the early return above it.
**Fix:**
```ts
const userIds = Array.from(userIdSet).filter((id) => id !== userId)
…
await admin.from('sop_assignments').update({ sop_id: newSopId }).eq('sop_id', oldSopId).eq('organisation_id', organisationId)
```

### WR-04: The decline / stop revert path rewrites `answered_by` and `decided_at` on the ask it is restoring

**File:** `src/lib/requests/ask-core.ts:216-224`, `src/lib/requests/ask-core.ts:249-256`
**Issue:** When `dropAskedAssignments` fails, the claim is reverted to `state: 'accepted'` with `answered_by: userId` (the decliner / stopper) and `answer_note: null`, but `decided_at` keeps the decline timestamp set by the claim. The original ask had `answered_by = raised_by_user` (A-05: accepted on the asker's authority) and `decided_at = raise time`. After the revert the row says a different person accepted it at a different time; `listMyRequests` then shows "Accepted by <decliner>".
**Fix:** Restore both columns from the claimed row:
```ts
.update({ state: 'accepted', answered_by: claimed.raised_by_user, answer_note: null, decided_at: claimed.created_at })
```
(add `created_at` to `CLAIM_COLUMNS` / `ClaimedAsk`).

### WR-05: Agent objective write: the ledger row has no `sopId`, and the agent name is whatever the session user says it is

**File:** `src/actions/ai-fields.ts:79-111`, `src/lib/ai-fields/registrations/objectives.ts:48-51`
**Issue:** (a) The objective registration deliberately carries the SOP id as `subjectId`, never `sopId` (A-09), so `serverSopId` stays null and the `ai_field_write` row for an `objective.sop` write has `sop_id: null` — the only objective decision not reachable from the SOP's ledger filter (the person path at `objectives.ts:60` sets it to the lineage root). (b) `agentName` is a top-level field of the request body; any admin/SM session can call `applyAiWrite` (a `'use server'` export) with `agentName: <any AGENT_NAMES value>` and the ledger row is written with `actor_kind: 'agent', actor_id: null` — the human who made the call is not recorded anywhere, and the objective row reads "set by <agent> · unconfirmed" for a human write. There is no separate agent credential, so this is inherent to D-12, but the ledger should not lose the session user.
**Fix:** (a) In `applyAiWrite`, when `fieldId.startsWith('objective.')` and `result.value` came back, pass `sopId: descriptor.id === 'objective.sop' ? (result as { subject?: { id: string } }).subject?.id ?? null : null` — or have the write descriptor return `{ outcome, value, sopId }` and read it. (b) Record the session user on agent rows: `details: { field_id: fieldId, session_user_id: userId }` in the `recordDecision` call at line 104, so an agent row is always traceable to the person whose session ran it.

### WR-06: `review-due` sweep filters null review dates before picking the latest published version

**File:** `src/lib/cron/sweeps.ts:42-53`, `src/lib/notifications/review-due.ts:26`
**Issue:** The query drops rows with `review_due_at IS NULL` before `reviewDueTargets` calls `latestPublished(rows)`. If the newest published version of a lineage has a null review date (the review-clock reset in `performPublish` is a non-fatal try/catch that can fail), an older published version with a date becomes the "latest" and its owner is told to review a superseded SOP, with a `place` that opens the Office rather than the current version.
**Fix:** Read all published rows and let the pure function decide:
```ts
// sweeps.ts: drop .not('review_due_at', 'is', null)
// review-due.ts already skips rows without a date AFTER latestPublished
```

### WR-07: Mark-read in the overview never surfaces a failed update, and a timed-out race leaves the row dimmed while still unread

**File:** `src/components/shell/SiteOverview.tsx:139-158`
**Issue:** supabase-js resolves `{ error }` instead of throwing, so the `try/catch` around `patch` catches nothing; `Promise.race` with a 3 s timer resolves either way. In both cases the code proceeds to `setDimmed(...)` (already done at line 140) and invalidates — if the update was denied or timed out, the row renders read until the refetch lands, then flips back to unread with no message. The comment says "a failed mark-read still opens the place", which is right, but the dimmed state is a lie in the failure case.
**Fix:**
```ts
const { error } = await Promise.race([patch, new Promise<{ error: null }>((r) => setTimeout(() => r({ error: null }), 3000))])
if (error) setDimmed((s) => { const n = new Set(s); n.delete(n.id); return n })
```
or drop the optimistic `setDimmed` and rely on the invalidation.

## Info

### IN-01: Fixed DOM ids in `ObjectiveEditor` collide when two editors are open

**File:** `src/components/requests/ObjectiveEditor.tsx:123-147`
**Issue:** `id="objective-text"` / `id="objective-due"` are literals. The overview can show the site editor (detail pane) and a department editor (list pane via `deptMeta`) at once; `label htmlFor` then points at the first match.
**Fix:** `const uid = useId()` and `${uid}-text` / `${uid}-due`, as `RequestComposer` already does.

### IN-02: `AskPicker` keeps the previous `targets` across opens

**File:** `src/components/requests/AskPicker.tsx:68-89`
**Issue:** `handleOpen` resets mode/picked/search but not `targets`, so the stale list (with stale `hasIt` flags) shows while the fresh one loads.
**Fix:** `setTargets(null)` alongside the other resets.

### IN-03: `notify()` returns `keep.length` even when every row was a duplicate

**File:** `src/lib/notifications/write.ts:58`
**Issue:** `ignoreDuplicates: true` writes nothing for an existing `(user_id, dedupe_key)`, but the count reported (`told` in `askToDoSop`, `notified` in the sweep) is the attempted count, not the written count.
**Fix:** `.select('id')` on the upsert and return `data?.length ?? 0`, or document that the number means "addressed".

### IN-04: A raiser can answer their own request

**File:** `src/actions/requests.ts:109`
**Issue:** `claimOpenRequest` has no `raised_by_user <> answered_by` guard; a supervisor who raises `observe_me` can accept it themselves and the ledger shows a self-answer.
**Fix:** Add `.neq('raised_by_user', userId)` to the claim (agent rows have `raised_by_user` null and still match).

### IN-05: The overview's "Ask for a new SOP" composer only renders when the requests section is non-empty

**File:** `src/components/shell/SiteOverview.tsx:455-471`
**Issue:** `RequestComposerTrigger` sits inside `{anyRequests && …}`, so a worker with no requests yet has no overview entry point for a new-SOP request (machine panels still offer it).
**Fix:** Move the trigger out of the `anyRequests` gate, or render a one-line empty state with the trigger.

### IN-06: Person-subject objectives are readable by every member of the org

**File:** `supabase/migrations/00074_requests_notifications_objectives.sql:166`, `src/lib/objectives/core.ts:217`, `src/lib/ai-fields/registrations/objectives.ts:59`
**Issue:** D-10 says "everyone in the org reads", and `listObjectives()` (called by the worker overview) and `objectives.all` return `person` rows with `subjectId` to any member. The People-row text is written by an admin about a named person; worth confirming that is intended before the first real one is set.
**Fix:** If not intended: filter `subject_type = 'person'` to admin/SM in `listObjectivesCore` (the RLS policy would need a matching conjunct).

### IN-07: Six touched action files still import the service-role client

**File:** `src/actions/ai-fields.ts:28`, `src/actions/approvals.ts:43`, `src/actions/completions.ts:6`, `src/actions/versioning.ts:3`, `src/actions/sops.ts`, `src/actions/assignments.ts:4`
**Issue:** The phase's own three action files follow the "core in src/lib, no service-role import in the action" rule; these pre-existing files do not. Out of this phase's scope, but each is a candidate for the same extraction when next touched.
**Fix:** Track as a sweep; no change required for Phase 60.

### IN-08: `deleteSop` removes the lineage's objective when the deleted row is the lineage root

**File:** `src/actions/sops.ts:388`
**Issue:** Objectives are keyed on the root (A-01). `parent_sop_id` is `ON DELETE SET NULL`, so deleting a root with surviving versions both orphans those versions into new roots (pre-existing) and deletes their objective. Practically unreachable today (only drafts are deleted; a root draft has no forks), but the clearing line assumes "about this SOP" means "about this version".
**Fix:** Guard with a lineage check, or document that the objective dies with the root.

---

_Reviewed: 2026-10-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
