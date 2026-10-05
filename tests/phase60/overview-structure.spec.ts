/**
 * Phase 60 -- Overview (stub; Wave 0 / 60-01).
 * Requirements: SHL-03, NTF-01. Decisions: D-13, A-06. Owning plan: 60-15.
 * Each case below is a test.fixme the owning plan turns live with real assertions.
 * Registration: playwright.config.ts `phase60` project.
 */
import { test } from '@playwright/test'

test.describe("Overview (60-15)", () => {
  test.fixme("SiteOverview renders counts card, objectives, notifications, my requests in that order", () => {})
  test.fixme("each section hides when empty", () => {})
  test.fixme("the admin Office line reads \"Open requests in the Office - N\"", () => {})
  test.fixme("SiteOverview is lazy with a forbidden marker, and /page carries it", () => {})
  test.fixme("overview-focus opens a place by select() or a Link, never router.push after a server action", () => {})
})
