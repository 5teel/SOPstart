/**
 * SB-LINE-05 — per-person department assignment lives on the Office People tab.
 *
 * Phase 60 (60-17) deleted the SOP-level sub-trade picker, its actions and the
 * assign screen; the absence of all of them (and of every link to the old
 * address) is asserted in tests/phase60/retirement-sweep.spec.ts.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const PEOPLE_TAB = path.join(process.cwd(), 'src', 'components', 'office', 'PeopleTab.tsx')

test.describe('SB-LINE-05 — People & roles tab integration (59-14)', () => {
  test('the People tab renders a member-mode DepartmentPicker per person row', () => {
    const src = fs.readFileSync(PEOPLE_TAB, 'utf-8')
    expect(src).toContain("from '@/components/admin/departments/DepartmentPicker'")
    expect(src).toMatch(/<DepartmentPicker\s*\n?\s*mode="member"/)
  })
})
