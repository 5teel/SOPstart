/**
 * Phase 60 -- Ask someone to do a SOP (stub; Wave 0 / 60-01).
 * Requirements: RQS-03. Decisions: D-02, A-03, A-05. Owning plan: 60-06.
 * Each case below is a test.fixme the owning plan turns live with real assertions.
 * Registration: playwright.config.ts `phase60` project.
 */
import { test } from '@playwright/test'

test.describe("Ask someone to do a SOP (60-06)", () => {
  test.fixme("the core writes sop_assignments with an explicit organisation filter", () => {})
  test.fixme("a role ask writes one dynamic role row; a person ask writes an individual row", () => {})
  test.fixme("a 23505 conflict reassigns assigned_by rather than failing", () => {})
  test.fixme("a supervisor may ask (A-04)", () => {})
  test.fixme("an auto-accepted ask writes ONE request_accepted ledger row at raise time and none for the raise (A-05)", () => {})
  test.fixme("decline is person-targeted only and resolves the SOP lineage (A-03)", () => {})
  test.fixme("worker-signal and the assignment half of useWorkerSops are unchanged since the phase began (git diff empty)", () => {})
})
