# Phase 30 — Deferred Items

Out-of-scope discoveries logged during execution (do NOT fix in the discovering plan).

## From 30-01 (2026-07-12)

- **Publish-route gate-string specs still stale (same class as the scp fix):**
  `tests/builder/builder-review-flow.spec.ts` R10 ("Server publish route still contains the 400 unverified_blocks gate") and
  `tests/phase26/spine-regression.spec.ts` ("publish route still rejects unverified blocks with 400 unverified_blocks")
  both assert gate strings that Phase 29 (`f150f4b`) moved into `src/lib/governance/publish-core.ts`.
  Fix = repoint reads to publish-core + assert the route delegates via `performPublish(` (~4 lines each, mirrors 30-01's scp-verify-checklist fix).

- **`VerifyChecklistGate.tsx` has no live mount:** its only mounter was the legacy
  BuilderWithSourceViewer (deleted in 30-01); Phase 26 moved verification into ReviewStation.
  Still exported from `src/components/admin/verify-checklist/index.ts` and unit-tested.
  Candidate deletion for the UX-08 dead-weight sweep plan (check `useVerifyChecklist` stays — it IS live in BuilderStageShell).

- **37 other pre-existing full-suite failures** (phase3/11/12.5/15 stubs, phase20-parsers,
  phase21-unit, phase26 verify-gate/reorder) — runtime/browser/live-DB dependent, long-standing.
  Full list in 30-01-SUMMARY.md § regression baseline. 30-08's gate compares against that list ("no NEW failures").
