/**
 * Phase 60 -- Cron routes (stub; Wave 0 / 60-01).
 * Requirements: RQS-04, NTF-02. Decisions: A-08. Owning plan: 60-08.
 * Each case below is a test.fixme the owning plan turns live with real assertions.
 * Registration: playwright.config.ts `phase60` project.
 */
import { test } from '@playwright/test'

test.describe("Cron routes (60-08)", () => {
  test.fixme("isCronAuthorized is fail-closed when CRON_SECRET is unset", () => {})
  test.fixme("the bearer compare is timing-safe", () => {})
  test.fixme("/api/cron/review-due and /api/cron/machines-without-sops are exempted by exact path in the proxy (CRON_PATHS)", () => {})
  test.fixme("the sweeps live in src/lib/cron/sweeps.ts, not in the route files", () => {})
})
