---
phase: 52
slug: worker-home-the-plant
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-28
---

# Phase 52 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (`@playwright/test`) — source-contract + wiring specs under `tests/phase52/`, pure-function unit tests under `src/components/sop/plant/__tests__/` (`phase15-unit` project, static `@/` imports), deployed evals under `tests/evals/` |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `npx playwright test --project=phase52 --project=phase15-unit && npx tsc --noEmit` |
| **Full suite command** | `npm run test && npm run build` (run the full suite ONCE per gate — live probes share the Supabase OTP budget, CLAUDE.md 2026-09-28) |
| **Estimated runtime** | ~25 s quick · ~4 min full |

---

## Sampling Rate

- **After every task commit:** `npx playwright test --project=phase52 --project=phase15-unit && npx tsc --noEmit`
- **After every plan wave:** `npm run build` (bundle gate is build-time) + non-live projects; full suite once at the phase gate
- **Before `/gsd-verify-work`:** full suite once + `npm run eval -- --phase 52`, screenshots read by the orchestrator
- **Max feedback latency:** 30 s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 52-W0 | 01 | 0 | all | — | — | project registration | `npx playwright test --list --project=phase52` | ❌ W0 | ⬜ pending |
| 52-01-01 | 01 | 1 | HOM-02 | T-52-01 | worker-readable site action returns only same-org rows; no admin fields; signed URL TTL-bounded | source-contract + live probe (once) | `npx playwright test --project=phase52 tests/phase52/site-worker-action.spec.ts` | ❌ W0 | ⬜ pending |
| 52-01-02 | 01 | 1 | HOM-02 | — | `derivePlantPins` / Now-card ordering pure and correct (due → never → updated → done) | unit | `npx playwright test --project=phase15-unit src/components/sop/plant/__tests__/pins.test.ts` | ❌ W0 | ⬜ pending |
| 52-01-03 | 01 | 1 | HOM-02 | — | no new table / store / Dexie table / column backs pins | source-contract | `npx playwright test --project=phase52 tests/phase52/plant-pins-no-storage.spec.ts` | ❌ W0 | ⬜ pending |
| 52-02-01 | 02 | 2 | HOM-01 | — | scene stage: fit re-measures, wheel zoom-to-cursor clamped, drag ignores polygon starts, camera constants present | unit (scene.ts maths) + source-contract | `npx playwright test --project=phase15-unit --project=phase52 tests/phase52/plant-stage.spec.ts` | ❌ W0 | ⬜ pending |
| 52-02-02 | 02 | 2 | HOM-04 | — | machine click → fly-to with 380 px offset → panel opens; rows to-do first; `Walk ›` href `/sops/<id>?tab=walk` | source-contract (handler wiring) | `npx playwright test --project=phase52 tests/phase52/plant-panel.spec.ts` | ❌ W0 | ⬜ pending |
| 52-03-01 | 03 | 2 | HOM-03 | — | Now card: due-first, Walk it → SOP page, Show me → `open(machine)`; hidden/neutral when nothing due | source-contract (handler wiring) | `npx playwright test --project=phase52 tests/phase52/plant-now-card.spec.ts` | ❌ W0 | ⬜ pending |
| 52-03-02 | 03 | 2 | HOM-05 | — | ask bar input highlights matching machines/SOPs; mic wired to the existing voice modal by dynamic import | source-contract (handler wiring) | `npx playwright test --project=phase52 tests/phase52/plant-ask-bar.spec.ts` | ❌ W0 | ⬜ pending |
| 52-04-01 | 04 | 3 | HOM-01/HOM-06 | T-52-02 | `/sops` page: plant module via `next/dynamic({ssr:false})` only when `!isAdmin && ≥1024 && hasSite`; fallback list otherwise; no Konva under `src/components/sop/plant/` | source-contract (existing Konva gate extended) | `npx playwright test --project=phase52 tests/phase52/plant-render-seam.spec.ts --project=phase26 tests/phase26/konva-worker-isolation.spec.ts` | ❌ W0 / ✅ edit | ⬜ pending |
| 52-04-02 | 04 | 3 | HOM-06 | — | `npm run build` bundle gate green; `/sops/page` gets a Konva forbidden-marker group; `.bundle-baseline.json` unchanged since 736f44a | build gate | `npm run build && git diff --quiet 736f44a HEAD -- .bundle-baseline.json` | ✅ (edit) | ⬜ pending |
| 52-05-01 | 05 | 4 | HOM-01..05 | — | deployed eval: eval-site worker sees scene, ≥1 polygon, pin on EVAL Press, panel lists fixture SOP with badge, Walk href, chip fits camera, no scope column, no console errors | deployed eval | `npm run eval -- --phase 52` | ❌ W0 (`tests/evals/plant-home.eval.ts`) | ⬜ pending |
| 52-05-02 | 05 | 4 | HOM-03 | — | real-org worker (no site) still sees today's list, never blank | deployed eval (second test) | `npm run eval -- --phase 52` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `playwright.config.ts` — `phase52` project (`testMatch: /tests\/phase52\/.*\.(spec|test)\.ts$/`), verified with `--list`
- [ ] `tests/phase52/` stubs for every spec above (`test.fixme` with the assertion intent in the title)
- [ ] `src/components/sop/plant/__tests__/pins.test.ts` stub (phase15-unit pattern — confirm its `testDir` covers this path or register it)
- [ ] `tests/phase26/konva-worker-isolation.spec.ts` — explicit deny assertion for `src/components/sop/plant/`
- [ ] `scripts/check-bundle-size.ts` — Konva forbidden-marker group added to the `/sops/page` entry (research Pitfall 4)
- [ ] `scripts/eval-fixtures.mjs` — eval-site org gets a worker member (`eval-site-worker@sopstart.com`) and a PUBLISHED fixture SOP linked to "EVAL Press" and assigned to that worker (research Pitfalls 2/3); `tests/evals/lib/session.ts` `EVAL_USERS` gains `siteWorker`
- [ ] `tests/evals/plant-home.eval.ts` skeleton with `EVAL_ENV_READY` skip

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| None | — | All phase behaviours have automated verification | — |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
