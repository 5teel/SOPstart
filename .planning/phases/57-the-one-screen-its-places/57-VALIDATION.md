---
phase: 57
slug: the-one-screen-its-places
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-10-04
---

# Phase 57 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.58 (source-contract / unit specs + deployed evals) |
| **Config file** | `playwright.config.ts` — 57-01 registers the `phase57` project (`testMatch: /tests\/phase57\/.*\.(spec|test)\.ts$/`) |
| **Quick run command** | `npx playwright test --project=phase57` + `npx tsc --noEmit` |
| **Full suite command** | `npm run test` (run ONCE per gate — live probes share one OTP budget, CLAUDE.md 2026-09-28) |
| **Deployed eval** | `npm run eval -- --phase 57` (needs `EVAL_BASE_URL`; self-skips otherwise) |
| **Build gate** | `npm run build` (postbuild bundle check: `/sops/[sopId]/page`, `/page`; `/sops/page` until 57-08) |
| **Estimated runtime** | phase57 project ~30 s; full suite several minutes |

---

## Sampling Rate

- **After every task commit:** `npx playwright test --project=phase57` + `npx tsc --noEmit` (each task's `<automated>` adds the projects it can break)
- **After every plan:** phase57 + every project its repoint-inventory rows belong to (phase23-stubs, 25-integration, 28, 30, 32, 33, 36, 37, 41, 43, 46, 51, 52, 53, 54, 55, `phase11-stubs`, `phase15-stubs` as listed per plan) + `npm run build` (CLAUDE.md 2026-10-04: per-plan self-checks missed cross-project breakage)
- **Before `/gsd-verify-work`:** ONE full-suite run, non-live failures compared to the recorded baseline; deployed eval after push, screenshots READ (57-09)
- **Max feedback latency:** ~60 seconds (phase57 project)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 57-01-T1 | 01 | 1 | all (guard) | T-57-03 | inventory completeness: no unlisted reference to a retired file | source-contract | `npx playwright test --project=phase57 tests/phase57/repoint-inventory.spec.ts` | created in task | ⬜ pending |
| 57-01-T2 | 01 | 1 | SHL-01..PLC-05 (eval) | T-57-02 | supervisor fixture refuses non-fixture accounts | eval list | `npx playwright test --list --project=evals tests/evals/one-screen.eval.ts` | created in task | ⬜ pending |
| 57-01-T3 | 01 | 1 | PLC-01, SHL-02, SHL-04 | T-57-01 | `?place=` whitelist / UUID; bad token → overview; no room table/UI | unit | `npx playwright test --project=phase57 tests/phase57/rooms.spec.ts tests/phase57/place.spec.ts tests/phase57/search.spec.ts` | created in task (tdd) | ⬜ pending |
| 57-02-T1 | 02 | 2 | PLC-01, SHL-02 | — | rooms above machines, signposts capped 2.4, flyInset, focus replay | source-contract | `npx playwright test --project=phase57 tests/phase57/stage.spec.ts` + `--project=phase52` | W0 stub | ⬜ pending |
| 57-02-T2 | 02 | 2 | SHL-01, SHL-02, SHL-04 | T-57-04..07 | replaceState only in select(); no router; place resolves only to loaded rows | source-contract + unit | `npx playwright test --project=phase57` + `npm run build` | W0 stub | ⬜ pending |
| 57-03-T1 | 03 | 2 | SHL-05, PLC-04 | T-57-08..10 | one `loadInbox()`; `getAdminShell()` admin-gated, no params, session org, no service role | source-contract | `npx playwright test --project=phase57 tests/phase57/one-query.spec.ts` + phase54/28/30/46 | W0 stub | ⬜ pending |
| 57-03-T2 | 03 | 2 | PLC-05 | T-57-11..13 | remove refused with counts; session-org filters; colour enum | unit + source-contract + live (`PHASE57_LIVE=1`) | `npx playwright test --project=phase57 tests/phase57/departments.spec.ts` | W0 stub | ⬜ pending |
| 57-03-T3 | 03 | 2 | PLC-05 | T-57-13 | strip handlers wired to actions; no literal hex | source-contract | `npx playwright test --project=phase57 tests/phase57/departments.spec.ts` + phase51 | W0 stub | ⬜ pending |
| 57-04-T1 | 04 | 3 | PLC-02, PLC-03 | — | worker bodies import no admin code | source-contract | `npx playwright test --project=phase57 tests/phase57/machine-body.spec.ts` + phase52/55 | W0 stub | ⬜ pending |
| 57-04-T2 | 04 | 3 | SHL-01, SHL-05, PLC-03, PLC-04 | T-57-14..18 | `/` branches on the session server-side; worker reads RLS-scoped | source-contract | `npx playwright test --project=phase57` | W0 stub | ⬜ pending |
| 57-04-T3 | 04 | 3 | SHL-01 | T-57-16 | `/page` gate forbids site editor / konva / pdfjs / mammoth; baseline recorded once | build + source-contract | `npm run build` + `npx playwright test --project=phase57` | W0 stub | ⬜ pending |
| 57-05-T1 | 05 | 4 | PLC-02, PLC-03 | T-57-20 | `?machine=` UUID-checked; setSopMachines re-validates org | unit + source-contract | `npx playwright test --project=phase57 tests/phase57/machine-body.spec.ts tests/phase57/noticeboard.spec.ts` | W0 stub | ⬜ pending |
| 57-05-T2 | 05 | 4 | PLC-04, PLC-05, SHL-05 | T-57-19, T-57-21, T-57-22 | AdminShell only via next/dynamic; one inboxCount for pin + card | source-contract + build | `npx playwright test --project=phase57` + `npm run build` | W0 stub | ⬜ pending |
| 57-05-T3 | 05 | 4 | PLC-04 | — | /governance inbox only; inventory 57-05 live | source-contract | `npx playwright test --project=phase57` + phase54/46/28/30 | ✅ | ⬜ pending |
| 57-06-T1 | 06 | 5 | SHL-01 | — | no header element anywhere in layout/page/shell | source-contract | `npx playwright test --project=phase57 tests/phase57/shell-structure.spec.ts` | W0 stub | ⬜ pending |
| 57-06-T2 | 06 | 5 | SHL-01 | T-57-24..26 | roleHome → `/`; `/dashboard` fixed redirect; no client redirect | unit + source-contract | `npx playwright test --project=phase57 tests/phase57/retirement-sweep.spec.ts` + phase43/53 | W0 stub | ⬜ pending |
| 57-06-T3 | 06 | 5 | SHL-01 | T-57-03 | header-nav dropped + swept; inventory 57-06 live | source-contract | phase57/55/30/41/51/43/53/11-stubs + `npm run build` | ✅ | ⬜ pending |
| 57-07-T1 | 07 | 6 | PLC-05 | T-57-28, T-57-29 | `/admin/access` server-gated, `?sop=` UUID-checked | source-contract | `npx playwright test --project=phase57` + phase32 | W0 stub | ⬜ pending |
| 57-07-T2 | 07 | 6 | PLC-05 | T-57-30, T-57-31 | redirects fixed; member departments untouched | source-contract | `npx playwright test --project=phase57 tests/phase57/departments.spec.ts` | W0 stub | ⬜ pending |
| 57-07-T3 | 07 | 6 | PLC-05, SHL-01 | T-57-03 | feature dropped + swept; pathways map `/admin/access` | source-contract | phase57/55/51/25-integration/46 + `npm run build` | ✅ | ⬜ pending |
| 57-08-T1 | 08 | 7 | SHL-01, PLC-03 | T-57-32..36 | `/sops` proxy block fixed destinations + cookie copy; gate swap | build + lint | `npm run build` + `npx playwright test --project=phase57` + no-dead-internal-hrefs | ✅ | ⬜ pending |
| 57-08-T2 | 08 | 7 | SHL-01 | T-57-03 | every guard on a surviving behaviour repointed; inventory 57-08 live | source-contract | phase57 + phase23-stubs/28/30/32/33/36/37/41/52/54/55/15-stubs | ✅ | ⬜ pending |
| 57-08-T3 | 08 | 7 | SHL-01 | T-57-36 | list-page dropped + swept; no quoted list address in src | source-contract | `npx playwright test --project=phase57` + phase55 | W0 stub | ⬜ pending |
| 57-09-T1 | 09 | 8 | all | T-57-37, T-57-38 | evals write only in the eval-site org; real org read-only | eval list | `npx playwright test --list --project=evals` | W0 skeleton | ⬜ pending |
| 57-09-T2 | 09 | 8 | all | — | deployed proof + screenshots read | deployed eval | `npm run eval -- --phase 57` | ✅ | ⬜ pending |
| 57-09-T3 | 09 | 8 | all | — | sign-off | doc check | `node -e` frontmatter check | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Requirement → spec file: SHL-01 `shell-structure.spec.ts`, `retirement-sweep.spec.ts` · SHL-02 `place.spec.ts`, `stage.spec.ts`, `shell-structure.spec.ts` · SHL-04 `search.spec.ts` · SHL-05 `one-query.spec.ts` · PLC-01 `rooms.spec.ts`, `stage.spec.ts` · PLC-02 `machine-body.spec.ts` · PLC-03 `noticeboard.spec.ts` · PLC-04 `pins.spec.ts`, `one-query.spec.ts` · PLC-05 `departments.spec.ts` · Retirement `retirement-sweep.spec.ts` + `tests/phase55/deletion-sweep.spec.ts` (features `header-nav`, `site-and-departments-pages`, `list-page`). All plus `tests/evals/one-screen.eval.ts` on the deployed site.

---

## Wave 0 Requirements (57-01)

- [ ] `playwright.config.ts` — `phase57` project; verify with `npx playwright test --list --project=phase57`
- [ ] `tests/phase57/repoint-inventory.spec.ts` — every stale guard (~45 spec/eval files) listed with disposition + owning plan; completeness live from 57-01; `LIVE_PLANS` flipped by 05/06/07/08/09
- [ ] `tests/phase57/*.spec.ts` stubs per requirement (pure-module specs `place`, `rooms`, `search` rooms half live in 57-01)
- [ ] `tests/evals/one-screen.eval.ts` skeleton + `siteSupervisor` fixture (eval-site org)
- [ ] Bundle gate change is planned in the plans that need it: `/page` entry + baseline recorded once in 57-04 (decision artefact); `/sops/page` entry removed with the page in 57-08; baselines only ever move down by hand
- [ ] Retired-URL assertions in `plant-home`, `governance`, `site-editor`, `sop-surface`, `dead-surface`, `cut-features` evals rewritten or folded in 57-09

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Room hit-areas sit over sensible spots on the real org's 2752×1536 scene and the eval org's 1600×900 scene; signposts legible at overview and zoomed | PLC-01 | geometry is invisible to assertions (CLAUDE.md 2026-07-14) | Claude reads `57-worker-overview`, `57-worker-zoomed`, `57-admin-edit`, `57-real-org-overview` screenshots from the deployed eval (57-09 T2) and tunes `src/lib/site/rooms.ts` if needed |

## Descoped by the owner (not a gap)

- PLC-01 / SC5 "an admin can position / drag each room's shape in the site editor" — descoped by Simon (D-01, 2026-10-04); rooms are fixed hit-areas in `src/lib/site/rooms.ts`. Listed under Deferred Ideas in 57-CONTEXT.md.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution (57-09 T3 signs off)
