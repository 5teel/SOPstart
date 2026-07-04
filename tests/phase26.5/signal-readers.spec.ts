/**
 * Phase 26.5 — D-06: four signal-source readers (LIVE, Plan 26.5-03).
 *
 * signals.ts reads all four D-06 sources and each reader is independently
 * try/caught (one failing source never blanks the run — reviewer-orchestrator
 * isolation pattern). similarity.ts wraps the pgvector RPC (D-03/Pitfall 3).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const SIGNALS_PATH = path.resolve(__dirname, '..', '..', 'src', 'lib', 'agent-layer', 'signals.ts')
const SIMILARITY_PATH = path.resolve(__dirname, '..', '..', 'src', 'lib', 'agent-layer', 'similarity.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test('D-06: signals.ts reads all four signal sources', () => {
  const src = read(SIGNALS_PATH)
  expect(src).toContain('sop_completions')
  expect(src).toMatch(/ai_review|reviewer/)
  expect(src).toMatch(/voice_qa|voice-qa/)
  expect(src).toContain('sop_section_blocks')
})

test('D-06: exports the four readers + SignalBundle', () => {
  const src = read(SIGNALS_PATH)
  expect(src).toContain('export async function readCompletionSignals')
  expect(src).toContain('export async function readReviewerSignals')
  expect(src).toContain('export async function readVerifySignals')
  expect(src).toContain('export async function readVoiceSignals')
  expect(src).toContain('export type SignalBundle')
})

test('D-06: each signal reader is independently error-isolated (try/catch per source)', () => {
  const src = read(SIGNALS_PATH)
  const catches = src.split('catch').length - 1
  expect(catches).toBeGreaterThanOrEqual(4)
})

test('D-03: similarity.ts wraps the RPC — never a raw .select() with a vector operator', () => {
  const src = read(SIMILARITY_PATH)
  expect(src).toContain(".rpc('match_sop_agent_metadata'")
  expect(src).not.toMatch(/\.select\([^)]*<=>/)
})

test.fixme('D-06: reader returns structured observations per source (unit, seeded fakes)', () => {
  // Behavioral test — deferred to phase UAT / synthesis-pipeline plan (26.5-04)
  // which is the first real consumer of these readers against seeded data.
})
