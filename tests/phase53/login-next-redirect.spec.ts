/**
 * Phase 53 -- PHN-02. Unit tests for the safe `?next=` path guard, and
 * source-contract tests for how it is wired through middleware, the login
 * page, LoginForm and loginWithEmail.
 *
 * Registration: playwright.config.ts `phase53` project
 *   testDir: '.', testMatch: /tests\/phase53\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase53`
 *
 * Static @/ imports only -- CLAUDE.md 2026-06-24.
 */
import { test, expect } from '@playwright/test'
import { safeNextPath } from '@/lib/auth/next-redirect'

test.describe('safeNextPath', () => {
  test('accepts a plain relative path, with query and/or hash', () => {
    expect(safeNextPath('/m/AB12CD')).toBe('/m/AB12CD')
    expect(safeNextPath('/sops?tab=walk')).toBe('/sops?tab=walk')
    expect(safeNextPath('/m/AB12CD#top')).toBe('/m/AB12CD#top')
  })

  test('rejects null/undefined/empty and a path missing its leading slash', () => {
    expect(safeNextPath(null)).toBeNull()
    expect(safeNextPath(undefined)).toBeNull()
    expect(safeNextPath('')).toBeNull()
    expect(safeNextPath('m/AB12CD')).toBeNull()
    expect(safeNextPath(' /m/AB12CD')).toBeNull()
  })

  test('rejects absolute/protocol-relative/backslash open-redirect shapes', () => {
    expect(safeNextPath('https://evil.com')).toBeNull()
    expect(safeNextPath('//evil.com')).toBeNull()
    expect(safeNextPath('/\\evil.com')).toBeNull()
    expect(safeNextPath('\\\\evil.com')).toBeNull()
    expect(safeNextPath('javascript:alert(1)')).toBeNull()
  })

  test('rejects /login and /api/* destinations', () => {
    expect(safeNextPath('/login')).toBeNull()
    expect(safeNextPath('/login?next=/x')).toBeNull()
    expect(safeNextPath('/api/sops')).toBeNull()
  })

  test('rejects control characters and overly long paths', () => {
    expect(safeNextPath('/m/AB12CD\r\n')).toBeNull()
    expect(safeNextPath('/' + 'a'.repeat(600))).toBeNull()
  })
})

test.describe('login ?next= wiring', () => {
  test.fixme('login ?next= wiring source-contract tests land in 53-01 Task 3', async () => {})
})
