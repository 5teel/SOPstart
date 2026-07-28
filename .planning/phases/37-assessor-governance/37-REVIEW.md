---
phase: 37-assessor-governance
reviewed: 2026-07-28T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/app/(protected)/activity/[completionId]/page.tsx
  - src/app/(protected)/activity/[completionId]/CompletionDetailClient.tsx
  - src/app/(protected)/admin/sops/[sopId]/video/page.tsx
  - src/actions/observations.ts
  - src/lib/competency/assessor.ts
  - src/lib/competency/__tests__/assessor.test.ts
  - src/components/observations/RecordObservationModal.tsx
  - scripts/apply-phase37-migration.mjs
  - tests/phase37/gap-org-guards.spec.ts
  - tests/phase37/gap-migration-and-state.spec.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 37: Code Review Report (Re-Review After Gap Closure 37-07/37-08)

**Reviewed:** 2026-07-28
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

Re-review of the 10 files touched by gap-closure plans 37-07/37-08 (diff base `76a41b6`). All seven prior findings (CR-01, CR-02, WR-01..WR-05) are **verified closed and sound** — see "Prior Findings Verification" below. Fix verification included tracing the dependency chain: `classifyCompetency` (reset floor correct per the 2026-07-24 learning), `resolveLineage` (input shape matches `LineageInputSop`), `signOffCompletion` + `SignOffSchema` (`overrideReason` present in Zod with the 10-char floor, enforced again in the action), migrations 00056/00057 (fully idempotent — `add column if not exists` / `drop policy if exists` — so the Management-API fallback's lack of migration-history recording cannot break a later `db push`), and Playwright registration (`phase37` project regex picks up both new specs; `phase35-unit` testDir `src/lib/competency/__tests__` covers `assessor.test.ts` — verified against `playwright.config.ts`, not assumed).

Two new warnings surfaced: the observation modal's save handler can wedge permanently on a thrown server action, and the WR-05 completion-reference validation has a residual gap (no SOP match). Two info items on display/sweep robustness. No critical issues.

## Prior Findings Verification

| ID | Fix | Verdict |
|----|-----|---------|
| CR-01 | `page.tsx:75-77` org guard on session `organisationId` runs before the presigned-URL `Promise.all` and the predicate; predicate consumes session org, not `data.organisation_id` (single remaining reference is the guard itself, pinned by `gap-org-guards.spec.ts`) | Sound |
| CR-01 sibling | `video/page.tsx:42` guard adds `organisation_id` to the select and compares against session org before any video-job reads; pre-existing `status !== 'published'` behaviour preserved | Sound |
| CR-02 | Applier iterates `MIGRATION_FILES` (00056 then 00057, order asserted) in the fallback path; assertion group 3 pins all three `with_check` substrings including `sop_observation_refs_in_org`; 00057 SQL carries both conjuncts | Sound |
| WR-01 | `assessor.ts:81` — `signOffs.some(s => s.decision === 'approved')` over all rows, order-independent; scope still enforced via `.in('completion_id', completionIds)` from the org+person-scoped completions query; RED/GREEN unit test added (`assessor.test.ts:120`) | Sound |
| WR-02 | `requestAssessorReview` gates `RECORDER_ROLES` before any admin-client work; SOP-org check before insert; unread dedupe intact | Sound |
| WR-03 | `[sopId]` effect resets `assessorStatus`/`requestSent`/`overrideOpen`/`overrideReason` on every SOP change; in-flight status stays null so `blocked` is false during fetch | Sound |
| WR-04 | `ASSESSOR_OVERRIDE_REQUIRED` branch inside `handleApprove` opens the override sheet when `canOverride`; idempotent on the re-entry path | Sound |
| WR-05 | `recordObservation` validates `completionId` against `sop_completions` scoped to session org + `workerId` via admin client, before the predicate read and the insert | Sound, with one residual gap (WR-01 below) |

## Warnings

### WR-01: WR-05 completion validation does not verify the completion belongs to the observed SOP

**File:** `src/actions/observations.ts:69-78`
**Issue:** The gap-closure check validates `completionId` against `organisation_id` and `worker_id` but not `sop_id`. `recordObservation` is a POST-invokable server action, so any recorder-role caller can invoke it directly (bypassing the modal's preset pairing) with a `completionId` that belongs to the right worker in the right org but a **different SOP**. Because `sop_observations` is append-only — the exact rationale the WR-05 comment cites — an observation on SOP A permanently referencing a completion of SOP B is unfixable once written, and the 00057 insert policy's `sop_observation_refs_in_org` deliberately does not cover `completion_id`, so this action is the only enforcement point. The UI flow always pairs `presetCompletionId` with the same completion's `presetSopId`, which is why this never surfaces in UAT.
**Fix:** Add `sop_id` to the same query. If lineage tolerance is wanted (a completion against a superseded version), check membership in the SOP's lineage; the minimal correct fix for the actual UI flow is:

```ts
const { data: completionRow } = await createAdminClient()
  .from('sop_completions')
  .select('id')
  .eq('id', completionId)
  .eq('organisation_id', organisationId)
  .eq('worker_id', workerId)
  .eq('sop_id', sopId)   // reject a completion for a different SOP
  .maybeSingle()
```

### WR-02: `handleSave` in RecordObservationModal has no try/catch — a thrown server action wedges the modal in "Saving…" forever

**File:** `src/components/observations/RecordObservationModal.tsx:156-175`
**Issue:** `handleSave` sets `setBusy(true)` then `await recordObservation(...)` with no try/catch/finally. If the server-action transport throws (network drop — the primary persona is a supervisor on a phone on a factory floor; offline is a first-class state in this app), `setBusy(false)` never runs: the Save button stays "Saving…", and the close button, note field, and verdict buttons are all `disabled={busy}`, so the recorder must abandon the page to recover. The sibling handler `handleApprove` in `CompletionDetailClient.tsx:121-176` wraps the identical call shape in try/catch/finally — this file missed the pattern. (Pre-existing from Phase 34, but 37-05/37-08 touched this exact function and it is in review scope.)
**Fix:**

```ts
async function handleSave() {
  if (!sopId || !verdict) return
  setBusy(true)
  setError(null)
  try {
    const result = await recordObservation({ /* ...unchanged... */ })
    if (!result.success) {
      setError(mapObservationError(result.error))
      return
    }
    onRecorded?.()
    onClose()
  } catch {
    setError('An unexpected error occurred.')
  } finally {
    setBusy(false)
  }
}
```

## Info

### IN-01: Completion detail page renders an arbitrary sign-off row when a completion carries more than one

**File:** `src/app/(protected)/activity/[completionId]/page.tsx:144-145`
**Issue:** `signOff = signOffs[0]` with no ordering on the nested `completion_sign_offs` select. The WR-01 fix in `assessor.ts` explicitly documents that a completion can carry multiple sign-off rows (append-only table, client-side-only `alreadySigned` guard, concurrent supervisors). When that happens, the displayed decision/reason/timestamp is whichever row PostgREST returns first — e.g. an old rejection reason shown on a since-approved completion. The status badge is driven by `data.status`, so only the detail row is arbitrary, not the headline.
**Fix:** Pick the newest row: `const signOff = signOffs.slice().sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null`.

### IN-02: Systemic sweep accepts any `organisationId` token as "guarded" — presence, not comparison

**File:** `tests/phase37/gap-org-guards.spec.ts:108-131`
**Issue:** The directory-wide sweep flags admin-client pages that don't *mention* `organisationId`. A future page that destructures `organisationId` from `getSessionContext()` but never compares it against the fetched row passes the sweep unguarded — the 2026-06-05 token-presence-vs-wiring gap in miniature, acknowledged as a tripwire but worth tightening.
**Fix:** Strengthen the unguarded filter to require a comparison, e.g. test for `/!==?\s*organisationId|\.eq\('organisation_id',\s*organisationId\)/` instead of a bare `includes('organisationId')`.

---

_Reviewed: 2026-07-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
