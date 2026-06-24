---
phase: 22-voice-driven-walkthrough
plan: 03
subsystem: voice-walkthrough-integration
tags: [voice, deepgram, tts, intent-classifier, d02-safety, forwardRef, tdd]
dependency_graph:
  requires:
    - 22-01 (phase22-stubs test harness — voice-modal + voice-safety-gate specs)
    - 22-02 (voice infra: startVoiceStream keyterms, classifyIntent, extractKeyterms, useTtsPlayback)
    - 22-04 (always-on visual layer — same authenticated UAT run)
  provides:
    - MobileWalkthrough.tsx: forwardRef + useImperativeHandle (MobileWalkthroughHandle)
    - WalkthroughSwitcher.tsx: mwRef bridge + reactive currentStepText useState mirror
    - WalkthroughVoiceModal.tsx: real Deepgram STT + intent dispatch + TTS read-back + D-02 gate
  affects:
    - Phase 22 UAT (Task 3 human-verify on sopstart.com — blocking checkpoint, not yet approved)
tech_stack:
  added: []
  patterns:
    - forwardRef + useImperativeHandle (MobileWalkthroughHandle voice bridge)
    - Reactive ref mirror: useState mirror of ref value, set AFTER advance call (CLAUDE.md 2026-06-08)
    - Push-to-talk: startVoiceStream per mic press (token-per-press Pitfall 2)
    - D-02 negative gate: isAcknowledged prop check before voice advance → TTS prompt
    - TTS step-entry: useEffect on currentStepText prop calls speak() (VDW-LIT-03)
    - Mic-stop sequencing: StreamHandle.stop() before TTS (RESEARCH Pitfall 1)
    - iOS autoplay unlock: synchronous play() on first mic gesture (RESEARCH Pitfall 5)
key_files:
  created: []
  modified:
    - src/components/sop/walkthrough/MobileWalkthrough.tsx
    - src/components/sop/walkthrough/WalkthroughSwitcher.tsx
    - src/components/sop/voice/WalkthroughVoiceModal.tsx
    - src/lib/journeys/journeys.ts
decisions:
  - useImperativeHandle over state hoist — additive option, zero risk of breaking existing D-02/D-19 tap paths
  - currentStepText useState mirror in WalkthroughSwitcher set AFTER ref advance, not from mwRef.current in JSX (CLAUDE.md 2026-06-08 non-reactive-source staleness trap prevention)
  - D-02 gate: modal reads isAcknowledged from prop (sourced from mwRef.current.isAcknowledged in WalkthroughSwitcher) — not from store directly (modal must delegate, not bypass)
  - voice "next" routes ONLY through onVoiceNext → handleMarkComplete, never markStepComplete direct (T-22-03-01 mitigated)
  - iOS autoplay unlock: synchronous play() on first mic press user gesture; fail-silent if NotAllowedError
  - prevStepTextRef guard prevents double-read on modal mount (empty string seed → no TTS on open)
  - journeys.ts 'ask' step extended (not a new journey/route — voice is a mode layer on /sops/[sopId]/walkthrough)
metrics:
  duration: "~7 minutes"
  completed: "2026-06-24"
  tasks_completed: 2
  files_changed: 4
---

# Phase 22 Plan 03: Live Voice Loop Integration — STT + Intent + TTS + D-02 Gate Summary

**One-liner:** forwardRef on MobileWalkthrough + reactive currentStepText mirror in WalkthroughSwitcher + real Deepgram STT + classifyIntent dispatch + TTS read-back + D-02 negative gate wired into WalkthroughVoiceModal, closing VDW-VOICE-01/02/03 and VDW-LIT-03.

## What Was Built

### Task 1: MobileWalkthrough forwardRef + WalkthroughSwitcher ref bridge (commit `827c5f4`)

**`src/components/sop/walkthrough/MobileWalkthrough.tsx`**
- Exported `MobileWalkthroughHandle` interface: `onVoiceNext`, `onVoicePrev`, `currentStepText`, `isAcknowledged`
- Converted to `React.forwardRef<MobileWalkthroughHandle, { sop: SopWithSections }>`
- `useImperativeHandle(ref, () => ({ ... }), [currentStep, prevStep, acknowledged])`:
  - `onVoiceNext()` → `currentStep && handleMarkCompleteRef.current(currentStep.id)` — SAME path as the tap button (D-02 invariant preserved)
  - `onVoicePrev()` → `prevStep && handleStepChangeRef.current(prevStep.id)` — SAME path as Prev nav
  - `currentStepText` → getter reading `currentStep?.text ?? ''` (live state)
  - `isAcknowledged` → getter reading `acknowledged` (live store read)
- Used stable mutable refs for handleMarkComplete/handleStepChange callbacks to avoid stale closure in the handle while keeping deps clean

**`src/components/sop/walkthrough/WalkthroughSwitcher.tsx`**
- Added `const mwRef = useRef<MobileWalkthroughHandle>(null)` — passed to `<MobileWalkthrough ref={mwRef} />`
- Added `const [currentStepText, setCurrentStepText] = useState<string>('')` — the REACTIVE mirror
- `handleVoiceNext`: calls `mwRef.current?.onVoiceNext()` THEN `setCurrentStepText(mwRef.current?.currentStepText ?? '')` — state set AFTER ref advance so modal's TTS effect fires on fresh step
- `handleVoicePrev`: symmetric pattern
- `useEffect` on `modalOpen`: seeds `currentStepText` when modal opens so first step reads aloud
- Passes `onVoiceNext={handleVoiceNext}`, `onVoicePrev={handleVoicePrev}`, `currentStepText`, `isAcknowledged` to `<WalkthroughVoiceModal />`
- Modal stays `next/dynamic` (bundle isolation preserved — lint guard still GREEN)

### Task 2: Real STT + intent dispatch + TTS in WalkthroughVoiceModal (commit `63b1039`)

**`src/components/sop/voice/WalkthroughVoiceModal.tsx`**
- **Props extended**: `onVoiceNext`, `onVoicePrev`, `currentStepText`, `isAcknowledged`, `onAdvance?`, `sop?`
- **ModalState**: `'speaking'` added
- **startListening**: replaced stub with real `startVoiceStream({ language: 'en-NZ', keyterms: extractKeyterms(sop) })` per press (Pitfall 2 token-per-press). Wires `onPartial→setTranscript`, `onFinal→handleFinalTranscript`, `onError→error state`. Calls `tts.stop()` before mic start (Pitfall 1). iOS unlock synchronous `play()` on first gesture (Pitfall 5).
- **handleFinalTranscript**: `classifyIntent(text)` dispatch:
  - `'next'` / `'done'`: stop mic → `tts.stop()` → D-02 gate: if `isAcknowledged === false`, `tts.speak('Please acknowledge the safety hazards first')` + no advance; else `onVoiceNext()` → `setState('idle')`
  - `'prev'`: stop mic → `onVoicePrev()` → `setState('idle')`
  - `'question'`: route to existing `stopAndAsk()` Q&A path
- **TTS-on-answer** (VDW-VOICE-02): after Q&A fetch resolves, `void tts.speak(data.answer.slice(0, 500))` + `setState('speaking')`
- **TTS-on-step-entry** (VDW-LIT-03): `useEffect([currentStepText])` guards empty/unchanged values via `prevStepTextRef`, then `void tts.speak(currentStepText)`. Reactive because `currentStepText` is a `useState`-backed prop (Task 1) — re-renders modal when step changes.
- **Hidden audio**: `<audio ref={tts.audioRef} className="hidden" aria-hidden="true" />`
- **Bypass guard**: No `markStepComplete` in modal; all progression via `onVoiceNext` prop (T-22-03-01)
- **Tap fallbacks**: Speak/Stop buttons + manual textarea + Ask button retained (D-04)

### Journeys.ts update (commit `a7261a4`)

Extended the `walkthrough-complete` journey's `'ask'` step detail to document the Phase 22 voice-driven mode: push-to-talk intent classification (next/prev/question), TTS read-back, D-02 safety gate. No new route — voice is a mode layer on `/sops/[sopId]/walkthrough`.

## Spec Results

| Spec | Tests | Result |
|------|-------|--------|
| `tests/phase22/voice-modal.spec.ts` | 6 | 6 PASS |
| `tests/phase22/voice-safety-gate.spec.ts` | 7 | 7 PASS |
| `tests/lint/no-static-desktop-import.spec.ts` | 2 | 2 PASS (bundle isolation) |
| `npx tsc --noEmit` | — | CLEAN |

## Checkpoint Status

**Task 3: Human UAT (blocking)** — AWAITING APPROVAL

Per the plan's `type="checkpoint:human-verify"` and the project's railway-only-testing rule, the runtime voice loop must be verified on sopstart.com (NOT localhost) by Simon. The source-contract specs are all GREEN, but per CLAUDE.md 2026-06-05/2026-06-08, grep-level tests cannot prove the mic→TTS→advance loop at runtime.

**Verification steps (from plan Task 3):**
1. Install the PWA on an iPhone and open a published SOP's Walkthrough tab
2. Push-to-talk, ask a step question — confirm transcription + answer + TTS read-back (VDW-VOICE-02)
3. Say "done" or "next" on a non-safety step — confirm walkthrough advances AND reads NEW step text aloud (VDW-VOICE-03, VDW-LIT-03). The new-step read validates the reactive currentStepText fix.
4. Say "next" before safety acknowledgement — confirm no advance + TTS "please acknowledge…" (D-02)
5. Confirm tap equivalents still work — "I've done this — Next" + manual text box (D-04)
6. Confirm each step card shows a photo or type icon — Plan 04 visual layer (VDW-LIT-01/02)
7. iOS specifics: TTS audio plays in installed PWA + STT returns non-empty transcripts

Resume signal: `"approved"` when runtime loop works, or describe failures for gap closure.

## Deviations from Plan

None — plan executed exactly as written. All wiring decisions matched PATTERNS.md option 1 (useImperativeHandle additive option). The prevStepTextRef guard (preventing double-read on modal mount) was a minor addition not explicitly in the plan but required for correct behavior.

## Known Stubs

None. All three components are fully wired:
- MobileWalkthrough exposes a live handle backed by real handleMarkComplete/handleStepChange
- WalkthroughSwitcher mirrors currentStepText into useState and updates it on each advance
- WalkthroughVoiceModal runs real Deepgram STT, real classifyIntent dispatch, real TTS via useTtsPlayback

## Threat Surface Scan

No new network endpoints beyond what is already in the plan's threat model.

| Flag | Coverage | Description |
|------|----------|-------------|
| T-22-03-01 mitigated | voice-safety-gate bypass guard GREEN | Modal contains no `markStepComplete`; voice "next" routes through onVoiceNext → handleMarkComplete only |
| T-22-03-02 mitigated | handleMarkComplete unchanged | Both markStepAcknowledged + markStepComplete present in the single write path |
| T-22-03-06 mitigated | Reactivity guard assertion GREEN | currentStepText is a useState set AFTER ref advance; stale-ref path impossible |

## Self-Check: PASSED

Files verified:
- `src/components/sop/walkthrough/MobileWalkthrough.tsx` — contains `useImperativeHandle`, `MobileWalkthroughHandle`, `markStepAcknowledged`, `markStepComplete` ✓
- `src/components/sop/walkthrough/WalkthroughSwitcher.tsx` — contains `useState` for `currentStepText`, `setCurrentStepText`, `onVoiceNext`, `useRef` ✓
- `src/components/sop/voice/WalkthroughVoiceModal.tsx` — contains `startVoiceStream(`, `classifyIntent(`, `onVoiceNext`, `speak(`, `useTtsPlayback`, `isAcknowledged`, `acknowledge` — does NOT contain `markStepComplete` ✓
- `src/lib/journeys/journeys.ts` — extended 'ask' step detail ✓

Commits verified:
- `827c5f4` — feat(22-03): expose MobileWalkthrough voice handle + wire WalkthroughSwitcher ref + reactive currentStepText ✓
- `63b1039` — feat(22-03): wire real STT + intent dispatch + TTS read-back in WalkthroughVoiceModal ✓
- `a7261a4` — chore(22-03): update journeys.ts with voice-driven walkthrough mode ✓

`npx playwright test --project=phase22-stubs tests/phase22/voice-modal.spec.ts tests/phase22/voice-safety-gate.spec.ts`: 13/13 GREEN ✓
`npx playwright test --project=phase15-stubs no-static-desktop-import`: 2/2 GREEN ✓
`npx tsc --noEmit`: CLEAN ✓
`markStepComplete` absent from WalkthroughVoiceModal.tsx ✓ (D-02 bypass guard)
`setCurrentStepText` appears after `mwRef.current?.onVoiceNext()` in WalkthroughSwitcher ✓ (reactivity guard)
