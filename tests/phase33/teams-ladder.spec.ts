/**
 * SC-1 — Teams column shows the full org ladder (site → area → department →
 * role → person) as expandable, selectable tiers, mirroring OrgTree.
 *
 * Contract (33-06-PLAN must_haves, RESEARCH Pattern 3):
 *   - `src/components/admin/wiring/WiringPatchBay.tsx` grows
 *     `expandedDepts: Set<string>` and `expandedRoles: Set<string>` beside
 *     the existing `expandedAreas` — dept rows twist open to reveal role
 *     rows, role rows twist open to reveal person rows.
 *   - Vacancy chips (`p.isVacancy`) render dashed and are NOT clickable
 *     (no `id` to grant).
 *   - `chains` memo grows role chains (org→area?→dept→role) and person
 *     chains (…→role→person); `peopleIndex` grows role→members entries.
 *   - `leftEndpoint` generalizes from "area collapsed ⇒ anchor at area" to
 *     "nearest collapsed ancestor" via a parent-chain lookup.
 *
 * Flipped LIVE in: 33-06.
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

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('SC-1 — teams-column ladder source contract', () => {
  test('expandedDepts/expandedRoles state exist beside expandedAreas', () => {
    const src = read(BAY)
    expect(src).toContain("useState<Set<string>>(new Set())")
    expect(src).toContain('const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set())')
    expect(src).toContain('const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set())')
    expect(src).toContain('const toggleDept = useCallback((deptId: string) => {')
    expect(src).toContain('const toggleRole = useCallback((roleId: string) => {')
  })

  test('dept rows twist open to reveal role rows; role rows twist open to reveal person rows', () => {
    const src = read(BAY)
    expect(src).toContain('const renderDeptRow = (dept: OrgTreeDepartment, indent: number, colour: string) => {')
    expect(src).toContain('{expanded && dept.roles.map((role) => renderRoleRow(role, indent + 18))}')
    expect(src).toContain('const renderRoleRow = (role: OrgTreeRole, indent: number) => {')
    expect(src).toContain('{expanded && role.people.map((p, i) => renderPersonRow(p, indent + 18,')
    expect(src).toContain("onClick={(e) => { e.stopPropagation(); toggleDept(dept.id) }}")
    expect(src).toContain("onClick={(e) => { e.stopPropagation(); toggleRole(role.id) }}")
  })

  test('role rows show filled/budgeted count', () => {
    const src = read(BAY)
    expect(src).toContain('{role.filledCount}/{role.budgetedCount}')
  })

  test('vacancy chips (p.isVacancy) render dashed and are NOT clickable — no onClick, no id to grant', () => {
    const src = read(BAY)
    expect(src).toContain('const renderPersonRow = (p: OrgPerson, indent: number, key: string) => {')
    expect(src).toContain('if (p.isVacancy || !p.id) {')
    expect(src).toContain('className="jack vacancy"')
    // The vacancy branch's own returned <div> must carry no onClick handler —
    // confirm the vacancy JSX block (up to its closing tag) has no onClick.
    const vacancyBlockMatch = src.match(/if \(p\.isVacancy \|\| !p\.id\) \{[\s\S]*?<\/div>\s*\)\s*\}/)
    expect(vacancyBlockMatch).not.toBeNull()
    expect(vacancyBlockMatch?.[0]).not.toContain('onClick')
  })

  test('vacancy chip has a dashed CSS treatment declared in the stylesheet', () => {
    const cssPath = path.join(ROOT, 'src', 'styles', 'blueprint-theme.css')
    const css = read(cssPath)
    expect(css).toContain('.jack.vacancy {')
    expect(css).toContain('border-style: dashed;')
  })

  test('chains memo grows role chains (org→area?→dept→role) and through-role person chains; legacy flat org→person chain preserved for non-tree grant subjects', () => {
    const src = read(BAY)
    expect(src).toContain("const roleChain: ChainLink[] = [...deptChain, { unitId: role.id, subjectType: 'role' }]")
    expect(src).toContain('m.set(role.id, roleChain)')
    expect(src).toContain("m.set(p.id, [...roleChain, { unitId: p.id, subjectType: 'person' }])")
    expect(src).toContain('for (const id of personIds) if (!m.has(id)) m.set(id, [orgLink, { unitId: id, subjectType: \'person\' }])')
  })

  test('peopleIndex grows role→members entries', () => {
    const src = read(BAY)
    expect(src).toContain("idx.set(role.id, role.people.filter((p) => !p.isVacancy && p.id).map((p) => p.id as string))")
  })

  test('handleLeftClick already flows role/person subjects into pending — role/person rows call it directly, no new mechanics', () => {
    const src = read(BAY)
    expect(src).toContain("onClick={() => handleLeftClick(role.id, 'role')}")
    expect(src).toContain("onClick={() => handleLeftClick(id, 'person')}")
  })

  test('leftEndpoint generalizes to nearest-collapsed-ancestor via a chain walk (not just area)', () => {
    const src = read(BAY)
    expect(src).toContain('const chain = chains.get(unitId)')
    expect(src).toContain('if (link.unitId === unitId) break')
    expect(src).toContain('if (isCollapsed(link)) return link.unitId')
  })

  test('search (matchIds) extends to role/person names with auto-expand of their ancestors', () => {
    const src = read(BAY)
    expect(src).toContain('if (role.name.toLowerCase().includes(q)) s.add(role.id)')
    expect(src).toContain('if (!p.isVacancy && p.id && p.name.toLowerCase().includes(q)) s.add(p.id)')
    expect(src).toContain('setExpandedDepts((prev) => {')
    expect(src).toContain('setExpandedRoles((prev) => {')
  })

  test('resolveEffectiveAccess and D-11 stay pinned; no revokeGrant import (33-06 must not touch these)', () => {
    const src = read(BAY)
    expect(src).toContain('resolveEffectiveAccess(chain, grantsByUnit)')
    expect(src).toContain('D-11')
    expect(src).not.toContain('revokeGrant')
  })
})

// ---------------------------------------------------------------------------
// Runtime smoke — requires chromium + live app + admin magic-link session
// (Railway-only UAT convention, CLAUDE.md 2026-04-24/2026-05-08).
// ---------------------------------------------------------------------------

test.describe('SC-1 — teams-column ladder runtime (requires chromium + live app)', () => {
  test.fixme(
    'WiringPatchBay renders site -> area -> department -> role -> person as expandable/selectable tiers, vacancies dashed and inert',
    async ({ page }) => {
      await page.goto('/admin/sops?view=access')
      await page.locator('.jack.group-jack').first().click() // expand an area
      const deptTwist = page.locator('.jack .twist').nth(1)
      await deptTwist.click() // expand a dept -> reveals role rows
      const roleTwist = page.locator('.jack .twist').nth(2)
      await roleTwist.click() // expand a role -> reveals person rows
      const vacancy = page.locator('.jack.vacancy').first()
      if (await vacancy.count()) {
        await expect(vacancy).toHaveCSS('border-style', 'dashed')
      }
    },
  )
})
