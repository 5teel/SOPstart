---
phase: 22
slug: voice-driven-walkthrough
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-23
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `22-RESEARCH.md` § Validation Architecture. Planner fills the Per-Task Verification Map from the generated PLAN.md files.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (integration + E2E) + project lint-guard specs (`tests/lint/*.spec.ts`) |
| **Config file** | `playwright.config.ts` (new specs MUST be registered in a project `testMatch` regex — CLAUDE.md 2026-05-25 learning) |
| **Quick run command** | `npm run test:integration` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~variable (project builds with `next build && next start` for stable headless nav on Windows — CLAUDE.md 2026-05-08) |

---

## Sampling Rate

- **After every task commit:** Run the relevant `npm run test:integration` project (or the source-contract/lint spec for that task)
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green + a real authenticated browser load of the worker walkthrough (voice paths cannot be proven by source-contract tests alone — CLAUDE.md source-contract blind-spot learnings 2026-06-05/06-08)
- **Max feedback latency:** keep per-task feedback under a minute where the test is a source-contract/lint assertion

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _Planner fills from PLAN.md tasks_ | — | — | VDW-LIT-01/02/03, VDW-VOICE-01/02/03 | _per <threat_model>_ | _expected secure behavior_ | source-contract / e2e | `_command_` | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> NOTE (CLAUDE.md learnings): for any interactive voice/visual affordance, the source-contract test MUST assert the HANDLER is wired (e.g. the push-to-talk `onClick` dispatches into the walkthrough store / `onVoiceNext`), not merely that a string appears — a dead feature can pass a grep-only test (2026-06-05). The mic→TTS→step-advance loop needs at least one real authenticated browser run before "done" (2026-06-08).

---

## Wave 0 Requirements

- [ ] New Playwright specs for the voice loop + visual layer registered in a `playwright.config.ts` project regex (e.g. a `phase22-stubs` project) — unregistered specs never run (2026-05-25)
- [ ] Lint-guard spec(s) if a no-regression invariant is needed (e.g. voice "next" must route through the walkthrough store, never `router.push`)

*If existing infrastructure covers all phase requirements, the planner notes that here.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| iOS Safari installed-PWA mic capture + TTS playback (autoplay unlock, audio rerouting on getUserMedia) | VDW-VOICE-01/02 | RESEARCH flagged LOW confidence — needs a real iOS device; headless Chromium cannot prove iOS audio constraints | On sopstart.com (Railway-only testing per project rule): install PWA on iPhone, open a SOP walkthrough, push-to-talk a step, confirm transcription + spoken read-back + "next" advances |
| ≥90% transcription accuracy on factory-floor / NZ-accented SOP vocabulary | VDW-VOICE-01 | Requires real ambient-noise audio; baseline is 75-85% (CLAUDE.md) — keyterm prompting must close the gap | Field test with representative SOP terms (e.g. "blank side hanger", "swab") in a noisy environment |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (specs registered in playwright.config.ts)
- [ ] No watch-mode flags
- [ ] Feedback latency acceptable
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
