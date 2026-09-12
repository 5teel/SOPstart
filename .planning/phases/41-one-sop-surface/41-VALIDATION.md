---
phase: 41
slug: one-sop-surface
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-13
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

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 41-01-01 | 01 | 0 | SUR-05 | — | N/A | build-script | `npm run build` (postbuild bundle gate, `/sops/page` baseline captured pre-surface-work) | ❌ W0 (route-array refactor) | ⬜ pending |
| 41-01-02 | 01 | 0 | SUR-01..06 | — | N/A | registration | `npx playwright test --list --project=phase41` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SUR-01 | T-41-01 | admin lens never renders for worker role | source-contract + role-probe | `npx playwright test --project=phase41 -g "SUR-01"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SUR-02 | — | deep links resolve on `/sops` | live probe | `npx playwright test --project=phase41 -g "deep-link"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SUR-03 | — | N/A | source-contract | `npx playwright test --project=phase41 -g "SUR-03"` (extends `tests/phase30/admin-nav.spec.ts`) | Partial | ⬜ pending |
| TBD | TBD | TBD | SUR-04 | — | N/A | reference sweep | `npx playwright test --project=phase41 -g "SUR-04"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SUR-05 | — | admin lens modules absent from worker chunks | build-script | `npm run build` | Partial | ⬜ pending |
| TBD | TBD | TBD | SUR-06 | — | N/A | source-contract grep | `npx playwright test --project=phase41 -g "SUR-06"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*The planner fills real Task IDs; rows above are the requirement contract from RESEARCH.md § Validation Architecture.*

---

## Wave 0 Requirements

- [ ] `playwright.config.ts` — register `phase41` project (`testMatch: /tests\/phase41\/.*\.(spec|test)\.ts$/`)
- [ ] `scripts/capture-bundle-baseline.ts` + `scripts/check-bundle-size.ts` — route-array refactor; capture `/sops/page` baseline BEFORE any surface edit; commit `.bundle-baseline.json`
- [ ] `tests/phase41/` — stubs for SUR-01..06, redirect-shim probe, `/admin/sops` reference-sweep (inventory in RESEARCH.md: `ai-fields.ts`, `ParseJobStatus.tsx`, `role-home.ts`, `journeys.ts` ×6, `roles.ts` ×2, `uat/tests.ts` ×15)
- [ ] `tests/phase30/admin-nav.spec.ts` — repoint assertion in the same commit that removes "Manage SOPs" (source-contract guards go stale-red when what they grep moves — CLAUDE.md 2026-07-13)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Miller frame renders correctly with admin scopes present (no mis-sized panes, no undefined tokens) | SUR-02 | CSS/sizing invisible to every automated gate | On sopstart.com as admin, open SOPs. Do you see the extra scopes (Needs attention / Drafts / Access) in the left column? Is every column the same height? Yes/no. |
| Worker sees no admin scopes | SUR-01 | role-visual | Log in as a worker, open SOPs. Are the admin scopes absent? Yes/no. |
| `/pathways` shows 0 not-mapped screens | — | page reads live route tree | Open /pathways → "All screens". Is the not-mapped count 0? Yes/no. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
