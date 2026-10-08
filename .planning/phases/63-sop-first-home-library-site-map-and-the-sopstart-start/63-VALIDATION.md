---
phase: 63
slug: sop-first-home-library-site-map-and-the-sopstart-start
status: planned
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-08
---

# Phase 63 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: 63-RESEARCH.md § Validation Architecture. Per-task map filled by the planner 2026-10-08 (revised after plan-check round 1: 21 plans); 63-21 signs it off.

---

## Execution Rule (deployed evals must not race)

From Wave 2 onward, plans run **sequentially on the main tree** -- never in parallel worktrees -- with **one push and one deployed eval run at a time**. Every eval run first waits until `https://sopstart.com/api/version` serves **its own plan's HEAD sha** (and checks `gh api repos/:owner/:repo/commits/<sha>/statuses` if it does not appear within 20 minutes); it never runs against an older build. A plan does not push while another plan's eval is running.

Order inside waves with more than one plan:

| Wave | Order | Eval-running plans |
|------|-------|--------------------|
| 2 | 63-02 → 63-03 → 63-04 | none (63-04 only confirms its Railway build) |
| 3 | 63-05 → 63-06 → 63-07 → 63-08 → 63-09 → 63-10 | none |
| 5 | **63-12 → 63-13 → 63-15** | 63-12 (home eval), 63-15 (start eval) |
| 6 | **63-14 → 63-16** | 63-14 (address eval) |
| 7 | 63-17 → 63-18 | none (63-21 runs the full suite) |

Single-plan waves: 1 (63-01), 4 (63-11), 8 (63-19), 9 (63-20), 10 (63-21, the full `npm run eval -- --phase 63`).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright `@playwright/test` ^1.58 (unit/source-contract specs in a `phase63` project; lint guards in `phase15-stubs`; deployed evals in project `evals`) |
| **Config file** | `playwright.config.ts` (63-01 adds `phase63`; 63-16 registers `no-walk-words`, 63-20 registers `no-rooms`, both in `phase15-stubs`) |
| **Quick run command** | `npx playwright test --project=phase63` |
| **Full suite command** | `npm run test` (once per gate — shared OTP budget) |
| **Deployed eval** | `npm run eval -- --phase 63` (writes `63-EVAL.md`; screenshots read by Claude); per-file live runs: `EVAL_BASE_URL=https://sopstart.com npx playwright test --project=evals --workers=1 --retries=0 <file>` |
| **Build gate** | `npm run build` (+ `npx tsc --noEmit`); a bundle baseline move in either direction is an orchestrator decision recorded in a SUMMARY -- executors never edit or re-capture `.bundle-baseline.json` |
| **Estimated runtime** | quick < 30 s · build ~4 min · eval file ~3 min · full eval ~12 min |

---

## Sampling Rate

- **After every task commit:** `npx playwright test --project=phase63` (+ `npx tsc --noEmit` for any `src/actions` edit)
- **After every plan wave:** `npm run build`, then the phase52/57/58/59/60 projects once, compared to `63-BASELINE.md`
- **Deployed checks while building:** 63-12 (home), 63-14 (addresses), 63-15 (start) each run their own eval file once against their own deploy, in the order above
- **Before `/gsd-verify-work`:** full suite once, `npm run eval -- --phase 63`, every screenshot read (63-21)
- **Max feedback latency:** 30 s (quick), one build per wave

---

## Per-Task Verification Map

| Task | Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|------|-------------|----------|-----------|-------------------|-------------|--------|
| 63-01-T1 | GATE-01 | project registered, inventory classes every referencing spec, baselines recorded | source-contract | `npx playwright test --list --project=phase63 && npx playwright test --project=phase63 repoint-inventory` | ❌ W0 creates | ⬜ |
| 63-01-T2 | EVAL-01 | four-area fixture, three eval skeletons listed | type + list | `npx tsc --noEmit && npx playwright test --list --project=evals` | ❌ W0 creates | ⬜ |
| 63-02-T1 | MAP-01, HOME-02 | area precedence, real org → 3 areas, type, object kind, row status, Recent / Most used | unit | `npx playwright test --project=phase63 -g "library classifier|recent"` | ❌ 63-02 creates | ⬜ |
| 63-02-T2 | HOME-05 | home address whitelist, legacy tokens, stored places, from tokens, back paths | unit | `npx playwright test --project=phase63 -g "home state"` | ❌ 63-02 creates | ⬜ |
| 63-03-T1/T2 | MAP-02 | projection, token roles, layout 1/3/8/12 × 1/6/15/40, no overlap, deterministic, view boxes | unit (TDD) | `npx playwright test --project=phase63 -g "iso layout"` | ❌ 63-03 creates | ⬜ |
| 63-04-T1 | BRAND-01 | wordmark on `--wm-*`, Saira via next/font, yellow only in the wordmark | lint + source-contract | `npx playwright test --project=phase63 -g "wordmark" && npx playwright test --project=phase15-stubs design-tokens design-principles no-undefined-css-tokens` | ✅ lints / ❌ spec | ⬜ |
| 63-04-T2 | BRAND-01, GATE-01 | wordmark target in the focus bar, Back / Stop, gates hold | build + source-contract | `npm run build && npx playwright test --project=phase58 frame-structure edit-rail` | ✅ | ⬜ |
| 63-05-T1/T2 | HOME-02 | browser-client only, worker_id filters, search sanitiser, list structure, Ask / Write | unit + source-contract | `npx playwright test --project=phase63 -g "sop list"` | ❌ 63-05 creates | ⬜ |
| 63-06-T1/T2 | HOME-03 | assembleFocus shared, owner gate (R4), Read structure and fuse hooks | unit + source-contract | `npx playwright test --project=phase63 -g "read view" && npx playwright test --project=phase58 && npx playwright test --project=phase59 capability-matrix` | ❌ 63-06 creates | ⬜ |
| 63-07-T1/T2 | HOME-04 | place-free Office pane, Sign-offs / People tabs equal tabsForRole | source-contract | `npx playwright test --project=phase59 && npx playwright test --project=phase63 -g "office sections"` | ✅ / ❌ | ⬜ |
| 63-08-T1/T2 | HOME-04 | Manage drafts read without side effects, site editor module, objectives list | source-contract | `npx playwright test --project=phase63 -g "manage section"` | ❌ 63-08 creates | ⬜ |
| 63-09-T1/T2 | HOME-04 | panels split, My record composition, Training body, no count | source-contract + build | `npx playwright test --project=phase60 && npx playwright test --project=phase63 -g "record and training" && npm run build` | ✅ / ❌ | ⬜ |
| 63-10-T1 | MAP-02, MAP-03, MAP-04 | SVG from code, tokens only, keyboard, tween on a ref, reduced motion, markers vs signs | source-contract | `npx playwright test --project=phase63 -g "site map"` | ❌ 63-10 creates | ⬜ |
| 63-10-T2 | MAP-02 | rendered samples read at 1280 and 390 | visual (PNG read) | `npx tsx scripts/render-map-samples.ts && npx playwright test --project=phase63 -g "site map"` | ❌ 63-10 creates | ⬜ |
| 63-11-T1 | HOME-01, MAP-04 | one select / replaceState, lazy sections and map, no viewport branching, bell dot | source-contract | `npx playwright test --project=phase63 -g "home shell" && npx playwright test --project=phase60 bell-structure` | ❌ / ✅ | ⬜ |
| 63-11-T2 | HOME-05, GATE-01 | `/` on HomeShell, legacy redirect, focus from / back, markers on `/page`, gates | build + source-contract | `npm run build && npx playwright test --project=phase58 && npx playwright test --project=phase63 && npx playwright test --project=phase15-stubs` | ✅ | ⬜ |
| 63-12-T1 | EVAL-01 | home cases written | type + list | `npx tsc --noEmit && npx playwright test --list --project=evals tests/evals/home.eval.ts` | ❌ W0 skeleton | ⬜ |
| 63-12-T2 | EVAL-01, HOME-01/02/04, MAP-03/04 | deployed home for every role, both widths, real org; results table in SUMMARY | deployed eval + screenshots | `test "$(grep -c 'test.fixme' tests/evals/home.eval.ts)" = "0" && npm run build` + live run of `home.eval.ts` | ✅ | ⬜ |
| 63-13-T1 | HOME-05 | notification places and Back bars write home addresses; legacy places still resolve | unit + source-contract | `npx playwright test --project=phase60 notification-places && npx playwright test --project=phase63 -g "home state"` | ✅ (repoint) | ⬜ |
| 63-13-T2 | HOME-05 | proxy + next.config translators; due reviews on home load | build + source-contract | `npm run build && npx playwright test --project=phase59 legacy-redirects` | ✅ (repoint) | ⬜ |
| 63-14-T1 | HOME-05 | no component writes an old address | source-contract | `npx playwright test --project=phase59 && npx playwright test --project=phase60` | ✅ | ⬜ |
| 63-14-T2 | HOME-04, HOME-05 | two pages retired with redirects, pathways routes and matrix prose in one commit | lint + build | `npm run build && npx playwright test --project=phase15-stubs no-dead-internal-hrefs && npx playwright test --project=phase43 && npx playwright test --project=phase59 capability-matrix` | ✅ | ⬜ |
| 63-14-T3 | EVAL-01 | every legacy address and redirect proven; results table in SUMMARY | deployed eval | `test "$(grep -c 'test.fixme' tests/evals/home-addresses.eval.ts)" = "0"` + live run of `home-addresses.eval.ts` | ❌ W0 skeleton | ⬜ |
| 63-15-T1 | FUSE-01, GATE-01 | durations from tokens, reduced motion, lazy engine, layer in root layout | source-contract | `npx playwright test --project=phase63 -g "fuse wiring"` | ❌ 63-15 creates | ⬜ |
| 63-15-T2 | FUSE-02, HOME-03, HOME-05 | no await / server action before push, go / fresh carried, autostart ref-guarded, resume and browse start words | source-contract + build | `npx playwright test --project=phase63 -g "fuse wiring|read view" && npx playwright test --project=phase58 && npm run build` | ✅ / ❌ | ⬜ |
| 63-15-T3 | FUSE-01, FUSE-02, EVAL-01 | full / short / none; lands in the running SOP; resume; second start; results table + frame readings | deployed eval + frame screenshots | `test "$(grep -c 'test.fixme' tests/evals/start.eval.ts)" = "0"` + live run of `start.eval.ts` | ❌ W0 skeleton | ⬜ |
| 63-16-T1 | WORD-01 | copy + server strings + STALE_WALK in lockstep | source-contract | `npx playwright test --project=phase58 && npx playwright test --project=phase59` | ✅ (repoint) | ⬜ |
| 63-16-T2 | WORD-01 | registered, mutation-proven no-walk-words guard (green because 63-15 landed first) | lint | `npx playwright test --project=phase15-stubs no-walk-words` | ❌ 63-16 creates | ⬜ |
| 63-17-T1/T2 | DOCS-01, WORD-01 | journeys / UAT / matrix prose / routing; no gate change | lint + source-contract | `npx playwright test --project=phase15-stubs no-walk-words no-global-blocks-in-journeys no-dead-internal-hrefs && npx playwright test --project=phase59 capability-matrix && npx playwright test --project=phase60 capability-matrix` | ✅ | ⬜ |
| 63-18-T1/T2 | EVAL-01 | one-screen eval mapped and retired; siblings rewritten; inventory live for 11/13/14/15/16 | type + list + source-contract | `npx tsc --noEmit && npx playwright test --list --project=evals && npx playwright test --project=phase63 repoint-inventory` | ✅ | ⬜ |
| 63-19-T1 | RET-01 | R1 producer removed; agent machine requests hidden from Requests | source-contract + build | `npm run build && npx playwright test --project=phase54 && npx playwright test --project=phase59 && npx playwright test --project=phase60` | ✅ (repoint) | ⬜ |
| 63-19-T2 | RET-01 | room specs retired / repointed ahead of the deletion; inventory live for 63-19 | source-contract | `npx playwright test --project=phase52 --project=phase57 --project=phase58 --project=phase59 --project=phase60 --project=phase63` | ✅ | ⬜ |
| 63-20-T1 | RET-01, DOCS-01 | room code deleted, ADR-0005 + index + ADR-0003 status + no-rooms guard + registration in ONE commit | lint + build + commit check | `npx playwright test --list --project=phase15-stubs | grep no-rooms && npx playwright test --project=phase15-stubs && npm run build` and `git show --name-status HEAD` | ❌ 63-20 creates | ⬜ |
| 63-20-T2 | GATE-01, DOCS-01 | markers re-derived, CLAUDE.md ADR line, allowlist removed, inventory live | build + suite | `npm run build && npx playwright test --project=phase15-stubs && npx playwright test --project=phase52 --project=phase54 --project=phase57 --project=phase58 --project=phase59 --project=phase60 --project=phase63` | ✅ | ⬜ |
| 63-21-T1 | EVAL-01 | full deployed eval, every screenshot read, fix round | deployed eval | `npm run eval -- --phase 63` | ✅ | ⬜ |
| 63-21-T2 | GATE-01, DOCS-01 | build gates, full suite once vs baseline, sign-off | build + suite | `npm run build && npm run test` | ✅ | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Register `phase63` in `playwright.config.ts` (63-01); register every new `tests/lint/*.spec.ts` (63-16, 63-20; verify with `--list`)
- [ ] `tests/phase63/repoint-inventory.spec.ts` — classify the room-referencing specs (retire / repoint) before code moves (63-01)
- [ ] Baseline: `npm run build` numbers and the phase52/57/58/59/60 failure list on the untouched tree → `63-BASELINE.md` (63-01)
- [ ] Eval fixture giving the eval-site org four areas (`tests/evals/lib/library-fixture.ts`) + three eval skeletons (63-01)
- [ ] ADR-0005 and `tests/lint/no-rooms.spec.ts` land in the same commit as the deletion of `src/lib/site/rooms.ts` (63-20 Task 1; ADR README rule 2)

---

## Manual-Only Verifications

None. The merge's look is judged from deployed screenshots taken with the development slow-motion flag (`?fuse=slow` → sessionStorage `sopstart-fuse-slow`), read frame by frame (63-15, 63-21); the map's geometry from the 63-10 sample renders and the real-org screenshots (63-12) — no click-path UAT (Simon: evals, not click-paths).

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30 s
- [ ] `nyquist_compliant: true` set in frontmatter (63-21, after the evidence is in)

**Approval:** pending (63-21)
