---
phase: 51
slug: site-model-machine-editor
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-28
---

# Phase 51 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (`@playwright/test`) — source-contract + runtime specs under `tests/phase51/`, deployed evals under `tests/evals/` |
| **Config file** | `playwright.config.ts` (project-based `testMatch` regex per phase) |
| **Quick run command** | `npx playwright test --project=phase51 && npx tsc --noEmit` |
| **Full suite command** | `npm run test && npm run build` |
| **Estimated runtime** | ~20 s quick · ~4 min full |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --project=phase51 && npx tsc --noEmit`
- **After every plan wave:** Run `npm run test && npm run build`
- **Before `/gsd-verify-work`:** Full suite green + `npm run eval -- --phase 51` against https://sopstart.com, screenshots read by the orchestrator
- **Max feedback latency:** 30 s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 51-W0 | 00 | 0 | all | — | — | project registration | `npx playwright test --list --project=phase51` | ❌ W0 | ⬜ pending |
| 51-01-01 | 01 | 1 | SIT-01 | T-51-01 | every policy conjoins `current_organisation_id()`; `WITH CHECK` restates `USING` | source-contract (existing, generic) | `npx playwright test tests/lint/rls-org-scope.spec.ts` | ✅ | ⬜ pending |
| 51-01-02 | 01 | 1 | SIT-01 | T-51-01 | cross-org session reads 0 rows; same-org worker reads layout/machines; worker write denied | integration | `npx playwright test --project=phase51 tests/phase51/site-model-rls-runtime.spec.ts` | ❌ W0 | ⬜ pending |
| 51-02-01 | 02 | 1 | SIT-02 | T-51-02 | `/admin/site` page imports `requireAdminContext`; editor via `next/dynamic({ ssr:false })` | source-contract | `npx playwright test --project=phase51 tests/phase51/site-route-guard.spec.ts` | ❌ W0 | ⬜ pending |
| 51-02-02 | 02 | 1 | SIT-02 | T-51-03 | scene upload validates MIME/size server-side; path is org-prefixed; bucket RLS org-scoped | integration + source-contract | `npx playwright test --project=phase51 tests/phase51/scene-storage.spec.ts` | ❌ W0 | ⬜ pending |
| 51-02-03 | 02 | 1 | SIT-02 | T-51-04 | Generate route requires admin + key; absent `GEMINI_API_KEY` hides the control and returns 503 | source-contract | `npx playwright test --project=phase51 tests/phase51/gemini-gate.spec.ts` | ❌ W0 | ⬜ pending |
| 51-03-01 | 03 | 2 | SIT-02 | — | Konva editor lives in the widened allow-list dir; no worker chunk imports it | source-contract (existing gate, edited) | `npx playwright test --project=phase26 tests/phase26/konva-worker-isolation.spec.ts` | ✅ (edit) | ⬜ pending |
| 51-03-02 | 03 | 2 | SIT-03 | T-51-01 | polygon create/rename/department/move-vertex/delete persist via server action, org-scoped | integration | `npx playwright test --project=phase51 tests/phase51/machine-crud.spec.ts` | ❌ W0 | ⬜ pending |
| 51-04-01 | 04 | 2 | SIT-04 | T-51-01 | `setSopMachines` rejects foreign-org SOP or machine ids; delete-then-insert is atomic per call | integration | `npx playwright test --project=phase51 tests/phase51/sop-machines.spec.ts` | ❌ W0 | ⬜ pending |
| 51-04-02 | 04 | 2 | SIT-04 | — | builder Tools menu has a Machines row wired to the modal | source-contract | `npx playwright test --project=phase51 tests/phase51/builder-machines-row.spec.ts` | ❌ W0 | ⬜ pending |
| 51-05-01 | 05 | 3 | SIT-02/03/04 | — | upload → draw two polygons → name → link SOP → reload → all persist | deployed eval | `npm run eval -- --phase 51` | ❌ W0 (`tests/evals/site-editor.eval.ts`, auto-registered) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `playwright.config.ts` — add `phase51` project (`testMatch: /tests\/phase51\/.*\.(spec|test)\.ts$/`), verified with `--list`
- [ ] `tests/phase51/` — stubs for every spec named above (`test.fixme` bodies with the assertion intent in the title)
- [ ] `tests/phase26/konva-worker-isolation.spec.ts` — `ALLOWED_DIR` → array, includes `src/components/admin/site/` (lands in the same wave as the first Konva import there)
- [ ] `tests/evals/site-editor.eval.ts` — skeleton with `EVAL_ENV_READY` skip + fixture PNG under `tests/evals/fixtures/`
- [ ] Existing infrastructure covers RLS lint, design-token lint, eval session minting

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Scene generation produces a usable isometric image | SIT-02 | Paid Gemini call; non-deterministic output; not run in CI or the deployed eval | Once `GEMINI_API_KEY` is on Railway: open `/admin/site` on an org with no layout, enter a one-paragraph description, Generate; the scene renders and machines are distinct enough to trace. Orchestrator reads the screenshot. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
