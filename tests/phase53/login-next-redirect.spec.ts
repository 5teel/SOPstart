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
import fs from 'node:fs'
import path from 'node:path'
import { safeNextPath } from '@/lib/auth/next-redirect'

const ROOT = path.resolve(__dirname, '..', '..')
function read(p: string): string {
  return fs.readFileSync(path.join(ROOT, p), 'utf-8')
}
// Mirrors tests/phase41/merged-surface.spec.ts: strip comments before
// asserting, so a comment can never satisfy or trip an assertion
// (CLAUDE.md 2026-09-28).
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

test.describe('safeNextPath', () => {
  test('accepts a plain relative path, with query and/or hash', () => {
    expect(safeNextPath('/m/AB12CD')).toBe('/m/AB12CD')
    expect(safeNextPath('/sops/AB12?from=office')).toBe('/sops/AB12?from=office')
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
  test('middleware imports safeNextPath from the shared guard', () => {
    const src = stripComments(read('src/lib/supabase/middleware.ts'))
    expect(src).toContain("from '@/lib/auth/next-redirect'")
  })

  test('the unauthenticated redirect sets ?next= and skips /api/* paths', () => {
    const src = stripComments(read('src/lib/supabase/middleware.ts'))
    expect(src).toContain("searchParams.set('next'")
    expect(src).toContain("startsWith('/api/')")
  })

  test('the signed-in auth-route branch prefers a validated next over roleHome', () => {
    const src = stripComments(read('src/lib/supabase/middleware.ts'))
    const idx = src.indexOf("safeNextPath(request.nextUrl.searchParams.get('next'))")
    expect(idx).toBeGreaterThan(-1)
    expect(src.indexOf('roleHome(role)')).toBeGreaterThan(idx)
  })

  test('the login page type accepts next and passes it to LoginForm', () => {
    const src = stripComments(read('src/app/(auth)/login/page.tsx'))
    expect(src).toContain('next?: string')
    expect(src).toMatch(/<LoginForm next=\{next\}/)
  })

  test('LoginForm calls loginWithEmail with data and next', () => {
    const src = stripComments(read('src/components/auth/LoginForm.tsx'))
    expect(src).toContain('loginWithEmail(data, next)')
  })

  test('auth.ts redirects via safeNextPath(next) ?? roleHome(...) and never defines its own safeNextPath', () => {
    const src = stripComments(read('src/actions/auth.ts'))
    expect(src).toMatch(/redirect\(safeNextPath\(next\) \?\? roleHome\(/)
    expect(src).not.toContain('function safeNextPath')
  })
})
