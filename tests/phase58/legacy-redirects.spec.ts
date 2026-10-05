/**
 * Phase 58 -- FOC-03: legacy address redirects live in the proxy only.
 * Filled by: 58-11 (tab addresses, legacyRedirectFor), 58-14 (builder, versions, review route).
 * Registration: playwright.config.ts `phase58` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { legacyRedirectFor } from '@/lib/sop/focus-path'

const ROOT = path.resolve(__dirname, '..', '..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')
const ID = '0b0e0d6a-1c2d-4e5f-8a9b-0c1d2e3f4a5b'

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(e.name)) out.push(full)
  }
  return out
}

test.describe('FOC-03 legacy redirects', () => {
  test('legacyRedirectFor maps tab addresses to the bare focus address over a UUID-gated id (58-11)', () => {
    expect(legacyRedirectFor(`/sops/${ID}`, '?tab=walk')).toBe(`/sops/${ID}`)
    expect(legacyRedirectFor(`/sops/${ID}`, '?tab=read&job=x')).toBe(`/sops/${ID}`)
    expect(legacyRedirectFor(`/sops/${ID}`, '?from=office')).toBeNull()
    expect(legacyRedirectFor(`/sops/${ID}`, '')).toBeNull()
    expect(legacyRedirectFor('/sops/not-a-uuid', '?tab=walk')).toBeNull()
  })

  test('the proxy blocks and redirects those addresses with refreshed cookies copied onto the redirect (58-11)', () => {
    const MW = read('src/lib/supabase/middleware.ts')
    expect(MW).toContain("import { legacyRedirectFor } from '@/lib/sop/focus-path'")
    const at = MW.indexOf("path.startsWith('/sops/')")
    expect(at).toBeGreaterThan(-1)
    const block = MW.slice(at, at + 600)
    expect(block).toContain('legacyRedirectFor(path, request.nextUrl.search)')
    expect(block).toContain('NextResponse.redirect(new URL(legacy, request.url), 307)')
    expect(block).toContain('response.cookies.getAll().forEach((c) => redirect.cookies.set(c))')
    // It runs after the sign-in gate, so a signed-out visitor still goes to login first.
    expect(at).toBeGreaterThan(MW.indexOf('if (!isPublicRoute && !claims)'))
  })

  test('no client code redirects a legacy address (no router.replace in the page, focus components or walk hook)', () => {
    const files = [
      path.join(ROOT, 'src/app/(protected)/sops/[sopId]/page.tsx'),
      ...walk(path.join(ROOT, 'src/components/focus')),
      path.join(ROOT, 'src/hooks/useWalk.ts'),
    ]
    for (const f of files) expect(fs.readFileSync(f, 'utf-8'), f).not.toMatch(/router\.replace\(/)
  })

  test('builder and versions addresses map to the edit address; nothing else under /admin/sops does (58-14)', () => {
    const edit = `/sops/${ID}?mode=edit`
    expect(legacyRedirectFor(`/admin/sops/builder/${ID}`, '')).toBe(edit)
    expect(legacyRedirectFor(`/admin/sops/${ID}/versions`, '?x=1')).toBe(edit)
    expect(legacyRedirectFor('/admin/sops/builder/not-a-uuid', '')).toBeNull()
    expect(legacyRedirectFor('/admin/sops/builder', '')).toBeNull()
    expect(legacyRedirectFor(`/admin/sops/${ID}/assign`, '')).toBeNull()
    expect(legacyRedirectFor('/admin/sops/new', '')).toBeNull()
    expect(legacyRedirectFor(`/admin/sops/${ID}/versions/diff`, '')).toBeNull()
  })

  test('the proxy runs the same redirect for /admin/sops/ paths, server-side, with cookies copied (58-14)', () => {
    const MW = read('src/lib/supabase/middleware.ts')
    const at = MW.indexOf("path.startsWith('/sops/')")
    expect(MW.slice(at, at + 160)).toContain("path.startsWith('/admin/sops/')")
    expect(MW.slice(at, at + 700)).toContain('legacyRedirectFor(path, request.nextUrl.search)')
    expect(at).toBeGreaterThan(MW.indexOf('if (!isPublicRoute && !claims)'))
  })

  test('the next.config review-route redirect is retargeted at the edit address (58-14)', () => {
    const cfg = read('next.config.ts')
    const at = cfg.indexOf("source: '/admin/sops/:sopId/review'")
    expect(at).toBeGreaterThan(-1)
    expect(cfg.slice(at, at + 160)).toContain("destination: '/sops/:sopId?mode=edit'")
  })
})
