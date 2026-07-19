/**
 * SC-5 — Wire-up mode: connect mode + people blast-radius + createGrant on Done.
 *
 * Flipped live in 32-08 (Rule-3 degrade — no chromium binary installed in
 * this environment, see tests/phase32/org-chart-build.spec.ts precedent from
 * 32-07): source-contract assertions prove connect mode, live wire toggling,
 * the PEOPLE blast-radius derivation, and the createGrant write-on-Done are
 * all actually wired together — not just present as strings. The
 * post-publish "Wire up access" CTA (PublishStage.tsx) and the true
 * end-to-end publish->wire-up->library flow are 32-09 scope (this plan ships
 * the WiringPatchBay component layer only) and are kept as documented
 * `test.fixme` items.
 *
 * Contract (32-08-PLAN must_haves):
 *   - A NEW·UNWIRED SOP enters connect mode in WiringPatchBay; each toggle
 *     draws/removes a live wire; a blast-radius banner counts PEOPLE
 *     (not units) affected.
 *   - ✓ Done writes grants via `src/actions/grants.ts` `createGrant` (D-12,
 *     permission CREATION — the surface's most important job).
 *
 * Registration: playwright.config.ts `phase32` project
 *   testDir: '.', testMatch: /tests\/phase32\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase32`
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

test.describe('SC-5 — connect mode source contract', () => {
  test('clicking ANY SOP row (pinned or drilled-down) toggles connect mode — generalized 33-08', () => {
    const src = read(BAY)
    // 33-09: jargon sweep — the pinned NEW pill drops "UNWIRED"; plain
    // "NEW" (default) / "CHOSEN BY NAME" (overridden) pills only.
    expect(src).toContain("opts.isPinned && !overridden && <span className=\"newpill mono\">NEW</span>")
    // 33-08: enterWireUp generalizes from "the one pinned newSop" to "the
    // selected SOP" — it now takes a sopId and every SOP row's onClick calls it.
    expect(src).toContain('const enterWireUp = useCallback(')
    expect(src).toContain('setConnecting((c) => (c && activeSopId === sopId ? false : true))')
    expect(src).toContain('onClick={() => enterWireUp(s.id)}')
  })

  test('while connecting, clicking a left-side org unit toggles a pending grant (draws/removes a live wire)', () => {
    const src = read(BAY)
    expect(src).toContain('const handleLeftClick = useCallback')
    expect(src).toContain('if (connecting) {')
    expect(src).toContain('setPending((prev) => {')
    expect(src).toContain('if (next.has(id)) next.delete(id)')
  })

  test('pending grants render as live wires to the active SOP (org/area/dept endpoint -> rightEndpoint(activeSop.id))', () => {
    const src = read(BAY)
    expect(src).toContain('if (connecting && activeSop) {')
    expect(src).toContain("add(leftEndpoint(unitId), rightEndpoint(activeSop.id), grant.subjectType === 'person')")
  })
})

test.describe('SC-5 — PEOPLE blast-radius source contract', () => {
  test('blast radius is a distinct-people union across pending grants, not a unit/SOP count', () => {
    const src = read(BAY)
    expect(src).toContain('const blastRadiusPeople = useMemo')
    expect(src).toContain('for (const [unitId] of pending) for (const pid of peopleIndex.get(unitId) ?? []) s.add(pid)')
    expect(src).toContain('return s.size')
  })

  test('SelectionStrip in wiring state receives the PEOPLE count and pending grant count', () => {
    const src = read(BAY)
    expect(src).toContain('state={stripState}')
    expect(src).toContain('peopleCount={connecting ? blastRadiusPeople : focusPeopleCount}')
    // WR-05: a focused collection counts DISTINCT SOURCE GRANTS, not derived edges.
    expect(src).toContain('grantCount={connecting ? pending.size : focusGrantCount}')
    expect(src).toContain('if (collectionById.has(focus)) return grants.filter((g) => g.collectionId === focus).length')
  })
})

test.describe('SC-5 — ✓ Done writes grants via createGrant', () => {
  test('imports createGrant from src/actions/grants.ts', () => {
    const src = read(BAY)
    expect(src).toContain("from '@/actions/grants'")
    expect(src).toContain('createGrant(')
  })

  test('Done grants the SOP by sopId — never a collection id masquerading as one (CR-01 guard, evolved 33-08 SC-3)', () => {
    const src = read(BAY)
    expect(src).toContain('const handleDone = useCallback(async () => {')
    expect(src).toContain('for (const grant of pending.values()) {')
    // 33-05's SOP-target arm: createGrant XORs collectionId/sopId — a SOP
    // selection writes sopId (collectionId omitted/null), never the old
    // per-collection loop this guard used to require (CR-01 era).
    expect(src).not.toContain('for (const collectionId of newSop.collectionIds)')
    expect(src).toContain('createGrant({ subjectType: grant.subjectType, subjectId: grant.subjectId, sopId: activeSop.id })')
  })

  test('a createGrant failure surfaces to the UI, aborts, and keeps pending — never console-swallowed success (CR-01)', () => {
    const src = read(BAY)
    const doneBody = src.match(/const handleDone = useCallback\(async \(\) => \{([\s\S]*?)\n  \}, \[/)?.[1] ?? ''
    expect(doneBody).toContain('setSaveError(result.error)')
    expect(doneBody).toContain('return')
    // Success-path cleanup must come AFTER the error return, inside the same body.
    expect(doneBody.indexOf('setSaveError(result.error)')).toBeLessThan(doneBody.indexOf('onWireUpComplete?.()'))
    expect(doneBody).not.toContain('console.error')
    // The error is rendered, not just stored.
    expect(src).toContain('{saveError && (')
  })

  test('the page resolves the pinned SOP\'s collections server-side via ensureSopCollections (CR-02 runtime path)', () => {
    const page = read(PAGE)
    expect(page).toContain('ensureSopCollections(params.sop)')
    expect(page).toContain('collectionIds: ensuredCollectionIds')
  })

  test('Done is wired to the SelectionStrip onDone prop and clears pending state on completion', () => {
    const src = read(BAY)
    expect(src).toContain('onDone={() => void handleDone()}')
    expect(src).toContain('setPending(new Map())')
    expect(src).toContain('onWireUpComplete?.()')
  })
})

// ---------------------------------------------------------------------------
// Runtime smoke — requires chromium + live app + a published NEW SOP
// (Rule-3 fallback documented above). The post-publish "Choose who sees it"
// CTA (PublishStage.tsx -> ?view=access&sop=<id>) is 32-09/33-09 scope.
// ---------------------------------------------------------------------------

test.describe('SC-5 — wire-up mode runtime (requires chromium + live app, 32-09 page arm)', () => {
  test.fixme(
    'connect mode toggles live wires, blast-radius counts people, Done writes grants via createGrant',
    async ({ page }) => {
      await page.goto('/admin/sops?view=access')
      await page.locator('.jack.newsop').click()
      await expect(page.locator('.strip-slot.wiring')).toBeVisible()
      await page.locator('.col.left .jack').first().click()
      await expect(page.locator('.bay-svg path')).toHaveCount(1)
      await expect(page.locator('.strip-slot.wiring')).toContainText('people')
      await page.getByRole('button', { name: '✓ Save — done' }).click()
      // UAT G2 fix: after Done (and on any later reload) the pinned SOP reads
      // its state from saved grants — CHOSEN BY NAME, never back to NEW.
      await expect(page.locator('.jack.newsop .newpill')).toHaveText('CHOSEN BY NAME')
    },
  )

  test('pinned SOP reflects SAVED grants and nests under its collection (UAT G2 fix, generalized 33-08)', () => {
    const src = read(BAY)
    // Saved-state source of truth is the grants prop (SOP-target grants,
    // sopId === activeSopId), not in-session pending toggles.
    expect(src).toContain('const activeSopExistingGrants = useMemo')
    expect(src).toContain('grants.filter((g) => g.sopId === activeSopId)')
    // 33-09: Badge: "CHOSEN BY NAME" when saved grants exist; plain "NEW" only when truly unset
    expect(src).toContain('{overridden && <span className="newpill mono">CHOSEN BY NAME</span>}')
    // Entering wire-up draws the saved wires alongside pending toggles
    expect(src).toContain('for (const g of activeSopExistingGrants) {')
    // Hierarchy: every SOP row (pinned or drilled-down) renders as a child
    // of its collection jack via the generalized renderSopRow.
    expect(src).toContain('const renderSopRow = (s: WiringSop, opts: { isPinned: boolean; nested: boolean }) => {')
    expect(src).toContain("className={`jack${opts.nested ? ' child' : ''} newsop")
  })

  test.fixme(
    'PublishStage shows a "Choose who sees it" CTA linking to ?view=access&sop=<id> pinned NEW (32-09/33-09)',
    async ({ page }) => {
      void page
    },
  )
})
