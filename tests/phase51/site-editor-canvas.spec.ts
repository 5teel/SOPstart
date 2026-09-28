/**
 * Phase 51 -- SIT-02/SIT-03. Source-contract assertions for the Konva
 * site editor canvas (`src/components/admin/site/SiteEditor.tsx`).
 *
 * Wave-0 stub. Activated by Plan 51-04.
 *
 * Registration: playwright.config.ts `phase51` project
 *   testDir: '.', testMatch: /tests\/phase51\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase51`
 */
import { test } from '@playwright/test'

test.describe('scene', () => {
  // activated by plan 51-04
  test.fixme('scene renders at natural width/height inside a world Group transformed by view {x,y,s}', () => {})

  // activated by plan 51-04
  test.fixme('fit() re-runs on a ResizeObserver of the container, not just on mount (Pitfall 5)', () => {})

  // activated by plan 51-04
  test.fixme('wheel zoom is zoom-to-cursor and clamps scale to [min, max] (uses scene.ts zoomAt)', () => {})

  // activated by plan 51-04
  test.fixme('dragging empty canvas pans the stage; dragging a machine does not pan', () => {})
})

test.describe('drawing', () => {
  // activated by plan 51-04
  test.fixme('vertices are placed via layer.getRelativePointerPosition() (scene-px, transform-aware)', () => {})

  // activated by plan 51-04
  test.fixme('Draw mode closes the polygon on first-vertex click or double-click', () => {})

  // activated by plan 51-04
  test.fixme('dragging a vertex commits a scene-px point clamped via clampPoint()', () => {})

  // activated by plan 51-04
  test.fixme('Delete key and a delete button both remove the selected machine', () => {})
})
