/**
 * Phase 57 -- SHL-01 the one screen's structure.
 * Frame half live from 57-02; page / layout / pathways halves are filled by
 * 57-04 and 57-06.
 * Registration: playwright.config.ts `phase57` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')

/** Naive brace-matched body of `function <name>(...) { ... }`. */
function functionBody(src: string, name: string): string {
  const sig = src.indexOf(`function ${name}(`)
  if (sig === -1) return ''
  const start = src.indexOf('{', src.indexOf(')', sig))
  let depth = 0
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++
    if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1)
  }
  return src.slice(start)
}

test.describe('SHL-01 frame', () => {
  const FRAME = read('src/components/shell/ShellFrame.tsx')
  const ACCOUNT = read('src/components/shell/AccountControl.tsx')

  test('ShellFrame renders three panes with the shell test ids', () => {
    for (const id of [
      'shell',
      'shell-search',
      'shell-room-row',
      'shell-dept-row',
      'shell-machine-row',
      'shell-stage',
      'shell-edit-site',
      'shell-no-site',
      'shell-detail',
      'shell-detail-close',
      'shell-dept-machine',
    ]) {
      expect(FRAME, id).toContain(`data-testid="${id}"`)
    }
    expect(FRAME).toContain('export function ShellFrame')
    expect(FRAME).toContain('export interface ShellSite')
    expect(FRAME).toContain('export interface ShellFrameProps')
    expect(FRAME).toContain('flyInset={0}')
  })

  test('the panes collapse by CSS only: no viewport hook, no navigation import, no header or nav element', () => {
    expect(FRAME).not.toContain('useViewport')
    expect(FRAME).not.toMatch(/from ['"]next\/navigation['"]/)
    expect(FRAME).not.toMatch(/router\./)
    expect(FRAME).not.toMatch(/<header|<nav|role="banner"/)
    expect(FRAME).toContain('hidden min-w-0 flex-1 lg:block')
    expect(FRAME).toContain('lg:w-64')
    expect(FRAME).toContain('lg:w-100')
  })

  test('place state is seeded by parsePlace and written only by select(), which also replaces the URL', () => {
    expect(FRAME).toMatch(/useState<Place>\(\(\) => parsePlace\(initialPlace\)\)/)
    expect((FRAME.match(/replaceState/g) ?? []).length).toBe(1)
    const select = functionBody(FRAME, 'select')
    expect(select).toContain('setPlace(p)')
    expect(select).toContain("window.history.replaceState(null, '', formatPlace(p))")
    expect((FRAME.match(/setPlace\(/g) ?? []).length).toBe(1)
  })

  test('map, list, close button and department machines all call select()', () => {
    expect(FRAME).toMatch(/onMachineClick=\{\(id\) => select\(\{ kind: 'machine', id \}\)\}/)
    expect(FRAME).toMatch(/onRoomClick=\{/)
    expect(FRAME).toContain('ROOM_IDS.find(')
    expect(FRAME).toMatch(/data-testid="shell-machine-row"[\s\S]{0,300}select\(\{ kind: 'machine'/)
    expect(FRAME).toMatch(/data-testid="shell-room-row"[\s\S]{0,300}select\(\{ kind: 'room'/)
    expect(FRAME).toMatch(/data-testid="shell-dept-row"[\s\S]{0,300}select\(\{ kind: 'dept'/)
    expect(FRAME).toMatch(/data-testid="shell-detail-close"[\s\S]{0,200}select\(OVERVIEW\)/)
    expect(FRAME).toMatch(/data-testid="shell-dept-machine"[\s\S]{0,200}select\(\{ kind: 'machine'/)
  })

  test('the camera effect never navigates; it flies, frames a department or refits', () => {
    const at = FRAME.indexOf('The camera follows the place')
    expect(at).toBeGreaterThan(-1)
    const effect = FRAME.slice(at, FRAME.indexOf('[placeKey', at))
    expect(effect).toContain('stage.flyTo(')
    expect(effect).toContain('stage.fitMachines(')
    expect(effect).toContain('stage.fit()')
    expect(effect).not.toMatch(/select\(|setPlace|replaceState/)
  })

  test('an unknown machine or department, or edit without rights, resolves to the overview in render', () => {
    const resolve = functionBody(FRAME, 'resolvePlace')
    expect(resolve).toContain('ctx.canEdit ? place : OVERVIEW')
    expect(resolve).toContain('if (ctx.loading) return place')
    expect(resolve).toMatch(/machines\.some\(/)
    expect(resolve).toMatch(/departments\.some\(/)
  })

  test('Escape selects the overview, ignored while typing and in edit mode', () => {
    expect(FRAME).toContain("e.key !== 'Escape'")
    expect(FRAME).toContain('isTypingTarget(e.target)')
    expect(FRAME).toContain('selectRef.current(OVERVIEW)')
    expect(FRAME).toMatch(/if \(editing\) return/)
    expect(functionBody(FRAME, 'isTypingTarget')).toMatch(/INPUT[\s\S]*TEXTAREA[\s\S]*SELECT[\s\S]*isContentEditable/)
  })

  test('the detail content is keyed by the place so per-place state resets', () => {
    expect(FRAME).toContain('<div key={placeKey}>')
    expect(FRAME).toContain('data-place={placeKey}')
  })

  test('edit mode swaps the stage and detail for one column rendered by renderEdit', () => {
    expect(FRAME).toContain('renderEdit(() => select(OVERVIEW))')
  })

  test('AccountControl carries email, Profile, Sign out and admin-only Pathways and Feedback', () => {
    expect(ACCOUNT).toContain('data-testid="shell-account"')
    expect(ACCOUNT).toContain('data-testid="shell-sign-out"')
    expect(ACCOUNT).toContain("from '@/actions/auth'")
    expect(ACCOUNT).toContain('<form action={signOut}')
    expect(ACCOUNT).toContain('href="/profile"')
    expect(ACCOUNT).toMatch(/isAdmin &&[\s\S]*href="\/pathways"[\s\S]*href="\/uat"/)
  })

  test('the frame is the only non-plant importer of the stage, and stays free of the canvas engine', () => {
    expect(FRAME).toContain("from '@/components/sop/plant/PlantStage'")
    expect(FRAME).not.toMatch(/konva/i)
  })
})

test.describe('SHL-01 one screen structure', () => {
  test('the root page renders the landing signed out and the one screen signed in', () => {
    const page = read('src/app/page.tsx')
    expect(page).toContain('getSessionContext(')
    expect(page).toMatch(/if \(!userId\) return <Landing \/>/)
    expect(page).toContain("redirect('/pending')")
    expect(page).toContain('<ProtectedProviders')
    expect(page).toContain('<OneScreen')
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
    expect(layout).toContain("import { BackToSite }")
    expect(layout).toContain("import { ProtectedProviders")
    expect(layout).not.toContain('TopHeader')
    const shellDir = path.join(ROOT, 'src/components/shell')
    const files = ['src/app/(protected)/layout.tsx', 'src/app/page.tsx', ...fs.readdirSync(shellDir).map((f) => `src/components/shell/${f}`)]
    for (const f of files) expect(read(f), f).not.toMatch(/<header|role="banner"|<nav/)
    const back = read('src/components/layout/BackToSite.tsx')
    expect(back).toContain('placeForPath(')
    expect(back).toContain('data-testid="back-to-site"')
    expect(back).not.toMatch(/<header|<nav/)
    for (const f of ['TopHeader', 'NotificationBadge', 'NavPendingSpinner']) {
      expect(fs.existsSync(path.join(ROOT, `src/components/layout/${f}.tsx`)), f).toBe(false)
    }
    const pending = read('src/app/(protected)/pending/page.tsx')
    expect(pending).toContain('action={signOut}')
    expect(pending).toContain('data-testid="pending-sign-out"')
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
    expect([...found].filter((r) => !mapped.has(r)).sort()).toEqual([])
  })
})
