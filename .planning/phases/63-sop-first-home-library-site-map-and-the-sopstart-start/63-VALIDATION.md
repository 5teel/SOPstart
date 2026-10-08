---
phase: 63
slug: sop-first-home-library-site-map-and-the-sopstart-start
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-08
---

# Phase 63 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: 63-RESEARCH.md § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright `@playwright/test` ^1.58 (unit/source-contract specs in a `phase63` project; deployed evals in project `evals`) |
| **Config file** | `playwright.config.ts` (Wave 0 adds the `phase63` project and registers new `tests/lint/*.spec.ts`) |
| **Quick run command** | `npx playwright test --project=phase63` |
| **Full suite command** | `npm run test` (once per gate — shared OTP budget) |
| **Deployed eval** | `npm run eval -- --phase 63` (writes `63-EVAL.md`; screenshots read by Claude) |
| **Build gate** | `npm run build` (+ `npx tsc --noEmit`) |
| **Estimated runtime** | quick < 30 s · build ~4 min · eval ~10 min |

---

## Sampling Rate

- **After every task commit:** `npx playwright test --project=phase63` (+ `npx tsc --noEmit` for any `src/actions` edit)
- **After every plan wave:** `npm run build`, then the phase52/57/58/59/60 projects once, compared to the Wave 0 baseline
- **Before `/gsd-verify-work`:** full suite once, `npm run eval -- --phase 63`, every screenshot read
- **Max feedback latency:** 30 s (quick), one build per wave

---

## Per-Task Verification Map

Filled in by the planner per task. Requirement → test mapping from research:

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| MAP-01 | area precedence, empty areas dropped, real-org table → 3 areas; type; object kind | unit | `npx playwright test --project=phase63 -g "library classifier"` | ❌ W0 `tests/phase63/library.spec.ts` | ⬜ pending |
| MAP-02 | layout for 1/3/8/12 areas × 1/6/15 objects: no overlap, inside ground, deterministic | unit | `-g "iso layout"` | ❌ W0 `tests/phase63/iso-layout.spec.ts` | ⬜ pending |
| HOME-05 | URL state whitelist, legacy `?place=` + stored `notifications.place` still resolve, back href | unit | `-g "home state"` | ❌ W0 `tests/phase63/home-state.spec.ts` | ⬜ pending |
| HOME-02 | Recent merge/sort/cap + UUID validation; Most used counts | unit | `-g "recent"` | ❌ W0 `tests/phase63/recent.spec.ts` | ⬜ pending |
| WORD-01 | no "walk"/"Show me" user strings (allowlist); server strings and `STALE_WALK` keys equal | source-contract | `tests/lint/no-walk-words.spec.ts` | ❌ W0 | ⬜ pending |
| RET-01 | rooms modules absent; new ADR supersedes ADR-0003; index updated | source-contract | `tests/lint/no-rooms.spec.ts` | ❌ W0 | ⬜ pending |
| BRAND-01 | `Wordmark` uses `--wm-*`; no raw hex/px | lint | `tests/lint/design-tokens.spec.ts`, `tests/lint/design-principles.spec.ts` | ✅ | ⬜ pending |
| FUSE-01 | durations from tokens; reduced-motion skips; `router.push` with no preceding `await`; host in root layout | source-contract | `-g "fuse wiring"` | ❌ W0 `tests/phase63/fuse-wiring.spec.ts` | ⬜ pending |
| FUSE-01/02 | merge plays full then short; lands in the running SOP; Back returns; second start works | deployed eval | `npm run eval -- --phase 63` | ❌ W0 `tests/evals/home.eval.ts` | ⬜ pending |
| MAP-03/04 | zoom, filter, Esc, dim/switch, keyboard, 390 px markers + key, real-org screenshot | deployed eval + screenshots | same | ❌ | ⬜ pending |
| HOME-01/04 | section visibility per role; gates unchanged | eval + capability spec | `npx playwright test tests/phase59/capability-matrix.spec.ts` | ✅ (repoint) | ⬜ pending |
| GATE-01 | `/page`, `/sops/[sopId]/page` ≤ baseline + 2; markers present | build | `npm run build` | ✅ (markers updated) | ⬜ pending |
| DOC-01 | every new route/state in `journeys.ts`; `/pathways` 0 unmapped | eval | eval | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Register `phase63` in `playwright.config.ts`; register every new `tests/lint/*.spec.ts` (verify with `--list`)
- [ ] `tests/phase63/repoint-inventory.spec.ts` — classify the 53 room-referencing specs (retire / repoint) before code moves
- [ ] Baseline: `npm run build` numbers and the phase52/57/58/59/60 failure list on the untouched tree
- [ ] Eval fixture giving the eval-site org ≥ 3 areas (+ cleanup rules) in `tests/evals/lib/`
- [ ] New ADR draft (supersedes ADR-0003) and `tests/lint/no-rooms.spec.ts`

---

## Manual-Only Verifications

All phase behaviors have automated verification. The merge's look is judged from eval screenshots taken with the development slow-motion flag (`?fuse=slow`), read frame by frame — no click-path UAT (Simon: evals, not click-paths).

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30 s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
