/**
 * Phase 60 -- Review-due selection (60-08). Requirements: NTF-02. Decisions: D-08.
 * Registration: playwright.config.ts `phase60` project.
 */
import { test, expect } from '@playwright/test'
import { reviewDueTargets, type ReviewDueRow } from '@/lib/notifications/review-due'
import { DUE_SOON_WINDOW_DAYS } from '@/lib/governance/classify'

const NOW = new Date('2026-10-06T00:00:00.000Z')
const DAY = 86_400_000
const at = (days: number) => new Date(NOW.getTime() + days * DAY).toISOString()
const row = (over: Partial<ReviewDueRow>): ReviewDueRow => ({
  id: 'a',
  version: 1,
  parent_sop_id: null,
  status: 'published',
  title: 'Lockout',
  owner_user_id: 'owner-1',
  review_due_at: at(5),
  ...over,
})

test.describe('Review-due selection (60-08)', () => {
  test('reviewDueTargets selects only published SOPs inside the due window', () => {
    const rows = [
      row({ id: 'soon', review_due_at: at(5) }),
      row({ id: 'late', review_due_at: at(90) }),
      row({ id: 'draft', status: 'draft' }),
      row({ id: 'past', review_due_at: at(-3) }),
    ]
    const out = reviewDueTargets(rows, NOW)
    expect(out.map((t) => t.sopId).sort()).toEqual(['past', 'soon'])
    expect(out.find((t) => t.sopId === 'past')!.overdue).toBe(true)
    expect(out.find((t) => t.sopId === 'soon')!.overdue).toBe(false)
  })

  test('only the latest version of a lineage is selected', () => {
    const rows = [
      row({ id: 'v1', version: 1, review_due_at: at(-10) }),
      row({ id: 'v2', version: 2, parent_sop_id: 'v1', review_due_at: at(5) }),
    ]
    expect(reviewDueTargets(rows, NOW).map((t) => t.sopId)).toEqual(['v2'])
  })

  test('a SOP with no owner is skipped', () => {
    expect(reviewDueTargets([row({ owner_user_id: null })], NOW)).toEqual([])
  })

  test('the due window edge is inclusive on the right, exclusive on the left', () => {
    expect(reviewDueTargets([row({ review_due_at: at(DUE_SOON_WINDOW_DAYS) })], NOW)).toHaveLength(1)
    expect(reviewDueTargets([row({ review_due_at: at(DUE_SOON_WINDOW_DAYS + 1) })], NOW)).toHaveLength(0)
    // exactly now is not overdue yet; a moment earlier is
    expect(reviewDueTargets([row({ review_due_at: NOW.toISOString() })], NOW)[0].overdue).toBe(false)
    expect(reviewDueTargets([row({ review_due_at: at(-0.001) })], NOW)[0].overdue).toBe(true)
  })
})
