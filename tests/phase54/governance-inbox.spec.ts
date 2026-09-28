/**
 * Phase 54 / Plan 54-02 -- ADM-01 `/governance` inbox contracts (severity
 * ordering, row derivation from listGovernanceQueue + parse_jobs + machines
 * without procedures, filter chips, "All clear" empty state).
 *
 * Wave-0 stub -- activates in 54-02. See 54-VALIDATION.md for the full
 * contract list this file will cover.
 *
 * Registration: playwright.config.ts `phase54` project
 *   testDir: '.', testMatch: /tests\/phase54\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase54`
 */
import { test } from '@playwright/test'

test.describe('governance inbox (54-02)', () => {
  test.fixme('unowned row -> red dot, Assign owner action', () => {})
  test.fixme('overdue row -> amber dot, Review action -> builder', () => {})
  test.fixme('awaiting-approval row -> blue dot, Approve action reuses approveStep gating', () => {})
  test.fixme('stuck/failed parse row -> grey dot, Retry action -> builder parse-state panel', () => {})
  test.fixme('machine with no procedures row -> Add action, machine preselected', () => {})
  test.fixme('filter chips: All / No owner / Overdue / Approve / Stuck / Machines counts match rows', () => {})
  test.fixme('empty inbox renders the "All clear" state, not an apology copy', () => {})
})
