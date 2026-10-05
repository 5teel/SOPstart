/**
 * Phase 59 -- retirement sweep (stub; Wave 0 / 59-01).
 * Filled by: 59-13 (addresses redirect to Office places), 59-14 (governance, team,
 * access pages and org-model canvases deleted), 59-15 (supervisor activity view
 * and the supervisor half of the completion page deleted). Negative assertions
 * that quote a retired literal live here (the repoint inventory walk excludes
 * this folder). Assert the absence of REFERENCES, not only of files
 * (CLAUDE.md 2026-08-04).
 * Registration: playwright.config.ts `phase59` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
// Helpers the owning plans use when they flip the fixme cases live.
export const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')

export function stripComments(src: string): string {
  return src
    .split('\n')
    .map((line) => (/^\s*(\/\/|\/\*|\*\/|\*)/.test(line) ? '' : line))
    .join('\n')
}

export function walkSrc(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walkSrc(full, out)
    else if (/\.tsx?$/.test(e.name)) out.push(full)
  }
  return out
}

test.describe('retire: legacy addresses redirect to Office places (59-13)', () => {
  const LEGACY_HREF = /(?:href=\{?|href:|route:|router\.(?:replace|push)\(|redirect\(|location\.href\s*=)\s*['"`]\/(?:governance|admin\/team|admin\/access)(?:['"`?/]|$)/
  test('the proxy sends the governance, team and access addresses to their Office places with fixed templates', () => {
    const proxy = stripComments(read('src/lib/supabase/middleware.ts'))
    expect(proxy).toContain("path === '/sops' || path === '/governance' || path === '/admin/team' || path === '/admin/access'")
    expect(proxy).toContain('officeRedirectFor(path, request.nextUrl.search)')
    // the destinations are plain templates in the helper; the proxy builds nothing from the query
    const helper = stripComments(read('src/lib/shell/place.ts'))
    for (const dest of ["'/?place=office'", "'/?place=office&tab=people'", '`/?place=office&tab=access${']) expect(helper, dest).toContain(dest)
    expect(proxy).not.toContain('sop=${')
  })
  test('the sop query is UUID-gated and cookies are copied onto the redirect', () => {
    const helper = stripComments(read('src/lib/shell/place.ts'))
    expect(helper).toContain('sop && UUID.test(sop)')
    const proxy = stripComments(read('src/lib/supabase/middleware.ts'))
    expect(proxy).toContain('NextResponse.redirect(new URL(office, request.url))')
    expect(proxy).toContain('response.cookies.getAll().forEach((c) => redirect.cookies.set(c))')
  })
  test('no client effect redirects any of the legacy addresses', () => {
    const offenders = walkSrc(path.join(ROOT, 'src'))
      .filter((f) => /router\.(replace|push)\(\s*['"`]\/(governance|admin\/team|admin\/access)/.test(stripComments(fs.readFileSync(f, 'utf-8'))))
      .map((f) => path.relative(ROOT, f))
    expect(offenders, offenders.join('\n')).toEqual([])
  })
  test('the old Office card bridge links are gone, and no shell, office or journeys source names a legacy address as a link or route', () => {
    for (const f of ['src/components/shell/AdminRoomBodies.tsx', 'src/components/shell/OfficeCard.tsx', 'src/components/shell/AdminShell.tsx', 'src/components/shell/WorkerShell.tsx', 'src/lib/journeys/journeys.ts']) {
      expect(LEGACY_HREF.test(stripComments(read(f))), f).toBe(false)
    }
    const officeDir = path.join(ROOT, 'src/components/office')
    for (const f of fs.readdirSync(officeDir)) {
      expect(LEGACY_HREF.test(stripComments(read(`src/components/office/${f}`))), f).toBe(false)
    }
    // the training bridge is the one new address, linked from the Smoko room (A-05)
    expect(read('src/components/shell/AdminShell.tsx')).toContain('href="/admin/training"')
    const page = stripComments(read('src/app/(protected)/admin/training/page.tsx'))
    expect(page.indexOf('requireAdminContext()')).toBeGreaterThan(-1)
    expect(page.indexOf('requireAdminContext()')).toBeLessThan(page.indexOf('listOrgTree()'))
  })
})

test.describe('retire: governance, team and access pages (59-14)', () => {
  test.fixme(true, 'flips live in 59-14')
  test('the three page directories are gone', () => {})
  test('the named components and the org-model canvases are gone', () => {})
  test('no src file links to the retired addresses (anchored on href or a router call, so the proxy source strings are not counted)', () => {})
})

test.describe('retire: supervisor activity view and completion supervisor half (59-15)', () => {
  test.fixme(true, 'flips live in 59-15')
  test('the supervisor activity view and its filter, summary card and reject sheet are gone', () => {})
  test('a non-owner opening a completion address is sent to the Office by the server page, never a client effect', () => {})
})
