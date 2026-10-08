/**
 * Phase 63 / 63-19 -- the structure guards of the old one-screen specs that outlive the rooms.
 *
 * tests/phase57/shell-structure.spec.ts and one-query.spec.ts pinned the room frame; their cases
 * about the root page, the public `/` route, the providers, the header-free layout, the Back bar,
 * the account control, the pathways map and the single inbox read describe code that stays, so they
 * live here, pointed at the home.
 *
 * Registration: playwright.config.ts phase63 project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const filesIn = (rel: string) => {
  const dir = path.join(ROOT, rel)
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.tsx$/.test(f)).map((f) => `${rel}/${f}`) : []
}

test.describe('the home page and its providers', () => {
  test('the root page redirects signed out, sends a member without a role to pending, and mounts the home', () => {
    const page = read('src/app/page.tsx')
    expect(page).toContain('getSessionContext(')
    expect(page).toContain("if (!userId) redirect('/welcome')")
    expect(page).toContain("redirect('/pending')")
    expect(page).toContain('<ProtectedProviders')
    expect(page).toContain('<HomeShell')
    expect(page).not.toMatch(/QueryProvider|RoleProvider/)
    expect(page).not.toContain('useEffect')
    expect(page).not.toContain("'use client'")
    expect(page).toContain(".eq('id', organisationId)")
  })

  test('/ stays a public route in the session proxy', () => {
    expect(read('src/lib/supabase/middleware.ts')).toMatch(/isPublicRoute = path === '\/'/)
  })

  test('ProtectedProviders wraps the query and role providers', () => {
    const src = read('src/components/providers/ProtectedProviders.tsx')
    expect(src).toContain('<QueryProvider>')
    expect(src).toContain('<RoleProvider role={role}>')
  })

  test('the protected layout has no header; bridge pages carry the Back bar', () => {
    const layout = read('src/app/(protected)/layout.tsx')
    expect(layout).toContain('import { BackToSite }')
    expect(layout).toContain('import { ProtectedProviders')
    expect(layout).not.toContain(['Top', 'Header'].join(''))
    const files = ['src/app/(protected)/layout.tsx', 'src/app/page.tsx', ...filesIn('src/components/shell'), 'src/components/home/HomeShell.tsx']
    for (const f of files) expect(read(f), f).not.toMatch(/<header|role="banner"|<nav/)
    const back = read('src/components/layout/BackToSite.tsx')
    expect(back).toContain('backForPath(')
    expect(back).toContain('data-testid="back-to-site"')
    expect(back).not.toMatch(/<header|<nav/)
    for (const f of [['Top', 'Header'], ['Notification', 'Badge'], ['Nav', 'PendingSpinner']].map((p) => p.join(''))) {
      expect(fs.existsSync(path.join(ROOT, `src/components/layout/${f}.tsx`)), f).toBe(false)
    }
    const pending = read('src/app/(protected)/pending/page.tsx')
    expect(pending).toContain('action={signOut}')
    expect(pending).toContain('data-testid="pending-sign-out"')
  })

  test('AccountControl carries email, Profile, Sign out and admin-only Pathways and Feedback', () => {
    const account = read('src/components/shell/AccountControl.tsx')
    expect(account).toContain('data-testid="shell-account"')
    expect(account).toContain('data-testid="shell-sign-out"')
    expect(account).toContain("from '@/actions/auth'")
    expect(account).toContain('<form action={signOut}')
    expect(account).toContain('href="/profile"')
    expect(account).toMatch(/isAdmin &&[\s\S]*href="\/pathways"[\s\S]*href="\/uat"/)
  })

  test('pathways map covers every page route, including /', () => {
    // routes.ts imports server-only (Playwright cannot load it), so the walk is replicated here.
    const found = new Set<string>()
    if (fs.existsSync(path.join(ROOT, 'src/app/page.tsx'))) found.add('/')
    const walkRoutes = (dir: string, segs: string[]) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!e.isDirectory()) continue
        if (e.name === 'api' || e.name.startsWith('@') || e.name.startsWith('_')) continue
        const isGroup = e.name.startsWith('(') && e.name.endsWith(')')
        const next = isGroup ? segs : [...segs, e.name]
        const full = path.join(dir, e.name)
        if (fs.existsSync(path.join(full, 'page.tsx'))) found.add('/' + next.join('/'))
        walkRoutes(full, next)
      }
    }
    walkRoutes(path.join(ROOT, 'src/app'), [])
    const journeys = read('src/lib/journeys/journeys.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const mapped = new Set([...journeys.matchAll(/route: '([^']+)'/g)].map((m) => m[1].split('?')[0]))
    expect(found.has('/')).toBe(true)
    // Phase 59: the governance, team and access pages only redirect to the Office; 59-14 deletes them.
    const REDIRECT_ONLY = new Set(['/governance', '/admin/team', '/admin/access'])
    expect([...found].filter((r) => !mapped.has(r) && !REDIRECT_ONLY.has(r)).sort()).toEqual([])
  })
})

test.describe('one inbox read', () => {
  const LOAD = strip(read('src/lib/governance/load-inbox.ts'))
  const OFFICE = strip(read('src/actions/office.ts'))

  test('load-inbox is a plain module that returns the shared read', () => {
    expect(LOAD).not.toContain("'use server'")
    expect(LOAD).not.toContain('server-only')
    expect(LOAD).not.toContain('createAdminClient')
    expect(LOAD).toContain('export async function loadInbox()')
    expect(LOAD).toContain('export interface LoadedInbox')
    expect(LOAD).toMatch(/governance:[\s\S]*library:[\s\S]*floor:[\s\S]*items:/)
  })

  test('getOfficeInbox reads the shared loadInbox, not a second governance query', () => {
    expect(OFFICE).toContain('await loadInbox(')
    expect(OFFICE).not.toContain('Promise.all(listGovernanceQueue')
  })

  test('completions awaiting sign-off are read once, inside loadInbox', () => {
    expect(LOAD).toContain('listPendingSignOffs()')
    expect(LOAD).toContain('signOffs,')
  })
})
