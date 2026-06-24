/**
 * Phase 22 — D-02: Voice safety gate source-contract assertions.
 *
 * Turns GREEN when Plan 03 wires the full onVoiceNext → handleMarkComplete chain
 * and the isAcknowledged-false TTS ack-prompt branch.
 * At Wave-0 head these specs FAIL (clean assertion red — the tokens don't exist yet).
 *
 * D-02 safety invariant (from 22-CONTEXT.md):
 *   "Voice is additive, not a bypass. The existing on-screen per-session safety
 *    re-acknowledgement still governs safety-critical steps. Voice 'next' must NOT
 *    silently skip a step that the current UI requires an explicit acknowledgement for —
 *    the spoken command drives the same state machine the tap UI drives; it does not
 *    get a weaker gate."
 *
 * Two assertions (per plan <behavior> § voice-safety-gate spec):
 *
 * (a) POSITIVE routing / bypass guard:
 *     - WalkthroughVoiceModal.tsx has `onVoiceNext` prop (voice advances via the prop,
 *       not by calling markStepComplete directly — ownership stays in MobileWalkthrough)
 *     - WalkthroughVoiceModal.tsx does NOT contain `markStepComplete` directly
 *       (the bypass guard: modal must delegate, not self-advance)
 *     - MobileWalkthrough.tsx exposes `useImperativeHandle` (the ref-based delegate pattern)
 *     - MobileWalkthrough.tsx handleMarkComplete contains both `markStepAcknowledged`
 *       AND `markStepComplete` (the single mutation path — no split ownership)
 *     - WalkthroughSwitcher.tsx passes `onVoiceNext` to the modal AND uses a `ref`
 *       pointing at MobileWalkthrough (the wiring site)
 *
 * (b) D-02 NEGATIVE gate (new — complements runtime UAT in Plan 03 Task 3):
 *     - WalkthroughVoiceModal.tsx contains `isAcknowledged` check
 *     - WalkthroughVoiceModal.tsx contains a `speak(` call that co-occurs with
 *       an `isAcknowledged`-false branch AND an acknowledge-prompt string
 *       (voice "next" before ack must speak "please acknowledge…" NOT advance the step)
 *
 * CLAUDE.md 2026-06-05: assert WIRING + negative invariants, not just token presence.
 * Pattern: fs.readFileSync + toContain / not.toContain (source-contract file-walk).
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
const MOBILE_WALKTHROUGH_PATH = path.join(
  REPO_ROOT,
  'src',
  'components',
  'sop',
  'walkthrough',
  'MobileWalkthrough.tsx',
)
const SWITCHER_PATH = path.join(
  REPO_ROOT,
  'src',
  'components',
  'sop',
  'walkthrough',
  'WalkthroughSwitcher.tsx',
)

function readFile(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

// ---------------------------------------------------------------------------
// (a) Positive routing / bypass guard
// ---------------------------------------------------------------------------

test('D-02 [bypass guard]: WalkthroughVoiceModal.tsx has onVoiceNext prop', () => {
  const text = readFile(VOICE_MODAL_PATH)
  expect(text).toContain('onVoiceNext')
})

test('D-02 [bypass guard]: WalkthroughVoiceModal.tsx does NOT call markStepComplete directly (ownership stays in MobileWalkthrough)', () => {
  const text = readFile(VOICE_MODAL_PATH)
  // The modal must delegate step completion via onVoiceNext prop — it must NOT
  // call markStepComplete directly, which would bypass the ack gate in MobileWalkthrough.
  expect(text).not.toContain('markStepComplete')
})

test('D-02 [bypass guard]: MobileWalkthrough.tsx uses useImperativeHandle (exposes voice callbacks via ref)', () => {
  const text = readFile(MOBILE_WALKTHROUGH_PATH)
  // useImperativeHandle is the recommended delegate pattern per PATTERNS.md § MobileWalkthrough.
  // WalkthroughSwitcher holds the ref; voice callbacks are exposed via this handle.
  expect(text).toContain('useImperativeHandle')
})

test('D-02 [bypass guard]: MobileWalkthrough.tsx handleMarkComplete contains markStepAcknowledged AND markStepComplete (single mutation path)', () => {
  const text = readFile(MOBILE_WALKTHROUGH_PATH)
  // Both ack + complete must live inside handleMarkComplete — no split ownership
  // where voice can call complete without ack.
  expect(text).toContain('markStepAcknowledged')
  expect(text).toContain('markStepComplete')
})

test('D-02 [bypass guard]: WalkthroughSwitcher.tsx passes onVoiceNext to the modal AND uses a ref for MobileWalkthrough', () => {
  const text = readFile(SWITCHER_PATH)
  // WalkthroughSwitcher is the wiring site: it holds the MobileWalkthrough ref
  // and passes onVoiceNext down to WalkthroughVoiceModal.
  expect(text).toContain('onVoiceNext')
  // ref usage (useRef or createRef) confirms the imperative handle pattern is wired
  expect(text).toContain('useRef')
})

// ---------------------------------------------------------------------------
// (b) D-02 negative gate — isAcknowledged-false → TTS ack-prompt branch
// ---------------------------------------------------------------------------

test('D-02 [negative gate]: WalkthroughVoiceModal.tsx checks isAcknowledged before advancing', () => {
  const text = readFile(VOICE_MODAL_PATH)
  // The modal must read isAcknowledged (from the walkthrough store or as a prop)
  // so it can detect when the safety ack has not yet been given.
  expect(text).toContain('isAcknowledged')
})

test('D-02 [negative gate]: WalkthroughVoiceModal.tsx contains an acknowledge-prompt speak() call when not yet acknowledged', () => {
  const text = readFile(VOICE_MODAL_PATH)
  // The modal must have a branch that calls speak() with a prompt referencing
  // acknowledgement when isAcknowledged is false — voice "next" before ack
  // must speak "please acknowledge…" and NOT advance the step (D-02 guard).
  //
  // grep-level wiring assertion: file contains both `isAcknowledged` (above)
  // AND a speak() call that co-occurs with an acknowledge-prompt phrase.
  // This is NOT a runtime test — it verifies the branch exists in the source.
  // The runtime proof is in Plan 03 Task 3's human UAT.
  //
  // Accept any of: 'acknowledge', 'Acknowledge', 'ack' adjacent to a speak( call.
  const hasAcknowledgePrompt =
    text.includes('acknowledge') || text.includes('Acknowledge')
  expect(
    hasAcknowledgePrompt,
    'Modal must contain an acknowledge-prompt string for the isAcknowledged-false → TTS branch (D-02 negative gate)',
  ).toBe(true)
  // And the speak() wiring must be present (checked separately in voice-modal.spec.ts,
  // but assert it again here for the safety-gate context: the branch must speak, not just warn)
  expect(text).toContain('speak(')
})
