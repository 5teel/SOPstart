/**
 * Phase 60 -- Live RLS probe (PHASE60_LIVE=1, once) (stub; Wave 0 / 60-01).
 * Requirements: D-01, D-07, D-10. Decisions: D-01, D-07, D-10. Owning plan: 60-02.
 * Each case below is a test.fixme the owning plan turns live with real assertions.
 * Registration: playwright.config.ts `phase60` project.
 */
import { test } from '@playwright/test'

test.describe("Live RLS probe (PHASE60_LIVE=1, once) (60-02)", () => {
  test.skip(process.env.PHASE60_LIVE !== '1', 'live probe: set PHASE60_LIVE=1 (shared OTP budget, run once)')
  test.fixme("self-skips unless PHASE60_LIVE=1 (shared OTP budget)", () => {})
  test.fixme("requests: a worker reads own rows and none of another worker rows", () => {})
  test.fixme("requests: supervisor and admin read the org open rows but not answered rows they did not answer", () => {})
  test.fixme("requests: no authenticated role can INSERT, UPDATE or DELETE", () => {})
  test.fixme("requests: a foreign-org admin reads zero rows", () => {})
  test.fixme("notifications: own rows only; no cross-user read", () => {})
  test.fixme("notifications: update read_at works; update title or place is refused (column privilege); no INSERT", () => {})
  test.fixme("objectives: every org member reads; no authenticated role writes; a foreign org reads zero", () => {})
  test.fixme("ledger: worker and supervisor still read zero decisions (59 A-04); the five new kinds are accepted by the check", () => {})
})
