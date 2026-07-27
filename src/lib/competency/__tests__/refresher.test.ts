import { test, expect } from '@playwright/test'
import { refresherDueDate, isRefresherDue, isRefresherOverdue, REFRESHER_DUE_WINDOW_DAYS } from '@/lib/competency/refresher'

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

// WR-04: "due" is a lead-in window (REFRESHER_DUE_WINDOW_DAYS before the due
// date), not a duplicate of "overdue" — otherwise the "Refresher due" label
// is dead UI (due and overdue would differ by a single millisecond).
test.describe('isRefresherDue (lead-in window)', () => {
  test('no due date -> false', () => {
    expect(isRefresherDue(null, '2026-03-01T00:00:00.000Z')).toBe(false)
  })

  test('now well before the window -> false', () => {
    expect(isRefresherDue('2026-06-30T00:00:00.000Z', '2026-03-01T00:00:00.000Z')).toBe(false)
  })

  test('now exactly at the window start -> true (due-soon, not yet overdue)', () => {
    const due = '2026-06-30T00:00:00.000Z'
    const windowStart = new Date(new Date(due).getTime() - REFRESHER_DUE_WINDOW_DAYS * 86_400_000).toISOString()
    expect(isRefresherDue(due, windowStart)).toBe(true)
    expect(isRefresherOverdue(due, windowStart)).toBe(false)
  })

  test('now at the due date -> due true, overdue still false', () => {
    expect(isRefresherDue('2026-06-30T00:00:00.000Z', '2026-06-30T00:00:00.000Z')).toBe(true)
    expect(isRefresherOverdue('2026-06-30T00:00:00.000Z', '2026-06-30T00:00:00.000Z')).toBe(false)
  })

  test('now past the due date -> both due and overdue true', () => {
    expect(isRefresherDue('2026-06-30T00:00:00.000Z', '2026-07-01T00:00:00.000Z')).toBe(true)
    expect(isRefresherOverdue('2026-06-30T00:00:00.000Z', '2026-07-01T00:00:00.000Z')).toBe(true)
  })
})
