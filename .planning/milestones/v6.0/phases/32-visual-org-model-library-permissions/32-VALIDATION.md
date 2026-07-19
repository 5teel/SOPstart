---
phase: 32
slug: visual-org-model-library-permissions
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-18
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 32-RESEARCH.md § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (existing project-wide convention) |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `npx playwright test --project=phase32-stubs` (new project; DELIBERATELY BROAD testMatch: `/tests\/phase32\/.*\.(spec|test)\.ts$/` per phase26/28/29/30 precedent) |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~60 seconds (stubs project) |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --project=phase32-stubs`
- **After every plan wave:** Run `npm run test` + `npx tsc --noEmit` + `npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

Phase 32 has no formal REQ-IDs (ROADMAP marks them "TBD"); mapped to the 6 roadmap success criteria (SC-1..SC-6) plus project-learning-mandated guards. Task IDs filled in by planner.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | SC-1 org chart + Columns toggle + vacancy chips | — | N/A | runtime | `npx playwright test tests/phase32/org-chart-build.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-2 5-level grants, union-up-chain resolver | — | N/A | unit (tsx-subprocess harness) | `npx playwright test tests/phase32/resolve-access.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-3 wiring survives 15×20 scale | — | N/A | runtime, seeded fixture | `npx playwright test tests/phase32/wiring-at-scale.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-4 viz-as-filter deep-link | — | N/A | runtime | `npx playwright test tests/phase32/library-filter-deeplink.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-5 wire-up mode + blast radius | — | N/A | runtime | `npx playwright test tests/phase32/wire-up-mode.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-6 banner slot never reflows graph | — | N/A | runtime, pixel-position assertion | `npx playwright test tests/phase32/banner-slot-stability.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | Junction-write org isolation (all new tables) | cross-tenant write | Cross-tenant write blocked; admin-client writes self-enforce org | runtime, real insert (NOT test.fixme, per [2026-06-15]) | `npx playwright test tests/phase32/grants-org-isolation.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-03 day-one equivalence | worker visibility regression | Post-migration sop_departments identical to pre-migration | migration assertion script | `npx tsx scripts/assert-phase32-day-one-equivalence.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-13 person-grant RLS arm | privilege escalation | New SECURITY DEFINER helper self-scopes via auth.uid(); shipped policies untouched | runtime + migration assertion | `npx playwright test tests/phase32/person-grant-rls.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/phase32/` spec stubs for SC-1..SC-6 + org-isolation + person-grant-rls
- [ ] `playwright.config.ts` — register `phase32-stubs` project with broad testMatch, verify with `npx playwright test --list --project=phase32-stubs` (per [2026-05-25] unregistered-spec learning)
- [ ] `scripts/assert-phase32-day-one-equivalence.ts` — pre/post migration snapshot compare; must use `to_regclass()` or retry on PGRST205 (per [2026-06-15] schema-cache learning)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Chart looks right (nodes visible, tokens applied, no invisible controls) | SC-1/SC-3 | CSS token bugs are invisible to every automated gate ([2026-07-14] learning) | Load /admin/team and /admin/sops?view=access on sopstart.com post-deploy; visually confirm every control is visible in dark theme |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
