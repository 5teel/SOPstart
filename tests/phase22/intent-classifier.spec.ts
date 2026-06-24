/**
 * Phase 22 — VDW-VOICE-03: classifyIntent unit test.
 *
 * Turns GREEN when Plan 02 ships `src/lib/voice/intent-classifier.ts`.
 * At Wave-0 head the module does not exist, so this spec SKIPS cleanly
 * (via the fs.existsSync guard below) rather than erroring on a missing import.
 *
 * CLAUDE.md 2026-06-05: source-contract tests must assert handler WIRING,
 * not just token presence. This spec exercises the live function with inputs
 * that validate the question-word gate (beats "next" keyword per PATTERNS.md).
 *
 * Pattern: green-when-absent / live-when-present.
 * Registration: phase22-stubs project in playwright.config.ts
 * (CLAUDE.md 2026-05-25: unregistered specs never run).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const CLASSIFIER_PATH = path.join(REPO_ROOT, 'src', 'lib', 'voice', 'intent-classifier.ts')

const moduleExists = fs.existsSync(CLASSIFIER_PATH)

// Guard: skip the live unit tests until Plan 02 ships the module.
// When the file exists, all tests run as real assertions.
test('VDW-VOICE-03: classifyIntent("done") returns "next"', async () => {
  if (!moduleExists) {
    test.skip(true, 'intent-classifier.ts not yet created — waiting for Plan 02')
    return
  }
  // Dynamic import avoids module-load error at Wave-0 head
  const { classifyIntent } = await import('@/lib/voice/intent-classifier')
  expect(classifyIntent('done')).toBe('next')
})

test('VDW-VOICE-03: classifyIntent("next") returns "next"', async () => {
  if (!moduleExists) {
    test.skip(true, 'intent-classifier.ts not yet created — waiting for Plan 02')
    return
  }
  const { classifyIntent } = await import('@/lib/voice/intent-classifier')
  expect(classifyIntent('next')).toBe('next')
})

test('VDW-VOICE-03: classifyIntent("go back") returns "prev"', async () => {
  if (!moduleExists) {
    test.skip(true, 'intent-classifier.ts not yet created — waiting for Plan 02')
    return
  }
  const { classifyIntent } = await import('@/lib/voice/intent-classifier')
  expect(classifyIntent('go back')).toBe('prev')
})

test('VDW-VOICE-03: classifyIntent with question word beats "next" keyword — returns "question"', async () => {
  if (!moduleExists) {
    test.skip(true, 'intent-classifier.ts not yet created — waiting for Plan 02')
    return
  }
  const { classifyIntent } = await import('@/lib/voice/intent-classifier')
  // "what is next on the blank side hanger" — question-word gate must fire FIRST
  // per PATTERNS.md § intent-classifier (Pitfall 4 fix: question-word > "next" keyword)
  expect(classifyIntent('what is next on the blank side hanger')).toBe('question')
})

test('VDW-VOICE-03: classifyIntent("how do I change the hanger") returns "question"', async () => {
  if (!moduleExists) {
    test.skip(true, 'intent-classifier.ts not yet created — waiting for Plan 02')
    return
  }
  const { classifyIntent } = await import('@/lib/voice/intent-classifier')
  expect(classifyIntent('how do I change the hanger')).toBe('question')
})
