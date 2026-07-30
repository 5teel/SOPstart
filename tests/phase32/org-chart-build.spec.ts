/**
 * SC-1 — Org chart build: /admin/team org chart + Columns toggle + vacancy chips.
 *
 * Flipped live in 32-07 (Rule-3 degrade — no chromium/live-app + magic-link
 * session available in this environment, mirrors tests/e2e/admin-departments.spec.ts):
 * source-contract assertions prove every SC-1 wiring point is actually
 * connected (not just present as a string), and the true browser render is
 * kept as a documented `test.fixme` runtime smoke, same convention as
 * admin-departments.spec.ts.
 *
 * Contract (32-06/32-07-PLAN must_haves):
 *   - src/lib/org-model/auto-layout.ts (layoutOrgTree) — pure leveled-tree layout.
 *   - src/components/admin/org-model/OrgChartCanvas.tsx — Node Chart view,
 *     dashed vacancy chips, role capacity counts (D-05).
 *   - src/components/admin/org-model/ViewToggle.tsx — ⊞ Chart / ▤ Columns
 *     segmented control (sketch 001 org-model-views.md).
 *   - src/components/admin/org-model/OrgColumnsBoard.tsx — Columns alt view,
 *     absorbs the old member list as a sub-panel.
 *   - src/components/admin/org-model/TeamViewShell.tsx — client shell mounting
 *     the toggle over OrgChartCanvas <-> OrgColumnsBoard (Rule 3 auto-add, 32-07).
 *   - src/app/(protected)/admin/team/page.tsx — server-fetches listOrgTree,
 *     mounts TeamViewShell (D-08); AdminNav stays 5 tabs, Team tab still
 *     lands /admin/team (UX-02 preserved).
 *
 * Registration: playwright.config.ts `phase32` project
 *   testDir: '.', testMatch: /tests\/phase32\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase32`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const CHART = path.join(ROOT, 'src', 'components', 'admin', 'org-model', 'OrgChartCanvas.tsx')
const TOGGLE = path.join(ROOT, 'src', 'components', 'admin', 'org-model', 'ViewToggle.tsx')
const COLUMNS = path.join(ROOT, 'src', 'components', 'admin', 'org-model', 'OrgColumnsBoard.tsx')
const SHELL = path.join(ROOT, 'src', 'components', 'admin', 'org-model', 'TeamViewShell.tsx')
const PAGE = path.join(ROOT, 'src', 'app', '(protected)', 'admin', 'team', 'page.tsx')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('SC-1 — OrgChartCanvas source contract', () => {
  test('renders vacancy chips as first-class dashed chips (never an error)', () => {
    const src = read(CHART)
    expect(src).toContain("person-chip${person.isVacancy ? ' vacant' : ''}")
    expect(src).toContain("person.isVacancy ? '+' : initials(person.name)")
  })

  test('shows role capacity counts (filled/budgeted)', () => {
    const src = read(CHART)
    expect(src).toContain('role.filledCount')
    expect(src).toContain('role.budgetedCount')
  })

  test('add-affordance ghosts wire to createRole + createDepartment (32-04 actions)', () => {
    const src = read(CHART)
    expect(src).toContain("from '@/actions/org-model'")
    expect(src).toContain('createRole(')
    expect(src).toContain('createDepartment(')
  })
})

test.describe('SC-1 — ViewToggle source contract', () => {
  test('is a controlled segmented control with no private view state', () => {
    const src = read(TOGGLE)
    expect(src).toContain("'use client'")
    expect(src).toContain('options')
    expect(src).toContain('onChange')
    expect(src).toContain("opt.value === value ? 'on'")
  })
})

test.describe('SC-1 — OrgColumnsBoard source contract', () => {
  test('renders one flex: 0 0 250px column per department', () => {
    const src = read(COLUMNS)
    expect(src).toContain("flex: '0 0 250px'")
  })

  test('reuses the OrgChartCanvas person-chip/pill JSX (share, not fork)', () => {
    const src = read(COLUMNS)
    expect(src).toContain('person-chip')
    expect(src).toContain("className=\"pill\"")
    expect(src).toContain('role.filledCount')
    expect(src).toContain('role.budgetedCount')
  })

  test('wires + Add role / + person / + ADD DEPARTMENT to the 32-04 actions', () => {
    const src = read(COLUMNS)
    expect(src).toContain('createRole(')
    expect(src).toContain('assignRoleMembers(')
    expect(src).toContain('createDepartment(')
    expect(src).toContain('+ Add role')
    expect(src).toContain('+ person')
    expect(src).toContain('+ ADD DEPARTMENT')
  })

  test('absorbs RoleAssignmentTable as a reachable sub-panel (role-edit capability preserved)', () => {
    const src = read(COLUMNS)
    expect(src).toContain("from '@/components/admin/RoleAssignmentTable'")
    expect(src).toContain('<RoleAssignmentTable')
    expect(src).toContain('<details')
  })
})

test.describe('SC-1 — TeamViewShell source contract', () => {
  test('mounts ViewToggle switching OrgChartCanvas <-> OrgColumnsBoard', () => {
    const src = read(SHELL)
    expect(src).toContain("'use client'")
    expect(src).toContain("from '@/components/admin/org-model/ViewToggle'")
    expect(src).toContain("from '@/components/admin/org-model/OrgChartCanvas'")
    expect(src).toContain("from '@/components/admin/org-model/OrgColumnsBoard'")
    expect(src).toMatch(/view === 'chart'/)
  })
})

test.describe('SC-1 — /admin/team page source contract', () => {
  test('page fetches listOrgTree() and mounts TeamViewShell', () => {
    const src = read(PAGE)
    expect(src).toContain("from '@/actions/org-model'")
    expect(src).toContain('listOrgTree()')
    expect(src).toContain("from '@/components/admin/org-model/TeamViewShell'")
    expect(src).toContain('<TeamViewShell')
  })

  test('keeps the getSessionContext admin/safety_manager guard verbatim', () => {
    const src = read(PAGE)
    expect(src).toContain("from '@/lib/auth/session-context'")
    expect(src).toContain('getSessionContext()')
    expect(src).toContain("'admin', 'safety_manager'")
    expect(src).toContain("redirect('/dashboard')")
  })

  test('mounts the shared AdminNav with active="team" (UX-02, 5-tab lock)', () => {
    const src = read(PAGE)
    expect(src).toContain("from '@/components/admin/AdminNav'")
    expect(src).toMatch(/<AdminNav active="team"/)
  })
})

// ---------------------------------------------------------------------------
// Runtime smoke — requires chromium + live app + admin magic-link session
// (mirrors tests/e2e/admin-departments.spec.ts). Prerequisites:
//   1. `npx playwright install chromium`
//   2. Migrations applied (00046/00047 — areas/roles/role_members)
//   3. App running at http://localhost:4200 (`npm run build && npm start`)
//   4. Admin magic-link session cookie (scripts/uat-magic-link.mjs pattern,
//      CLAUDE.md [2026-04-24] learning)
// ---------------------------------------------------------------------------

test.describe('SC-1 — /admin/team runtime smoke (requires chromium + live app)', () => {
  test.fixme(
    '/admin/team renders Node Chart by default with vacancy chips + ⊞/▤ toggle to Columns',
    async ({ page }) => {
      await page.goto('/admin/team')
      await expect(page.getByRole('heading', { name: 'Team' })).toBeVisible()
      // Node Chart default: at least the org-root node renders.
      await expect(page.locator('.node.org-root')).toBeVisible()
      // Switch to Columns.
      await page.getByRole('button', { name: '▤ Columns' }).click()
      await expect(page.locator('details summary', { hasText: 'Manage members' })).toBeVisible()
      // AdminNav still exactly 5 tabs, Team still lands here.
      await expect(page.getByRole('navigation', { name: 'Admin sections' }).getByRole('link')).toHaveCount(5)
    },
  )
})
