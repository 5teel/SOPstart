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

  test('collapses: one row per department, Open all / Close all, Find a person, a size threshold', () => {
    expect(CHART).toContain('aria-expanded={o}')
    expect(CHART).toContain("'Close all' : 'Open all'")
    expect(CHART).toContain('data-testid="org-find"')
    expect(CHART).toMatch(/OPEN_ALL_PEOPLE = \d+/)
  })

  test('reads only: no write action is imported; changes go to the sheet, the invite form and the pinned access tab', () => {
    const actions = [...CHART.matchAll(/from '@\/actions\/([\w-]+)'/g)].map((m) => m[1])
    expect(actions.sort()).toEqual(['auth', 'competency', 'org-model'])
    expect(CHART).not.toMatch(/\b(createGrant|revokeGrant|inviteWorker|removeMember|setSupervision|updateMemberRoleSafe)\b/)
    expect(CHART).toContain('onChangeAccess(sop.id)')
    expect(TAB).toContain('onPinSop?.(sopId)')
  })

  test('the chart classes live in the design file', () => {
    const theme = read('src/styles/blueprint-theme.css')
    for (const c of ['.org-chart', '.org-dept', '.org-person', '.org-dim']) expect(theme).toContain(`${c} {`)
  })
})
