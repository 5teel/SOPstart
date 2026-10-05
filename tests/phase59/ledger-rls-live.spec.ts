/**
 * Phase 59 -- ledger RLS live probe (stub; Wave 0 / 59-01). Requirement DEC-02; decision A-04.
 * Owner: 59-02. Self-skips unless PHASE59_LIVE=1: live probes share one Supabase
 * OTP budget (CLAUDE.md 2026-09-28), so run it ONCE, never in a loop.
 * Registration: playwright.config.ts `phase59`.
 */
import { test } from '@playwright/test'

test.describe('ledger rls live (A-04)', () => {
  test.skip(process.env.PHASE59_LIVE !== '1', 'set PHASE59_LIVE=1 to run the live ledger probe once')
  test.fixme(true, 'flips live in 59-02')
  test('a worker session reads 0 decision rows', () => {})
  test('a supervisor session reads 0 decision rows (no SELECT widening)', () => {})
  test('an admin session reads its own org only, never a foreign org', () => {})
  test('no authenticated role can insert, update or delete a decision row', () => {})
})
