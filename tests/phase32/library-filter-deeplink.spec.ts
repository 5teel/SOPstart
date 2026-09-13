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
 * from admin/sops/page.tsx (now a redirect shim) to /sops. Server-side id
 * resolution + the `.in('id', …)` filter moved to `listAdminSopRows`
 * (src/actions/admin-sop-list.ts); the "Open in library (N)" header moved
 * to AdminStatusLens.tsx; the departments/collection-are-inert-under-access
 * precedence moved to AdminSopSurface.tsx's `resolveAdminScope`; and the
 * WiringPatchBay/SelectionStrip hrefs were repointed to `/sops?...` in 41-07.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ADMIN_SOP_LIST = path.join(process.cwd(), 'src/actions/admin-sop-list.ts')
const ADMIN_STATUS_LENS = path.join(process.cwd(), 'src/components/sop/lenses/AdminStatusLens.tsx')
const ADMIN_SURFACE = path.join(process.cwd(), 'src/components/sop/AdminSopSurface.tsx')
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

  test('AdminStatusLens renders the Open in library (N) filtered-count header', () => {
    const src = fs.readFileSync(ADMIN_STATUS_LENS, 'utf-8')
    expect(src).toContain('Open in library (')
    expect(src).toContain('Clear filter')
  })

  test('AdminSopSurface resolves ?view=access BEFORE any departments/collection check, dropping them entirely (isAccessView precedence)', () => {
    const src = fs.readFileSync(ADMIN_SURFACE, 'utf-8')
    const accessIdx = src.indexOf("if (view === 'access') {")
    const deptCollIdx = src.indexOf('if (departments || collection) {')
    expect(accessIdx).toBeGreaterThan(-1)
    expect(deptCollIdx).toBeGreaterThan(-1)
    expect(accessIdx).toBeLessThan(deptCollIdx)

    // The access branch's own return statement carries no departments/collection
    // key — asserted on the actual code line, not the explanatory comment above
    // it (which legitimately names both fields in prose).
    const accessReturnLine = src.split('\n').find(
      (l) => l.includes("scope: 'admin-access'") && l.includes('return')
    )
    expect(accessReturnLine).toBeDefined()
    expect(accessReturnLine).not.toContain('departments')
    expect(accessReturnLine).not.toContain('collection')
  })

  test('WiringPatchBay exposes a focus-based Open in library deep-link to /sops?departments=/?collection=', () => {
    const src = fs.readFileSync(WIRING_PATCH_BAY_PATH, 'utf-8')
    expect(src).toContain('`/sops?departments=${focus}`')
    expect(src).toContain('`/sops?collection=${focus}`')
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
       * 3. Follow the link; confirm the library list only shows that
       *    department's SOPs and the header reads "Open in library (N)".
       * 4. Repeat for a collection jack → ?collection=<id>.
       */
      void page
      expect(true).toBe(true)
    },
  )
})
