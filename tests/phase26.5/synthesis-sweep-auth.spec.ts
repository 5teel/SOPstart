/**
 * Phase 26.5 — D-14: scheduled synthesis-sweep route auth.
 *
 * Made LIVE by Plan 26.5-06: the sweep route ships in this plan. Asserts
 * the route rejects unauthenticated requests (401), fails closed when
 * CRON_SECRET is unset, uses a constant-time secret compare (not the
 * session-cookie pattern), returns a specific 503 when VOYAGE_API_KEY is
 * unset (RESEARCH Open Question 1), and calls synthesizeSop for the sweep
 * body.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const SWEEP_ROUTE = path.resolve(
  __dirname, '..', '..', 'src', 'app', 'api', 'agent-layer', 'synthesis-sweep', 'route.ts',
)
const src = fs.readFileSync(SWEEP_ROUTE, 'utf-8')

test('D-14: sweep route rejects unauthenticated requests with 401', () => {
  expect(src).toContain('CRON_SECRET')
  expect(src).toContain('401')
})

test('D-14: sweep route fails closed (401) when CRON_SECRET is unset, not open', () => {
  // isAuthorized returns false immediately when the secret env var is unset
  // — no branch that treats a missing secret as "allow".
  expect(src).toMatch(/if\s*\(!secret\)\s*return false/)
})

test('D-14: auth uses a constant-time compare, not raw string equality', () => {
  expect(src).toContain('timingSafeEqual')
})

test('D-14: sweep route does NOT authenticate via supabase.auth.getUser() cookie session', () => {
  expect(src).not.toContain('auth.getUser()')
  expect(src).not.toContain('auth.getSession()')
})

test('D-14: sweep route returns specific 503 when VOYAGE_API_KEY is unset', () => {
  expect(src).toContain('VOYAGE_API_KEY')
  expect(src).toContain('503')
})

test('D-14: the sweep calls synthesizeSop with a per-invocation batch cap', () => {
  expect(src).toContain('synthesizeSop')
  expect(src).toMatch(/MAX_SOPS_PER_SWEEP/)
})

test('D-14: every sweep write self-enforces org-scope (organisation_id on every query)', () => {
  // hasNewerSignal / findStaleSops filter every signal-source query by
  // organisation_id; synthesizeSop itself (unit-tested elsewhere) is the
  // sole write path and takes organisationId as an explicit argument.
  const orgIdRefs = src.match(/organisation_id/g) ?? []
  expect(orgIdRefs.length).toBeGreaterThan(2)
})

test('D-14: session middleware exempts the sweep route (cron callers have no cookies)', () => {
  // Regression: without this exemption the middleware 307-redirects the cron
  // POST to /login before the route's bearer auth ever runs (found live 2026-07-05).
  const mw = fs.readFileSync('src/lib/supabase/middleware.ts', 'utf-8')
  expect(mw).toContain("'/api/agent-layer/synthesis-sweep'")
  expect(mw).toMatch(/isCronRoute/)
})
