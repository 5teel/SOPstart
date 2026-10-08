/**
 * Phase 63 -- Recent and Most used. Requirement HOME-02; threat T-63-06. Owner: 63-02.
 * Registration: playwright.config.ts `phase63`.
 */
import { test, expect } from '@playwright/test'
import { mergeRecent, mostUsed, parseRecent, pushRecent } from '../../src/lib/library/recent'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

test.describe('recent', () => {
  test('parseRecent drops everything malformed and never throws', () => {
    expect(parseRecent(null)).toEqual([])
    expect(parseRecent('{not json')).toEqual([])
    expect(parseRecent('{"root":1}')).toEqual([])
    const raw = JSON.stringify([
      { root: id(1), t: 5 },
      { root: 'javascript:alert(1)', t: 6 },
      { root: id(2), t: 'x' },
      { root: id(3), t: null },
      null,
      7,
    ])
    expect(parseRecent(raw)).toEqual([{ root: id(1), t: 5 }])
  })

  test('parseRecent caps at ten entries', () => {
    const raw = JSON.stringify(Array.from({ length: 30 }, (_, i) => ({ root: id(i + 1), t: i })))
    expect(parseRecent(raw)).toHaveLength(10)
  })

  test('pushRecent moves an existing root to the front, caps at ten and ignores non-ids', () => {
    const list = Array.from({ length: 10 }, (_, i) => ({ root: id(i + 1), t: i }))
    const next = pushRecent(list, id(5), 99)
    expect(next[0]).toEqual({ root: id(5), t: 99 })
    expect(next).toHaveLength(10)
    expect(next.filter((e) => e.root === id(5))).toHaveLength(1)
    expect(pushRecent(list, id(50), 99)).toHaveLength(10)
    expect(pushRecent(list, 'nope', 99)).toEqual(list)
  })

  test('mergeRecent takes the latest time per root, newest first, top four', () => {
    const device = [
      { root: id(1), t: Date.parse('2026-10-01T00:00:00Z') },
      { root: id(2), t: Date.parse('2026-10-05T00:00:00Z') },
    ]
    const walks = [{ root: id(1), at: '2026-10-07T00:00:00Z' }]
    const completions = [
      { root: id(3), at: '2026-10-06T00:00:00Z' },
      { root: id(4), at: '2026-09-01T00:00:00Z' },
      { root: id(5), at: '2026-08-01T00:00:00Z' },
      { root: id(6), at: 'not a date' },
    ]
    expect(mergeRecent(device, walks, completions)).toEqual([id(1), id(3), id(2), id(4)])
  })

  test('mostUsed counts non-rejected completions per root, top three, ties by title', () => {
    const rows = [
      { root: id(1), status: 'signed_off', title: 'Zeta' },
      { root: id(1), status: 'pending_sign_off', title: 'Zeta' },
      { root: id(1), status: 'rejected', title: 'Zeta' },
      { root: id(2), status: 'signed_off', title: 'Beta' },
      { root: id(3), status: 'signed_off', title: 'Alpha' },
      { root: id(4), status: 'signed_off', title: 'Gamma' },
      { root: id(5), status: 'rejected', title: 'Omega' },
    ]
    expect(mostUsed(rows)).toEqual([
      { root: id(1), title: 'Zeta', count: 2 },
      { root: id(3), title: 'Alpha', count: 1 },
      { root: id(2), title: 'Beta', count: 1 },
    ])
  })
})
