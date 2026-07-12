import { test, expect } from '@playwright/test'
import { classifyGovernanceRow, DUE_SOON_WINDOW_DAYS } from '@/lib/governance/classify'
import { resolveCadenceMonths, computeReviewDueDate } from '@/lib/governance/cadences'

const NOW = new Date('2026-07-12T00:00:00.000Z')
const DAY_MS = 86_400_000

const base = {
  reviewDueAt: null as string | null,
  ownerUserId: 'user-1' as string | null,
  ownerIsActiveMember: true,
  danglingDepartmentRefs: false,
  departmentRenamedSinceReview: false,
  now: NOW,
}

test.describe('classifyGovernanceRow', () => {
  test('unowned when ownerUserId is null', () => {
    const flags = classifyGovernanceRow({ ...base, ownerUserId: null })
    expect(flags).toContain('unowned')
  })

  test('unowned when ownerIsActiveMember is false', () => {
    const flags = classifyGovernanceRow({ ...base, ownerIsActiveMember: false })
    expect(flags).toContain('unowned')
  })

  test('overdue when reviewDueAt is in the past', () => {
    const past = new Date(NOW.getTime() - DAY_MS).toISOString()
    const flags = classifyGovernanceRow({ ...base, reviewDueAt: past })
    expect(flags).toContain('overdue')
    expect(flags).not.toContain('due_soon')
  })

  test('due_soon when reviewDueAt is within the window', () => {
    const soon = new Date(NOW.getTime() + (DUE_SOON_WINDOW_DAYS - 1) * DAY_MS).toISOString()
    const flags = classifyGovernanceRow({ ...base, reviewDueAt: soon })
    expect(flags).toContain('due_soon')
    expect(flags).not.toContain('overdue')
  })

  test('no due flag when reviewDueAt is null', () => {
    const flags = classifyGovernanceRow({ ...base, reviewDueAt: null })
    expect(flags).not.toContain('overdue')
    expect(flags).not.toContain('due_soon')
  })

  test('stale_role on dangling department ref', () => {
    const flags = classifyGovernanceRow({ ...base, danglingDepartmentRefs: true })
    expect(flags).toContain('stale_role')
  })

  test('stale_role on department renamed since review', () => {
    const flags = classifyGovernanceRow({ ...base, departmentRenamedSinceReview: true })
    expect(flags).toContain('stale_role')
  })

  test('co-occurring flags: unowned + overdue', () => {
    const past = new Date(NOW.getTime() - DAY_MS).toISOString()
    const flags = classifyGovernanceRow({ ...base, ownerUserId: null, reviewDueAt: past })
    expect(flags).toContain('unowned')
    expect(flags).toContain('overdue')
    expect(flags).toHaveLength(2)
  })
})

test.describe('resolveCadenceMonths', () => {
  test('resolution order: override > category > default > 12', () => {
    expect(resolveCadenceMonths('hazard', { hazard: 6, default: 18 }, 3)).toBe(3)
    expect(resolveCadenceMonths('hazard', { hazard: 6, default: 18 }, null)).toBe(6)
    expect(resolveCadenceMonths('unset-category', { hazard: 6, default: 18 }, null)).toBe(18)
    expect(resolveCadenceMonths(null, {}, null)).toBe(12)
  })
})

test.describe('computeReviewDueDate', () => {
  test('advances baseIso by N months deterministically', () => {
    const result = computeReviewDueDate('2026-01-15T00:00:00.000Z', 12)
    expect(result).toBe('2027-01-15T00:00:00.000Z')
  })
})
