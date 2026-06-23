---
phase: 22
slug: voice-driven-walkthrough
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-23
planned: 2026-06-24
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `22-RESEARCH.md` § Validation Architecture. Per-Task map filled from the generated PLAN.md files.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (integration + E2E) + project lint-guard / source-contract specs (`tests/phase22/*.spec.ts`, `tests/lint/*.spec.ts`) |
| **Config file** | `playwright.config.ts` — new `phase22-stubs` project registered in Plan 22-01 (CLAUDE.md 2026-05-25: unregistered specs never run) |
| **Quick run command** | `npx playwright test --project=phase22-stubs` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | source-contract specs are filesystem reads (sub-second); full suite builds with `next build && next start` for stable headless nav on Windows (CLAUDE.md 2026-05-08) |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --project=phase22-stubs` + the task's `npx tsc --noEmit`.
- **After every plan wave:** Run `npm run test`.
- **Before `/gsd-verify-work`:** Full suite green + the Plan 22-03 Task 3 human UAT on a real authenticated sopstart.com session (voice paths cannot be proven by source-contract tests alone — CLAUDE.md 2026-06-05 / 2026-06-08).
- **Max feedback latency:** under a minute per task (source-contract/unit assertions).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-T1 Register phase22-stubs project | 22-01 | 0 | (harness for all) | T-22-01-01 | Specs are discoverable so they actually run | config | `npx playwright test --list --project=phase22-stubs` | No → Wave 0 | ⬜ pending |
| 01-T2 Create 6 stub specs | 22-01 | 0 | all 6 VDW IDs | T-22-01-02 | Source-contract specs assert handler WIRING + D-02 bypass guard | source-contract/unit | `npx playwright test --project=phase22-stubs --list` | No → Wave 0 | ⬜ pending |
| 02-T1 Intent classifier + keyterms + STT | 22-02 | 1 | VDW-VOICE-01, VDW-VOICE-03 | — | Pure classifier; keyterm injection bounded ≤100 | unit + source-contract | `npx playwright test --project=phase22-stubs tests/phase22/intent-classifier.spec.ts tests/phase22/stt-keyterms.spec.ts` | No → Wave 1 | ⬜ pending |
| 02-T2 TTS route + hook + constant + validator | 22-02 | 1 | VDW-VOICE-02, VDW-LIT-03 | T-22-02-01/02/04/05 | Auth-gated, 500-char cap, per-user 429, non-admin client, TTS_MODEL constant | source-contract | `npx playwright test --project=phase22-stubs tests/phase22/tts-route.spec.ts` | No → Wave 1 | ⬜ pending |
| 04-T1 Visual layer in ImmersiveStepCard | 22-04 | 1 | VDW-LIT-01, VDW-LIT-02 | T-22-04-02 | Photo-or-icon always present; ListChecks fallback (no dead static icon) | source-contract | `npx playwright test --project=phase22-stubs tests/phase22/visual-layer.spec.ts` | No → Wave 1 | ⬜ pending |
| 03-T1 MobileWalkthrough handle + switcher ref | 22-03 | 2 | VDW-VOICE-03 | T-22-03-01/02 | onVoiceNext → handleMarkComplete only; no store write in modal | source-contract | `npx playwright test --project=phase22-stubs tests/phase22/voice-safety-gate.spec.ts` | No → Wave 2 | ⬜ pending |
| 03-T2 Modal STT + intent + TTS read-back | 22-03 | 2 | VDW-VOICE-01/02, VDW-LIT-03 | T-22-03-03/05 | Real Deepgram stream; classifyIntent 'next' branch calls onVoiceNext; fail-silent TTS | source-contract | `npx playwright test --project=phase22-stubs tests/phase22/voice-modal.spec.ts tests/phase22/voice-safety-gate.spec.ts` | No → Wave 2 | ⬜ pending |
| 03-T3 Human UAT (sopstart.com) | 22-03 | 2 | VDW-VOICE-01/02/03, VDW-LIT-01/02/03, D-02, D-04 | T-22-03-03 | Runtime voice loop advances + reads aloud + respects safety gate | manual e2e | (human-check on sopstart.com — see plan Task 3) | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> NOTE (CLAUDE.md learnings): every interactive voice/visual affordance's source-contract spec asserts the HANDLER is wired (the 'next'/'done' branch invokes `onVoiceNext`; the visual layer derives the icon from section type with a `?? ListChecks` fallback; the modal must NOT contain `markStepComplete` — the D-02 bypass guard), not merely that a string appears (2026-06-05). The mic→TTS→step-advance loop needs at least one real authenticated browser run before "done" (2026-06-08, Plan 22-03 Task 3). Bundle isolation regression guard: `npx playwright test --project=phase15-stubs no-static-desktop-import` must stay green through Plan 22-03 (SB-LINE-06).

---

## Wave 0 Requirements

- [x] New Playwright specs for the voice loop + visual layer registered in a `phase22-stubs` project regex — Plan 22-01 Task 1 (unregistered specs never run, 2026-05-25)
- [x] Source-contract guard that voice "next" routes through the walkthrough store via handleMarkComplete (never the store directly, never `router.push`) — `tests/phase22/voice-safety-gate.spec.ts`, Plan 22-01 Task 2

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| iOS Safari installed-PWA mic capture + TTS playback (autoplay unlock, audio rerouting on getUserMedia) | VDW-VOICE-01/02 | RESEARCH flagged LOW confidence — needs a real iOS device; headless Chromium cannot prove iOS audio constraints | On sopstart.com (Railway-only testing): install PWA on iPhone, open a SOP walkthrough, push-to-talk a step, confirm transcription + spoken read-back + "next" advances (Plan 22-03 Task 3) |
| ≥90% transcription accuracy on factory-floor / NZ-accented SOP vocabulary | VDW-VOICE-01 | Requires real ambient-noise audio; baseline 75-85% (CLAUDE.md) — keyterm prompting must close the gap | Field test with representative SOP terms (e.g. "blank side hanger", "swab", "lehr") in a noisy environment |

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies (Task 03-T3 is the mandatory manual e2e gate)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (6 specs registered in playwright.config.ts via phase22-stubs)
- [x] No watch-mode flags
- [x] Feedback latency acceptable (source-contract/unit sub-minute)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned 2026-06-24 — ready for `/gsd-execute-phase 22`
