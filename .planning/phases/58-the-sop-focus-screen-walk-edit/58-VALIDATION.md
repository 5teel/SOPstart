---
phase: 58
slug: the-sop-focus-screen-walk-edit
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-10-05
---

# Phase 58 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `58-RESEARCH.md` §Validation Architecture; the per-task map below is filled from the 18 PLAN.md files.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright `@playwright/test` ^1.58.2 (source-contract, pure-module unit specs with static `@/` imports, live-DB probes, deployed evals) |
| **Config file** | `playwright.config.ts` — 58-01 registers project `phase58` (`testMatch: /tests\/phase58\/.*\.(spec\|test)\.ts$/`); verify with `npx playwright test --list --project=phase58` |
| **Quick run command** | `npx tsc --noEmit && npx playwright test --project=phase58` |
| **Full suite command** | `npm run test` **once** per gate, then `npm run build` (bundle gate) as the final gate |
| **Deployed eval** | `npm run eval -- --phase 58` (`tests/evals/sop-focus.eval.ts`) |
| **Estimated runtime** | ~60 s quick · ~15 min full suite · ~5 min eval |

---

## Sampling Rate

- **After every task commit:** `npx tsc --noEmit && npx playwright test --project=phase58` plus every sibling project named in the task's `<verify>` (the projects whose specs read the task's files).
- **After every plan wave:** `phase58`, `phase57`, `phase56`, `phase55`, `phase41`, `phase15-stubs`, `phase26`, `phase29`, `phase30`, `phase52`, `phase54`.
- **Before `/gsd-verify-work`:** `npm run build` green, full `npm run test` green once (live probes failing only with `verifyOtp … rate limit` are an environment limit), `npm run eval -- --phase 58` passed with every UI-SPEC screenshot read (58-18).
- **Max feedback latency:** 120 seconds (quick run).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 58-01-T1 | 01 | 1 | (cross) | T-58-01 | every retired literal has an owner; references not files | source-contract | `npx playwright test --project=phase58 repoint-inventory retirement-sweep` | ❌ W0 creates | ✅ |
| 58-01-T2 | 01 | 1 | all | T-58-02 | requirement stubs registered (fixme) | stub | `npx playwright test --list --project=phase58` | ❌ W0 creates | ✅ |
| 58-01-T3 | 01 | 1 | FOC-01 | — | `--text-step` declared and pinned | lint | `npx playwright test --project=phase15-stubs design-tokens` | ✅ edit | ✅ |
| 58-02-T1 | 02 | 2 | FOC-03, FOC-04 | T-58-from, T-58-redirect | `?from` whitelist; walk order; reachability; legacy mapping | unit | `npx playwright test --project=phase58 focus-model focus-path` | ❌ creates | ✅ |
| 58-02-T2 | 02 | 2 | SOP-04, WRK-03 | T-58-draft | lineage-latest; worker never resolves a draft; ETA heuristic | unit | `npx playwright test --project=phase58 lineage-current parse-progress` | ❌ creates | ✅ |
| 58-02-T3 | 02 | 2 | all | — | eval skeleton self-skips without EVAL_BASE_URL | eval list | `npx playwright test --list --project=evals sop-focus` | ❌ creates | ✅ |
| 58-03-T1 | 03 | 2 | FOC-04, WRK-04 | T-58-walk, T-58-gate, T-58-step-write | own-row RLS with org in USING+WITH CHECK; no write policy on steps/findings; tick-clearing trigger | lint + script | `npx playwright test --project=phase15-stubs rls-org-scope` | ❌ creates | ✅ |
| 58-03-T2 | 03 | 2 | FOC-04, WRK-04, SOP-04 | T-58-walk, T-58-04 | [BLOCKING] live apply verified via Management API; live RLS probes | live | `node scripts/apply-phase58-migration.mjs --assert-only && PHASE58_LIVE=1 npx playwright test --project=phase58 focus-rls-live` | ❌ creates | ✅ |
| 58-03-T3 | 03 | 2 | FOC-02 | — | matrix rows incl. page-not-RLS draft refusal; fixtures | source-contract | `npx playwright test --project=phase58 capability-matrix` | ❌ W0 stub | ✅ |
| 58-04-T1 | 04 | 3 | FOC-02 | T-58-step-write, T-58-07 | `{ stepId }` arm; session-org filters; drafts only | source-contract | `npx playwright test --project=phase58 edit-actions && npx playwright test --project=phase46` | ❌ W0 stub | ✅ |
| 58-04-T2 | 04 | 3 | WRK-04 | T-58-gate, T-58-finding, T-58-objective | tick/clear admin-only + ledger; objective ≤ 500 | source-contract | `npx playwright test --project=phase56 decision-writers-sweep` | ✅ edit | ✅ |
| 58-04-T3 | 04 | 3 | FOC-02 | T-58-06, T-58-05 | step-image prefix rebuilt server-side; no trust params | source-contract + live | `npx playwright test --project=phase58 edit-actions && npm run build` | ❌ W0 stub | ✅ |
| 58-05-T1 | 05 | 3 | WRK-04 | T-58-gate, T-58-08 | gate re-keyed (D-16), hash re-pinned once, no bypass | source-contract | `npx playwright test --project=phase56 publish-gate-pin && npx playwright test --project=phase58 publish-gate` | ✅ edit | ✅ |
| 58-05-T2 | 05 | 3 | SOP-04 | T-58-09 | notify on lineage publish; never superseded_by | source-contract | `npx playwright test --project=phase58 publish-gate && npm run build` | ❌ W0 stub | ✅ |
| 58-06-T1 | 06 | 3 | WRK-04 | T-58-reviewer, T-58-13 | draft block, step_id validated, findings as rows, job errors become findings | unit | `npx playwright test --project=phase21-ai-reviewer && npx playwright test --project=phase21-ai-reviewer-jobs` | ✅ edit | ✅ |
| 58-06-T2 | 06 | 3 | WRK-04 | T-58-11, T-58-12 | route org-scoped; caps kept; GET via edit access | source-contract | `npx playwright test --project=phase58 reviewer-steps` | ❌ W0 stub | ✅ |
| 58-07-T1 | 07 | 3 | WRK-03 | T-58-step-write, T-58-15 | on-ramps write focus steps with `new:` keys | source-contract | `npx playwright test --project=phase56 convert` | ✅ | ✅ |
| 58-07-T2 | 07 | 3 | WRK-03 | T-58-converter | no layout_data writer; blank wizard writes no sections | source-contract | `npx playwright test --project=phase58 parse-pipelines && npm run build` | ❌ W0 stub | ✅ |
| 58-08-T1 | 08 | 3 | SOP-04 | T-58-fork | fork copies every sops(id) table (census) | source-contract | `npx playwright test --project=phase58 fork-draft` | ❌ W0 stub | ✅ |
| 58-08-T2 | 08 | 3 | SOP-04 | T-58-draft | worker lists latest published only | unit + source-contract | `npx playwright test --project=phase58 lineage-consumers` | ❌ creates | ✅ |
| 58-08-T3 | 08 | 3 | FOC-04 | T-58-17 | old completions readable; agent layer on focus steps | source-contract | `npx playwright test --project=phase55 sop-pack && npm run build` | ✅ edit | ✅ |
| 58-09-T1 | 09 | 4 | FOC-04 | T-58-walk, T-58-photo | walk own-row; step-in-SOP; order rule; photo URL only for own walk | source-contract | `npx playwright test --project=phase55` | ✅ | ✅ |
| 58-09-T2 | 09 | 4 | FOC-04 | T-58-walk, T-58-18 | submit recomputes from walk row; refuses missing; recordSignature after insert | source-contract | `npx playwright test --project=phase58 walk-actions && npx playwright test --project=phase56 decision-writers-sweep` | ❌ W0 stub | ✅ |
| 58-10-T1 | 10 | 4 | FOC-01, FOC-03 | T-58-from, T-58-20, T-58-21 | frame has no site element; Back from events only | source-contract + lint | `npx playwright test --project=phase58 frame-structure` | ❌ W0 stub | ✅ |
| 58-10-T2 | 10 | 4 | FOC-03 | T-58-from | every entry href via `focusHref` with `from` | source-contract | `npx playwright test --project=phase52 && npx playwright test --project=phase57` | ✅ edit | ✅ |
| 58-11-T1 | 11 | 5 | FOC-04 | T-58-walk | walk/review/sent keyed to walk id; second walk inherits nothing | source-contract | `npx playwright test --project=phase58 walk-no-leak` | ❌ W0 stub | ✅ |
| 58-11-T2 | 11 | 5 | FOC-01, FOC-03, SOP-04 | T-58-draft, T-58-redirect | server resolver; proxy tab redirect; layout opt-out | source-contract | `npx playwright test --project=phase58 frame-structure legacy-redirects retirement-sweep` | ❌ W0 stub | ✅ |
| 58-11-T3 | 11 | 5 | FOC-01, FOC-04 | T-58-bundle | worker route ≤ baseline +2 KB; utilities compiled | build + eval list | `npm run build && npx playwright test --list --project=evals sop-focus` | ✅ edit | ✅ |
| 58-12-T1 | 12 | 5 | FOC-02 | — | relocated pieces keep behaviour | source-contract | `npx playwright test --project=phase51 && npx playwright test --project=phase56` | ✅ edit | ✅ |
| 58-12-T2 | 12 | 5 | WRK-04 | T-58-gate, T-58-20 | one tick per step; no tick-all; fork from a click | source-contract + lint | `npx playwright test --project=phase58 edit-ui && npx playwright test --project=phase15-stubs no-bulk-verify-ui` | ❌ creates | ✅ |
| 58-12-T3 | 12 | 5 | FOC-02, SOP-04 | T-58-gate | Publish follows gate status; approval divert shown | source-contract | `npx playwright test --project=phase58 edit-rail && npm run build` | ❌ W0 stub | ✅ |
| 58-13-T1 | 13 | 6 | WRK-03, WRK-04 | T-58-finding | parse view never empty, no navigation on completion; clear via ledger | source-contract | `npx playwright test --project=phase58 parse-progress-ui && npx playwright test --project=phase40` | ❌ creates | ✅ |
| 58-13-T2 | 13 | 6 | FOC-02 | T-58-draft, T-58-bundle | edit mode needs edit access; one lazy seam; editor markers absent from worker route | build + source-contract | `npm run build && npx playwright test --project=phase41 bundle-gate && npx playwright test --project=phase58 edit-rail frame-structure` | ✅ edit | ✅ |
| 58-13-T3 | 13 | 6 | WRK-03, SOP-04 | T-58-21 | on-ramps use router.push, no reload | source-contract + eval list | `npx playwright test --list --project=evals sop-focus && npm run build` | ✅ edit | ✅ |
| 58-14-T1 | 14 | 7 | WRK-04 | T-58-converter | [BLOCKING] final run skips native SOPs; dry run read first | script + report | `npx playwright test --project=phase56 convert` | ✅ | ✅ |
| 58-14-T2 | 14 | 7 | WRK-04 | T-58-converter | `--apply` refuses; `--missing` zero-step only | spawn + source-contract | `npx playwright test --project=phase58 cutover-converter-retired` | ❌ W0 stub | ✅ |
| 58-14-T3 | 14 | 7 | FOC-03 | T-58-redirect, T-58-from | builder/versions redirect in proxy; admin links to editor | source-contract | `npx playwright test --project=phase58 legacy-redirects retirement-sweep repoint-inventory` | ✅ edit | ✅ |
| 58-15-T1 | 15 | 8 | FOC-01, FOC-04 | T-58-23 | worker guards read focus files | source-contract | per-task project list (phase28/30/35/36/37/41/53/55) | ✅ edit | ✅ |
| 58-15-T2 | 15 | 8 | FOC-02 | T-58-23, T-58-gate | admin guards read the editor; no-bulk-verify scans focus | source-contract | per-task project list (phase29/30/32/40/43/54, lints) | ✅ edit | ✅ |
| 58-16-T1 | 16 | 9 | FOC-04 | T-58-walk | legacy client-trusted submit input removed; worker side deleted | sweep + build | `npm run build && npx playwright test --project=phase55 deletion-sweep` | ✅ edit | ✅ |
| 58-16-T2 | 16 | 9 | FOC-02 | T-58-24, T-58-25, T-58-01 | junction arm and legacy PATCH gone; four dropped features live | sweep + build | `npm run build && npx playwright test --project=phase58 && npx playwright test --project=phase56` | ✅ edit | ✅ |
| 58-17-T1 | 17 | 10 | FOC-02 (optional) | T-58-annotation, T-58-26 | annotation path prefix + draft + org filter | source-contract | `npx playwright test --project=phase58 annotation` | ❌ creates | ✅ |
| 58-17-T2 | 17 | 10 | FOC-02 (optional) | T-58-bundle | Konva absent from worker route; explicit un-drop | build + sweep | `npm run build && npx playwright test --project=phase26 konva-worker-isolation` | ✅ edit | ✅ |
| 58-18-T1 | 18 | 11 | all | T-58-27, T-58-converter | deployed eval; screenshots read; `--missing` once | deployed eval | `npm run eval -- --phase 58` | ✅ | ✅ |
| 58-18-T2 | 18 | 11 | all | T-58-28 | build + full suite once; sign-off | full suite | `npm run build && npm run test` | ✅ | ✅ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `playwright.config.ts` — register `phase58`; verify with `--list` (58-01-T1)
- [x] `tests/phase58/repoint-inventory.spec.ts` + `tests/phase58/retirement-sweep.spec.ts` (58-01-T1)
- [x] Requirement spec stubs (`frame-structure`, `edit-rail`, `legacy-redirects`, `walk-actions`, `walk-no-leak`, `parse-pipelines`, `publish-gate`, `reviewer-steps`, `edit-actions`, `fork-draft`, `cutover-converter-retired`, `capability-matrix`) (58-01-T2)
- [x] `--text-step` token + lint pin (58-01-T3)
- [x] Pure modules `src/lib/sop/focus.ts`, `focus-path.ts`, `lineage-current.ts`, `parse-progress.ts` with unit specs first (58-02-T1/T2)
- [x] `tests/evals/sop-focus.eval.ts` skeleton (58-02-T3)
- [x] `scripts/eval-fixtures.mjs` — focus-step, lineage, findings, blank, parse-job fixtures (58-03-T3, after the live migration because ticks/findings need 00071)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Placement / sizing / token rendering on the real org's SOPs | FOC-01, FOC-02 | CSS-token and geometry bugs are invisible to assertions (CLAUDE.md 2026-07-14, 2026-10-05) | Claude reads every `58-*` screenshot from `npm run eval -- --phase 58` (58-18-T1) before declaring a pass; escalate to Simon only with a specific failing screenshot |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-05 (deployed eval 60/60 at `9a43d0bf` with every `58-*` screenshot read, `npm run build` green, full suite once: 1928 passed; the only reds were the live-probe `verifyOtp` rate limit, re-run once after the window reset: `phase46` 30/30, and one stale `__new__` guard repointed)
