/**
 * SC-2 — Collections expand in place to their SOPs; any SOP is organically
 * selectable — no pinned `?sop=` URL required (closes G2).
 *
 * Contract (33-08-PLAN must_haves, RESEARCH Pattern 4):
 *   - Server page (`.../admin/sops/page.tsx` access-view assembly) fetches
 *     `id, title, status` per collection via one `.in('collection_id', ids)`
 *     join read and passes `sopsByCollection` down.
 *   - `WiringPatchBay.tsx` grows `expandedCollections: Set<string>`; SOP rows
 *     render nested under their collection (reuse the shipped pinned-SOP
 *     nesting JSX pattern from d3fc9f5).
 *   - Clicking ANY SOP row enters choose-mode — `enterWireUp` generalizes
 *     from "the one pinned newSop" to "the selected SOP".
 *   - A `rightEndpoint` mirrors `leftEndpoint`: a SOP-target wire anchors at
 *     the SOP row when its collection is expanded, else at the collection
 *     jack (aggregated count badge).
 *   - Overridden SOPs (any SOP-target grant exists) render a "chosen by
 *     name" row pill.
 *
 * Flipped LIVE in: 33-08 (files_modified: tests/phase33/sop-drilldown.spec.ts)
 * — this Wave-0 version is a placeholder test.fixme ONLY until 33-08 lands;
 * do not treat it as done once 33-08 ships without confirming the fixme was
 * removed.
 *
 * Registration: playwright.config.ts `phase33` project
 *   testDir: '.', testMatch: /tests\/phase33\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase33`
 */
import { test, expect } from '@playwright/test'

test.describe('SC-2 — collection-to-SOP drill-down (Wave 0 stub — flips live in 33-08)', () => {
  test.fixme(
    'collections expand in place to SOP rows; clicking any SOP row enters choose-mode organically, no ?sop= pin needed',
    async ({ page }) => {
      /**
       * Real path constant this will assert against once built:
       *   - src/components/admin/wiring/WiringPatchBay.tsx
       *     (expandedCollections state, rightEndpoint, generalized enterWireUp)
       *   - src/app/(protected)/admin/sops/page.tsx (sopsByCollection fetch)
       *
       * Steps (once flipped live):
       * 1. Navigate to /admin/sops?view=access (no ?sop= param).
       * 2. Click a collection row; confirm its SOP rows render nested
       *    beneath it (title + status).
       * 3. Click any nested SOP row; confirm it enters choose-mode
       *    identically to the old pinned-newSop flow.
       * 4. Confirm an overridden SOP (has a SOP-target grant) renders a
       *    "chosen by name" pill.
       * 5. Collapse the collection; confirm the SOP-target wire re-anchors
       *    at the collection jack with its aggregated count badge.
       */
      void page
      expect(true).toBe(true)
    },
  )
})
