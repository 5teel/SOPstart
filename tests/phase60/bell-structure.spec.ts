/**
 * Phase 60 -- Notification bell (stub; Wave 0 / 60-01).
 * Requirements: NTF-01. Decisions: D-09, A-06. Owning plan: 60-16.
 * Each case below is a test.fixme the owning plan turns live with real assertions.
 * Registration: playwright.config.ts `phase60` project.
 */
import { test } from '@playwright/test'

test.describe("Notification bell (60-16)", () => {
  test.fixme("ShellFrame takes a renderBell slot and holds no router", () => {})
  test.fixme("the count is hidden at zero", () => {})
  test.fixme("reads, the unread count and mark-read use the browser Supabase client under RLS, never a server action (A-06)", () => {})
  test.fixme("NotificationBell mounts in both shells under SiteSummary", () => {})
  test.fixme("the worker Office card copy no longer promises a later update", () => {})
})
