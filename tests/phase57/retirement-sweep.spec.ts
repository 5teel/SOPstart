/**
 * Phase 57 -- retirement sweep (stub; Wave 0 / 57-01).
 * Filled by: 57-06, 57-07, 57-08, 57-09. Negative assertions that quote a
 * retired literal live here (the repoint inventory walk excludes this folder).
 * Registration: playwright.config.ts `phase57` project.
 */
import { test } from '@playwright/test'

test.describe('retire sweep', () => {
  test.fixme('header, dashboard route and roleHome are retired; auth actions never redirect to the dashboard [57-06]', () => {})
  test.fixme('departments and site pages are redirects to edit mode; access bridge exists [57-07]', () => {})
  test.fixme('list page and plant home are gone; proxy redirects the list and attention views [57-08]', () => {})
  test.fixme('library table and its helpers are gone; dropped-features entries are live [57-09]', () => {})
})
