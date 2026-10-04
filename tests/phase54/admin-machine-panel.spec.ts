/**
 * Phase 54 / Plan 54-03 -- ADM-02 admin machine panel contracts (D-05): pin
 * severity on PlantStage health mode, panel SOP rows with NO OWNER / REVIEW
 * DUE / DRAFT / OK badges, Open/Edit links, "Add one" empty state, no-site
 * "Draw your site" fallback (D-06).
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
const FLOOR_HEALTH_PATH = 'src/components/admin/governance/AdminFloorHealth.tsx'
const GOV_PAGE_PATH = 'src/app/(protected)/governance/page.tsx'

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

test.describe('AdminMachinePanel (54-03 Task 1)', () => {
  test('exports AdminMachinePanel', () => {
    expect(read(ADMIN_PANEL_PATH)).toContain('export function AdminMachinePanel')
  })

  test('renders owner/review badges, Open/Edit links, no photo yet, Add one', () => {
    const src = read(ADMIN_PANEL_PATH)
    expect(src).toContain('admin-panel-badge')
    expect(src).toContain('/sops/${sop.id}')
    expect(src).toContain('/admin/sops/builder/${sop.id}')
    expect(src).toContain('/admin/sops/new')
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
})

test.describe('worker MachinePanel stays governance-free', () => {
  test('no owner/badge words in the worker variant', () => {
    const src = read(MACHINE_PANEL_PATH)
    expect(src).not.toMatch(/\bowner\b/i)
    expect(src).not.toContain('NO OWNER')
    expect(src).not.toContain('REVIEW DUE')
  })
})

test.describe('AdminFloorHealth (54-03 Task 2)', () => {
  test('loads PlantStage only through next/dynamic ssr:false -- no static import', () => {
    const src = read(FLOOR_HEALTH_PATH)
    expect(src).toMatch(/dynamic\(\s*\(\)\s*=>\s*import\('@\/components\/sop\/plant\/PlantStage'\)/)
    expect(src).toContain('ssr: false')
    expect(src).not.toMatch(/^import .* from '@\/components\/sop\/plant/m)
  })

  test('derives pins and panel rows from admin-health.ts, never re-classifies', () => {
    const src = read(FLOOR_HEALTH_PATH)
    expect(src).toContain('machineHealth(')
    expect(src).toContain('machinePanelSops(')
  })

  test('wires onMachineClick and onClose to the selection state, not just names them', () => {
    const src = read(FLOOR_HEALTH_PATH)
    expect(src).toContain('onMachineClick={setSelectedId}')
    expect(src).toContain('onClose={() => setSelectedId(null)}')
  })

  test('no-site card links /admin/site', () => {
    const src = read(FLOOR_HEALTH_PATH)
    expect(src).toContain('floor-no-site')
    expect(src).toContain('/admin/site')
  })

  test('error state renders the returned error string', () => {
    const src = read(FLOOR_HEALTH_PATH)
    expect(src).toContain('floor-error')
    expect(src).toContain('floor.error')
  })
})

test.describe('/governance renders the floor column (54-03 Task 2)', () => {
  test('renders AdminFloorHealth after GovernanceInbox inside the grid, server component', () => {
    const src = read(GOV_PAGE_PATH)
    const inboxIdx = src.indexOf('<GovernanceInbox')
    const floorIdx = src.indexOf('<AdminFloorHealth floor={inbox.floor} governance={inbox.governance}')
    expect(inboxIdx).toBeGreaterThan(-1)
    expect(floorIdx).toBeGreaterThan(inboxIdx)
    expect(src).not.toContain("'use client'")
  })
})
