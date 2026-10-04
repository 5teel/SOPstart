/**
 * SC-4 — Viz-as-filter deep-link: /sops?departments=<id> | ?collection=<id>.
 *
 * Contract (32-09-PLAN must_haves):
 *   - Focusing a unit in the wiring view deep-links `?departments=<id>` or
 *     `?collection=<id>`; the library list server-filters to matching SOPs
 *     with an "Open in library (N)" count.
 *   - journeys.ts + uat/tests.ts updated in the same change (D-10) so
 *     /pathways shows 0 not-mapped for the ?view=access arm.
 *
 * Flipped live in: 32-09. No chromium binary + live app + magic-link session
 * available in this environment — same Rule-3 source-contract trade-off as
 * every other 32-0x spec (32-05/06/07/08 precedent). The true browser-render
 * scenario (click a department jack, confirm URL + filtered list + count) is
 * documented below as a fixme runtime smoke with the same prerequisites list.
 *
 * Repointed in 41-08 (Phase 41, SUR-01/02/04): the deep-link surface moved
 * from admin/sops/page.tsx (now a redirect shim) to /sops.
 *
 * Repointed a second time in 54-05 (Phase 54, D-07/D-08): the Miller frame
 * and its lenses are gone. `listAdminSopRows` still owns the id resolution +
 * `.in('id', …)` filter; the filtered-count header is now AdminLibraryTable's
 * "In a collection ×" chip (`lib-chip-collection`); the departments/
 * collection-are-inert-under-access precedence moved to the pure
 * `resolveLibraryNav` in src/lib/sop-list/admin-rows.ts; and the
 * WiringPatchBay/SelectionStrip hrefs are unchanged from 41-07.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ADMIN_SOP_LIST = path.join(process.cwd(), 'src/actions/admin-sop-list.ts')
const LIBRARY_TABLE = path.join(process.cwd(), 'src/components/admin/AdminLibraryTable.tsx')
const ADMIN_ROWS = path.join(process.cwd(), 'src/lib/sop-list/admin-rows.ts')
const WIRING_PATCH_BAY_PATH = path.join(process.cwd(), 'src/components/admin/wiring/WiringPatchBay.tsx')
const SELECTION_STRIP_PATH = path.join(process.cwd(), 'src/components/admin/wiring/SelectionStrip.tsx')

test.describe('SC-4 — library filter deep-link', () => {
  test('listAdminSopRows server-filters the SOP list by ?departments=/?collection=', () => {
    const src = fs.readFileSync(ADMIN_SOP_LIST, 'utf-8')

    // id resolution through the org-scoped junction reads (T-32-09-02).
    expect(src).toContain("from('sop_departments').select('sop_id').eq('department_id', params.departments)")
    expect(src).toContain("from('sop_collections').select('sop_id').eq('collection_id', params.collection)")

    // Server-side .in('id', …) filter on the sops query.
    expect(src).toContain("query = query.in('id', filterIds.length > 0 ? filterIds : [NO_MATCH_ID])")
  })

  test('a collection deep link gets a filtered-count header with a way back (Clear filter)', () => {
    // 2026-09-29: the filtered-count control is AdminLibraryTable's own
    // "In a collection ×" chip, shown only while nav.collection is set.
    const src = fs.readFileSync(LIBRARY_TABLE, 'utf-8')
    expect(src).toContain('data-testid="lib-chip-collection"')
    expect(src).toContain('{nav.collection && (')
    expect(src).toContain("onClick={() => applyNav({ ...nav, collection: undefined })}")
  })

  test('resolveLibraryNav resolves ?view=access BEFORE any departments/collection check, dropping them entirely', () => {
    const src = fs.readFileSync(ADMIN_ROWS, 'utf-8')
    const accessIdx = src.indexOf("if (params.get('view') === 'access') {")
    const statusIdx = src.indexOf("const status = params.get('status')")
    expect(accessIdx).toBeGreaterThan(-1)
    expect(statusIdx).toBeGreaterThan(-1)
    expect(accessIdx).toBeLessThan(statusIdx)

    // The access branch's own return statement carries no departments/collection
    // key — asserted on the actual code line, not the explanatory comment
    // above it (which legitimately names both fields in prose).
    const accessReturnLine = src.split('\n').find(
      (l) => l.includes("view: 'access'") && l.includes('return')
    )
    expect(accessReturnLine).toBeDefined()
    expect(accessReturnLine).not.toContain('departments')
    expect(accessReturnLine).not.toContain('collection')
  })

  test('WiringPatchBay exposes a focus-based Open link: a department opens its place; no collection link (list retired, D-13)', () => {
    const src = fs.readFileSync(WIRING_PATCH_BAY_PATH, 'utf-8')
    expect(src).toContain('`/?place=dept:${focus}`')
    expect(src).not.toContain('`/sops?collection=${focus}`')
    expect(src).toContain('openInLibraryHref')
  })

  test('SelectionStrip renders the Open in library link when supplied', () => {
    // Rule 1: 41-07 changed this visible copy to "Open in the SOP list" (SUR-06,
    // the word "Library" survives only as a filter/scope label, never a nav
    // destination) — the href prop name (openInLibraryHref) is unchanged.
    const src = fs.readFileSync(SELECTION_STRIP_PATH, 'utf-8')
    expect(src).toContain('openInLibraryHref')
    expect(src).toContain('Open in the SOP list')
  })

  test.fixme(
    'runtime smoke — focusing a department jack navigates to the server-filtered, counted library view',
    async ({ page }) => {
      /**
       * Prerequisites (same as tests/e2e/admin-departments.spec.ts / 32-07's
       * org-chart-build.spec.ts runtime smoke): chromium binary installed,
       * `next build && next start` running locally, and an authenticated
       * magic-link session cookie for an admin user.
       *
       * Steps:
       * 1. Navigate to /sops?view=access.
       * 2. Click a department jack; confirm the SelectionStrip shows an
       *    "Open in library →" link and its href is /sops?departments=<id>.
       * 3. Follow the link; confirm the library table only shows that
       *    department's SOPs and the "In a collection ×" chip is gone
       *    (departments filters don't use that chip; only collection does).
       * 4. Repeat for a collection jack → ?collection=<id>, confirming the
       *    "In a collection ×" chip appears and clears the filter on click.
       */
      void page
      expect(true).toBe(true)
    },
  )
})
