/**
 * Phase 59 -- place tab. Requirement SHL-06; decisions D-01, D-03, A-04.
 * Owner: 59-03 (office-tabs module). Registration: playwright.config.ts `phase59`.
 * Repointed in 63-19: the place module (parsePlace / formatPlace / placeToken / isWidePlace) is gone with the rooms;
 * the address round trip is tests/phase63/home-state.spec.ts.
 */
import { test, expect } from '@playwright/test'
import { tabsForRole } from '@/lib/shell/office-tabs'
import { backHref } from '@/lib/sop/focus-path'

test.describe('office tabs', () => {
  test('Back from the Office speaks the home address', () => {
    expect(backHref('office')).toBe('/?s=signoffs') // 63-11
  })

  test('tabsForRole: admin and safety manager get all five; supervisor gets the inbox and requests (A-04, 60 D-03); worker gets none', () => {
    const all = ['inbox', 'requests', 'decisions', 'people', 'access']
    expect(tabsForRole('admin')).toEqual(all)
    expect(tabsForRole('safety_manager')).toEqual(all)
    expect(tabsForRole('supervisor')).toEqual(['inbox', 'requests'])
    expect(tabsForRole('worker')).toEqual([])
    expect(tabsForRole(null)).toEqual([])
  })
})
