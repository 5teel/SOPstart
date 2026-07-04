/**
 * Phase 26.5 — D-06 voice write path / RESEARCH Pitfall 1 (LIVE, Plan 26.5-03).
 *
 * /api/voice/query now persists the Q&A transcript into sop_voice_qa_log via
 * createAdminClient() (append-only, no authenticated write policy). These are
 * source-contract assertions that the write is WIRED — the handler is called
 * with the answer, sets organisation_id explicitly, and never falls back to
 * atob() for the org claim (CLAUDE.md 2026-06-05/2026-06-26).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROUTE_PATH = path.resolve(
  __dirname, '..', '..', 'src', 'app', 'api', 'voice', 'query', 'route.ts',
)

function readRoute(): string {
  return fs.readFileSync(ROUTE_PATH, 'utf-8')
}

test('D-06/Pitfall-1: /api/voice/query persists the Q&A transcript (append-only)', () => {
  const src = readRoute()
  expect(src).toMatch(/sop_voice_qa_log/)
  expect(src).toContain('.insert(')
  expect(src).toContain('createAdminClient')
})

test('D-06/Pitfall-1: transcript write self-enforces org scope (service-role insert sets organisation_id)', () => {
  const src = readRoute()
  expect(src).toContain('organisation_id: params.organisationId')
  expect(src).not.toContain('atob(')
})

test('D-06/Pitfall-1: the log write is called with the computed answer, after answerSopQuestion resolves', () => {
  const src = readRoute()
  const answerIdx = src.indexOf('await answerSopQuestion(')
  const logIdx = src.indexOf('logVoiceQaTranscript({')
  expect(answerIdx).toBeGreaterThan(-1)
  expect(logIdx).toBeGreaterThan(answerIdx)
})

test.fixme('D-06/Pitfall-1: a voice query produces a transcript row (runtime, seeded org)', () => {
  // Live-route integration test — deferred to phase UAT (requires a seeded
  // org + published SOP + live Anthropic call).
})
