/**
 * Phase 26.5 — D-06 voice write path / RESEARCH Pitfall 1 (Wave-0 stub, Plan 26.5-01).
 *
 * /api/voice/query is currently PURE request-response — no transcript is
 * persisted anywhere, so signal source #3 does not exist until a write path
 * is added. Goes LIVE when the route gains the append-only transcript insert.
 * Content-level guard (phase23 version-supersede convention: the file exists
 * today, so guard on the new capability, not file existence).
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

const hasWritePath = fs.existsSync(ROUTE_PATH) && /voice_qa/.test(readRoute())

test('D-06/Pitfall-1: /api/voice/query persists the Q&A transcript (append-only)', () => {
  if (!hasWritePath) {
    test.skip(true, 'voice Q&A transcript write not yet added — waiting for Plan 26.5-03')
    return
  }
  const src = readRoute()
  expect(src).toMatch(/voice_qa/)
  expect(src).toContain('insert')
})

test('D-06/Pitfall-1: transcript write self-enforces org scope (service-role insert sets organisation_id)', () => {
  if (!hasWritePath) {
    test.skip(true, 'voice Q&A transcript write not yet added — waiting for Plan 26.5-03')
    return
  }
  expect(readRoute()).toContain('organisation_id')
})

test.fixme('D-06/Pitfall-1: a voice query produces a transcript row (runtime, seeded org)', () => {
  // Live-route integration test — implemented in Plan 26.5-03.
})
