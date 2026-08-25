---
phase: 46
slug: 46-capability-matrix
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-25
---

# Phase 46 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (`@playwright/test`) — Wave-0 stub + live-Supabase-integration pattern |
| **Config file** | `playwright.config.ts` (register `phase46` project — Wave 0) |
| **Quick run command** | `npx playwright test --project=phase46 --grep-invert "live"` (source-contract only) |
| **Full suite command** | `npx playwright test --project=phase46` (with `.env.local` populated — activates live-ephemeral-org probes) |
| **Estimated runtime** | ~30 seconds (source-contract) / ~2 min (with live probes) |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --project=phase46 --grep-invert "live"`
- **After every plan wave:** Run `npx playwright test --project=phase46` (full, live probes included)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD (planner fills) | — | 0 | CAP-01 | — | Matrix doc exists, covers every role × capability, CLAUDE.md references it | source-contract | `npx playwright test tests/phase46/capability-matrix-doc.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | CAP-02 | owner-edit | Non-admin owner CAN edit their SOP's sections | live probe (ephemeral org) | `npx playwright test tests/phase46/sop-edit-owner-access.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | CAP-02 | cross-user-edit | Non-owner non-admin worker CANNOT edit a SOP they don't own | live negative probe, same spec | same file | ❌ W0 | ⬜ pending |
| TBD | — | — | CAP-02 | regression | Admin/safety_manager retains universal edit | live probe, same spec | same file | ❌ W0 | ⬜ pending |
| TBD | — | — | CAP-02 | guard-wiring | `requireSopEditAccess` exists AND is called at every enumerated write path | source-contract | `npx playwright test tests/phase46/sop-edit-guard-wiring.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/phase46/capability-matrix-doc.spec.ts` — stubs for CAP-01
- [ ] `tests/phase46/sop-edit-owner-access.spec.ts` — stubs for CAP-02 probes (mirror `tests/phase34/observation-read-role-scope.spec.ts` fixture pattern: `createEphemeralOrg`/`createEphemeralMember`/`mintAccessToken`/`asUserClient`)
- [ ] `tests/phase46/sop-edit-guard-wiring.spec.ts` — stubs for CAP-02 call-site coverage ("guard exists AND is called", per 2026-06-05 learning)
- [ ] Register `phase46` Playwright project in `playwright.config.ts` (broad testMatch on `tests/phase46/**`, per phase28..40 convention; validate with `npx playwright test --list --project=phase46` per the 2026-05-25 learning)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Matrix content accuracy vs the running app | CAP-01 | The matrix's claims about UI-visible capabilities can only be eyeballed against sopstart.com | Open sopstart.com as each role; spot-check 3 cells per role against the document |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
