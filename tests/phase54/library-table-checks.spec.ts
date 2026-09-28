/**
 * Phase 54 / Plan 54-01 -- ADM-03 unit tests for the library-table checks
 * classifier (`deriveChecks`, `tableStatus`, `CHECK_ORDER`) in
 * `src/lib/sop/admin-health.ts`.
 *
 * Static @/ imports only (CLAUDE.md 2026-06-24).
 *
 * Registration: playwright.config.ts `phase54` project
 *   testDir: '.', testMatch: /tests\/phase54\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase54`
 */
import { test, expect } from '@playwright/test'
import { deriveChecks, tableStatus, CHECK_ORDER, type CheckInput } from '@/lib/sop/admin-health'

const NOW = new Date('2026-09-29T00:00:00Z')

function input(overrides: Partial<CheckInput> = {}): CheckInput {
  return {
    flags: [],
    status: 'published',
    lastReviewedAt: '2026-08-01T00:00:00Z',
    chainRequired: false,
    allDepartments: true,
    departments: [],
    hasPersonGrant: false,
    stuck: false,
    parseFailed: false,
    ...overrides,
  }
}

test('CHECK_ORDER is exactly owner, review, approved, assigned, converted', () => {
  expect(CHECK_ORDER).toEqual(['owner', 'review', 'approved', 'assigned', 'converted'])
})

test('five greens for a healthy published SOP', () => {
  const checks = deriveChecks(input(), NOW)
  expect(checks).toEqual({ owner: 'ok', review: 'ok', approved: 'ok', assigned: 'ok', converted: 'ok' })
})

test.describe('owner check', () => {
  test('bad iff unowned', () => {
    expect(deriveChecks(input({ flags: ['unowned'] }), NOW).owner).toBe('bad')
    expect(deriveChecks(input({ flags: [] }), NOW).owner).toBe('ok')
  })
})

test.describe('review check', () => {
  test('bad when overdue flag present', () => {
    expect(deriveChecks(input({ flags: ['overdue'] }), NOW).review).toBe('bad')
  })

  test('bad when never reviewed', () => {
    expect(deriveChecks(input({ lastReviewedAt: null }), NOW).review).toBe('bad')
  })

  test('13 months ago -> bad, 11 months ago -> ok (calendar-year cut)', () => {
    expect(deriveChecks(input({ lastReviewedAt: '2025-08-29T00:00:00Z' }), NOW).review).toBe('bad')
    expect(deriveChecks(input({ lastReviewedAt: '2025-10-29T00:00:00Z' }), NOW).review).toBe('ok')
  })

  test('warn when due_soon flag present', () => {
    expect(deriveChecks(input({ flags: ['due_soon'] }), NOW).review).toBe('warn')
  })
})

test.describe('approved check', () => {
  test('ok when published, regardless of chain', () => {
    expect(deriveChecks(input({ status: 'published', chainRequired: true }), NOW).approved).toBe('ok')
  })

  test('warn when awaiting_approval flag present', () => {
    expect(deriveChecks(input({ status: 'draft', chainRequired: true, flags: ['awaiting_approval'] }), NOW).approved).toBe('warn')
  })

  test('ok when no chain applies', () => {
    expect(deriveChecks(input({ status: 'draft', chainRequired: false }), NOW).approved).toBe('ok')
  })

  test('else bad (draft, chain required, not yet sent for approval)', () => {
    expect(deriveChecks(input({ status: 'draft', chainRequired: true, flags: [] }), NOW).approved).toBe('bad')
  })
})

test.describe('assigned check', () => {
  test('ok when allDepartments', () => {
    expect(deriveChecks(input({ allDepartments: true, departments: [], hasPersonGrant: false }), NOW).assigned).toBe('ok')
  })

  test('ok when at least one department', () => {
    expect(deriveChecks(input({ allDepartments: false, departments: ['d1'], hasPersonGrant: false }), NOW).assigned).toBe('ok')
  })

  test('ok when a person grant exists', () => {
    expect(deriveChecks(input({ allDepartments: false, departments: [], hasPersonGrant: true }), NOW).assigned).toBe('ok')
  })

  test('bad when none of the above', () => {
    expect(deriveChecks(input({ allDepartments: false, departments: [], hasPersonGrant: false }), NOW).assigned).toBe('bad')
  })
})

test.describe('converted check', () => {
  test('bad when stuck', () => {
    expect(deriveChecks(input({ stuck: true }), NOW).converted).toBe('bad')
  })

  test('bad when last parse failed', () => {
    expect(deriveChecks(input({ parseFailed: true }), NOW).converted).toBe('bad')
  })

  test('warn while uploading/parsing', () => {
    expect(deriveChecks(input({ status: 'uploading' }), NOW).converted).toBe('warn')
    expect(deriveChecks(input({ status: 'parsing' }), NOW).converted).toBe('warn')
  })

  test('ok otherwise', () => {
    expect(deriveChecks(input({ status: 'draft' }), NOW).converted).toBe('ok')
  })
})

test.describe('tableStatus', () => {
  test('stuck or parseFailed -> STUCK', () => {
    expect(tableStatus({ status: 'parsing', stuck: true, parseFailed: false })).toBe('STUCK')
    expect(tableStatus({ status: 'draft', stuck: false, parseFailed: true })).toBe('STUCK')
  })

  test('published -> LIVE', () => {
    expect(tableStatus({ status: 'published', stuck: false, parseFailed: false })).toBe('LIVE')
  })

  test('anything else -> DRAFT', () => {
    expect(tableStatus({ status: 'draft', stuck: false, parseFailed: false })).toBe('DRAFT')
    expect(tableStatus({ status: 'uploading', stuck: false, parseFailed: false })).toBe('DRAFT')
  })
})
