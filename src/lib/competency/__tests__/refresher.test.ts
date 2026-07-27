import { test, expect } from '@playwright/test'
import { refresherDueDate, isRefresherOverdue } from '@/lib/competency/refresher'

test.describe('refresherDueDate', () => {
  test('end-of-month clamp inherited from computeReviewDueDate', () => {
    expect(refresherDueDate('2026-01-31T00:00:00.000Z', 1)).toBe('2026-02-28T00:00:00.000Z')
  })

  test('unset interval -> null (D-02, no org/category fallback)', () => {
    expect(refresherDueDate('2026-01-15T00:00:00.000Z', null)).toBe(null)
  })

  test('never completed -> null (no due-date)', () => {
    expect(refresherDueDate(null, 6)).toBe(null)
  })
})

test.describe('isRefresherOverdue', () => {
  test('no due date -> false', () => {
    expect(isRefresherOverdue(null, '2026-03-01T00:00:00.000Z')).toBe(false)
  })

  test('now strictly after due -> true', () => {
    expect(isRefresherOverdue('2026-02-28T00:00:00.000Z', '2026-03-01T00:00:00.000Z')).toBe(true)
  })

  test('now equal to due -> false (not overdue at the instant it becomes due)', () => {
    expect(isRefresherOverdue('2026-02-28T00:00:00.000Z', '2026-02-28T00:00:00.000Z')).toBe(false)
  })

  test('now before due -> false', () => {
    expect(isRefresherOverdue('2026-03-01T00:00:00.000Z', '2026-02-28T00:00:00.000Z')).toBe(false)
  })
})
