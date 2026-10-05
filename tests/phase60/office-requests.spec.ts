/**
 * Phase 60 -- Office Requests (stub; Wave 0 / 60-01).
 * Requirements: RQS-02, RQS-04. Decisions: D-03, D-05. Owning plan: 60-05 (data and pin), 60-11 (tab).
 * Each case below is a test.fixme the owning plan turns live with real assertions.
 * Registration: playwright.config.ts `phase60` project.
 */
import { test } from '@playwright/test'

test.describe("Office Requests (60-05 (data and pin), 60-11 (tab))", () => {
  test.fixme("listOpenRequests feeds OfficeInbox.requests", () => {})
  test.fixme("the Office pin equals inbox plus open requests in getAdminShell, WorkerShell and InboxTab", () => {})
  test.fixme("the Machines inbox kind is gone and agent requests show with the agent chip", () => {})
  test.fixme("the Requests tab shows for supervisor, admin and safety manager (tabsForRole)", () => {})
  test.fixme("RequestRow shows the asker, kind and note, and Accept and Decline", () => {})
  test.fixme("the Decisions tab shows an about-line for request rows", () => {})
})
