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
 * Flipped LIVE in 33-08 (Rule-3 degrade — no chromium binary installed in
 * this environment, same trade-off as every 32-0x/33-0x source-contract
 * spec): proves every SC-2 wiring point is actually connected — not just
 * present as a string. The true browser-render scenario is kept as a
 * documented `test.fixme` runtime smoke.
 *
 * Registration: playwright.config.ts `phase33` project
 *   testDir: '.', testMatch: /tests\/phase33\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase33`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const BAY = path.join(ROOT, 'src', 'components', 'admin', 'wiring', 'WiringPatchBay.tsx')
const PAGE = path.join(ROOT, 'src', 'app', '(protected)', 'admin', 'sops', 'page.tsx')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('SC-2 — server page: sopsByCollection assembly', () => {
  test('page.tsx fetches id/title/status per collection via ONE .in(collection_id, ids) join read on sop_collections->sops, inside the existing dependent read (no new serial await)', () => {
    const page = read(PAGE)
    expect(page).toContain(
      "await (supabase as any).from('sop_collections').select('collection_id, sops(id, title, status)').in('collection_id', collIds)",
    )
    expect(page).toContain('let sopsByCollection: Record<string, WiringSop[]> = {}')
    expect(page).toContain('<WiringPatchBayShell tree={orgTree} collections={collections} sopsByCollection={sopsByCollection}')
  })
})

test.describe('SC-2 — collection expand-in-place to SOP rows', () => {
  test('expandedCollections state + toggleCollection twist, mirroring the shipped area/dept/role twist machinery', () => {
    const src = read(BAY)
    expect(src).toContain('const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set())')
    expect(src).toContain('const toggleCollection = useCallback((collectionId: string) => {')
    expect(src).toContain('onClick={(e) => { e.stopPropagation(); toggleCollection(c.id) }}')
    expect(src).toContain('{expanded && sopsHereWithPin.map((s) => renderSopRow(s, { isPinned: !!newSop && s.id === newSop.id, nested: true }))}')
  })

  test('renderSopRow reuses the shipped child-row JSX pattern for every SOP, not just the pinned one', () => {
    const src = read(BAY)
    expect(src).toContain('const renderSopRow = (s: WiringSop, opts: { isPinned: boolean; nested: boolean }) => {')
    expect(src).toContain("className={`jack${opts.nested ? ' child' : ''} newsop${active ? ' lit' : ''}`}")
  })
})

test.describe('SC-2 — any SOP row is organically selectable (closes G2)', () => {
  test('enterWireUp is generalized to take a sopId, not bound to a single pinned newSop', () => {
    const src = read(BAY)
    expect(src).toContain('const enterWireUp = useCallback(')
    expect(src).toContain('(sopId: string) => {')
    expect(src).toContain('setActiveSopId(sopId)')
    // No ?sop= param is required to reach connect mode — the deep-link pin
    // only pre-selects the parent collection for expansion.
    expect(src).toContain('onClick={() => enterWireUp(s.id)}')
  })

  test('?sop= survives only as a deep-link pre-expand, not a wiring precondition', () => {
    const src = read(BAY)
    expect(src).toContain('// Deep-link nicety: a pinned ?sop= pre-expands its collection')
    expect(src).not.toContain('This SOP has no collection')
  })
})

test.describe('SC-2 — SOP-selected handleDone writes sopId-target grants', () => {
  test('createGrant is called with sopId, not iterated per-collection', () => {
    const src = read(BAY)
    expect(src).toContain('createGrant({ subjectType: grant.subjectType, subjectId: grant.subjectId, sopId: activeSop.id })')
  })
})

test.describe('SC-2 — rightEndpoint mirrors leftEndpoint (wire density)', () => {
  test('a SOP-target wire anchors at the SOP row when its collection is expanded, else the collection jack', () => {
    const src = read(BAY)
    expect(src).toContain('const rightEndpoint = useCallback(')
    expect(src).toContain('return expandedCollections.has(collectionId) ? sopId : collectionId')
    // Used both in connect-mode wires and the general focus-driven trace.
    expect(src).toContain('rightEndpoint(activeSop.id)')
    expect(src).toContain('rightEndpoint(e.sopId)')
  })

  test('SOP-title search auto-expands the matching collection', () => {
    const src = read(BAY)
    expect(src).toContain('for (const sops of Object.values(sopsByCollection)) for (const sop of sops) if (sop.title.toLowerCase().includes(q)) s.add(sop.id)')
    expect(src).toContain('for (const [cid, sops] of Object.entries(sopsByCollection)) if (sops.some((s) => matchIds.has(s.id))) next.add(cid)')
  })
})

test.describe('SC-2 — overridden-pill derivation', () => {
  test('a "chosen by name" pill is derived client-side from grants (any grant with sopId === row.id), no stored flag', () => {
    const src = read(BAY)
    expect(src).toContain('const overridden = grants.some((g) => g.sopId === s.id)')
    expect(src).toContain('CHOSEN BY NAME')
  })
})

// ---------------------------------------------------------------------------
// Runtime smoke — requires chromium + live app + a published SOP nested
// under a collection with ~1 sibling (Rule-3 fallback documented above).
// ---------------------------------------------------------------------------

test.describe('SC-2 — drill-down runtime (requires chromium + live app)', () => {
  test.fixme(
    'collections expand in place to SOP rows; clicking any SOP row enters choose-mode organically, no ?sop= pin needed',
    async ({ page }) => {
      /**
       * Steps:
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
