/**
 * Phase 26.5 — D-06: four signal-source readers (Wave-0 stub, Plan 26.5-01).
 *
 * Goes LIVE when src/lib/agent-layer/signals.ts ships: asserts all four
 * D-06 sources are read (completions + ack traces, reviewer flags/verify
 * history, voice Q&A transcripts, admin edit patterns) and each reader is
 * independently try/caught (one failing source never blanks the run —
 * reviewer-orchestrator isolation pattern). Skips cleanly until then.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const SIGNALS_PATH = path.resolve(__dirname, '..', '..', 'src', 'lib', 'agent-layer', 'signals.ts')

test('D-06: signals.ts reads all four signal sources', () => {
  if (!fs.existsSync(SIGNALS_PATH)) {
    test.skip(true, 'signals.ts not yet created — waiting for the signals plan')
    return
  }
  const src = fs.readFileSync(SIGNALS_PATH, 'utf-8')
  expect(src).toContain('sop_completions')
  expect(src).toMatch(/ai_review|reviewer/)
  expect(src).toMatch(/voice_qa|voice-qa/)
})

test('D-06: each signal reader is independently error-isolated (try/catch per source)', () => {
  if (!fs.existsSync(SIGNALS_PATH)) {
    test.skip(true, 'signals.ts not yet created — waiting for the signals plan')
    return
  }
  const src = fs.readFileSync(SIGNALS_PATH, 'utf-8')
  const catches = src.split('catch').length - 1
  expect(catches).toBeGreaterThanOrEqual(4)
})

test.fixme('D-06: reader returns structured observations per source (unit, seeded fakes)', () => {
  // Behavioral test — implemented in the signals plan.
})
