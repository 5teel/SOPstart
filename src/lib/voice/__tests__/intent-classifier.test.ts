/**
 * Phase 22 — VDW-VOICE-03: classifyIntent unit tests (live behavioral assertions).
 *
 * Registered under the `phase15-unit` Playwright project (testDir: './src/lib/voice/__tests__')
 * because that project resolves @/ TypeScript path aliases via Playwright's TS compiler,
 * unlike the phase22-stubs project which uses Node.js dynamic import() — which does not
 * resolve @/ aliases in this project's Node/CommonJS setup.
 *
 * Covers all 5 classification cases from the Plan 02 behavior spec:
 *   'done'   → 'next' (explicit done utterance)
 *   'next'   → 'next' (explicit next utterance)
 *   'go back' → 'prev' (backward navigation)
 *   'what is next on the blank side hanger' → 'question' (question-word beats "next" keyword)
 *   'how do I swab the lehr' → 'question' (question-word)
 *
 * Additional cases from PATTERNS.md:
 *   60+ char utterance with NEXT_PATTERNS → 'question' (length gate)
 *   'i have done this' → 'next'
 *   'previous step' → 'prev'
 */
import { test, expect } from '@playwright/test'
import { classifyIntent } from '@/lib/voice/intent-classifier'

test('VDW-VOICE-03: classifyIntent("done") returns "next"', () => {
  expect(classifyIntent('done')).toBe('next')
})

test('VDW-VOICE-03: classifyIntent("next") returns "next"', () => {
  expect(classifyIntent('next')).toBe('next')
})

test('VDW-VOICE-03: classifyIntent("i have done this") returns "next"', () => {
  expect(classifyIntent('i have done this')).toBe('next')
})

test('VDW-VOICE-03: classifyIntent("go back") returns "prev"', () => {
  expect(classifyIntent('go back')).toBe('prev')
})

test('VDW-VOICE-03: classifyIntent("previous") returns "prev"', () => {
  expect(classifyIntent('previous')).toBe('prev')
})

test('VDW-VOICE-03: classifyIntent("last step") returns "prev"', () => {
  expect(classifyIntent('last step')).toBe('prev')
})

test('VDW-VOICE-03: classifyIntent with question word beats "next" keyword — returns "question"', () => {
  // "what is next on the blank side hanger" — question-word gate must fire FIRST
  // per PATTERNS.md § intent-classifier (Pitfall 4 fix: question-word > "next" keyword)
  expect(classifyIntent('what is next on the blank side hanger')).toBe('question')
})

test('VDW-VOICE-03: classifyIntent("how do I swab the lehr") returns "question"', () => {
  expect(classifyIntent('how do I swab the lehr')).toBe('question')
})

test('VDW-VOICE-03: classifyIntent("how do I change the hanger") returns "question"', () => {
  expect(classifyIntent('how do I change the hanger')).toBe('question')
})

test('VDW-VOICE-03: long utterance (≥60 chars) with NEXT_PATTERNS but no question word → "question" (length gate)', () => {
  // A 60+ char utterance that embeds "next" but is narrative, not a navigation command.
  // The length gate (t.length < 60) prevents misclassification as 'next'.
  const longUtterance = "I'm about to move on to the next step after checking the machine"
  expect(longUtterance.length).toBeGreaterThanOrEqual(60)
  expect(classifyIntent(longUtterance)).toBe('question')
})
