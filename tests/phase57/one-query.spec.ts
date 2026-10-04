/**
 * Phase 57 -- SHL-05 / PLC-04 one query feeds pin and card.
 * 57-03 fills the loadInbox / getAdminShell contracts; 57-05 owns the parity wiring.
 * Registration: playwright.config.ts `phase57` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), 'utf-8').replace(/\r\n/g, '\n')

const LOAD = read('src', 'lib', 'governance', 'load-inbox.ts')
const SHELL = read('src', 'actions', 'shell.ts')
const PAGE = read('src', 'app', '(protected)', 'governance', 'page.tsx')

/** Drop // and block comments so a comment never satisfies or trips a match. */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

test.describe('SHL-05 one inbox query', () => {
  test('load-inbox is a plain module that returns the shared read', () => {
    const src = strip(LOAD)
    expect(src).not.toContain("'use server'")
    expect(src).not.toContain('server-only')
    expect(src).not.toContain('createAdminClient')
    expect(src).toContain('export async function loadInbox()')
    expect(src).toContain('export interface LoadedInbox')
    expect(src).toMatch(/governance:[\s\S]*library:[\s\S]*floor:[\s\S]*items:/)
  })

  test('governance page and getAdminShell import the same loadInbox', () => {
    expect(strip(PAGE)).toContain("from '@/lib/governance/load-inbox'")
    expect(strip(PAGE)).toContain('await loadInbox(')
    expect(strip(PAGE)).not.toContain('deriveInbox(')
    expect(strip(PAGE)).not.toContain('Promise.all(')
    expect(strip(SHELL)).toContain("from '@/lib/governance/load-inbox'")
    expect(strip(SHELL)).toContain('await loadInbox(')
  })

  test('getAdminShell is an admin-gated action with no org or role parameter', () => {
    const src = strip(SHELL)
    expect(src.split('\n')[0]).toContain("'use server'")
    expect(src).toContain('export async function getAdminShell()')
    expect(src.indexOf('requireAdminContext()')).toBeGreaterThan(-1)
    expect(src.indexOf('requireAdminContext()')).toBeLessThan(src.indexOf('await loadInbox('))
    expect(src).toContain('inboxCount: inbox.items.length')
    expect(src).toContain(".eq('organisation_id', ctx.organisationId)")
    expect(src).toContain(".eq('placement', 'site')")
    expect(src).not.toContain('createAdminClient')
    expect(src).not.toContain('server-only')
    // a 'use server' file exports only async functions (types are erased)
    const exports = src.match(/^export (?!async function|interface|type)\S+/gm)
    expect(exports).toBeNull()
  })

  test('completions awaiting sign-off are not inside the inbox count', () => {
    for (const src of [strip(LOAD), strip(SHELL)]) {
      expect(src).not.toMatch(/completion/i)
    }
  })

  test('the Workshop list is every non-published SOP in the org', () => {
    expect(strip(SHELL)).toContain("s.status !== 'published'")
  })
})

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(e.name)) out.push(full)
  }
  return out
}

test.describe('SHL-05 supervisor parity', () => {
  const WORKER = strip(read('src', 'components', 'shell', 'WorkerShell.tsx'))

  test('one identifier feeds the Office card count and the Office pin', () => {
    expect(WORKER).toContain('count={pending}')
    expect(WORKER).toMatch(/roomPins=\{isSupervisor \? \{ office: pending,/)
    expect((WORKER.match(/const pending =/g) ?? []).length).toBe(1)
  })

  test('the sign-off count is fetched only for a supervisor and counts pending_sign_off', () => {
    expect(WORKER).toContain("useSupervisorCompletions({ type: 'all' }, isSupervisor)")
    expect(WORKER).toContain("c.status === 'pending_sign_off'")
  })

  test('the Office body shows the same number it is handed', () => {
    expect(read('src', 'components', 'shell', 'RoomBodies.tsx')).toContain('pending: number')
    expect(WORKER).toContain('pending={pending}')
  })
})

test.describe('SHL-05 admin seam', () => {
  const MODULE = '@/components/shell/AdminShell'

  test('OneScreen reaches AdminShell only through next/dynamic with ssr off', () => {
    const src = strip(read('src', 'components', 'shell', 'OneScreen.tsx'))
    expect(src).toContain(`import('${MODULE}')`)
    expect(src).toMatch(/dynamic\(\s*\(\) => import\('@\/components\/shell\/AdminShell'\)/)
    expect(src).toContain('ssr: false')
    expect(src).toContain('useIsAdmin()')
    expect(src).toContain('data-testid="shell-loading"')
    expect(src).not.toMatch(/^import .*AdminShell/m)
  })

  test('no other file under src references the AdminShell module', () => {
    const hits = walk(path.join(ROOT, 'src'))
      .filter((f) => !f.endsWith(path.join('shell', 'AdminShell.tsx')))
      .filter((f) => fs.readFileSync(f, 'utf-8').includes(MODULE))
      .map((f) => path.relative(ROOT, f).split(path.sep).join('/'))
    expect(hits).toEqual(['src/components/shell/OneScreen.tsx'])
  })

  test('the worker shell imports nothing from the admin side', () => {
    const src = read('src', 'components', 'shell', 'WorkerShell.tsx')
    expect(src).not.toContain('@/actions/governance')
    expect(src).not.toMatch(/components\/admin/)
    expect(src).not.toMatch(/konva/i)
  })
})

test.describe('SHL-05 admin parity', () => {
  const ADMIN = strip(read('src', 'components', 'shell', 'AdminShell.tsx'))

  test('one identifier feeds the Office card count and the Office pin', () => {
    expect(ADMIN).toContain('count={inboxCount}')
    expect(ADMIN).toContain('office: inboxCount')
    expect(ADMIN).toContain('inboxCount={inboxCount}')
    expect((ADMIN.match(/const inboxCount =/g) ?? []).length).toBe(1)
    expect(ADMIN).toContain('data?.inboxCount')
  })

  test('there is one admin read, one sign-off read, and sign-offs stay out of the inbox number', () => {
    expect((ADMIN.match(/\['shell-admin'\]/g) ?? []).length).toBe(1)
    expect((ADMIN.match(/queryFn: \(\) => getAdminShell\(\)/g) ?? []).length).toBe(1)
    expect(ADMIN).toContain("c.status === 'pending_sign_off'")
    expect(ADMIN).toContain('pendingSignOffs={pendingSignOffs}')
    expect(ADMIN).not.toMatch(/inboxCount\s*[+]/)
  })

  test('edit mode: Done refreshes both reads, the strip sits above the workspace', () => {
    expect(ADMIN).toContain('data-testid="site-edit-done"')
    expect(ADMIN).toContain('queryKey: SHELL_KEY')
    expect(ADMIN).toContain('queryKey: SITE_KEY')
    expect(ADMIN.indexOf('<DepartmentsStrip')).toBeGreaterThan(-1)
    expect(ADMIN.indexOf('<DepartmentsStrip')).toBeLessThan(ADMIN.indexOf('<SiteWorkspace'))
    expect(ADMIN).toContain('key={site.layout.id}')
    expect(ADMIN).toMatch(/^\s+canEdit$/m)
  })
})
