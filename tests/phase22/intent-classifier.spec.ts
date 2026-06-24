/**
 * Phase 22 — VDW-VOICE-03: classifyIntent source-contract + unit assertions.
 *
 * Turns GREEN when Plan 02 ships `src/lib/voice/intent-classifier.ts`.
 * At Wave-0 head the module does not exist, so this spec SKIPS cleanly
 * (via the fs.existsSync guard below) rather than erroring on a missing import.
 *
 * CLAUDE.md 2026-06-05: source-contract tests must assert handler WIRING,
 * not just token presence. This spec verifies:
 *  1. The module file exists
 *  2. classifyIntent is exported
 *  3. VoiceIntent union type is present
 *  4. Key gate ordering (QUESTION_WORDS before NEXT_PATTERNS per PATTERNS.md Pitfall 4)
 *  5. Length gate (t.length < 60) for NEXT_PATTERNS
 *
 * NOTE: Behavioral unit tests (calling the live function) live in
 *   src/lib/voice/__tests__/intent-classifier.test.ts (phase15-unit project)
 *   because Playwright's dynamic import() does not resolve @/ TS path aliases
 *   in Node.js context for the phase22-stubs project.
 *
 * Pattern: fs.readFileSync + toContain (source-contract file-walk).
 * Registration: phase22-stubs project in playwright.config.ts
 * (CLAUDE.md 2026-05-25: unregistered specs never run).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const CLASSIFIER_PATH = path.join(REPO_ROOT, 'src', 'lib', 'voice', 'intent-classifier.ts')

const moduleExists = fs.existsSync(CLASSIFIER_PATH)

function readClassifier(): string {
  return fs.readFileSync(CLASSIFIER_PATH, 'utf-8')
}

// Guard: skip all tests until Plan 02 ships the module.
test('VDW-VOICE-03: intent-classifier.ts module exists', () => {
  if (!moduleExists) {
    test.skip(true, 'intent-classifier.ts not yet created — waiting for Plan 02')
    return
  }
  expect(moduleExists).toBe(true)
})

test('VDW-VOICE-03: classifyIntent function is exported', () => {
  if (!moduleExists) {
    test.skip(true, 'intent-classifier.ts not yet created — waiting for Plan 02')
    return
  }
  const text = readClassifier()
  expect(text).toContain('export function classifyIntent')
})

test('VDW-VOICE-03: VoiceIntent union type is exported', () => {
  if (!moduleExists) {
    test.skip(true, 'intent-classifier.ts not yet created — waiting for Plan 02')
    return
  }
  const text = readClassifier()
  expect(text).toContain('VoiceIntent')
})

test('VDW-VOICE-03: QUESTION_WORDS gate is ordered BEFORE NEXT_PATTERNS (Pitfall 4 fix)', () => {
  if (!moduleExists) {
    test.skip(true, 'intent-classifier.ts not yet created — waiting for Plan 02')
    return
  }
  const text = readClassifier()
  // Assert both gates exist
  expect(text).toContain('QUESTION_WORDS')
  expect(text).toContain('NEXT_PATTERNS')
  // Assert QUESTION_WORDS check appears before NEXT_PATTERNS check in the function body
  const qwPos = text.indexOf('QUESTION_WORDS.test(')
  const npPos = text.indexOf('NEXT_PATTERNS.test(')
  expect(qwPos).toBeGreaterThan(-1)
  expect(npPos).toBeGreaterThan(-1)
  expect(qwPos).toBeLessThan(npPos)
})

test('VDW-VOICE-03: NEXT_PATTERNS has length gate (t.length < 60) to avoid long-utterance misclassification', () => {
  if (!moduleExists) {
    test.skip(true, 'intent-classifier.ts not yet created — waiting for Plan 02')
    return
  }
  const text = readClassifier()
  // The length gate prevents "I'm about to do the next thing on the machine (62 chars)"
  // from triggering step advance — per RESEARCH Pitfall 4
  expect(text).toContain('length < 60')
})
