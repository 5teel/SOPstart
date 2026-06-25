---
phase: 23
slug: ai-field-layer-version-supersede
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-25
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (project-based: phase23-stubs, phase23-unit, phase15-unit) |
| **Config file** | `playwright.config.ts` (Wave 0 must register `phase23-stubs` + `phase23-unit` projects) |
| **Quick run command** | `npx playwright test --project=phase23-unit` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~60–120 seconds (unit subset ~15s) |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --project=phase23-unit`
- **After every plan wave:** Run `npm run test` + `npx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

> Filled per-plan during planning. Each AFL-* requirement maps to at least one automated assertion.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 23-00-01 | 00 | 0 | infra | — | phase23 projects registered in playwright.config | source-contract | `npx playwright test --list --project=phase23-unit` | ❌ W0 | ⬜ pending |
| 23-xx-xx | xx | 1 | AFL-AI-03 | — | field registry exposes unified read/write descriptors | unit | `npx playwright test --project=phase23-unit -g registry` | ❌ W0 | ⬜ pending |
| 23-xx-xx | xx | 1 | AFL-AI-01 | — | read API returns current value for a registered field | unit | `npx playwright test --project=phase23-unit -g read` | ❌ W0 | ⬜ pending |
| 23-xx-xx | xx | 2 | AFL-AI-02 | T-23 tiered-gate | high-stakes write goes to inline approval, not auto-apply | unit | `npx playwright test --project=phase23-unit -g write-gate` | ❌ W0 | ⬜ pending |
| 23-xx-xx | xx | 2 | AFL-VER-01 | — | cloneSopAsDraft copies sections+steps, publish supersedes | unit | `npx playwright test --project=phase23-unit -g clone` | ❌ W0 | ⬜ pending |
| 23-xx-xx | xx | 2 | AFL-VER-02 | — | side-by-side diff renders via diff-block-content | unit | `npx playwright test --project=phase23-unit -g diff` | ❌ W0 | ⬜ pending |
| 23-xx-xx | xx | 2 | AFL-VER-03 | — | restore creates NEW version, history append-only | unit | `npx playwright test --project=phase23-unit -g restore` | ❌ W0 | ⬜ pending |
| 23-xx-xx | xx | 3 | AFL-VER-04 | — | badge shows when published_at > last completion | unit | `npx playwright test --project=phase23-unit -g update-badge` | ❌ W0 | ⬜ pending |
| 23-xx-xx | xx | 3 | AFL-VER-05 | T-23 spoof | sign-off binds roster_worker_id, org-validated before write | unit | `npx playwright test --project=phase23-unit -g signoff` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `playwright.config.ts` — register `phase23-stubs` (source-contract specs under `tests/phase23/`) and `phase23-unit` (behavioral specs under `src/lib/ai-fields/__tests__/` and `src/lib/builder/__tests__/`)
- [ ] `tests/phase23/*.spec.ts` — source-contract stubs for AFL-AI-01/02/03, AFL-VER-01..05 (gate ordering, exports, RLS/service-role usage)
- [ ] Behavioral unit specs use STATIC `@/` imports under a testDir-scoped project (never dynamic `import('@/...')` outside testDir — CLAUDE.md 2026-06-24 learning)

*Critical: D-11 auth/RLS reconciliation and junction/signature writes MUST have at least one runtime test that performs the insert as an authenticated principal (CLAUDE.md 2026-06-15 learning — source-contract-only shipped a broken write before).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Roster name-select login on a shared/kiosk device establishes an org-scoped session | AFL-VER-05 / D-11 | Requires real Supabase session + device; RLS isolation observable only end-to-end | On sopstart.com: open kiosk device, pick a worker name, confirm org SOPs visible and other-org SOPs not; complete an SOP and confirm signature logged against the selected roster identity |
| Inline AI proposal Accept/Reject diff at a published-SOP field | AFL-AI-02 / D-03 | Visual diff + apply path; needs live data | Trigger a proposal on a published SOP field, confirm inline diff with Accept/Reject, Accept applies + supersedes correctly, Reject discards |
| "Updated since last completion" badge on SOP card + walkthrough entry | AFL-VER-04 | Cross-session timing (worker completed v1, admin publishes v2) | Complete an SOP as a worker, publish a new version as admin, confirm badge appears on the worker's card + walkthrough entry |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
