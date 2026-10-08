/**
 * Phase 59 -- place tab. Requirement SHL-06; decisions D-01, D-03, A-04.
 * Owner: 59-03 (room tab on Place, office-tabs module). Registration: playwright.config.ts `phase59`.
 */
import { test, expect } from '@playwright/test'
import { formatPlace, parsePlace, placeToken } from '@/lib/shell/place'
import { isWidePlace, tabsForRole } from '@/lib/shell/office-tabs'
import { backHref } from '@/lib/sop/focus-path'

test.describe('place tab', () => {
  test('parsePlace reads a tab for the office place and drops an unknown tab', () => {
    expect(parsePlace('office', 'people')).toEqual({ kind: 'room', id: 'office', tab: 'people' })
    expect(parsePlace('office', 'inbox')).toEqual({ kind: 'room', id: 'office' })
    expect(parsePlace('office', 'requests')).toEqual({ kind: 'room', id: 'office', tab: 'requests' })
    expect(parsePlace('office', 'bogus')).toEqual({ kind: 'room', id: 'office' })
    expect('tab' in parsePlace('office', 'bogus')).toBe(false)
    expect(parsePlace('smoko', 'people')).toEqual({ kind: 'room', id: 'smoko' })
    expect(parsePlace('office')).toEqual({ kind: 'room', id: 'office' })
  })

  test('formatPlace writes the tab for non-default tabs and omits it for the inbox', () => {
    expect(formatPlace({ kind: 'room', id: 'office', tab: 'access' })).toBe('/?place=office&tab=access')
    expect(formatPlace({ kind: 'room', id: 'office' })).toBe('/?place=office')
  })

  test('placeToken stays "office" whatever the tab', () => {
    expect(placeToken({ kind: 'room', id: 'office', tab: 'decisions' })).toBe('office')
    expect(backHref('office')).toBe('/?s=signoffs') // 63-11: Back speaks the home address
  })

  test('tabsForRole: admin and safety manager get all five; supervisor gets the inbox and requests (A-04, 60 D-03); worker gets none', () => {
    const all = ['inbox', 'requests', 'decisions', 'people', 'access']
    expect(tabsForRole('admin')).toEqual(all)
    expect(tabsForRole('safety_manager')).toEqual(all)
    expect(tabsForRole('supervisor')).toEqual(['inbox', 'requests'])
    expect(tabsForRole('worker')).toEqual([])
    expect(tabsForRole(null)).toEqual([])
  })

  test('isWidePlace is true only for decisions, people and access', () => {
    for (const tab of ['decisions', 'people', 'access'] as const) {
      expect(isWidePlace({ kind: 'room', id: 'office', tab })).toBe(true)
    }
    expect(isWidePlace({ kind: 'room', id: 'office', tab: 'requests' })).toBe(false) // normal width (60 UI-SPEC)
    expect(isWidePlace({ kind: 'room', id: 'office' })).toBe(false)
    expect(isWidePlace({ kind: 'room', id: 'smoko' })).toBe(false)
    expect(isWidePlace({ kind: 'overview' })).toBe(false)
  })

})
