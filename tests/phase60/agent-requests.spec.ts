/**
 * Phase 60 -- Agent requests (stub; Wave 0 / 60-01).
 * Requirements: RQS-04. Decisions: D-05. Owning plan: 60-04 (helper), 60-08 (producer).
 * Each case below is a test.fixme the owning plan turns live with real assertions.
 * Registration: playwright.config.ts `phase60` project.
 */
import { test } from '@playwright/test'

test.describe("Agent requests (60-04 (helper), 60-08 (producer))", () => {
  test.fixme("raiseRequestAsAgent lives in a plain module, not a use-server file", () => {})
  test.fixme("it names an allowlisted agent and the ledger row carries it", () => {})
  test.fixme("a partial unique index makes a second raise for the same machine idempotent", () => {})
  test.fixme("a declined request is not re-raised by the next sweep", () => {})
})
