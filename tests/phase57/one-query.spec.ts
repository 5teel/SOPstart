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
const OFFICE = read('src', 'actions', 'office.ts')

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

  test('getOfficeInbox and getAdminShell both read the same loadInbox (59-14: the governance page is gone)', () => {
    expect(strip(OFFICE)).toContain('loadInbox')
    expect(strip(OFFICE)).toContain('await loadInbox(')
    expect(strip(OFFICE)).not.toContain('Promise.all(listGovernanceQueue')
    expect(strip(SHELL)).toContain("from '@/lib/governance/load-inbox'")
    expect(strip(SHELL)).toContain('await loadInbox(')
  })

  test('getAdminShell is an admin-gated action with no org or role parameter', () => {
    const src = strip(SHELL)
    expect(src.split('\n')[0]).toContain("'use server'")
    expect(src).toContain('export async function getAdminShell()')
    expect(src.indexOf('requireAdminContext()')).toBeGreaterThan(-1)
    expect(src.indexOf('requireAdminContext()')).toBeLessThan(src.indexOf('await loadInbox('))
    expect(src).toContain('inboxCount: officePinCount(inbox.items, inbox.requests)')
    expect(src).toContain(".eq('organisation_id', ctx.organisationId)")
    expect(src).toContain(".eq('placement', 'site')")
    expect(src).not.toContain('createAdminClient')
    expect(src).not.toContain('server-only')
    // a 'use server' file exports only async functions (types are erased)
    const exports = src.match(/^export (?!async function|interface|type)\S+/gm)
    expect(exports).toBeNull()
  })

  test('completions awaiting sign-off ARE inside the inbox count (Phase 59 D-05), read once in loadInbox', () => {
    expect(strip(LOAD)).toContain('listPendingSignOffs()')
    expect(strip(LOAD)).toContain('signOffs,')
    // the shell action only counts the one list; it reads no completion table itself
    expect(strip(SHELL)).not.toMatch(/completion/i)
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

  test('the pin and card read the pane own inbox query, only for a supervisor (59-12, A-11)', () => {
    expect(WORKER).toContain('queryKey: OFFICE_INBOX_KEY')
    expect(WORKER).toContain('queryFn: () => getOfficeInbox()')
    expect(WORKER).toContain('enabled: isSupervisor')
    expect(WORKER).toContain('officePinCount(inbox.items, inbox.requests)')
    expect(WORKER).not.toContain("c.status === 'pending_sign_off'")
    expect(fs.existsSync(path.join(ROOT, 'src', 'hooks', 'useCompletions.ts'))).toBe(true)
    expect(strip(read('src', 'hooks', 'useCompletions.ts'))).not.toContain('pending-count')
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

  test('OneScreen imports WorkerShell statically so the / gate measures the worker download', () => {
    const src = strip(read('src', 'components', 'shell', 'OneScreen.tsx'))
    expect(src).toMatch(/^import \{[^}]*\bWorkerShell\b[^}]*\} from '@\/components\/shell\/WorkerShell'/m)
    expect(src).not.toMatch(/import\('@\/components\/shell\/WorkerShell'\)/)
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
    expect((ADMIN.match(/const inboxCount =/g) ?? []).length).toBe(1)
    expect(ADMIN).toContain('data?.inboxCount')
  })

  test('there is one admin read, one sign-off read, and sign-offs stay out of the inbox number', () => {
    // Phase 59-03: the key moved to the shared module; the shell imports it, never re-spells it.
    expect((read('src', 'lib', 'shell', 'query-keys.ts').match(/\['shell-admin'\]/g) ?? []).length).toBe(1)
    expect(ADMIN).toContain("import { SHELL_KEY } from '@/lib/shell/query-keys'")
    expect((ADMIN.match(/\['shell-admin'\]/g) ?? []).length).toBe(0)
    expect((ADMIN.match(/queryFn: \(\) => getAdminShell\(\)/g) ?? []).length).toBe(1)
    expect(ADMIN).toContain('inboxChips.signoff')
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
