/**
 * Phase 56 / 56-09 -- placement helper (SOP-03, D-09/D-10) and standards labels (SOP-02, D-11).
 */
import { test, expect } from '@playwright/test'
import { placementSummary, placementLabel, standardNames } from '@/lib/sop/placement'

test.describe('placement helper', () => {
  test('site, no machines -> whole site', () => {
    expect(placementSummary('site', [])).toEqual({ siteWide: true, machines: [], departments: [] })
  })
  test('machines -> both names, unique department', () => {
    const s = placementSummary('machine', [
      { name: 'Oven', department: 'Forming' },
      { name: 'EVAL Press', department: 'Forming' },
    ])
    expect(s).toEqual({ siteWide: false, machines: ['EVAL Press', 'Oven'], departments: ['Forming'] })
  })
  test('machine placement with no machines is whole site', () => {
    expect(placementSummary('machine', []).siteWide).toBe(true)
    expect(placementSummary(undefined, []).siteWide).toBe(true)
  })
  test('departments skip nulls and sort; machines sort by name', () => {
    const s = placementSummary('machine', [
      { name: 'B', department: null },
      { name: 'A', department: 'Zeta' },
      { name: 'C', department: 'Alpha' },
    ])
    expect(s.machines).toEqual(['A', 'B', 'C'])
    expect(s.departments).toEqual(['Alpha', 'Zeta'])
  })
  test('placementLabel', () => {
    expect(placementLabel(placementSummary('site', []))).toBe('Whole site')
    expect(placementLabel(placementSummary('machine', [{ name: 'EVAL Press', department: 'Forming' }]))).toBe(
      'EVAL Press · Forming',
    )
    expect(
      placementLabel(
        placementSummary('machine', [
          { name: 'Oven', department: 'Forming' },
          { name: 'EVAL Press', department: 'Forming' },
        ]),
      ),
    ).toBe('EVAL Press, Oven · Forming')
  })
  test('standardNames', () => {
    expect(standardNames(undefined)).toEqual([])
    expect(standardNames([{ standards: { name: 'LOTO' } }, { standards: null }])).toEqual(['LOTO'])
  })
})
