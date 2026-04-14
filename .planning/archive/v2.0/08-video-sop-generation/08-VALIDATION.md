---
phase: 8
slug: video-sop-generation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-04
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (integration + E2E) |
| **Config file** | playwright.config.ts |
| **Quick run command** | `npx playwright test --project=integration` |
| **Full suite command** | `npx playwright test` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --project=integration`
- **After every plan wave:** Run `npx playwright test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | VGEN-01 | integration | `npx playwright test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | VGEN-02 | integration | `npx playwright test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | VGEN-04 | integration | `npx playwright test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | VGEN-05 | integration | `npx playwright test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | VGEN-06 | integration | `npx playwright test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | VGEN-07 | integration | `npx playwright test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | VGEN-08 | integration | `npx playwright test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | VGEN-09 | integration | `npx playwright test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | INFRA-03 | integration | `npx playwright test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Note: VGEN-03 (full AI video) is deferred per D-01 — no test stub needed.*

---

## Wave 0 Requirements

- [ ] Playwright test stubs for all VGEN-* and INFRA-03 requirements (excluding deferred VGEN-03)
- [ ] Test fixtures for video generation scenarios

*Existing Playwright infrastructure from prior phases covers framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| TTS audio quality and pronunciation | VGEN-01 | Requires live OpenAI API call and audio playback | Generate video for a test SOP, listen to narration quality |
| Shotstack render output quality | VGEN-01 | Requires live Shotstack API and visual inspection | Generate video, verify slide transitions, audio sync |
| Video player chapter navigation on mobile | VGEN-08 | Requires physical device testing | Open Video tab on phone, tap chapters, verify jumps |
| Video outdated warning after SOP edit | VGEN-05 | Requires sequential actions (generate → edit SOP → check) | Generate video, edit SOP text, verify amber warning appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
