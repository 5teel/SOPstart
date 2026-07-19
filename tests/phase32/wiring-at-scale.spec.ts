/**
 * SC-3 — WiringPatchBay grouped/focus survives ~15×20 (org-units × collections) scale.
 *
 * Flipped live in 32-08 (Rule-3 degrade — no chromium binary installed in this
 * environment, see tests/phase32/org-chart-build.spec.ts precedent from
 * 32-07): source-contract assertions prove every SC-3 wiring point is
 * actually connected (grouping, quiet-by-default guard, the shared
 * resolveEffectiveAccess trace, direct=solid/personal=dashed wire styling,
 * count badges) — not just present as a string. The true render-at-scale
 * proof is kept as a documented `test.fixme` runtime smoke.
 *
 * Contract (32-08-PLAN must_haves):
 *   - `src/components/admin/wiring/WiringPatchBay.tsx` renders grouped
 *     org-units × collections with expand-in-place, quiet-by-default focus
 *     (no wires drawn until search/click), and count badges — must not
 *     degrade at Visy-scale (~15 org-units × ~20 collections).
 *   - Clicking a unit traces its access via the shared resolveEffectiveAccess
 *     (lit/dim states; direct=solid wire, personal=dashed wire).
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

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('SC-3 — WiringPatchBay grouped structure source contract', () => {
  test('areas group departments with expand-in-place and a dept-count badge when collapsed', () => {
    const src = read(BAY)
    expect(src).toContain('toggleArea')
    expect(src).toContain('expandedAreas')
    expect(src).toContain('area.departments.length} depts')
    expect(src).toContain('expanded && area.departments.map')
  })

  test('a collapsed area redirects its departments\' wires to the area jack (leftEndpoint collapse, generalized 33-06 to nearest-collapsed-ancestor)', () => {
    const src = read(BAY)
    expect(src).toContain('const leftEndpoint = useCallback(')
    expect(src).toContain('if (isCollapsed(link)) return link.unitId')
    // 33-06: the generalization covers all three collapsible tiers, not just area.
    expect(src).toContain("if (link.subjectType === 'area') return !expandedAreas.has(link.unitId)")
    expect(src).toContain("if (link.subjectType === 'department') return !expandedDepts.has(link.unitId)")
    expect(src).toContain("if (link.subjectType === 'role') return !expandedRoles.has(link.unitId)")
  })

  test('every rendered jack shows a count/meta badge (people, SOPs, or depts)', () => {
    const src = read(BAY)
    expect(src).toContain('people</span>')
    expect(src).toContain('{deptPeopleIds(dept).length}p')
    expect(src).toContain('{c.sopCount} SOPs')
  })
})

test.describe('SC-3 — quiet-by-default focus source contract', () => {
  test('zero wires render until connect mode or a focus click (the guard is explicit, not implicit)', () => {
    const src = read(BAY)
    expect(src).toContain('if (connecting) return []')
    expect(src).toContain('if (!focus) return []')
  })

  test('focusing lits the selected unit + its wire endpoints and dims everything else (no always-on wires)', () => {
    const src = read(BAY)
    expect(src).toContain('const litIds = useMemo')
    expect(src).toMatch(/dim = !connecting && !!focus && !litIds\.has/)
  })
})

test.describe('SC-3 — trace via the shared resolver source contract', () => {
  test('imports resolveEffectiveAccess (the ONE resolver, RESEARCH Pattern 2) — no per-view recompute', () => {
    const src = read(BAY)
    expect(src).toContain("from '@/lib/org-model/resolve-access'")
    expect(src).toContain('resolveEffectiveAccess(chain, grantsByUnit)')
  })

  test('direct/inherited access draws a solid wire; personal (D-13) access draws a dashed wire', () => {
    const src = read(BAY)
    expect(src).toContain('access.personal) if (collectionById.has(c)) edges.push({ unitId, collectionId: c, personal: true })')
    expect(src).toContain("path.setAttribute('stroke', w.dashed ? 'var(--accent-decision)' : 'var(--accent-ok)')")
    expect(src).toContain("if (w.dashed) path.setAttribute('stroke-dasharray', '5 4')")
  })
})

test.describe('SC-3 — D-11 additive-only (no in-place inherited-revoke) source contract', () => {
  test('the component never imports or calls revokeGrant — revoke routes to source, not this view', () => {
    const src = read(BAY)
    expect(src).not.toContain('revokeGrant')
    expect(src).toContain('D-11')
  })
})

// ---------------------------------------------------------------------------
// Runtime smoke — requires chromium + live app + a Visy-scale fixture
// (Rule-3 fallback documented above). Prerequisites:
//   1. `npx playwright install chromium`
//   2. Seed ~15 depts (5 areas) × ~20 collections + 34 grants
//   3. App running with admin magic-link session (CLAUDE.md 2026-04-24)
// ---------------------------------------------------------------------------

test.describe('SC-3 — wiring at scale runtime (requires chromium + live app)', () => {
  test.fixme(
    'WiringPatchBay renders grouped/focused at 15 org-units × 20 collections with no wires until interaction',
    async ({ page }) => {
      await page.goto('/admin/sops?view=access')
      await expect(page.locator('.bay-svg path')).toHaveCount(0)
      await page.locator('.jack.group-jack').first().click()
      await expect(page.locator('.bay-svg path').first()).toBeVisible()
      const litCount = await page.locator('.jack.lit').count()
      expect(litCount).toBeGreaterThan(0)
    },
  )
})
