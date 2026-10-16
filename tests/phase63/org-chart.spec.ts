/**
 * ADR-0020 -- the People chart. Source contract: it opens first, carries the four Show views in
 * words, collapses (Open all / Close all, Find a person, a size threshold), reads only, and hands
 * writes to the sheet, the invite form and the pinned SOP access tab.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'

const read = (p: string) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
const CHART = read('src/components/office/OrgChart.tsx')
const TAB = read('src/components/office/PeopleTab.tsx')

test.describe('the People chart', () => {
  test('People opens on the chart; Departments and Who can do what stay as views', () => {
    expect(TAB).toContain("useState<View>('chart')")
    expect(TAB).toContain('<OrgChart')
    for (const id of ['people-view-chart', 'people-view-departments', 'people-view-authority']) expect(TAB).toContain(id)
  })

  test('four Show views, in words', () => {
    for (const w of ["'People'", "'Who can…'", "'Training'", "'SOP access'", 'Nobody here', 'signed off', 'Seen by', 'looks after']) expect(CHART).toContain(w)
  })

  test('roles are edited on the chart: add, edit, take out, remove (two steps), and an empty seat seats someone', () => {
    for (const id of ['org-role-add', 'org-role-edit', 'org-role-unseat', 'org-role-remove', 'org-seat-pick', 'org-seat-person']) expect(CHART).toContain(id)
    expect(CHART).toContain('edit.confirm ?')
  })

  test('collapses: one row per department, Open all / Close all, Find a person, a size threshold', () => {
    expect(CHART).toContain('aria-expanded={o}')
    expect(CHART).toContain("'Close all' : 'Open all'")
    expect(CHART).toContain('data-testid="org-find"')
    expect(CHART).toMatch(/OPEN_ALL_PEOPLE = \d+/)
  })

  test('writes only job roles (ADR-0021); everything else goes to the sheet, the invite form and the pinned access tab', () => {
    const actions = [...CHART.matchAll(/from '@\/actions\/([\w-]+)'/g)].map((m) => m[1])
    expect(actions.sort()).toEqual(['auth', 'competency', 'org-model'])
    for (const a of ['createRole(', 'updateRole(', 'removeRole(', 'setRoleSeat(']) expect(CHART).toContain(a)
    expect(CHART).not.toMatch(/\b(createGrant|revokeGrant|inviteWorker|removeMember|setSupervision|updateMemberRoleSafe)\b/)
    expect(CHART).toContain('onChangeAccess(sop.id)')
    expect(TAB).toContain('onPinSop?.(sopId)')
  })

  test('role writes are wrapped so a thrown action never leaves the form busy', () => {
    expect(CHART).toMatch(/try \{\s*const r = await call\(\)/)
    expect(CHART).toContain('setBusy(false)')
  })

  test('the chart classes live in the design file', () => {
    const theme = read('src/styles/blueprint-theme.css')
    for (const c of ['.org-chart', '.org-dept', '.org-person', '.org-dim']) expect(theme).toContain(`${c} {`)
  })
})
