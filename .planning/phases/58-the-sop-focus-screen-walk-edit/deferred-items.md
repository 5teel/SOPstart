# Phase 58 deferred items

Found while executing 58-05; not caused by it, so not fixed there.

- **`tests/phase40/dat01-category-column.spec.ts` ("sops-table write census") is red.** `src/actions/focus-steps.ts` (58-04) writes `sops.objective` and `sops.allow_forward_jump` without `category_slug` and has no `CATEGORY_EXEMPT` entry. Fix: add two justified exempt entries (and bump `EXPECTED_SOPS_WRITE_SITE_COUNT` if the census counts them). Owner: the plan that next touches focus-steps, or 58-15.
- **`tests/phase55/deletion-sweep.spec.ts` ("photo-scan > tests/ has no reference") is red.** `tests/evals/sop-focus.eval.ts:48` (58-01/02 skeleton) has the `58-walk-photo-required` fixme title containing a symbol the Phase 55 sweep forbids. Fix: reword the title.
- **`src/components/admin/verify-checklist/__tests__/publish-gate.integration.test.ts` is registered in no Playwright project** (the `publish-gate` regex in `phase6-stubs` only searches `tests/`), so it never runs. Run through a throwaway config, its four gate tests pass after the 58-05 repoint; one unrelated test ("Publish button on builder header is REMOVED", expects `VerifyChecklistGate` in `BuilderClient.tsx`) fails. The file and the builder go in 58-16.

Found while executing 58-07; not caused by it, so not fixed there.

- **`tests/phase26/ai-overlay.spec.ts` is red** ("reused ReviewerFlagsPanel should render for the flagged block"). Its harness feeds the old block-keyed flags; `useReviewerFlags` groups by `step_id` since 58-06 (`554a856e`). The spec is a 58-16 delete in the repoint inventory; leave it red until then or delete it earlier.
- **`tests/integration/wizard-sop-dept.spec.ts` A4 ("sopId sentinel __new__") is red.** `src/components/admin/SopMetadataFields.tsx` no longer contains the literal `__new__` (predates Phase 58; the file was last touched by `c21b7e73`). Owner: whoever next edits the wizard metadata step.
