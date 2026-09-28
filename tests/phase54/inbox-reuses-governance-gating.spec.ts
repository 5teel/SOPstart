/**
 * Phase 54 / Plan 54-02 -- D-03 hard constraint (APR-03/04, Phase 29/41):
 * the inbox reuses GovernanceQueueRow / approveStep gating verbatim, it does
 * not re-implement approver precedence (approve-me before unowned before
 * stale-role).
 *
 * Wave-0 stub -- activates in 54-02.
 *
 * Registration: playwright.config.ts `phase54` project
 *   testDir: '.', testMatch: /tests\/phase54\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase54`
 */
import { test } from '@playwright/test'

test.describe('inbox reuses governance gating, does not re-derive it (54-02)', () => {
  test.fixme('inbox imports GovernanceQueueRow / approveStep, no local isCallerNextApprover copy', () => {})
  test.fixme('approve-me precedence still checked before unowned before stale-role', () => {})
})
