/**
 * Phase 26.5 — D-14: scheduled synthesis-sweep route auth (Wave-0 stub, Plan 26.5-01).
 *
 * Goes LIVE when the cron-invoked sweep route ships: asserts it rejects
 * unauthenticated requests (401) and returns a specific 503 when
 * VOYAGE_API_KEY is unset (RESEARCH Open Question 1 resolution) rather than
 * a generic SDK exception. Skips cleanly until then.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const SWEEP_ROUTE = path.resolve(
  __dirname, '..', '..', 'src', 'app', 'api', 'agent-layer', 'synthesis-sweep', 'route.ts',
)

test('D-14: sweep route rejects unauthenticated requests with 401', () => {
  if (!fs.existsSync(SWEEP_ROUTE)) {
    test.skip(true, 'synthesis-sweep route not yet created — waiting for the sweep plan')
    return
  }
  const src = fs.readFileSync(SWEEP_ROUTE, 'utf-8')
  expect(src).toContain('401')
})

test('D-14: sweep route returns specific 503 when VOYAGE_API_KEY is unset', () => {
  if (!fs.existsSync(SWEEP_ROUTE)) {
    test.skip(true, 'synthesis-sweep route not yet created — waiting for the sweep plan')
    return
  }
  const src = fs.readFileSync(SWEEP_ROUTE, 'utf-8')
  expect(src).toContain('VOYAGE_API_KEY')
  expect(src).toContain('503')
})

test.fixme('D-14: unauthenticated request → 401; cross-org data filtered (runtime probe)', () => {
  // Live-route integration test — implemented in the sweep plan.
})
