/**
 * Phase 60 -- Answer a request (stub; Wave 0 / 60-01).
 * Requirements: RQS-02. Decisions: D-04, D-07. Owning plan: 60-04.
 * Each case below is a test.fixme the owning plan turns live with real assertions.
 * Registration: playwright.config.ts `phase60` project.
 */
import { test } from '@playwright/test'

test.describe("Answer a request (60-04)", () => {
  test.fixme("answerRequest claims the row with .eq(state, open) before any ledger or notification write", () => {})
  test.fixme("exactly one recordDecision follows the claim", () => {})
  test.fixme("decline requires a note of at least 10 characters server-side", () => {})
  test.fixme("the receipt says \"logged\" only when logged === true", () => {})
  test.fixme("a supervisor change_sop link is browse, not edit", () => {})
  test.fixme("a second answer to an answered request is refused", () => {})
})
