/**
 * Phase 57 -- PLC-02 a machine's SOPs in the detail pane.
 * Worker half live from 57-04; admin half is filled by 57-05.
 * Registration: playwright.config.ts `phase57` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')

test.describe('PLC-02 machine body', () => {
  const PANEL = read('src/components/sop/plant/MachinePanel.tsx')
  const ROOMS = read('src/components/shell/RoomBodies.tsx')
  const NOW = read('src/components/sop/plant/NowCard.tsx')
  const HOME = read('src/components/sop/plant/PlantHome.tsx')

  test('MachineBody and SopRows are exports usable outside the overlay panel', () => {
    expect(PANEL).toContain('export function MachineBody(')
    expect(PANEL).toContain('export function SopRows(')
    expect(PANEL).toContain('<MachineBody machine={machine}')
    expect(PANEL).toContain('No procedures for this machine yet.')
  })

  test('rows carry the shared badge and a Walk link', () => {
    expect(PANEL).toContain("import { RelBadge } from '@/components/sop/plant/RelBadge'")
    expect(PANEL).toContain('<RelBadge rel={rel} />')
    expect(PANEL).toContain('href={`/sops/${sop.id}?tab=walk`}')
    expect(PANEL).toContain('data-testid="plant-panel-walk"')
  })

  test('the Now card is in-flow and PlantHome keeps the overlay position', () => {
    expect(NOW).not.toMatch(/\babsolute\b/)
    expect(HOME).toContain('absolute bottom-4 left-4')
  })

  test('room bodies are worker-safe and re-use SopRows', () => {
    expect((ROOMS.match(/data-testid="room-body"/g) ?? []).length).toBe(4)
    expect(ROOMS).toContain('<SopRows sops={sops} empty="No site-wide SOPs yet." />')
    expect(ROOMS).not.toContain('@/actions/governance')
    expect(ROOMS).not.toMatch(/components\/admin/)
    expect(ROOMS).toContain('href="/activity"')
    expect(ROOMS).toContain('Ask for a change')
  })

  test.fixme('admin machine body offers Walk, Edit and new SOP for the machine [57-05]', () => {})
  test.fixme('the blank wizard with a machine id links the new SOP to it after create [57-05]', () => {})
})
