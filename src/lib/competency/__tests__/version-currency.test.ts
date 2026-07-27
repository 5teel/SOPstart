import { test, expect } from '@playwright/test'
import { isOutdatedVersion } from '@/lib/competency/version-currency'

test.describe('isOutdatedVersion', () => {
  test('no completion -> false (never orphan, never demote)', () => {
    expect(isOutdatedVersion(null, 3)).toBe(false)
  })

  test('completed the current version -> false', () => {
    expect(isOutdatedVersion(3, 3)).toBe(false)
  })

  test('completed an older version -> true (supersede scenario)', () => {
    expect(isOutdatedVersion(1, 2)).toBe(true)
  })

  test('unknown current version -> false (never fabricates a chip)', () => {
    expect(isOutdatedVersion(2, null)).toBe(false)
  })
})
