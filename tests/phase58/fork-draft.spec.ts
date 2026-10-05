/**
 * Phase 58 -- SOP-04 (D-11, D-18): forkDraft copies the whole SOP.
 * Filled by: 58-08.
 * Registration: playwright.config.ts `phase58` project.
 */
import { test } from '@playwright/test'

test.describe("SOP-04 forkDraft", () => {
  test.fixme("census: every table referencing public.sops(id) is copied or on an explicit allow-list (D-11) (58-08)", () => {})
  test.fixme("an open draft in the lineage is reused rather than a second fork (D-18) (58-08)", () => {})
})
