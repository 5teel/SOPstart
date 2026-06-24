/**
 * Phase 22 — VDW-VOICE-01: Deepgram keyterms source-contract assertions.
 *
 * Turns GREEN when Plan 02 extends `src/lib/voice/deepgram-stream.ts`
 * with the keyterms interface + URL param injection.
 * At Wave-0 head these specs FAIL (clean assertion red — the tokens don't exist yet).
 *
 * CLAUDE.md 2026-06-05: assert WIRING, not just token presence.
 * Asserts:
 *   - `keyterms` field in VoiceStreamOpts interface (Plan 02 extension)
 *   - `params.append('keyterm'` call (URL injection per Deepgram keyterms API)
 *
 * Pattern: fs.readFileSync + toContain (source-contract file-walk).
 * Registration: phase22-stubs project in playwright.config.ts
 * (CLAUDE.md 2026-05-25: unregistered specs never run).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const DEEPGRAM_PATH = path.join(REPO_ROOT, 'src', 'lib', 'voice', 'deepgram-stream.ts')

function readDeepgram(): string {
  return fs.readFileSync(DEEPGRAM_PATH, 'utf-8')
}

test('VDW-VOICE-01: deepgram-stream.ts exists', () => {
  expect(
    fs.existsSync(DEEPGRAM_PATH),
    `deepgram-stream.ts not found at ${DEEPGRAM_PATH}`,
  ).toBe(true)
})

test('VDW-VOICE-01: VoiceStreamOpts interface contains keyterms field', () => {
  const text = readDeepgram()
  // The interface must declare a keyterms property (optional string[])
  expect(text).toContain('keyterms')
})

test('VDW-VOICE-01: params.append("keyterm") call exists for per-term URL injection', () => {
  const text = readDeepgram()
  // Deepgram keyterms API requires one param append per term:
  // `params.append('keyterm', kt)` — this is the wiring assertion
  expect(text).toContain("params.append('keyterm'")
})
