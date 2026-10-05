/**
 * Phase 60 -- Review-due selection (stub; Wave 0 / 60-01).
 * Requirements: NTF-02. Decisions: D-08. Owning plan: 60-08.
 * Each case below is a test.fixme the owning plan turns live with real assertions.
 * Registration: playwright.config.ts `phase60` project.
 */
import { test } from '@playwright/test'

test.describe("Review-due selection (60-08)", () => {
  test.fixme("reviewDueTargets selects only published SOPs inside the due window", () => {})
  test.fixme("only the latest version of a lineage is selected", () => {})
  test.fixme("a SOP with no owner is skipped", () => {})
  test.fixme("the due window edge is inclusive on the right, exclusive on the left", () => {})
})
