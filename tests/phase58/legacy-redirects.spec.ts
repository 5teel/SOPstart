/**
 * Phase 58 -- FOC-03: legacy address redirects live in the proxy only.
 * Filled by: 58-11 (tab addresses, legacyRedirectFor), 58-14 (builder, versions, review route).
 * Registration: playwright.config.ts `phase58` project.
 */
import { test } from '@playwright/test'

test.describe("FOC-03 legacy redirects", () => {
  test.fixme("legacyRedirectFor maps tab, builder and versions addresses to fixed destinations over a UUID-gated id (58-11)", () => {})
  test.fixme("the proxy blocks and redirects those addresses with refreshed cookies copied onto the redirect (58-11, 58-14)", () => {})
  test.fixme("the next.config review-route redirect is retargeted at the edit address (58-14)", () => {})
})
