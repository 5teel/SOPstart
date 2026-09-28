/**
 * Phase 53 -- PHN-01. Source-contract tests for the phone home layout:
 * ask bar, Now card (Walk it / Read only, no Show me), floor thumbnail,
 * Scan button, rendered below 1024px for a worker whose org has a site.
 *
 * Registration: playwright.config.ts `phase53` project
 *   testDir: '.', testMatch: /tests\/phase53\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase53`
 *
 * Static @/ imports only -- CLAUDE.md 2026-06-24.
 */
import { test } from '@playwright/test'

test.describe('PhoneHome', () => {
  test.fixme('activates 53-04: renders ask bar, NowCard without showMeAction, floor thumbnail, Scan button, in that order', async () => {})
  test.fixme('activates 53-04: NowCard renders Walk it / Read only -- no Show me button on the phone', async () => {})
  test.fixme('activates 53-04: the render seam gates on viewport === "mobile" and !isAdmin, sharing the ["site-worker"] query with PlantHome', async () => {})
  test.fixme('activates 53-04: PhoneHome and ScanSheet are loaded only via next/dynamic({ ssr: false }), never a static value import', async () => {})
})
