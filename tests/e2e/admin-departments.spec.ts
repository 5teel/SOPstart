/**
 * Phase 25 Plan 04 — /admin/departments e2e smoke spec.
 *
 * Source-contract assertions (no browser/Chromium binary required for CI):
 *  - DepartmentCard.tsx contains the card anatomy tokens from UI-SPEC
 *  - DepartmentGrid.tsx contains "NEW DEPARTMENT" add-card copy + archive toggle
 *  - /admin/departments page.tsx guards to /dashboard and calls listDepartments
 *  - DepartmentFormModal.tsx has colour picker + code field
 *
 * Runtime e2e portions are marked test.fixme — they require:
 *  1. Chromium Playwright binary: `npx playwright install chromium`
 *  2. Migrations applied: `npx supabase db push --include-all`
 *  3. Running app at http://localhost:4200
 *  4. Admin magic-link session (scripts/uat-magic-link.mjs pattern)
 *
 * Registration: This file is matched by the `phase25-e2e` project in playwright.config.ts.
 * Per CLAUDE.md 2026-05-25 learning: a spec not in any project testMatch NEVER runs —
 * always verify with `npx playwright test --list | grep admin-departments`.
 *
 * REQ-6: /admin/departments renders cards with live People/SOPs/Blocks counts.
 * D-03: No-owner warning surfaces the Visy governance gap.
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

const CARD = path.join(ROOT, 'src', 'components', 'admin', 'departments', 'DepartmentCard.tsx')
const GRID = path.join(ROOT, 'src', 'components', 'admin', 'departments', 'DepartmentGrid.tsx')
const PAGE = path.join(ROOT, 'src', 'app', '(protected)', 'admin', 'departments', 'page.tsx')
const MODAL = path.join(
  ROOT,
  'src',
  'components',
  'admin',
  'departments',
  'DepartmentFormModal.tsx',
)

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

// ---------------------------------------------------------------------------
// Source-contract: DepartmentCard
// ---------------------------------------------------------------------------

test.describe('admin/departments — DepartmentCard source contract', () => {
  test('DepartmentCard contains colour stripe and cdot elements', () => {
    const src = read(CARD)
    // 6px left stripe
    expect(src).toContain('6px')
    // cdot (26×26 colour dot)
    expect(src).toContain('26px')
  })

  test('DepartmentCard has filled owner block (OWNER label + initials)', () => {
    const src = read(CARD)
    expect(src).toContain('OWNER')
    // Initials extraction
    expect(src).toContain('getInitials')
  })

  test('DepartmentCard has no-owner warning with accent-hazard (D-03, REQ-5)', () => {
    const src = read(CARD)
    // The "No owner assigned" text must be present — D-03 governance gap feature
    expect(src).toContain('No owner assigned — set one')
    // accent-hazard used for dashed border + avatar + text
    expect(src).toContain('accent-hazard')
    // Dashed border style for .owner.empty
    expect(src).toContain('dashed')
    // Red avatar background: rgba(239,68,68,0.10)
    expect(src).toContain('rgba(239,68,68,0.10)')
  })

  test('DepartmentCard renders stats row with 3 cells (People/SOPs/Blocks)', () => {
    const src = read(CARD)
    expect(src).toContain('PEOPLE')
    expect(src).toContain('SOPS')
    expect(src).toContain('BLOCKS')
    // Stats from DepartmentWithCounts
    expect(src).toContain('people_count')
    expect(src).toContain('sop_count')
    expect(src).toContain('block_count')
  })

  test('DepartmentCard handles archived state with muted stripe + ARCHIVED label', () => {
    const src = read(CARD)
    expect(src).toContain('ARCHIVED')
    expect(src).toContain('opacity')
  })
})

// ---------------------------------------------------------------------------
// Source-contract: DepartmentGrid
// ---------------------------------------------------------------------------

test.describe('admin/departments — DepartmentGrid source contract', () => {
  test('DepartmentGrid renders the dashed add-card with NEW DEPARTMENT label', () => {
    const src = read(GRID)
    // Per UI-SPEC: "NEW DEPARTMENT" — the exact uppercase copy (REQ-6)
    expect(src).toContain('NEW DEPARTMENT')
  })

  test('DepartmentGrid wires DepartmentCard', () => {
    const src = read(GRID)
    expect(src).toContain('DepartmentCard')
    expect(src).toContain("from './DepartmentCard'")
  })

  test('DepartmentGrid has show-archived toggle', () => {
    const src = read(GRID)
    expect(src).toContain('showArchived')
    expect(src).toContain('archived')
  })

  test('DepartmentGrid wires create/edit/archive actions from departments.ts', () => {
    const src = read(GRID)
    // archive action wired (create + update are inside the modal)
    expect(src).toContain('archiveDepartment')
  })

  test('DepartmentGrid has empty-state copy', () => {
    const src = read(GRID)
    expect(src).toContain('No departments yet')
  })
})

// ---------------------------------------------------------------------------
// Source-contract: /admin/departments page
// ---------------------------------------------------------------------------

test.describe('admin/departments — page.tsx source contract', () => {
  test('page calls listDepartments for org data', () => {
    const src = read(PAGE)
    expect(src).toContain('listDepartments')
  })

  test('page redirects non-admin/safety_manager to /dashboard (REQ-1)', () => {
    const src = read(PAGE)
    expect(src).toContain('dashboard')
    expect(src).toContain("'admin', 'safety_manager'")
  })

  test('page renders DepartmentGrid with departments prop', () => {
    const src = read(PAGE)
    expect(src).toContain('DepartmentGrid')
    expect(src).toContain('departments={departments}')
  })

  test('page includes shared sub-nav with Departments tab', () => {
    const src = read(PAGE)
    // Shared sub-nav links
    expect(src).toContain('/admin/sops')
    expect(src).toContain('/admin/blocks')
    expect(src).toContain('/admin/team')
    expect(src).toContain('/admin/departments')
    // Active Departments tab
    expect(src).toContain('Departments')
  })

  test('page sub-heading matches UI-SPEC copywriting', () => {
    const src = read(PAGE)
    expect(src).toContain('A first-class entity')
    expect(src).toContain('owner accountable')
  })
})

// ---------------------------------------------------------------------------
// Source-contract: DepartmentFormModal
// ---------------------------------------------------------------------------

test.describe('admin/departments — DepartmentFormModal source contract', () => {
  test('modal has fixed 8-swatch colour picker (no free-form input, V5/T-25-08)', () => {
    const src = read(MODAL)
    // Radio group (no free text input for colour)
    expect(src).toContain("type=\"radio\"")
    expect(src).toContain('dept-colour')
    // All 8 palette hex values present
    expect(src).toContain('#f97316')
    expect(src).toContain('#3b82f6')
    expect(src).toContain('#06b6d4')
    expect(src).toContain('#10b981')
    expect(src).toContain('#ec4899')
    expect(src).toContain('#ef4444')
    expect(src).toContain('#fbbf24')
    expect(src).toContain('#8b5cf6')
  })

  test('modal has auto-uppercase code field (≤6 chars)', () => {
    const src = read(MODAL)
    expect(src).toContain('toUpperCase')
    expect(src).toContain('maxLength={6}')
  })

  test('modal has member owner selector', () => {
    const src = read(MODAL)
    expect(src).toContain('ownerMemberId')
    expect(src).toContain('orgMembers')
  })

  test('modal wires createDepartment and updateDepartment from actions', () => {
    const src = read(MODAL)
    expect(src).toContain('createDepartment')
    expect(src).toContain('updateDepartment')
    expect(src).toContain("from '@/actions/departments'")
  })

  test('modal surfaces duplicate code error copy from UI-SPEC', () => {
    const src = read(MODAL)
    expect(src).toContain('That code is already in use')
  })
})

// ---------------------------------------------------------------------------
// Runtime smoke — activate after: chromium install + db push + app running
// ---------------------------------------------------------------------------

test.describe('admin/departments — runtime smoke (requires chromium + live app)', () => {
  test.fixme(
    'page loads at /admin/departments with h1 "Departments" visible (REQ-6)',
    async ({ page }) => {
      // Prerequisites:
      // 1. `npx playwright install chromium`
      // 2. `npx supabase db push --include-all` (migrations 00035/00036/00037)
      // 3. App running at http://localhost:4200 (`npm run build && npm start`)
      // 4. Mint admin magic-link session cookie (scripts/uat-magic-link.mjs pattern,
      //    per CLAUDE.md [2026-04-24] learning)
      //
      // Once prerequisites are met, flip test.fixme to test:
      await page.goto('/admin/departments')
      await expect(page.getByRole('heading', { name: 'Departments' })).toBeVisible()
    },
  )

  test.fixme(
    'at least one DepartmentCard renders with colour stripe and stats (REQ-6)',
    async ({ page }) => {
      // After `npx supabase db push --include-all`, the General department auto-created
      // by migration 00036 should be present. Assert:
      //   - a card exists with code "GEN · department"
      //   - stats cells for PEOPLE / SOPS / BLOCKS are visible
      //   - if owner_user_id is null, red "No owner assigned" warning is shown (D-03)
      await page.goto('/admin/departments')
      // Colour stripe: 6px div inside each card
      await expect(page.locator('[style*="6px"]').first()).toBeVisible()
      // Stats labels
      await expect(page.getByText('PEOPLE')).toBeVisible()
      await expect(page.getByText('SOPS')).toBeVisible()
      await expect(page.getByText('BLOCKS')).toBeVisible()
    },
  )
})
