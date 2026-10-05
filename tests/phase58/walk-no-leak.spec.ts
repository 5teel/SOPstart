/**
 * Phase 58 -- FOC-04 (CLAUDE.md 2026-10-03): second-walk state does not leak.
 * Filled by: 58-11.
 * Registration: playwright.config.ts `phase58` project.
 */
import { test } from '@playwright/test'

test.describe("FOC-04 walk no-leak", () => {
  test.fixme("photo list and walk state are keyed to walk.id and reset when it changes (58-11)", () => {})
  test.fixme("a second walk after Send starts clean and its submit passes the photo path check (58-11)", () => {})
})
