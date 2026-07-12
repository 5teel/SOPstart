import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

// Source-contract check: the pure governance modules exist with the exact
// exports later phase28 plans (28-03/04/05) compose over. Keeps the broad
// `phase28` project non-empty at Wave 1 (2026-05-25 registration gate) until
// those plans add their own specs into tests/phase28/.
test.describe('phase28 governance module contract', () => {
  test('classify.ts exports classifyGovernanceRow, GovernanceFlag, GovernanceInput, DUE_SOON_WINDOW_DAYS', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/governance/classify.ts'),
      'utf-8'
    )
    expect(src).not.toContain("'use server'")
    expect(src).toContain('export function classifyGovernanceRow')
    expect(src).toContain('export type GovernanceFlag')
    expect(src).toContain('export interface GovernanceInput')
    expect(src).toContain('export const DUE_SOON_WINDOW_DAYS')
  })

  test('cadences.ts exports resolveCadenceMonths, computeReviewDueDate', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/governance/cadences.ts'),
      'utf-8'
    )
    expect(src).not.toContain("'use server'")
    expect(src).toContain('export function resolveCadenceMonths')
    expect(src).toContain('export function computeReviewDueDate')
  })
})
