---
phase: 41
slug: one-sop-surface
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-13
updated: 2026-09-13
plans: 9
waves: 7
---

# Phase 41 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (source-contract specs + live probes) |
| **Config file** | `playwright.config.ts` — project-per-phase regex; an unregistered spec never runs (CLAUDE.md 2026-05-25) |
| **Quick run command** | `npx playwright test --project=phase41` |
| **Full suite command** | `npm run build && npm run test` (bundle gate runs in `postbuild`) |
| **Estimated runtime** | ~60 s quick · ~10 min full |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --project=phase41`
- **After every plan wave:** Run `npm run build && npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green AND `npm run build` green (SUR-05 is a build-artifact assertion)
- **Max feedback latency:** 60 seconds

**Known red window:** between plan 41-06 and plan 41-08 the nine legacy source-contract specs listed in 41-08 are RED by design (they read `admin/sops/page.tsx`, which 41-06 empties into a shim). 41-06's summary names each one. Any OTHER red spec in that window is a real break.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 41-01-01 | 01 | 0 | SUR-05 | T-41-05-01, T-41-05-02 | a dead forbidden marker fails the build instead of passing vacuously | build-script | `npm run build` | ❌ W0 (route-array refactor) | ⬜ pending |
| 41-01-02 | 01 | 0 | SUR-01..06 | T-41-05-03 | N/A | registration + stubs | `npx playwright test --list --project=phase41 && npx playwright test --project=phase41` | ❌ W0 | ⬜ pending |
| 41-01-03 | 01 | 0 | SUR-05 | T-41-02 | worker page cannot statically import an admin lens | lint spec | `npx playwright test --project=phase15-stubs` | ❌ W0 | ⬜ pending |
| 41-02-01 | 02 | 1 | SUR-02 | — | pure helpers stay out of `'use server'` modules | typecheck + build | `npx tsc --noEmit && npx playwright test --project=phase30` | ❌ W0 | ⬜ pending |
| 41-02-02 | 02 | 1 | SUR-01, SUR-02 | T-41-01, T-41-01b, T-41-05 | `requireAdminContext()` before the first read; session RLS client only | source-contract + build | `npx tsc --noEmit && npm run build` | ❌ W0 | ⬜ pending |
| 41-02-03 | 02 | 1 | SUR-01, SUR-02 | T-41-01 | guard ordering pinned positionally, mutation-proven | source-contract | `npx playwright test --project=phase41 -g "listAdminSopRows"` | ❌ W0 | ⬜ pending |
| 41-03-01 | 03 | 1 | SUR-02 | T-41-01, T-41-01c, T-41-01d | guard before `ensureSopCollections`; no service-role client | source-contract + build | `npx tsc --noEmit && npm run build` | ❌ W0 | ⬜ pending |
| 41-03-02 | 03 | 1 | SUR-02, SUR-05 | T-41-02 | lens reached only via the dynamic boundary; exit is a callback | lint + typecheck | `npx tsc --noEmit && npx playwright test --project=phase15-stubs` | ❌ W0 | ⬜ pending |
| 41-03-03 | 03 | 1 | SUR-02 | T-41-01c, T-41-05 | ensure-before-collections-read ordering, mutation-proven | source-contract | `npx playwright test --project=phase41 -g "access"` | ❌ W0 | ⬜ pending |
| 41-04-01 | 04 | 2 | SUR-02, SUR-04, SUR-05 | T-41-02 | no new list→builder chain; no navigation for a filter | lint + typecheck | `npx tsc --noEmit && npx playwright test --project=phase15-stubs` | ❌ W0 | ⬜ pending |
| 41-04-02 | 04 | 2 | SUR-02 | T-41-06 | `GovernanceQueueRow` byte-identical; approval gating intact | source-contract | `npx tsc --noEmit && npx playwright test --project=phase15-stubs --project=phase28 --project=phase29` | ❌ W0 | ⬜ pending |
| 41-04-03 | 04 | 2 | SUR-02, SUR-04 | T-41-06 | APR-03/04 double-guarded across the 41-08 repoint | source-contract | `npx playwright test --project=phase41 -g "lens"` | ❌ W0 | ⬜ pending |
| 41-05-01 | 05 | 3 | SUR-01, SUR-02, SUR-05 | T-41-02, T-41-04, T-41-05, T-41-08 | admin params inert for non-admins; inert under the access lens; `replaceState` not `router.push` | source-contract + build | `npx tsc --noEmit && npm run build && npx playwright test --project=phase15-stubs` | ❌ W0 | ⬜ pending |
| 41-05-02 | 05 | 3 | SUR-01, SUR-02, SUR-06 | T-41-07 | worker logic byte-identical; admin branch precedes the worker empty state | source-contract + build | `npx tsc --noEmit && npm run build && npx playwright test --project=phase15-stubs --project=phase30` | ❌ W0 | ⬜ pending |
| 41-05-03 | 05 | 3 | SUR-01, SUR-02, SUR-06 | T-41-04 | capability matrix records route-is-not-the-boundary | source-contract + build | `npx playwright test --project=phase41 -g "SUR-01"` / `-g "SUR-02"` / `-g "SUR-06"` / `-g "deep-link"` && `npm run build` | ❌ W0 | ⬜ pending |
| 41-06-01 | 06 | 4 | SUR-01, SUR-03 | T-41-03, T-41-03b, T-41-10 | guard in front of the redirect; fixed `/sops` path, `URLSearchParams` query | source-contract + build | `npx tsc --noEmit && npm run build && npx playwright test --project=phase15-stubs --project=phase30 -g "journeys"` | ❌ W0 | ⬜ pending |
| 41-06-02 | 06 | 4 | SUR-03, SUR-06 | — | one SOPs entry; `Manage SOPs` cannot come back | source-contract + build | `npx tsc --noEmit && npm run build` | ❌ W0 | ⬜ pending |
| 41-06-03 | 06 | 4 | SUR-03, SUR-04 | T-41-09 | the two Phase 30 guards repointed in the same commit | source-contract | `npx playwright test --project=phase41 --project=phase30` | Partial (extends `tests/phase30/admin-nav.spec.ts`) | ⬜ pending |
| 41-07-01 | 07 | 5 | SUR-03, SUR-04 | T-41-10, T-41-11 | no in-app traffic through the shim; sub-routes intact | grep sweep + build | `npx tsc --noEmit && npm run build` | ❌ W0 | ⬜ pending |
| 41-07-02 | 07 | 5 | SUR-06 | T-41-12 | roles map still states the lenses are admin-only | source-contract + build | `npx tsc --noEmit && npm run build` | ❌ W0 | ⬜ pending |
| 41-07-03 | 07 | 5 | SUR-03, SUR-04, SUR-06 | T-41-10 | count-pinned reference sweep, mutation-proven ×3 | reference sweep | `npx playwright test --project=phase41 -g "reference sweep"` | ❌ W0 | ⬜ pending |
| 41-08-01 | 08 | 5 | SUR-01, SUR-02 | T-41-09, T-41-06 | governance / owner / approval contracts live at the new homes | source-contract | `npx playwright test --project=phase28 --project=phase29` | Partial (repoint) | ⬜ pending |
| 41-08-02 | 08 | 5 | SUR-02, SUR-04 | T-41-13 | no-audience rule keeps both clauses; one create entry | source-contract | `npx playwright test --project=phase30` | Partial (repoint) | ⬜ pending |
| 41-08-03 | 08 | 5 | SUR-01, SUR-02 | T-41-09, T-41-13, T-41-14 | CR-02 ordering + single-join read keep their strength; no spec left on the shim | full suite | `npx playwright test` | Partial (repoint) | ⬜ pending |
| 41-09-01 | 09 | 6 | SUR-05 | T-41-15 | baseline NOT re-captured; measured numbers recorded for both routes | build-script + full suite | `npm run build && npx playwright test && npx tsc --noEmit` | Partial | ⬜ pending |
| 41-09-02 | 09 | 6 | SUR-01..06 | T-41-16, T-41-04, T-41-03 | a human looked at the deployed page | human-verify (blocking) | manual click-path on sopstart.com (D-10) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `playwright.config.ts` — register `phase41` project (`testMatch: /tests\/phase41\/.*\.(spec|test)\.ts$/`) — **41-01 Task 2**
- [ ] `scripts/capture-bundle-baseline.ts` + `scripts/check-bundle-size.ts` — route-array refactor with forbidden-marker self-validation; capture `/sops/page` baseline BEFORE any surface edit; commit `.bundle-baseline.json` — **41-01 Task 1**
- [ ] `tests/phase41/` — five stub specs: `bundle-gate` (live), `merged-surface` (→41-05), `nav-and-shim` (→41-06), `reference-sweep` (→41-07), `spec-repoint-inventory` (→41-08) — **41-01 Task 2**
- [ ] `tests/lint/no-static-admin-lens-import.spec.ts` — registered in the `phase15-stubs` regex; contract 2 (worker page has no admin import) live from Wave 0 — **41-01 Task 3**
- [ ] `tests/phase30/admin-nav.spec.ts` + `tests/phase30/governance-fold.spec.ts` — repointed in the SAME commit that removes "Manage SOPs" and empties the page (CLAUDE.md 2026-07-13) — **41-06 Task 3**
- [ ] Nine further legacy specs read `admin/sops/page.tsx` and must be repointed (`phase28` ×2, `phase29`, `phase30/create-entry`, `phase30/list-rows`, `phase32` ×2, `phase33`, `sb-auth-builder`) — **41-08**. RESEARCH named only one; the real count is nine.

---

## Manual-Only Verifications

All manual verification happens on sopstart.com after the Railway deploy, as plain click-paths with yes/no answers (D-10). Never local Playwright. Full script: **41-09 Task 2**.

| Behavior | Requirement | Why Manual | Where |
|----------|-------------|------------|-------|
| Miller frame renders correctly with the Admin scope group present (no mis-sized panes, no stray borders, no invisible controls, no undefined tokens) | SUR-02 | CSS/sizing bugs are invisible to every gate in this repo (CLAUDE.md 2026-07-14) | 41-09 Task 2, questions A2-A4 |
| Each lens opens and the back affordance returns without a page reload | SUR-02 | interaction | 41-09 Task 2, questions B5-B10 |
| Worker behaviour unchanged (own list, refresher dates, badges, search, department filter) | SUR-01 | visual equivalence | 41-09 Task 2, questions C11-C13 |
| One SOPs menu entry; legacy bookmarks resolve; Governance opens the attention lens | SUR-03 | visual + routing | 41-09 Task 2, questions D14-D17 |
| `/pathways` "All screens" shows 0 not-mapped | — | page reads the live route tree | 41-09 Task 2, question E18 |
| A worker session sees no Admin group | SUR-01 | role-visual | 41-09 Task 2, question F19 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or a Wave-0 dependency — the only non-automated task is the blocking human checkpoint 41-09-02, which follows 41-09-01's automated gate
- [x] Sampling continuity: no 3 consecutive tasks without an automated verify
- [x] Wave 0 covers all MISSING references, plus the eight stale legacy specs RESEARCH under-counted
- [x] No watch-mode flags
- [x] Feedback latency < 60s for `--project=phase41`
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned — 9 plans, waves 0-6
