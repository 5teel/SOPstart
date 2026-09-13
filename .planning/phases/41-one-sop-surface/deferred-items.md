# Deferred items — Phase 41 (out of scope for the plan that found them)

## Found during 41-06 full-suite verification

- **`tests/integration/wizard-sop-dept.spec.ts:61` (`phase25-integration` project)
  — "DepartmentPicker in wizard mode uses sopId sentinel `__new__` (A4)"**
  fails on current `master` independent of any 41-06 change. The spec reads
  `src/components/admin/SopMetadataFields.tsx` for the literal `__new__`
  sentinel; that string is no longer present in the file (last touched by
  `d40d688`/`23cb3dc`/`dd1fd15`, none of which are Phase 41 commits). Out of
  scope — 41-06 touched neither file. Needs its own fix/repoint pass.

- **`tests/phase46/sop-edit-owner-access.spec.ts:573` — "IMAGES NEGATIVE"
  runtime probe** fails with `verifyOtp failed: Request rate limit reached`,
  a live Supabase Auth rate limit hit during the run, not a code regression.
  Re-run in isolation to confirm; unrelated to Phase 41.
