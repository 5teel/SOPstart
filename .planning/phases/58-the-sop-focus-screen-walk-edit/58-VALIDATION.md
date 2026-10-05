---
phase: 58
slug: the-sop-focus-screen-walk-edit
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-05
---

# Phase 58 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `58-RESEARCH.md` §Validation Architecture; the planner fills the per-task map.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright `@playwright/test` ^1.58.2 (source-contract, pure-module unit specs with static `@/` imports, live-DB probes, deployed evals) |
| **Config file** | `playwright.config.ts` — Wave 0 registers project `phase58` (`testMatch: /tests\/phase58\/.*\.(spec\|test)\.ts$/`), modelled on `phase56`/`phase57`; verify with `npx playwright test --list --project=phase58` |
| **Quick run command** | `npx tsc --noEmit && npx playwright test --project=phase58` |
| **Full suite command** | `npm run test` **once** per gate, then `npm run build` (bundle gate) as the final gate |
| **Deployed eval** | `npm run eval -- --phase 58` (new `tests/evals/sop-focus.eval.ts`) |
| **Estimated runtime** | ~60 s quick · ~15 min full suite · ~5 min eval |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit && npx playwright test --project=phase58` plus any sibling project whose specs the task's files appear in (see Spec Repoint list in RESEARCH.md).
- **After every plan wave:** Run `phase58`, `phase57`, `phase56`, `phase55`, `phase41`, `phase15-stubs`, `phase26`, `phase29`, `phase30`, `phase52`, `phase54`.
- **Before `/gsd-verify-work`:** `npm run build` green, full `npm run test` green once (live probes failing only with `verifyOtp … rate limit` are an environment limit, not a regression), `npm run eval -- --phase 58` passed with every UI-SPEC screenshot read.
- **Max feedback latency:** 120 seconds (quick run).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (planner fills from PLAN.md tasks) | | | FOC-01 | — | Top bar carries Back + title only; no shell testids on the focus route | source-contract + eval | `npx playwright test --project=phase58 frame-structure` | ❌ W0 | ⬜ pending |
| | | | FOC-02 | T-58-objective | `setSopObjective` behind `requireSopEditAccess`, org resolved server-side | source-contract + live | `npx playwright test --project=phase58 edit-rail` | ❌ W0 | ⬜ pending |
| | | | FOC-03 | T-58-from | `?from` passes the place whitelist; legacy redirects in proxy only | pure unit + source-contract | `npx playwright test --project=phase58 focus-path legacy-redirects` | ❌ W0 | ⬜ pending |
| | | | FOC-04 | T-58-walk | Walk actions org-scope, step-in-SOP, ack kinds, photo path; submit recomputes from the walk row; second walk does not leak | pure unit + source-contract + live probe | `npx playwright test --project=phase58 focus-model walk-actions walk-no-leak` | ❌ W0 | ⬜ pending |
| | | | WRK-03 | — | Every on-ramp writes `sop_focus_steps`; none writes `layout_data`; editor mounts over a parse job without `window.location` | source-contract + unit + eval | `npx playwright test --project=phase58 parse-pipelines parse-progress` | ❌ W0 | ⬜ pending |
| | | | WRK-04 | T-58-gate | Gate re-keyed to steps and re-pinned once; `clearFinding` writes the ledger; no tick-all | source-contract + live + lint | `npx playwright test --project=phase58 publish-gate reviewer-steps edit-actions` + `--project=phase15-stubs` | ❌ W0 (+ ✅ `tests/lint/no-bulk-verify-ui.spec.ts`) | ⬜ pending |
| | | | SOP-04 | — | Workers resolve to lineage-latest published; fork copies every `sop_id`-keyed table | pure unit + census spec + eval | `npx playwright test --project=phase58 lineage-current fork-draft` | ❌ W0 | ⬜ pending |
| | | | (cross) | — | Retirement/deletion sweeps assert absence of REFERENCES; converter refuses `--apply`; capability-matrix rows present | source-contract | `npx playwright test --project=phase58 retirement-sweep repoint-inventory cutover-converter-retired capability-matrix` | ❌ W0 | ⬜ pending |
| | | | (cross) | — | Worker route ≤ baseline +2 KB; editor/Konva/pdfjs/mammoth markers absent from the worker route | build gate + spec | `npm run build`; `npx playwright test --project=phase41 bundle-gate` | ✅ edit | ⬜ pending |
| | | | (cross) | — | `--text-step` declared; no raw palette/px | lint | `npx playwright test --project=phase15-stubs design-tokens` | ✅ edit | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `playwright.config.ts` — register `phase58`; verify with `--list`
- [ ] `tests/phase58/repoint-inventory.spec.ts` + `tests/phase58/retirement-sweep.spec.ts` (Phase 57 idiom; `fixme` until the owning plan lands)
- [ ] Requirement spec stubs per the map above (`frame-structure`, `edit-rail`, `focus-path`, `legacy-redirects`, `focus-model`, `walk-actions`, `walk-no-leak`, `parse-pipelines`, `parse-progress`, `publish-gate`, `reviewer-steps`, `edit-actions`, `lineage-current`, `fork-draft`, `cutover-converter-retired`, `capability-matrix`)
- [ ] `scripts/eval-fixtures.mjs` — focus-step fixtures, lineage fixture, parse-job fixtures
- [ ] `tests/evals/sop-focus.eval.ts` skeleton (self-skips without `EVAL_BASE_URL`); screenshots per UI-SPEC; no-reload marker; walk twice; computed sizes (`min-height` ≥ 60, rail 300, column max-width 820, rail hidden < 1024); compiled CSS contains the new utilities
- [ ] `--text-step` token + lint pin
- [ ] Pure modules `src/lib/sop/focus.ts`, `focus-path.ts`, `lineage-current.ts` with unit specs first

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Placement / sizing / token rendering on the real org's SOPs | FOC-01, FOC-02 | CSS-token and geometry bugs are invisible to assertions (CLAUDE.md 2026-07-14, 2026-10-05) | Claude reads every `58-*` screenshot from `npm run eval -- --phase 58` before declaring a pass; escalate to Simon only with a specific failing screenshot |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
