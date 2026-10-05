/**
 * Phase 60 -- Notification places and kinds (stub; Wave 0 / 60-01).
 * Requirements: NTF-01, NTF-02. Decisions: D-08. Owning plan: 60-03.
 * Each case below is a test.fixme the owning plan turns live with real assertions.
 * Registration: playwright.config.ts `phase60` project.
 */
import { test } from '@playwright/test'

test.describe("Notification places and kinds (60-03)", () => {
  test.fixme("NOTIFICATION_KINDS is a closed list with a words entry each; notificationTitle is built from the kind", () => {})
  test.fixme("dedupeKey is stable for the same subject and differs across subjects", () => {})
  test.fixme("notificationPlace only emits safe in-app paths; isSafePlace refuses absolute URLs, protocol-relative paths and the legacy assign address", () => {})
  test.fixme("every kind maps to a place the shell can open (select() or Link)", () => {})
})
