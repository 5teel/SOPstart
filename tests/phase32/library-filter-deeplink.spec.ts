/**
 * SC-4 — Viz-as-filter deep-link: /admin/sops?departments=<id> | ?collection=<id>.
 *
 * Contract (32-09-PLAN must_haves):
 *   - `src/app/(protected)/admin/sops/page.tsx` — focusing a unit in the
 *     wiring view deep-links `?departments=<id>` or `?collection=<id>`; the
 *     library list server-filters to matching SOPs with an
 *     "Open in library (N)" count.
 *   - journeys.ts + uat/tests.ts updated in the same change (D-10) so
 *     /pathways shows 0 not-mapped for the ?view=access arm.
 *
 * Flipped live in: 32-09. No chromium binary + live app + magic-link session
 * available in this environment — same Rule-3 source-contract trade-off as
 * every other 32-0x spec (32-05/06/07/08 precedent). The true browser-render
 * scenario (click a department jack, confirm URL + filtered list + count) is
 * documented below as a fixme runtime smoke with the same prerequisites list.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const PAGE_PATH = path.join(process.cwd(), 'src/app/(protected)/admin/sops/page.tsx')
const WIRING_PATCH_BAY_PATH = path.join(process.cwd(), 'src/components/admin/wiring/WiringPatchBay.tsx')
const SELECTION_STRIP_PATH = path.join(process.cwd(), 'src/components/admin/wiring/SelectionStrip.tsx')

test.describe('SC-4 — library filter deep-link', () => {
  test('page.tsx server-filters the SOP list by ?departments=/?collection= and renders an Open in library (N) header', () => {
    const src = fs.readFileSync(PAGE_PATH, 'utf-8')

    // ?view=access arm renders the wiring surface.
    expect(src).toContain("const isAccessView = params.view === 'access'")
    expect(src).toContain('WiringPatchBayShell')

    // Deep-link params only apply outside the access view.
    expect(src).toContain('const departmentFilter = !isAccessView ? params.departments : undefined')
    expect(src).toContain('const collectionFilter = !isAccessView ? params.collection : undefined')

    // id resolution through the org-scoped junction reads (T-32-09-02).
    expect(src).toContain("from('sop_departments').select('sop_id').eq('department_id', departmentFilter)")
    expect(src).toContain("from('sop_collections').select('sop_id').eq('collection_id', collectionFilter)")

    // Server-side .in('id', …) filter on the sops query.
    expect(src).toContain("query = query.in('id', filterIds.length > 0 ? filterIds : [NO_MATCH_ID])")

    // "Open in library (N)" filtered-count header.
    expect(src).toContain('Open in library (')
    expect(src).toContain('Clear filter')
  })

  test('WiringPatchBay exposes a focus-based Open in library deep-link to /admin/sops?departments=/?collection=', () => {
    const src = fs.readFileSync(WIRING_PATCH_BAY_PATH, 'utf-8')
    expect(src).toContain('`/admin/sops?departments=${focus}`')
    expect(src).toContain('`/admin/sops?collection=${focus}`')
    expect(src).toContain('openInLibraryHref')
  })

  test('SelectionStrip renders the Open in library link when supplied', () => {
    const src = fs.readFileSync(SELECTION_STRIP_PATH, 'utf-8')
    expect(src).toContain('openInLibraryHref')
    expect(src).toContain('Open in library')
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
       * 1. Navigate to /admin/sops?view=access.
       * 2. Click a department jack; confirm the SelectionStrip shows an
       *    "Open in library →" link and its href is /admin/sops?departments=<id>.
       * 3. Follow the link; confirm the library list only shows that
       *    department's SOPs and the header reads "Open in library (N)".
       * 4. Repeat for a collection jack → ?collection=<id>.
       */
      void page
      expect(true).toBe(true)
    },
  )
})
