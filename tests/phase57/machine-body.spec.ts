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

  test('MachineBody and SopRows are the exports the detail pane renders (the overlay panel is gone)', () => {
    expect(PANEL).toContain('export function MachineBody(')
    expect(PANEL).toContain('export function SopRows(')
    expect(PANEL).not.toContain('export function MachinePanel(')
    expect(PANEL).not.toContain('<aside')
    expect(PANEL).toContain('No procedures for this machine yet.')
  })

  test('rows carry the shared badge and a Walk link', () => {
    expect(PANEL).toContain("import { RelBadge } from '@/components/sop/plant/RelBadge'")
    expect(PANEL).toContain('<RelBadge rel={rel} />')
    expect(PANEL).toContain('href={focusHref(sop.id, { from })}')
    expect(PANEL).toContain('data-testid="plant-panel-walk"')
  })

  test('the Now card is in-flow, never an overlay', () => {
    expect(NOW).not.toMatch(/\babsolute\b/)
  })

  test('room bodies are worker-safe and re-use SopRows', () => {
    expect((ROOMS.match(/data-testid="room-body"/g) ?? []).length).toBe(4)
    expect(ROOMS).toContain('<SopRows sops={sops} empty="No site-wide SOPs yet." from="noticeboard" />')
    expect(ROOMS).not.toContain('@/actions/governance')
    expect(ROOMS).not.toMatch(/components\/admin/)
    expect(ROOMS).toContain('href="/activity"')
    expect(ROOMS).toContain('Ask for a change')
  })

})

test.describe('PLC-02 admin machine body', () => {
  const ADMIN = read('src/components/admin/governance/AdminMachinePanel.tsx')
  const ROOMS = read('src/components/shell/AdminRoomBodies.tsx')
  const WIZ = read('src/app/(protected)/admin/sops/new/blank/WizardClient.tsx')
  const PAGE = read('src/app/(protected)/admin/sops/new/blank/page.tsx')

  test('rows: badge, title link, Walk only when published, Edit, owner and review line', () => {
    expect(ADMIN).toContain('export function AdminSopRows(')
    expect(ADMIN).toContain('data-testid="admin-panel-row"')
    expect(ADMIN).toContain('data-testid="admin-panel-badge"')
    expect(ADMIN).toContain('<Link href={focusHref(sop.id, { from })} className')
    expect(ADMIN).toMatch(/sop\.status === 'published' && \(\s*<Link\s+href=\{focusHref\(sop\.id, \{ from \}\)\}\s+data-testid="admin-panel-walk"/)
    expect(ADMIN).toContain('href={`/admin/sops/builder/${sop.id}`}')
    expect(ADMIN).toContain('data-testid="admin-panel-edit"')
    expect(ADMIN).toContain('owner {sop.ownerLabel ??')
  })

  test('machine body has no close button and starts a SOP for this machine', () => {
    expect(ADMIN).toContain('export function AdminMachineBody(')
    expect(ADMIN).toContain('data-testid="admin-panel"')
    expect(ADMIN).not.toContain('onClose')
    expect(ADMIN).toContain('href={`/admin/sops/new/blank?machine=${machine.id}`}')
    expect(ADMIN).toContain('data-testid="admin-panel-new-sop"')
    expect(ADMIN).toContain('No procedures for this machine yet.')
    expect(ADMIN).not.toContain('@/components/sop/plant')
  })

  test('admin room bodies: Office, Workshop, Noticeboard', () => {
    expect((ROOMS.match(/data-testid="room-body"/g) ?? []).length).toBe(3)
    expect(ROOMS).toContain('href="/governance" data-testid="room-office-inbox"')
    expect(ROOMS).toContain('href="/activity" data-testid="room-office-signoffs"')
    expect(ROOMS).toContain('href="/admin/team"')
    expect(ROOMS).toContain('href="/admin/settings"')
    expect(ROOMS).toContain('data-testid="room-workshop-draft"')
    expect(ROOMS).toContain('href={`/admin/sops/builder/${d.id}`}')
    expect(ROOMS).toContain('href="/admin/sops/new" data-testid="room-workshop-new"')
    expect(ROOMS).toContain('Write a new SOP')
    expect(ROOMS).toContain('<AdminSopRows sops={sops} empty="No site-wide SOPs yet." from="noticeboard" />')
  })

  test('the blank page keeps ?machine= only when it is a UUID', () => {
    expect(PAGE).toContain('await searchParams')
    expect(PAGE).toMatch(/const UUID = \/\^\[0-9a-f\]\{8\}/)
    expect(PAGE).toContain('UUID.test(machine)')
    expect(PAGE).toContain('machineId={machineId}')
  })

  test('the wizard creates the SOP, then links it to the machine, then opens the editor (58-13)', () => {
    const create = WIZ.indexOf('await createSopFromWizard(')
    const link = WIZ.indexOf('setSopMachines({ sopId: result.sopId, machineIds: [machineId] })')
    const push = WIZ.indexOf("router.push(focusHref(result.sopId, { mode: 'edit', from: 'workshop' }))")
    expect(create).toBeGreaterThan(-1)
    expect(link).toBeGreaterThan(create)
    expect(push).toBeGreaterThan(link)
    expect(WIZ).toContain("from '@/actions/site'")
  })
})
