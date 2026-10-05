/**
 * Phase 58 -- retirement sweep (stub; Wave 0 / 58-01).
 * Filled by: 58-11 (tab redirect), 58-14 (builder/versions redirect, converter),
 * 58-16 (deletions). Negative assertions that quote a retired literal live here
 * (the repoint inventory walk excludes this folder).
 * Registration: playwright.config.ts `phase58` project.
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

test.describe('retire: the tabbed SOP page (58-11)', () => {
  test('the proxy redirects a SOP address carrying the tab query to the bare SOP address (UUID-gated, fixed destination, cookies copied)', () => {
    const MW = stripComments(read('src/lib/supabase/middleware.ts'))
    expect(MW).toContain("path.startsWith('/sops/')")
    expect(MW).toContain('legacyRedirectFor(path, request.nextUrl.search)')
    expect(MW).toContain('response.cookies.getAll().forEach((c) => redirect.cookies.set(c))')
  })

  test('no client effect redirects a tab address (no router.replace or push of it anywhere in src)', () => {
    const offenders: string[] = []
    for (const f of walkSrc(path.join(ROOT, 'src'))) {
      const code = stripComments(fs.readFileSync(f, 'utf-8'))
      if (/router\.(replace|push)\([^)]*[?&]tab=/.test(code)) offenders.push(path.relative(ROOT, f))
    }
    expect(offenders).toEqual([])
  })

  test('the SOP route no longer mounts the tabs or the old walkthrough', () => {
    const PAGE = stripComments(read('src/app/(protected)/sops/[sopId]/page.tsx'))
    for (const gone of ['SopTabNav', 'ReadTab', 'WalkthroughSwitcher', 'WorkerPreviewToggle', 'useActiveTab']) expect(PAGE, gone).not.toContain(gone)
  })
})

test.describe('retire: builder and versions addresses (58-14)', () => {
  test.fixme(true, 'flips live in 58-14')
  test('the proxy redirects the builder address and the versions address to the SOP edit address', () => {})
  test('the review-route redirect in next.config targets the edit address (or chains through the proxy)', () => {})
  test('the converter refuses --apply and tells the caller it is retired', () => {})
})

test.describe('retire: deleted components, routes and modules (58-16)', () => {
  test.fixme(true, 'flips live in 58-16')
  test('no src file references any 58-16 token (references, not just files -- CLAUDE.md 2026-08-04)', () => {})
  test('the builder directory and the versions directory are gone', () => {})
  test('submitCompletion takes no client-supplied step data and no ack trace parameter', () => {})
  test('requireSopEditAccess has no junction arm', () => {})
})
