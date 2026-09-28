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
| **Framework** | Playwright (`@playwright/test`) — source-contract, wiring AND pure-function unit specs all under `tests/phase52/` (`phase52` project, `testDir: '.'`, STATIC `@/` imports — the Phase 51 pattern); deployed evals under `tests/evals/` (`evals` project) |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `npx playwright test --project=phase52 && npx tsc --noEmit` |
| **Full suite command** | `npm run test && npm run build` (run the full suite ONCE per gate — live probes share the Supabase OTP budget, CLAUDE.md 2026-09-28) |
| **Estimated runtime** | ~20 s quick · ~4 min full |

Why not `phase15-unit`: its `testDir` is `src/lib/voice/__tests__`, so a unit file under `src/components/sop/plant/__tests__/` would never be discovered (CLAUDE.md 2026-05-25). The pure layer lives in `src/lib/sop/worker-signal.ts` + `src/lib/site/scene.ts` and is unit-tested from `tests/phase52/plant-pins.spec.ts` / `plant-stage.spec.ts`.

---

## Sampling Rate

- **After every task commit:** `npx playwright test --project=phase52 && npx tsc --noEmit`
- **After every plan wave:** `npm run build` (bundle gate is build-time) + the non-live projects the wave touched; full suite once at the phase gate (52-05)
- **Before `/gsd-verify-work`:** full suite once + `npm run eval -- --phase 52`, screenshots read by the orchestrator
- **Max feedback latency:** 30 s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 52-01-01 | 01 | 1 | all (scaffold), HOM-06 | T-52-03 | phase52 registered; Konva denied under `src/components/sop/plant/`; `konva (52 D-02)` + `voice modal (52 D-13)` marker groups on `/sops/page`; eval-site worker + published assigned fixture SOP provisioned | registration + source-contract + fixture script | `npx playwright test --list --project=phase52 && npx playwright test tests/phase26/konva-worker-isolation.spec.ts --project=phase26 && node scripts/eval-fixtures.mjs` | ❌ W0 | ⬜ pending |
| 52-01-02 | 01 | 1 | HOM-02 | T-52-01-C | `plantRelState` / `derivePlantPins` / `pickNowQueue` / `askMatches` pure and correct (due → never → updated → done); ONE classifier module; no table / column / store / Dexie table backs pins | unit + source-contract | `npx playwright test --project=phase52 tests/phase52/plant-pins.spec.ts tests/phase52/plant-pins-no-storage.spec.ts` | ❌ W0 | ⬜ pending |
| 52-01-03 | 01 | 1 | HOM-02, HOM-06 | T-52-01, T-52-02 | `listSiteForWorker` session-scoped (not admin-gated), `.eq('organisation_id', orgId)` on every query from the SESSION org, TTL-bounded signed URLs never logged; build green with the new marker groups; headroom recorded | source-contract + build gate | `npx playwright test --project=phase52 tests/phase52/site-worker-action.spec.ts && npm run build` | ❌ W0 | ⬜ pending |
| 52-02-01 | 02 | 2 | HOM-01 | — | camera constants 1.02 / 0.35 / 2.4 / 380 / 1.5 / 1.6 / 350; `flyToView` (targetX = (W − 380)/2), `fitBoxView`, zoom clamp, `zoneColour` fallback triple | unit | `npx playwright test --project=phase52 tests/phase52/plant-stage.spec.ts -g "camera maths"` | ❌ W0 | ⬜ pending |
| 52-02-02 | 02 | 2 | HOM-01 | T-52-03 | PlantStage: re-measure fit via ResizeObserver, non-passive wheel → `zoomAt`, drags starting on a polygon ignored, img lazy/async, no window/navigator in first render, no Konva | source-contract (wiring) | `npx playwright test --project=phase52 tests/phase52/plant-stage.spec.ts` | ❌ W0 | ⬜ pending |
| 52-02-03 | 02 | 2 | HOM-04 | — | panel: close → `onClose`; rows to-do first with RelBadge; Walk › `/sops/<id>?tab=walk`, Read `/sops/<id>`; "no photo yet"; empty state; 380 px; no admin controls | source-contract (wiring) | `npx playwright test --project=phase52 tests/phase52/plant-panel.spec.ts` | ❌ W0 | ⬜ pending |
| 52-03-01 | 03 | 2 | HOM-03 | — | Now card: Walk it → `/sops/<id>?tab=walk`, Show me → `onShowMe(machine id)`, Then: lines, "Nothing due" state, no ordering inside the component | source-contract (wiring) | `npx playwright test --project=phase52 tests/phase52/plant-now-card.spec.ts` | ❌ W0 | ⬜ pending |
| 52-03-02 | 03 | 2 | HOM-05 | T-52-03 | ask input edits the one query; mic opens the existing `WalkthroughVoiceModal` via `next/dynamic({ssr:false})` scoped to `voiceSopId`; voice import guard allows exactly two dynamic sites | source-contract (wiring) + lint | `npx playwright test --project=phase52 tests/phase52/plant-ask-bar.spec.ts && npx playwright test tests/lint/no-static-desktop-import.spec.ts` | ❌ W0 / ✅ edit | ⬜ pending |
| 52-04-01 | 04 | 3 | HOM-01..05 | — | PlantHome: open → `flyTo`, close → `fit`, chip → `fitMachines`; pins / Now / panel / ask from one list; NowCard hidden while loading | source-contract (wiring) | `npx playwright test --project=phase52 tests/phase52/plant-render-seam.spec.ts -g "PlantHome wiring"` | ❌ W0 | ⬜ pending |
| 52-04-02 | 04 | 3 | HOM-01, HOM-03, HOM-06 | T-52-02, T-52-03 | `/sops`: PlantHome only via `next/dynamic({ssr:false})` when `!isAdmin && desktop && layout && machines > 0`; list otherwise; `['site-worker']` query has no `persister`; slot after every hook; admin branch untouched | source-contract | `npx playwright test --project=phase52 tests/phase52/plant-render-seam.spec.ts` | ❌ W0 | ⬜ pending |
| 52-04-03 | 04 | 3 | HOM-06 | T-52-03 | `npm run build` bundle gate green on both routes; `plant home (52 D-01)` marker on both; `.bundle-baseline.json` unchanged since 736f44a; new CSS present; journeys.ts + uat/tests.ts updated | build gate | `npm run build && git diff --quiet 736f44a HEAD -- .bundle-baseline.json` | ✅ (edit) | ⬜ pending |
| 52-05-01 | 05 | 4 | HOM-01..05 | T-52-05-B | deployed eval authored; eval run serial (`--workers=1`) | eval authoring | `npx playwright test --list --project=evals` | ❌ W0 (`tests/evals/plant-home.eval.ts`) | ⬜ pending |
| 52-05-02 | 05 | 4 | HOM-01..06 | T-52-01, T-52-03 | on sopstart.com: scene, ≥1 polygon, pin on EVAL Press, Now card Walk href, panel + badge + Walk href, close → fit, chip moves camera, ask highlight, voice dialog, no scope column, no console errors; no-site worker still sees the list; full suite ⊆ 51 baseline; screenshots read | deployed eval + full suite + build | `npm run build && npm run eval -- --phase 52` | ❌ W0 | ⬜ pending |
| 52-05-03 | 05 | 4 | — | — | validation signed off; earned learnings logged | doc | `grep -c "nyquist_compliant: true" .planning/phases/52-worker-home-the-plant/52-VALIDATION.md` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Cross-org read denial for the three site tables is not re-probed live in this phase: RLS is unchanged (no migration) and `tests/phase51/site-model-rls-runtime.spec.ts` already proves same-org worker read + foreign-org zero rows. The new action is pinned by source contract (52-01-03) and exercised on production by the eval (52-05-02).

---

## Wave 0 Requirements (all in 52-01)

- [ ] `playwright.config.ts` — `phase52` project (`testMatch: /tests\/phase52\/.*\.(spec|test)\.ts$/`), verified with `--list`
- [ ] `tests/phase52/` stubs for 52-02 / 52-03 / 52-04 specs (`test.fixme` with the assertion intent in the title) + live `plant-pins`, `plant-pins-no-storage`, `site-worker-action`
- [ ] `tests/phase26/konva-worker-isolation.spec.ts` — explicit deny test for `src/components/sop/plant/` (static and dynamic)
- [ ] `scripts/check-bundle-size.ts` — `konva (52 D-02)` and `voice modal (52 D-13)` groups on `/sops/page` (research Pitfall 4); the `plant home (52 D-01)` group lands in 52-04 once its marker string exists
- [ ] `scripts/eval-fixtures.mjs` — `eval-site-worker@sopstart.com` (worker of the eval-site org) + a PUBLISHED `Eval plant fixture SOP` (one section, one 5-minute step) assigned to that worker (research Pitfalls 2/3); the SOP ↔ EVAL Press link is re-ensured by the eval's `beforeAll` because site-editor's reset cascades it away
- [ ] `tests/evals/lib/session.ts` `EVAL_USERS.siteWorker`; `tests/evals/plant-home.eval.ts` skeleton with `EVAL_ENV_READY` skip

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| None | — | All phase behaviours have automated verification; the screenshots are read by the orchestrator as part of 52-05-02 | — |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
