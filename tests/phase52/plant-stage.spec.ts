/**
 * Phase 52 -- HOM-01. Camera + scene render stub for PlantStage.
 * Activated by Plan 52-02.
 *
 * Registration: playwright.config.ts `phase52` project
 *   testDir: '.', testMatch: /tests\/phase52\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase52`
 */
import { test } from '@playwright/test'

test.describe('camera maths (src/lib/site/scene.ts)', () => {
  test.fixme('exports the camera constants: fit 1.02, zoom clamp 0.35/2.4, panel offset 380, fly-to scale 1.5, chip fit clamp 1.6, transition 350ms', () => {})
  test.fixme('flyToView targets (W - 380) / 2 so the 380px panel never covers the clicked machine', () => {})
  test.fixme('fitBoxView clamps to min((W-80)/bw, (H-120)/bh, 1.6) for a department chip bounding box', () => {})
  test.fixme('zoneColour falls back to the Forming/General/Engineering triple when a department has no colour set', () => {})
})

test.describe('PlantStage wiring', () => {
  test.fixme('re-measures fit via a ResizeObserver so a stage built while hidden (0x0) recovers on next paint', () => {})
  test.fixme('wheel listener is registered non-passive and calls zoomAt on wheel', () => {})
  test.fixme('a drag that starts on a machine polygon is ignored by the pan handler', () => {})
  test.fixme('the scene <img> has loading="lazy" and decoding="async"', () => {})
  test.fixme('no window/navigator read occurs during the first render (2026-06-08 hydration class)', () => {})
})
