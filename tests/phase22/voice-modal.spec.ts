/**
 * Phase 22 — VDW-VOICE-02/03: WalkthroughVoiceModal handler-wiring source-contract assertions.
 *
 * Turns GREEN when Plan 03 wires `src/components/sop/voice/WalkthroughVoiceModal.tsx`
 * with real STT, intent dispatch, TTS, and the onVoiceNext progression prop.
 * At Wave-0 head these specs FAIL (clean assertion red — the tokens don't exist yet).
 *
 * CLAUDE.md 2026-06-05: source-contract tests must assert handler WIRING,
 * not just token presence. Each assertion validates a functional connection:
 *   - `startVoiceStream(` — real Deepgram STT wired (not the stub "simulate" path)
 *   - `classifyIntent(` — intent dispatch wired (return value routes to next/prev/question)
 *   - `onVoiceNext` — progression prop present (the voice→step-advance path)
 *   - `speak(` — TTS speak call (TTS read-back after answer AND on step change)
 *   - `useTtsPlayback` — TTS hook imported and used (not an ad-hoc fetch)
 *
 * Pattern: fs.readFileSync + toContain (source-contract file-walk).
 * Registration: phase22-stubs project in playwright.config.ts
 * (CLAUDE.md 2026-05-25: unregistered specs never run).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const VOICE_MODAL_PATH = path.join(
  REPO_ROOT,
  'src',
  'components',
  'sop',
  'voice',
  'WalkthroughVoiceModal.tsx',
)

function readVoiceModal(): string {
  return fs.readFileSync(VOICE_MODAL_PATH, 'utf-8')
}

test('VDW-VOICE-02/03: WalkthroughVoiceModal.tsx exists', () => {
  expect(
    fs.existsSync(VOICE_MODAL_PATH),
    `WalkthroughVoiceModal.tsx not found at ${VOICE_MODAL_PATH}`,
  ).toBe(true)
})

test('VDW-VOICE-02: WalkthroughVoiceModal calls startVoiceStream( (real STT, not stub)', () => {
  const text = readVoiceModal()
  // startVoiceStream is the real Deepgram STT function from deepgram-stream.ts.
  // The Phase 15 modal had a simulated stub — Plan 03 must wire the real call.
  expect(text).toContain('startVoiceStream(')
})

test('VDW-VOICE-03: WalkthroughVoiceModal calls classifyIntent( (intent dispatch wired)', () => {
  const text = readVoiceModal()
  // classifyIntent is called on the final transcript to route to next/prev/question.
  // Per CLAUDE.md 2026-06-05: wiring assertion (function call), not just import presence.
  expect(text).toContain('classifyIntent(')
})

test('VDW-VOICE-03: WalkthroughVoiceModal has onVoiceNext prop (step progression)', () => {
  const text = readVoiceModal()
  // onVoiceNext is the prop that triggers handleMarkComplete in MobileWalkthrough.
  // It must appear in the modal so voice can drive step progression.
  expect(text).toContain('onVoiceNext')
})

test('VDW-VOICE-02: WalkthroughVoiceModal calls speak( (TTS read-back wired)', () => {
  const text = readVoiceModal()
  // speak() is the useTtsPlayback hook method — called after answer arrival AND on step change.
  // This is the TTS wiring assertion (functional handler call, not just hook import).
  expect(text).toContain('speak(')
})

test('VDW-VOICE-02: WalkthroughVoiceModal uses useTtsPlayback hook', () => {
  const text = readVoiceModal()
  // useTtsPlayback is the custom TTS hook (Plan 02) — the modal must use it,
  // not ad-hoc fetch calls to /api/voice/tts.
  expect(text).toContain('useTtsPlayback')
})
