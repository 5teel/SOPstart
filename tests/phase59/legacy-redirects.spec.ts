/**
 * Phase 59 -- legacy redirects. Decision D-13.
 * Owners: 59-13 (proxy + place), 59-15 (completion page). Registration: playwright.config.ts `phase59`.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { officeRedirectFor, placeForPath } from '@/lib/shell/place'

const SOP = '0b0e0d6a-1c2d-4e5f-8a9b-0c1d2e3f4a5b'
const proxy = fs.readFileSync(path.join(process.cwd(), 'src/lib/supabase/middleware.ts'), 'utf-8').replace(/\r\n/g, '\n')

test.describe('legacy redirects (59-13)', () => {
  test('officeRedirectFor maps governance, team, access (with and without a UUID sop) and the attention / access views to Office places', () => {
    expect(officeRedirectFor('/governance', '')).toBe('/?place=office')
    expect(officeRedirectFor('/governance', '?view=library')).toBe('/')
    expect(officeRedirectFor('/admin/team', '')).toBe('/?place=office&tab=people')
    expect(officeRedirectFor('/admin/access', '')).toBe('/?place=office&tab=access')
    expect(officeRedirectFor('/admin/access', `?sop=${SOP}`)).toBe(`/?place=office&tab=access&sop=${SOP}`)
    expect(officeRedirectFor('/sops', '?view=attention')).toBe('/?place=office')
    expect(officeRedirectFor('/sops', `?view=access&sop=${SOP}`)).toBe(`/?place=office&tab=access&sop=${SOP}`)
    expect(officeRedirectFor('/sops', '?view=access')).toBe('/?place=office&tab=access')
    expect(officeRedirectFor('/sops', '')).toBe('/')
  })

  test('officeRedirectFor ignores a non-UUID sop value and returns null for unrelated paths', () => {
    expect(officeRedirectFor('/admin/access', '?sop=nope')).toBe('/?place=office&tab=access')
    expect(officeRedirectFor('/admin/access', '?sop=//evil.example/x')).toBe('/?place=office&tab=access')
    expect(officeRedirectFor('/sops', '?view=access&sop=1&evil=https://x')).toBe('/?place=office&tab=access')
    for (const p of ['/', '/activity', '/admin/settings', '/admin/training', '/governance/x', '/admin/team/x', `/sops/${SOP}`]) {
      expect(officeRedirectFor(p, ''), p).toBeNull()
    }
  })

  test('placeForPath no longer claims the retired addresses but keeps settings and the training bridge', () => {
    expect(placeForPath('/admin/settings')).toBe('/?place=office')
    expect(placeForPath('/admin/training')).toBe('/?place=smoko')
    for (const p of ['/governance', '/admin/team', '/admin/access']) expect(placeForPath(p), p).toBe('/')
  })

  test('the proxy block copies cookies and uses fixed destination templates', () => {
    expect(proxy).toContain('officeRedirectFor(path, request.nextUrl.search)')
    expect(proxy).toContain('NextResponse.redirect(new URL(office, request.url))')
    const at = proxy.indexOf('officeRedirectFor(path')
    expect(proxy.slice(at, at + 400)).toContain('response.cookies.getAll().forEach((c) => redirect.cookies.set(c))')
    // the one block covers every legacy address; the helper holds the templates
    expect(proxy).toMatch(/path === '\/sops' \|\| path === '\/governance' \|\| path === '\/admin\/team' \|\| path === '\/admin\/access'/)
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
