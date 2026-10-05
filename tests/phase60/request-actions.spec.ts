/**
 * Phase 60 -- Raise and withdraw (stub; Wave 0 / 60-01).
 * Requirements: RQS-01. Decisions: D-01, D-03. Owning plan: 60-04.
 * Each case below is a test.fixme the owning plan turns live with real assertions.
 * Registration: playwright.config.ts `phase60` project.
 */
import { test } from '@playwright/test'

test.describe("Raise and withdraw (60-04)", () => {
  test.fixme("raiseRequest uses a strict zod schema with no organisation, user or agent field", () => {})
  test.fixme("organisation and actor come from the session, never the input", () => {})
  test.fixme("insertRequest is a plain core module and withdrawOwnRequest filters on the asker and state open", () => {})
  test.fixme("raiseRequest writes the request then notifies inside try/catch, never the other way round", () => {})
  test.fixme("src/actions/requests.ts exports only async functions", () => {})
})
