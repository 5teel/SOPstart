/**
 * Phase 58 -- FOC-02, WRK-04 (D-01, D-04, D-17, D-20): focus-step edit actions.
 * Filled by: 58-04.
 * Registration: playwright.config.ts `phase58` project.
 */
import { test } from '@playwright/test'

test.describe("FOC-02/WRK-04 edit actions", () => {
  test.fixme("requireSopEditAccess accepts { stepId } and resolves the SOP from it (58-04)", () => {})
  test.fixme("service-role writes are filtered by the session org, never the fetched row's org (58-04)", () => {})
  test.fixme("edits are refused on published and parsing SOPs (58-04)", () => {})
  test.fixme("tick is admin-only (58-04)", () => {})
  test.fixme("clearFinding writes a ledger decision through recordDecision (D-17) (58-04)", () => {})
  test.fixme("objective is capped at 500 characters (D-20) (58-04)", () => {})
})
