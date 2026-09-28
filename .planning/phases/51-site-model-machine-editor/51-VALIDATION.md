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

Task IDs match the PLAN files (`51-NN-PLAN.md`, task order). Frontmatter wave 1 is the Wave-0 scaffold.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 51-01-01 | 01 | 1 | all | — | every phase51 spec is discovered (no unregistered spec) | project registration | `npx playwright test --list --project=phase51` | ❌ W0 | ⬜ pending |
| 51-01-02 | 01 | 1 | SIT-02/03 | T-51-02 | Konva only in `builder-v2/visual/` + `admin/site/`; `SiteEditor` only via `SiteEditorLoader` | source-contract (existing gate, edited) | `npx playwright test --project=phase26 tests/phase26/konva-worker-isolation.spec.ts` | ✅ (edit) | ⬜ pending |
| 51-01-03 | 01 | 1 | SIT-02/03/04 | T-51-03, T-51-04 | polygon schema shape-only (concave OK), scene path org-prefixed, code matches DB pattern, Gemini request/response shape | unit (TDD) | `npx playwright test --project=phase51 tests/phase51/site-model.spec.ts` | ❌ W0 | ⬜ pending |
| 51-02-01 | 02 | 2 | SIT-01 | T-51-01 | every policy conjoins `current_organisation_id()`; `WITH CHECK` restates `USING`; FK cascades per D-13; bucket private 15 MB jpeg/png | source-contract | `npx playwright test --project=phase15-stubs tests/lint/rls-org-scope.spec.ts && npx playwright test --project=phase51 tests/phase51/site-migration-shape.spec.ts` | ✅ + ❌ W0 | ⬜ pending |
| 51-02-02 | 02 | 2 | SIT-01 | T-51-01 | [BLOCKING] migration live; pg_policies / pg_constraint / storage.buckets asserted | live apply | `node scripts/apply-phase51-migration.mjs` | ❌ (created) | ⬜ pending |
| 51-02-03 | 02 | 2 | SIT-01/04 | T-51-01, T-51-03 | same-org worker reads, worker writes denied, foreign-org reads empty + writes denied, cross-org FK links impossible, storage org-prefix enforced | integration (live) | `npx playwright test --project=phase51 tests/phase51/site-model-rls-runtime.spec.ts` | ❌ W0 | ⬜ pending |
| 51-03-01 | 03 | 2 | SIT-03/04 | T-51-01, T-51-02 | every action opens with `requireAdminContext()`; `setSopMachines` org-filters SOP + machines, inserts before pruning; no service-role client | source-contract | `npx playwright test --project=phase51 tests/phase51/site-actions-contract.spec.ts -g "actions"` | ❌ W0 | ⬜ pending |
| 51-03-02 | 03 | 2 | SIT-02 | T-51-02, T-51-03, T-51-04 | generate route: admin → key gate → validate → one fetch; 503 without key; key never in a response; Generate UI only when `canGenerate` | source-contract | `npx playwright test --project=phase51 tests/phase51/site-actions-contract.spec.ts` | ❌ W0 | ⬜ pending |
| 51-04-01 | 04 | 2 | SIT-02 | — | natural-size scene, fit on ResizeObserver, wheel zoom-to-cursor, stage pan | source-contract | `npx playwright test --project=phase51 tests/phase51/site-editor-canvas.spec.ts -g "scene"` | ❌ W0 | ⬜ pending |
| 51-04-02 | 04 | 2 | SIT-03 | — | vertices via `getRelativePointerPosition()` (scene px), close on first vertex / dblclick, vertex drag commits clamped scene px | source-contract | `npx playwright test --project=phase51 tests/phase51/site-editor-canvas.spec.ts && npx playwright test --project=phase26` | ❌ W0 | ⬜ pending |
| 51-05-01 | 05 | 3 | SIT-03/04 | — | Draw / Delete / rename / department / link / unlink handlers wired to the actions | source-contract | `npx playwright test --project=phase51 tests/phase51/site-workspace-wiring.spec.ts -g "workspace"` | ❌ W0 | ⬜ pending |
| 51-05-02 | 05 | 3 | SIT-02 | T-51-02 | `/admin/site` guarded by `requireAdminContext()` + redirect; header Site link; journeys route mapped | source-contract | `npx playwright test --project=phase51 tests/phase51/site-workspace-wiring.spec.ts && npx playwright test --project=phase30 --project=phase41` | ❌ W0 | ⬜ pending |
| 51-06-01 | 06 | 3 | SIT-04 | — | portaled modal lists org machines by department, search, writes via `setSopMachines` | source-contract | `npx playwright test --project=phase51 tests/phase51/builder-machines-row.spec.ts -g "modal"` | ❌ W0 | ⬜ pending |
| 51-06-02 | 06 | 3 | SIT-04 | — | builder Tools menu renders the Machines row | source-contract | `npx playwright test --project=phase51 tests/phase51/builder-machines-row.spec.ts` | ❌ W0 | ⬜ pending |
| 51-07-01 | 07 | 4 | SIT-02/03/04 | T-51-02 | eval authored; fixtures create the isolated eval-site org | source-contract (list) | `npx playwright test --list --project=evals` | ❌ W0 (skeleton) | ⬜ pending |
| 51-07-02 | 07 | 4 | SIT-02/03/04 | — | upload → draw two polygons (one after zoom) → name + department → link from builder → reload → all persist, stored in scene px; worker redirected | deployed eval | `npm run eval -- --phase 51` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `playwright.config.ts` — add `phase51` project (`testMatch: /tests\/phase51\/.*\.(spec|test)\.ts$/`), verified with `--list`
- [ ] `tests/phase51/` — stubs for every spec named above (`test.fixme` bodies with the assertion intent in the title); `site-model.spec.ts` goes live in the same plan (TDD)
- [ ] `tests/phase26/konva-worker-isolation.spec.ts` — `ALLOWED_DIR` → `ALLOWED_DIRS` array incl. `src/components/admin/site`, plus a SiteEditor-only-via-loader rule (lands in wave 1, before the first Konva import there in wave 2)
- [ ] `tests/evals/site-editor.eval.ts` — skeleton with `EVAL_ENV_READY` skip + fixture PNG `tests/evals/fixtures/site-scene.png` (1600×900)
- [ ] `51-BASELINE-FAILURES.md` — the full-suite failures that pre-date this phase, so the final gate means "no new failures"
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
