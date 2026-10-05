/**
 * Phase 54 / Plan 54-03 -- ADM-02 admin machine panel contracts (D-05): pin
 * severity on PlantStage health mode, panel SOP rows with NO OWNER / REVIEW
 * DUE / DRAFT / OK badges and Edit links. Phase 57 folded the floor card into
 * the one screen; the panel body is now AdminMachineBody / AdminSopRows.
 *
 * Registration: playwright.config.ts `phase54` project
 *   testDir: '.', testMatch: /tests\/phase54\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase54`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const PLANT_STAGE_PATH = 'src/components/sop/plant/PlantStage.tsx'
const MACHINE_PANEL_PATH = 'src/components/sop/plant/MachinePanel.tsx'
const ADMIN_PANEL_PATH = 'src/components/admin/governance/AdminMachinePanel.tsx'

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')
}

test.describe('PlantStage admin health mode (54-03 Task 1)', () => {
  test('declares an optional health field of bad | due | ok', () => {
    expect(read(PLANT_STAGE_PATH)).toMatch(/health\?:\s*'bad'\s*\|\s*'due'\s*\|\s*'ok'/)
  })

  test('carries data-health and both pin testids', () => {
    const src = read(PLANT_STAGE_PATH)
    expect(src).toContain('data-health=')
    expect(src).toContain('data-testid="plant-health-pin"')
    expect(src).toContain('data-testid="plant-pin"')
  })

  test('never classifies -- no unowned/overdue/owner/reviewDueAt words', () => {
    const src = read(PLANT_STAGE_PATH)
    expect(src).not.toMatch(/unowned|overdue|owner|reviewDueAt/)
  })
})

test.describe('AdminMachineBody / AdminSopRows (54-03, repointed 57-05)', () => {
  test('exports the body and the rows', () => {
    const src = read(ADMIN_PANEL_PATH)
    expect(src).toContain('export function AdminMachineBody')
    expect(src).toContain('export function AdminSopRows')
  })

  test('renders owner/review badges, Edit link, no photo yet, and a new-SOP link', () => {
    const src = read(ADMIN_PANEL_PATH)
    expect(src).toContain('admin-panel-badge')
    expect(src).toContain('focusHref(sop.id, { from })')
    expect(src).toContain('/admin/sops/builder/${sop.id}')
    expect(src).toContain('/admin/sops/new/blank?machine=')
    expect(src).toContain('no photo yet')
  })

  test('carries no worker plant imports or worker rel state', () => {
    const src = read(ADMIN_PANEL_PATH)
    expect(src).not.toContain('@/components/sop/plant')
    expect(src).not.toContain('RelBadge')
    expect(src).not.toContain('plantRelState')
  })

  test('panel row order is NO OWNER, REVIEW DUE, DRAFT, OK, then title (from machinePanelSops)', () => {
    // The sort is owned by admin-health.ts's machinePanelSops (unit-tested in
    // 54-01); this component renders what it is handed, in order.
    const src = read(ADMIN_PANEL_PATH)
    expect(src).toContain('sops.map((sop) =>')
    expect(src).not.toMatch(/\.sort\(/)
  })

  test('governance fields are admin-only and the component fetches nothing', () => {
    const src = read(ADMIN_PANEL_PATH)
    expect(src).not.toMatch(/useQuery|fetch\(|@\/actions\//)
  })
})

test.describe('worker MachinePanel stays governance-free', () => {
  test('no owner/badge words in the worker variant', () => {
    const src = read(MACHINE_PANEL_PATH)
    expect(src).not.toMatch(/\bowner\b/i)
    expect(src).not.toContain('NO OWNER')
    expect(src).not.toContain('REVIEW DUE')
  })
})
