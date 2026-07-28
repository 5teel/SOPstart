---
phase: 37-assessor-governance
reviewed: 2026-07-28T00:00:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - playwright.config.ts
  - scripts/apply-phase37-migration.mjs
  - src/actions/completions.ts
  - src/actions/observations.ts
  - src/app/(protected)/activity/[completionId]/CompletionDetailClient.tsx
  - src/app/(protected)/activity/[completionId]/page.tsx
  - src/app/(protected)/admin/team/page.tsx
  - src/components/observations/AssessmentRequestsPanel.tsx
  - src/components/observations/RecordObservationModal.tsx
  - src/components/observations/VerdictButtons.tsx
  - src/lib/competency/__tests__/assessor.test.ts
  - src/lib/competency/assessor.ts
  - src/lib/journeys/journeys.ts
  - src/lib/uat/tests.ts
  - src/lib/validators/completions.ts
  - src/lib/validators/observations.ts
  - src/types/database.types.ts
  - supabase/migrations/00056_assessor_governance.sql
  - supabase/migrations/00057_restore_sop_observations_cross_org_guard.sql
  - tests/phase34/record-observation.spec.ts
  - tests/phase37/assessor-gate.spec.ts
  - tests/phase37/assessor-ui-observation.spec.ts
  - tests/phase37/assessor-ui-signoff.spec.ts
  - tests/phase37/bootstrap-override-runtime.spec.ts
  - tests/phase37/no-competency-gate-worker.spec.ts
  - tests/phase37/override-audit-schema.spec.ts
findings:
  critical: 2
  warning: 5
  info: 2
  total: 9
status: issues_found
---

# Phase 37: Code Review Report

**Reviewed:** 2026-07-28
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

Reviewed the full assessor-governance surface: the `isSignedOffAssessor` predicate, both gated write paths (`recordObservation`, `signOffCompletion`), migrations 00056/00057, the migration applier script, the three observation UI components, the completion-detail page/client pair, validators, types, and all six phase-37 specs plus the repointed phase-34 spec.

The core gate design is sound: branch-before-gate is correctly positioned on both write paths, the override is stamped three layers deep (Zod → action → CHECK constraint), the 00057 fix-forward correctly restores the 00053 org-ref guard alongside the new override conjunct, `journeys.ts`/`uat/tests.ts` are updated per the project convention, and the `phase37` Playwright project regex picks up all specs. The unit tests for the predicate exercise real `resolveLineage`/`classifyCompetency` composition, and the bootstrap runtime spec is a genuine live-DB proof.

Two Critical findings remain. First, `/activity/[completionId]` reads the completion (including signed photo URLs) via the admin client with **no organisation guard** — a cross-tenant read hole the phase touched directly and made marginally worse. Second, the migration applier's fallback path re-applies raw 00056 — which would **re-drop the 00057 cross-org guard on the live DB** — and its own assertions would then report ALL PASS, the exact assertion gap 00057's header documents but the script never closed.

## Critical Issues

### CR-01: Cross-org completion read on /activity/[completionId] — admin-client fetch with no organisation guard

**File:** `src/app/(protected)/activity/[completionId]/page.tsx:39-76,117`
**Issue:** The page fetches the completion (worker id, step data, sign-offs, and **1-hour signed photo URLs**) with `createAdminClient()` keyed only on `completionId`, then gates access with just two checks: `role` exists, and `role === 'worker' && data.worker_id !== userId`. There is **no check that `data.organisation_id === session organisationId`**. Any authenticated supervisor / admin / safety_manager from **another organisation** who obtains a completion UUID can view the full completion detail of a foreign org, including presigned photo URLs. This is the exact service-role self-enforcement class CLAUDE.md flags repeatedly (2026-06-15, 2026-06-26, 2026-07-20). The hole is pre-existing, but this phase edited this precise fetch (added `organisation_id` to the select), widened `isSupervisor` to include `admin` (so more roles now render the sign-off bar on a foreign completion), and feeds the **attacker-controlled row's** `data.organisation_id` — not the session org — into `isSignedOffAssessor` at line 117. The write path is safe only because `signOffCompletion` independently re-checks org; the read disclosure stands.
**Fix:**
```ts
const { supabase, userId, role, organisationId } = await getSessionContext()
...
if (error || !rawData) redirect('/activity')
const data = rawData as unknown as RawCompletionData
if (!organisationId || data.organisation_id !== organisationId) {
  redirect('/activity')
}
...
// and evaluate the predicate against the session org, not the row's:
isSignedOffAssessor(userId, data.sop_id, admin, organisationId),
```

### CR-02: apply-phase37-migration.mjs fallback silently re-drops the 00057 cross-org guard and then reports ALL PASS

**File:** `scripts/apply-phase37-migration.mjs:29,114-119,337-348`
**Issue:** Two compounding defects. (1) When `npx supabase db push` fails (the script's own comments name this as the expected failure mode — missing DB password), the fallback executes the raw body of **00056 only** (`MIGRATION_FILE` at line 29). 00056 contains `drop policy … create policy sop_observations_insert_recorder` **without** the `sop_observation_refs_in_org(...)` conjunct — so running this script after 00057 is live re-opens the T-34-03-01 cross-tenant write hole on the production DB. (2) Assertion group 3 (line 337) only checks the `with_check` for the `current_user_role` and `is_assessor_override` substrings — the **exact assertion gap that let 00056 silently drop the guard in the first place**, per 00057's own header comment — so after re-opening the hole the script prints `=== ALL POST-APPLY ASSERTIONS PASSED ===`. A security regression trigger with a green banner is worse than no script.
**Fix:**
```js
// 1) Fallback must apply BOTH files, in order:
const MIGRATION_FILES = [
  'supabase/migrations/00056_assessor_governance.sql',
  'supabase/migrations/00057_restore_sop_observations_cross_org_guard.sql',
]
// ...in the catch: for (const f of MIGRATION_FILES) await managementSql(readFileSync(f, 'utf8'))

// 2) Assertion group 3 must pin the restored conjunct:
ok: !!row && withCheck.includes('current_user_role')
  && withCheck.includes('is_assessor_override')
  && withCheck.includes('sop_observation_refs_in_org'),
```

## Warnings

### WR-01: isSignedOffAssessor collapses multiple sign-offs per completion into one arbitrary Map entry — can falsely deny (or mis-time) assessor status

**File:** `src/lib/competency/assessor.ts:69-80`
**Issue:** `signOffByCompletion = new Map(signOffs.map(s => [s.completion_id, s]))` keeps only the **last row in unordered query results** when a completion has more than one sign-off row. `completion_sign_offs` is append-only and `signOffCompletion` never checks for an existing sign-off (the `alreadySigned` guard is client-side only), so two rows per completion is reachable (racing supervisors; reject-then-approve via direct action call). If the Map keeps a `rejected` row over an `approved` one, `hasSignOff` reads false → a legitimately signed-off assessor is denied; `latestPositiveEvidenceAt` similarly drops the approved timestamp, skewing the D-02 reset comparison. The Map is unnecessary — the sign-off rows are already restricted to this person's completions.
**Fix:**
```ts
const hasSignOff = signOffs.some(s => s.decision === 'approved')
const latestPositiveEvidenceAt = latestOf([
  ...observations.filter(o => o.verdict === 'performed_to_sop').map(o => o.created_at),
  ...signOffs.filter(s => s.decision === 'approved').map(s => s.created_at),
])
```
(And drop `signOffByCompletion` entirely.)

### WR-02: requestAssessorReview has no role gate — any authenticated worker can fan out assessment_requested notifications to every admin

**File:** `src/actions/observations.ts:367-422`
**Issue:** Unlike every sibling action in the file (all gated on `RECORDER_ROLES` or admin roles), `requestAssessorReview` checks only `userId` + `organisationId`, then uses the **admin client** to insert one `worker_notifications` row per admin/safety_manager. The design (journeys.ts node `blocked`, the action's own comment) says this is for a **blocked supervisor**. As shipped, a plain worker can call the endpoint (server actions are POST-invokable by any authenticated client), spamming every admin's `NotificationBadge` unread count and the /admin/team requests panel with "asked to be signed off" entries. Dedupe limits it to one live request per (worker, SOP), but a worker can still fan out one per published SOP.
**Fix:** Add the same gate as the other recorder actions:
```ts
const { userId, role, organisationId } = await getSessionContext()
if (!role || !RECORDER_ROLES.includes(role)) {
  return { success: false, error: 'Only supervisors, admins and safety managers can request assessment.' }
}
```

### WR-03: RecordObservationModal — stale assessorStatus/requestSent when the selected SOP changes; in-code comment asserts the opposite

**File:** `src/components/observations/RecordObservationModal.tsx:104-117`
**Issue:** The comment claims "While the fetch is in flight, assessorStatus stays null (its prior reset)" — true only for the **first** selection after the modal opens. `assessorStatus` is reset to null only on the `open` transition (line 79). When the user taps "Change" (`setSopId(null)` — the effect early-returns and clears nothing) and picks a different SOP, the **previous SOP's** status drives `blocked`/`canOverride` until the new fetch resolves: a blocked panel (or an enabled advancing verdict) flashes for the wrong SOP. `requestSent` and `overrideOpen` likewise survive the SOP change, so "Request sent" can display for a SOP no request was made for. Server-side re-gating makes this fail-safe for the write, but the UI state machine contradicts its own documentation.
**Fix:** Clear per-SOP state whenever `sopId` changes:
```ts
useEffect(() => {
  setAssessorStatus(null)
  setRequestSent(false)
  setOverrideOpen(false)
  if (!sopId) return
  let cancelled = false
  getAssessorStatusForSop(sopId).then(...)
  ...
}, [sopId])
```

### WR-04: CompletionDetailClient — ASSESSOR_OVERRIDE_REQUIRED from the server is a dead end when the client's isAssessor prop is stale-true

**File:** `src/app/(protected)/activity/[completionId]/CompletionDetailClient.tsx:155-174`
**Issue:** `isAssessor` is computed once at page render. If a `needs_support` reset lands between render and click (the exact scenario the code comment at line 156 names), an admin/safety_manager clicks Approve, `handleApproveClick` skips the sheet (`blockedFromApproving` is false), and the server returns `ASSESSOR_OVERRIDE_REQUIRED`. The client renders the error copy — "An override reason (10+ characters) is required…" — but the override sheet is **unreachable**: it only opens when `blockedFromApproving && canOverride`, and `blockedFromApproving` never updates. The user is told to supply a reason with no way to supply one short of a full page reload.
**Fix:** Open the sheet when the server demands it:
```ts
} else {
  if (result.error === 'ASSESSOR_OVERRIDE_REQUIRED' && canOverride) {
    setOverrideSheetOpen(true)
  }
  setActionError(mapSignOffError(result.error))
}
```

### WR-05: Observation completionId is never validated against the org — a foreign completion_id can be stamped onto an observation row

**File:** `src/actions/observations.ts:89-100`; `supabase/migrations/00057_restore_sop_observations_cross_org_guard.sql:30`
**Issue:** `RecordObservationSchema.completionId` is any UUID; `recordObservation` inserts it verbatim, and the RLS guard `sop_observation_refs_in_org(sop_id, observed_worker_id, organisation_id)` deliberately covers `sop_id` and `observed_worker_id` but **not** `completion_id`. A recorder can attach another organisation's completion UUID (or an unrelated same-org worker's completion) to a permanent, append-only audit row. The policy was re-created twice this phase (00056, 00057) without closing this reference. Pre-existing from Phase 34, but this phase's audit-trail framing (D-07 "reconstructible audit trail") raises the cost of a row that permanently references the wrong evidence.
**Fix:** In `recordObservation`, when `completionId` is present, verify it with the session/admin client before insert:
```ts
if (completionId) {
  const { data: comp } = await createAdminClient()
    .from('sop_completions').select('id')
    .eq('id', completionId).eq('organisation_id', organisationId)
    .eq('worker_id', workerId).maybeSingle()
  if (!comp) return { success: false, error: 'Completion not found.' }
}
```

## Info

### IN-01: Multi-recipient assessment requests — acting on a request clears only the acting admin's row; peers keep stale entries and re-requests stay suppressed

**File:** `src/actions/observations.ts:395-414`; `src/components/observations/AssessmentRequestsPanel.tsx:30-33,88-91`
**Issue:** `requestAssessorReview` inserts one notification per admin/safety_manager, but recording/dismissing via the panel marks only the current admin's row read. Peer admins keep a live "Assess now" entry for a supervisor who may already be signed off (risking duplicate observations), their `NotificationBadge` count stays inflated, and the dedupe check (`read=false` on any recipient row) blocks the supervisor from re-requesting until **every** recipient dismisses.
**Fix:** On record/dismiss, mark **all** rows for `(organisation_id, sop_id, subject_user_id, type)` read via a small server action (admin client, org-scoped), instead of `markNotificationRead(id)` on one row. Also note `dismiss()` fire-and-forgets `markNotificationRead` with no error handling — a failed update resurrects the row on next load.

### IN-02: signOffCompletion re-validates an already Zod-guaranteed overrideReason; short reasons never actually reach the friendly error copy

**File:** `src/actions/completions.ts:183`; `src/lib/validators/completions.ts:82`
**Issue:** `SignOffSchema.overrideReason` is `.trim().min(10)`, so by the time `parsed.data.overrideReason` exists it cannot be shorter than 10 chars — the `|| parsed.data.overrideReason.trim().length < 10` clause is dead code. Side effect: a present-but-short reason fails the Zod parse first and surfaces the raw Zod issue message, not the mapped `ASSESSOR_OVERRIDE_REQUIRED` copy the UI handles. Same pattern in `recordObservation` (presence-only check, consistent). Harmless; simplify or leave.
**Fix:** Drop the redundant length clause, or (better UX for API callers) loosen Zod to `.optional()` string and keep the length check in the action so the mapped error code is the single failure surface.

---

_Reviewed: 2026-07-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
