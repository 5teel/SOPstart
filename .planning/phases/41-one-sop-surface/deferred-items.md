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

## Found during 41-08 full-suite verification

- **`tests/sb-auth-builder.test.ts:4` (`phase11-stubs` project) — "SB-AUTH-01
  admin can start a new SOP from a blank-page wizard..."** fails on
  `expect(wizard).toContain('useForm')` against
  `src/app/(protected)/admin/sops/new/blank/WizardClient.tsx`, which manages
  its 4-step form with plain `useState`, not React Hook Form. Confirmed
  pre-existing and IDENTICAL on `master` before any 41-08 change (`git stash`
  + re-run reproduces the same failure). Neither this plan nor any prior
  Phase 41 plan touches `WizardClient.tsx`. Out of scope — needs its own
  fix/repoint pass (either restore `useForm` or repoint the assertion to the
  actual `useState`-based implementation).

- **`tests/sb-layout-editor.test.ts` (7-8 tests) and `tests/sb-section-schema.test.ts`
  (1 test), both `phase11-stubs`** — same pre-existing Phase 26 Puck-removal
  rot already documented in 41-07-SUMMARY.md (`ENOENT: src/lib/builder/puck-config.tsx`).
  Confirmed still present, unrelated to this plan.

- **`tests/phase46/sop-edit-owner-access.spec.ts` (5 "CAP-02 approver-edit
  runtime probes" tests) — `createEphemeralOrg failed: TypeError: fetch failed`**
  during the 41-08 full-suite run. Same class of live-Supabase-dependent
  runtime-probe flakiness as the single rate-limited test 41-06-SUMMARY
  already logged for this file, different specific symptom (network fetch
  failure vs. auth rate limit) — both are live-network conditions during the
  test run, not code regressions. Re-running this project in isolation
  (`npx playwright test --project=phase46`) is the way to confirm; not
  re-run here as it requires live Supabase network access and is outside
  this plan's scope (test-file repointing only).

- **`tests/phase3-stubs`/`phase12.5-stubs` legacy stub failures (14 tests
  total: 2× sb-ux-walkthrough, 4× sb-ux-blocks, 4× sb-ux-blueprint, 2×
  sb-ux-voice, 2× sb-ux-walkthrough in phase12.5-stubs)** — part of the
  "~26 legacy phase3-stubs/phase11-stubs/phase12.5-stubs failures" bucket
  41-06-SUMMARY already confirmed pre-existing. Not touched by this plan.
