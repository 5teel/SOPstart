/**
 * Phase 52 -- HOM-01..06. Render-seam stub for the /sops page.
 * Activated by Plan 52-04.
 *
 * Registration: playwright.config.ts `phase52` project
 *   testDir: '.', testMatch: /tests\/phase52\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase52`
 */
import { test } from '@playwright/test'

test.describe('sops/page.tsx render seam', () => {
  test.fixme('PlantHome is loaded only via next/dynamic({ ssr: false }) -- no static import', () => {})
  test.fixme('the render gate is !isAdmin && desktop viewport && the site query resolved a layout && machines.length > 0', () => {})
  test.fixme('the ["site-worker"] query has no persister -- never cached to Dexie/localStorage (T-52-02)', () => {})
  test.fixme('the toolbar search input is hidden when the plant is rendering (it becomes the ask bar inside PlantHome)', () => {})
  test.fixme('the admin branch (isAdmin ? <AdminSopSurface> ...) is untouched by this change', () => {})
})

test.describe('PlantHome wiring', () => {
  test.fixme('clicking a machine (open) calls flyTo and opens the panel', () => {})
  test.fixme('closing the panel calls fit()', () => {})
  test.fixme('clicking a department chip calls fitMachines for that department\'s bounding box', () => {})
  test.fixme('pins, the Now card, the panel list and the ask bar all derive from one shared worker-sop list', () => {})
  test.fixme('the Now card is hidden while the site query is loading, never a flash of "Nothing due"', () => {})
})
