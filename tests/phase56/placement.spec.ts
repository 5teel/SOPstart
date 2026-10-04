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

// Source contract: the worker surfaces render the labels, stay out of admin code,
// and never show a step-level label (A-05: step labels reach the walk in Phase 58).
import fs from 'node:fs'
import path from 'node:path'

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
const read = (p: string) => strip(fs.readFileSync(path.join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n'))

const WORKER_FILES = [
  'src/app/(protected)/sops/[sopId]/page.tsx',
  'src/components/sop/tabs/ReadTab.tsx',
  'src/components/sop/walkthrough/DesktopWalkthrough.tsx',
  'src/components/sop/walkthrough/ImmersiveStepCard.tsx',
]

test.describe('worker surfaces render placement + labels', () => {
  test('page shows placement line and labels', () => {
    const src = read(WORKER_FILES[0])
    expect(src).toContain('placementLabel(')
    expect(src).toContain('<StandardLabels')
    expect(src).toContain('data-testid="sop-meta"')
  })
  for (const f of WORKER_FILES.slice(1)) {
    test(`${path.basename(f)} renders StandardLabels`, () => {
      expect(read(f)).toContain('<StandardLabels')
    })
  }
  for (const f of WORKER_FILES) {
    test(`${path.basename(f)} imports no admin code and no step-level label`, () => {
      const src = read(f)
      expect(src).not.toMatch(/from\s+['"][^'"]*\/admin\//)
      expect(src).not.toContain('@/actions/standards')
      expect(src).not.toContain('focus_step')
    })
  }
})
