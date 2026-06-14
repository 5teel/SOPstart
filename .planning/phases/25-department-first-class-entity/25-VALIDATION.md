---
phase: 25
slug: department-first-class-entity
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-15
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Highest-risk behaviours (from 25-RESEARCH.md § Validation Architecture):
> cross-tenant `departments` isolation · OR-composed SOP visibility RLS without recursion ·
> non-destructive global-block migration (zero orphans) · ownerless-warning on member removal.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (integration + E2E) + SQL/RLS assertion scripts |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `npm run test:integration` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~120 seconds |

> UAT against a running app uses the magic-link cookie pattern (CLAUDE.md [2026-04-24]):
> `sb-{projectRef}-auth-token` cookie, `next start` not `next dev`, anon key var is
> `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

---

## Sampling Rate

- **After every task commit:** Run `npm run test:integration`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

> Filled per-plan by the planner / gsd-nyquist-auditor. Highest-risk behaviours below MUST have an automated check.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 25-01-xx | 01 | 1 | REQ-1 departments table | T-25-01 cross-tenant | dept created in org A invisible to org B | rls/sql | `npm run test:integration` | ❌ W0 | ⬜ pending |
| 25-0x-xx | — | — | REQ-3 sop_departments RLS | T-25-02 visibility | worker sees Forming SOP, not Cleaning-only; no 42P17 recursion | rls/sql | `npm run test:integration` | ❌ W0 | ⬜ pending |
| 25-0x-xx | — | — | REQ-8 global-block migration | T-25-03 data-loss | zero blocks `organisation_id = null`; zero rows deleted | sql assertion | `npm run test:integration` | ❌ W0 | ⬜ pending |
| 25-0x-xx | — | — | REQ-5 ownerless warning | — | removing owning member surfaces "No owner assigned" | e2e | `npm run test:e2e` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/integration/departments-rls.spec.ts` — cross-tenant isolation + OR-composed SOP visibility (REQ-1, REQ-3, D-02)
- [ ] `tests/integration/global-block-migration.spec.ts` — zero-orphan / zero-delete assertions (REQ-8, D-01)
- [ ] `tests/e2e/department-ownership.spec.ts` — owner-set + ownerless-warning state (REQ-5)

*Existing Playwright infrastructure covers the harness; per-phase specs above are new.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sketch-fidelity of the three admin surfaces (chip colours, owner badge, red ownerless card, dept filter bar) | REQ-6, REQ-7, REQ-9 | Visual fidelity vs `sketches/*` not assertable in code | Open `/admin/departments`, `/admin/blocks`, `/admin/team` authenticated; compare to sketches |

*All data/RLS/route behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
