/**
 * Phase 59 -- legacy redirects. Decision D-13.
 * Owners: 59-13 (proxy + place), 59-15 (completion page). Registration: playwright.config.ts `phase59`.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { legacyPathRedirect, backForPath } from '@/lib/shell/home-state'

const SOP = '0b0e0d6a-1c2d-4e5f-8a9b-0c1d2e3f4a5b'
const proxy = fs.readFileSync(path.join(process.cwd(), 'src/lib/supabase/middleware.ts'), 'utf-8').replace(/\r\n/g, '\n')

test.describe('legacy redirects (59-13, repointed by 63-13)', () => {
  test('legacyPathRedirect maps governance, team, access (with and without a UUID sop) and the attention / access views to home sections', () => {
    expect(legacyPathRedirect('/governance', '')).toBe('/?s=signoffs')
    expect(legacyPathRedirect('/governance', '?view=library')).toBe('/')
    expect(legacyPathRedirect('/admin/team', '')).toBe('/?s=people')
    expect(legacyPathRedirect('/admin/access', '')).toBe('/?s=people&tab=access')
    expect(legacyPathRedirect('/admin/access', `?sop=${SOP}`)).toBe(`/?s=people&tab=access&pin=${SOP}`)
    expect(legacyPathRedirect('/sops', '?view=attention')).toBe('/?s=signoffs')
    expect(legacyPathRedirect('/sops', `?view=access&sop=${SOP}`)).toBe(`/?s=people&tab=access&pin=${SOP}`)
    expect(legacyPathRedirect('/sops', '?view=access')).toBe('/?s=people&tab=access')
    expect(legacyPathRedirect('/sops', '')).toBe('/')
  })

  test('legacyPathRedirect ignores a non-UUID sop value and returns null for unrelated paths', () => {
    expect(legacyPathRedirect('/admin/access', '?sop=nope')).toBe('/?s=people&tab=access')
    expect(legacyPathRedirect('/admin/access', '?sop=//evil.example/x')).toBe('/?s=people&tab=access')
    expect(legacyPathRedirect('/sops', '?view=access&sop=1&evil=https://x')).toBe('/?s=people&tab=access')
    for (const p of ['/', '/activity', '/admin/settings', '/admin/training', '/governance/x', '/admin/team/x', `/sops/${SOP}`]) {
      expect(legacyPathRedirect(p, ''), p).toBeNull()
    }
  })

  test('backForPath sends settings to Manage and the training bridge to Training; the retired addresses go to the home', () => {
    expect(backForPath('/admin/settings')).toBe('/?s=manage')
    expect(backForPath('/admin/training')).toBe('/?s=training')
    for (const p of ['/governance', '/admin/team', '/admin/access']) expect(backForPath(p), p).toBe('/')
  })

  test('the proxy block copies cookies and uses fixed destination templates', () => {
    expect(proxy).toContain('legacyPathRedirect(path, request.nextUrl.search)')
    expect(proxy).toContain('NextResponse.redirect(new URL(office, request.url))')
    const at = proxy.indexOf('legacyPathRedirect(path')
    expect(proxy.slice(at, at + 400)).toContain('response.cookies.getAll().forEach((c) => redirect.cookies.set(c))')
    // the one block covers every legacy address; the helper holds the templates
    expect(proxy).toMatch(/path === '\/sops' \|\| path === '\/governance' \|\| path === '\/admin\/team' \|\| path === '\/admin\/access'/)
  })

  test('next.config sends the old departments and site addresses to Manage > Site & departments', () => {
    const cfg = fs.readFileSync(path.join(process.cwd(), 'next.config.ts'), 'utf-8')
    expect(cfg).not.toContain('place=edit')
    for (const source of ['/admin/departments', '/admin/site']) {
      expect(cfg, source).toMatch(new RegExp(String.raw`source: '${source}',\s*destination: '/\?s=manage&view=site',\s*permanent: false`))
    }
  })
})

test.describe('legacy redirects (59-15)', () => {
  test('a non-owner opening a completion address is redirected to the Office by the server page, with the role read from the session (59-15)', () => {
    const page = fs.readFileSync(path.join(process.cwd(), 'src/app/(protected)/activity/[completionId]/page.tsx'), 'utf-8').replace(/\r\n/g, '\n')
    // role comes from getSessionContext, never a prop or the URL
    expect(page).toMatch(/const \{[^}]*\brole\b[^}]*\} = await getSessionContext\(\)/)
    expect(page).toContain("role === 'worker' ? '/activity' : '/?place=office'")
    // the unreadable row and the not-yours row take the same exit, and it is a server redirect
    expect(page).toContain('if (!data || data.worker_id !== userId) redirect(away)')
    expect(page).not.toContain("'use client'")
    expect(page).not.toMatch(/useEffect|router\.replace/)
  })
})
