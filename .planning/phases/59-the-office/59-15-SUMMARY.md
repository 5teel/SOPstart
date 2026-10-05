---
phase: 59-the-office
plan: 15
subsystem: retirement B
tags: [office, deletion, activity, completion-page, rls, dropped-features]
requires: [59-14]
provides:
  - "SupervisorActivityView, ActivityFilter, CompletionSummaryCard, RejectReasonSheet, useSupervisorCompletions (and SupervisorCompletion / FilterState) deleted"
  - "/activity renders each person's own record (WorkerActivityView) for every role"
  - "/activity/[completionId] is owner-only, read through the session client with the session org filter; photos signed only for returned rows via signCompletionPhotos; non-owner gets a server redirect() to /?place=office (worker to /activity)"
  - "supervisor-review dropped feature live in the Phase 55 sweep; 59-15 in LIVE_PLANS"
affects: [59-16]
requirements-completed: []
key-files:
  deleted:
    - "src/app/(protected)/activity/SupervisorActivityView.tsx"
    - src/components/activity/ActivityFilter.tsx
    - src/components/activity/CompletionSummaryCard.tsx
    - src/components/activity/RejectReasonSheet.tsx
  modified:
    - "src/app/(protected)/activity/page.tsx"
    - "src/app/(protected)/activity/[completionId]/page.tsx"
    - "src/app/(protected)/activity/[completionId]/CompletionDetailClient.tsx"
    - src/components/activity/CompletionStepRow.tsx
    - src/hooks/useCompletions.ts
    - tests/phase37/{assessor-ui-signoff,gap-migration-and-state,gap-org-guards}.spec.ts
    - tests/evals/{sop-ledger,cut-features,office}.eval.ts
    - scripts/dropped-features.json
    - tests/phase55/deletion-sweep.spec.ts
    - tests/phase59/{retirement-sweep,repoint-inventory,legacy-redirects,capability-matrix}.spec.ts
    - src/lib/journeys/journeys.ts
    - src/lib/uat/tests.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
duration: single session
completed: 2026-10-06
---

# Phase 59 Plan 15: Retirement B Summary

The supervisor halves of `/activity` are gone; sign-off lives only on the Office inbox row, and the walker's own completion page now reads through RLS with no service-role read by id (F-05, T-59-55).

## Commits

| Task | Commit | What |
|---|---|---|
| 1 | `576e4e59` | Delete supervisor views; owner-only completion page |
| 2 | `3a1f5620` | Repoint phase37 guards and the sop-ledger / cut-features evals |
| 3 | `5f462e8b` | Dropped feature, maps, matrix, sweeps, redirect and eval cases |

tsc and `npm run build` were green after Task 1 and again after Task 3. Bundle: `/page` 833 KB (baseline 834, **-1 KB**, downward only, baseline not touched); `/sops/[sopId]` 794 KB (baseline 792, +2 KB, inside the +/-2 KB tolerance; that route imports nothing this plan touched).

## What changed

- **Completion page:** UUID check, session-client read with `.eq('organisation_id', <session org>)`, `worker_id !== userId` or no row sends to `redirect(role === 'worker' ? '/activity' : '/?place=office')`. Steps via `orderedReviewSteps`, photos via `signCompletionPhotos`. `createAdminClient`, `isSignedOffAssessor`, `isSupervisor`, `alreadySigned`, `canOverride` are gone from the page.
- **CompletionDetailClient:** now purely the walker's view (steps, photos, status, decision and reason). Props shrank from 17 to 8; no sign-off bar, override sheet, reject sheet or request-assessment.
- **CompletionStepRow:** dropped the unused `storagePath` photo field (the signing helper no longer returns it; the page was its only consumer).
- **/activity:** one branch, `WorkerActivityView` for worker / supervisor / safety_manager / admin; no-role fallthrough kept.

## Moved assertions

- `assessor-ui-signoff.spec.ts`: client pins (teaching copy, override disclosure, `requestAssessorReview` wiring, ungated Reject, Approve wired to the blocked state) now read `SignOffPanel.tsx` (`signOffBlocked`, `signoff-reject`, `signoff-approve`); the old "page passes isAssessor / canOverride" test became "the page carries no sign-off surface".
- `gap-migration-and-state.spec.ts`: WR-04 repointed to `SignOffPanel` (`approve` -> `setForceOverride(true)`).
- `gap-org-guards.spec.ts` CR-01: the old "org guard on the fetched row before createSignedUrl" pins became: no `createAdminClient`, session-org `.eq`, owner check before `signCompletionPhotos`, no `data.organisation_id`, no assessor predicate on the page.
- `sop-ledger.eval.ts` case E: rejects from the Office inbox row (`data-key="signoff-<id>"`, reason dialog). `cut-features.eval.ts`: the walk sign-off test opens the inbox row and checks the photo thumbnail loads; the "existing completions" test now asserts an admin opening a real-org completion address lands on the Office (the owner's photo view cannot be exercised with the fixtures' sessions, and the walk test above covers the owner-safe photo path).
- Inventory files with no remaining hit (`phase37/assessor-ui-observation`, `phase34/*`, `phase35/training-record`, `phase55/worker-path-contract`, `phase59/signoff-actions`): checked, they read nothing deleted and pass unchanged.

## Dropped feature and maps

- `supervisor-review` (4 file entries + 1 symbol entry) in `scripts/dropped-features.json`; added to `LIVE_FEATURES` and `FEATURES` in the Phase 55 sweep; `'59-15'` appended to `LIVE_PLANS`; the 59-15 describe in `retirement-sweep`, the legacy-redirect case and the matrix case are live; the office eval gained the non-owner case (listed, not run live).
- `journeys.ts`: the supervisor review step is the Office inbox row (`route: '/'`); `/activity/[completionId]` stays mapped as "My completion" so `/pathways` still shows 0 not-mapped; record-observation journey now routes the activity entry to `/admin/training`. `uat/tests.ts`: sign-off entries point at the Office inbox; observation entries drop the Activity entry.
- `CAPABILITY-MATRIX.md`: new row "Activity -- own completion record" (everyone, redirect + no service-role read by id); "Record observation" notes the entry-point gap.

## Gap recorded for Phase 61

**"Record observation" lost its supervisor entry point.** The only supervisor-reachable route into `RecordObservationModal` was the old Activity page. Until Phase 61 puts it in the Smoko room, admins record from the `/admin/training` person panel and supervisors have no screen that opens the modal. The server action and its assessor gate are untouched. Recorded in the matrix and `journeys.ts`.

## Deviations from Plan

None that changed scope. Notes:

- **[Rule 3]** `CompletionStepRow`'s `storagePath` was dropped because the 59-06 signing helper does not return it and nothing read it.
- A UAT/journeys string literal carried an unescaped apostrophe on the first pass and was fixed before any commit (tsc caught it).
- Server-action parameter check: `signOffCompletion` and `requestAssessorReview` still have `SignOffPanel` as a caller; no parameter was supplied only by the deleted views.

## Verification

tsc and build clean; phase59, phase55 (incl. deletion-sweep), phase37, phase34, phase35, phase15-stubs, phase46 matrix doc, phase30, phase43, phase56, phase57 all green (source-contract only; some phase37/55 specs that self-skip or probe ran as they were registered); `npx playwright test --list` loads. Live probes and the deployed office eval were not run (orchestrator / 59-16 own that).

## Known Stubs

None.

## Self-Check: PASSED

Deleted files absent; commits `576e4e59`, `3a1f5620`, `5f462e8b` exist; `supervisor-review` in the dropped list and sweep; `'59-15'` in `LIVE_PLANS`.
