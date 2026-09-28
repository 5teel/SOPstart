/**
 * Phase 52 -- HOM-05. Ask bar stub for PlantAskBar.
 * Activated by Plan 52-03.
 *
 * Registration: playwright.config.ts `phase52` project
 *   testDir: '.', testMatch: /tests\/phase52\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase52`
 */
import { test } from '@playwright/test'

test.describe('PlantAskBar', () => {
  test.fixme('the input onChange wires directly to the one query state, no router.push (2026-05-13)', () => {})
  test.fixme('the mic button opens WalkthroughVoiceModal via next/dynamic({ ssr: false }), scoped to voiceSopId', () => {})
  test.fixme('the voice modal chunk is reached only through next/dynamic -- no static import of WalkthroughVoiceModal in this file', () => {})
})
