---
phase: 22-voice-driven-walkthrough
plan: 01
subsystem: test-harness
tags: [playwright, source-contract, tdd, voice, walkthrough, nyquist]
dependency_graph:
  requires: []
  provides:
    - phase22-stubs Playwright project (playwright.config.ts)
    - tests/phase22/intent-classifier.spec.ts (VDW-VOICE-03 unit gate)
    - tests/phase22/tts-route.spec.ts (VDW-LIT-03 gate)
    - tests/phase22/stt-keyterms.spec.ts (VDW-VOICE-01 gate)
    - tests/phase22/visual-layer.spec.ts (VDW-LIT-01/02 gate)
    - tests/phase22/voice-modal.spec.ts (VDW-VOICE-02/03 gate)
    - tests/phase22/voice-safety-gate.spec.ts (D-02 gate)
  affects:
    - Plans 22-02, 22-03, 22-04 (these specs turn green as waves ship)
tech_stack:
  added: []
  patterns:
    - fs.readFileSync source-contract file-walk (analog: tests/lint/no-static-desktop-import.spec.ts)
    - fs.existsSync guard + test.skip for green-when-absent unit specs
    - Handler-wiring assertions (CLAUDE.md 2026-06-05 learning)
    - D-02 negative-gate assertion (isAcknowledged-false → ack-prompt speak branch)
key_files:
  created:
    - playwright.config.ts (phase22-stubs project added)
    - tests/phase22/intent-classifier.spec.ts
    - tests/phase22/tts-route.spec.ts
    - tests/phase22/stt-keyterms.spec.ts
    - tests/phase22/visual-layer.spec.ts
    - tests/phase22/voice-modal.spec.ts
    - tests/phase22/voice-safety-gate.spec.ts
  modified: []
decisions:
  - Phase22 source-contract specs use [\s\S] not /s flag (CLAUDE.md 2026-06-02 TS target compatibility)
  - TTS route spec asserts TTS_MODEL constant / tts-constants import rather than bare hardcoded string (CLAUDE.md 2026-06-02 model-ID-rot learning)
  - intent-classifier spec uses fs.existsSync guard + test.skip (not dynamic import at module-load) to achieve green-when-absent / live-when-present without module-load errors
  - voice-safety-gate encodes both positive bypass guard AND D-02 negative gate as separate named tests for clear CI failure attribution
metrics:
  duration: "~15 minutes"
  completed: "2026-06-24"
  tasks_completed: 2
  files_changed: 7
---

# Phase 22 Plan 01: Phase22 Stub Test Harness (Nyquist Wave-0) Summary

**One-liner:** Playwright `phase22-stubs` project + 6 source-contract/unit stub specs gating all Phase 22 requirements, with handler-wiring assertions and the D-02 safety negative gate, executing cleanly at Wave-0 head (5 skip, 20 red, 5 green).

## What Was Built

The Nyquist Wave-0 test harness for Phase 22 — voice-driven walkthrough. No production code; only the test scaffold that gates Plans 02-04 implementations.

### Task 1: Register phase22-stubs Playwright project (commit `480af5e`)

Added `phase22-stubs` project to `playwright.config.ts` with:
- `testDir: '.'` + `testMatch: /tests\/phase22\/.*\.(spec|test)\.ts$/`
- `use: { browserName: 'chromium' }` (matches `phase15-stubs` / `phase25-e2e` pattern)
- Comment block citing CLAUDE.md 2026-05-25 rationale (unregistered specs never run) and listing all 6 gated spec files with their Plan-of-origin

Verification: `npx playwright test --list --project=phase22-stubs` discovers all 30 tests across 6 files.

### Task 2: Create six phase22 stub specs (commit `2405cb5`)

All 6 spec files created under `tests/phase22/`:

| File | Req(s) | Type | Wave-0 State |
|------|--------|------|--------------|
| `intent-classifier.spec.ts` | VDW-VOICE-03 | Unit (live when Plan 02 ships) | 5 SKIP (module absent) |
| `tts-route.spec.ts` | VDW-LIT-03 | Source-contract | 5 FAIL (file absent) |
| `stt-keyterms.spec.ts` | VDW-VOICE-01 | Source-contract | 1 PASS + 2 FAIL |
| `visual-layer.spec.ts` | VDW-LIT-01/02 | Source-contract | 1 PASS + 3 FAIL |
| `voice-modal.spec.ts` | VDW-VOICE-02/03 | Source-contract | 1 PASS + 4 FAIL |
| `voice-safety-gate.spec.ts` | D-02 | Source-contract | 2 PASS + 6 FAIL |

## Wave-0 Baseline (Expected Red / Skip Targets)

`npx playwright test --project=phase22-stubs` result at Wave-0 head:
- **5 SKIP** — intent-classifier (module `src/lib/voice/intent-classifier.ts` not yet created)
- **20 FAIL** — clean assertion reds (tokens absent from unimplemented files)
- **5 PASS** — pre-existing tokens in already-shipped files:
  1. `deepgram-stream.ts` exists (stt-keyterms)
  2. `ImmersiveStepCard.tsx` exists (visual-layer)
  3. `WalkthroughVoiceModal.tsx` exists (voice-modal, voice-safety-gate)
  4. `MobileWalkthrough.tsx` contains `markStepAcknowledged` AND `markStepComplete` (voice-safety-gate)
  5. `WalkthroughVoiceModal.tsx` does NOT contain `markStepComplete` (D-02 bypass guard passes vacuously)

**All failures are clean assertion reds, not module-load or process errors.** This confirms the spec quality criterion: a spec that throws on execution (module-load crash) is a defect; all 6 specs execute cleanly.

## Go-Green Targets for Waves 1-2

| Plan | Specs It Turns Green |
|------|---------------------|
| 22-02 (Deepgram keyterms + TTS route + classifyIntent + useTtsPlayback) | `stt-keyterms.spec.ts` (fully), `tts-route.spec.ts` (fully), `intent-classifier.spec.ts` (skip → live) |
| 22-03 (WalkthroughVoiceModal live wiring + D-02 gate) | `voice-modal.spec.ts` (fully), `voice-safety-gate.spec.ts` (fully) |
| 22-04 (ImmersiveStepCard visual layer) | `visual-layer.spec.ts` (fully) |

## Key Assertions Encoded

### Handler-wiring assertions (CLAUDE.md 2026-06-05)
Source-contract specs assert FUNCTION CALL SITES (wiring), not mere import presence:
- `voice-modal.spec.ts`: `startVoiceStream(` (real STT call), `classifyIntent(` (intent dispatch call), `speak(` (TTS call) — all call sites, not just imports
- `voice-safety-gate.spec.ts`: Both `markStepAcknowledged` + `markStepComplete` in `handleMarkComplete` body — ownership assertion

### D-02 safety invariants (positive + negative gates)
`voice-safety-gate.spec.ts` encodes two complementary gates:

**(a) Positive routing / bypass guard:**
- Modal has `onVoiceNext` prop (delegates, doesn't self-advance)
- Modal does NOT contain `markStepComplete` directly (bypass prohibited)
- `MobileWalkthrough` uses `useImperativeHandle` (delegate pattern)
- `WalkthroughSwitcher` passes `onVoiceNext` + uses `useRef` for the handle

**(b) D-02 negative gate (voice next before ack → spoken prompt, no advance):**
- Modal contains `isAcknowledged` check
- Modal contains `speak(` + acknowledge-prompt string (the "please acknowledge…" spoken TTS branch)

### TTS model constant (CLAUDE.md 2026-06-02)
`tts-route.spec.ts` asserts TTS route uses `TTS_MODEL` or `@/lib/voice/tts-constants` import rather than a bare hardcoded `'gpt-4o-mini-tts'` string — prevents the silent model-ID rot bug that caused the Phase 21 AI reviewer failure.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. This plan is test-only.

## Self-Check: PASSED

Files verified:
- `playwright.config.ts` — contains `phase22-stubs` ✓
- `tests/phase22/intent-classifier.spec.ts` — exists ✓
- `tests/phase22/tts-route.spec.ts` — exists ✓
- `tests/phase22/stt-keyterms.spec.ts` — exists ✓
- `tests/phase22/visual-layer.spec.ts` — exists ✓
- `tests/phase22/voice-modal.spec.ts` — exists ✓
- `tests/phase22/voice-safety-gate.spec.ts` — exists ✓

Commits verified:
- `480af5e` — feat(22-01): register phase22-stubs Playwright project ✓
- `2405cb5` — test(22-01): create six phase22 stub specs (Nyquist Wave-0 harness) ✓

`npx playwright test --project=phase22-stubs`: 30 tests executed (5 skip, 20 fail clean, 5 pass) — no process/module-load errors ✓
`npx playwright test --project=phase22-stubs tests/phase22/intent-classifier.spec.ts`: 5 skip cleanly ✓
No `/s` regex flags in any spec file ✓
