/**
 * Phase 54 / Plan 54-04 -- ADM-03 admin `/sops` plain table contracts:
 * columns (SOP / Machine / Status / Owner / Checks / Review), five-circle
 * checks row, chips (Where/Status/Owner/Checks), deep-link resolution,
 * row click -> SOP page, Edit -> builder (one chain, SUR-04).
 *
 * Registration: playwright.config.ts `phase54` project
 *   testDir: '.', testMatch: /tests\/phase54\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase54`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import {
  resolveLibraryNav,
  libraryNavToUrl,
  DEFAULT_LIBRARY_NAV,
  type LibraryNav,
} from '@/lib/sop-list/admin-rows'

const ROOT = path.resolve(__dirname, '..', '..')
const TABLE_PATH = path.join(ROOT, 'src', 'components', 'admin', 'AdminLibraryTable.tsx')
const SOPS_PAGE_PATH = path.join(ROOT, 'src', 'app', '(protected)', 'sops', 'page.tsx')
const WORKER_LIST_PATH = path.join(ROOT, 'src', 'components', 'sop', 'WorkerSimpleList.tsx')
const WORKER_SIGNAL_PATH = path.join(ROOT, 'src', 'lib', 'sop', 'worker-signal.ts')
const CATEGORY_BUTTON_PATH = path.join(
  ROOT, 'src', 'app', '(protected)', 'admin', 'sops', 'builder', '[sopId]', 'BuilderCategoryButton.tsx'
)
const STAGE_SHELL_PATH = path.join(
  ROOT, 'src', 'app', '(protected)', 'admin', 'sops', 'builder', '[sopId]', 'BuilderStageShell.tsx'
)

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n')
}

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

function params(qs: string): URLSearchParams {
  return new URLSearchParams(qs)
}

test.describe('resolveLibraryNav / libraryNavToUrl', () => {
  test('view=attention resolves to the governance sentinel', () => {
    expect(resolveLibraryNav(params('view=attention'))).toBe('governance')
  })

  test('view=access keeps sop and drops departments/collection (SC-4)', () => {
    const nav = resolveLibraryNav(params('view=access&sop=abc&departments=d1&collection=c1'))
    expect(nav).not.toBe('governance')
    expect(nav).toMatchObject({ view: 'access', sop: 'abc' })
    expect((nav as LibraryNav).departments).toBeUndefined()
    expect((nav as LibraryNav).collection).toBeUndefined()
  })

  test('status draft/published/failed map to DRAFT/LIVE/STUCK', () => {
    expect((resolveLibraryNav(params('status=draft')) as LibraryNav).status).toBe('DRAFT')
    expect((resolveLibraryNav(params('status=published')) as LibraryNav).status).toBe('LIVE')
    expect((resolveLibraryNav(params('status=failed')) as LibraryNav).status).toBe('STUCK')
    expect((resolveLibraryNav(params('')) as LibraryNav).status).toBe('all')
  })

  test('owner=me resolves owner to me', () => {
    expect((resolveLibraryNav(params('owner=me')) as LibraryNav).owner).toBe('me')
    expect((resolveLibraryNav(params('')) as LibraryNav).owner).toBe('all')
  })

  test('departments passes through, including "none"', () => {
    expect((resolveLibraryNav(params('departments=none')) as LibraryNav).departments).toBe('none')
    expect((resolveLibraryNav(params('departments=d1')) as LibraryNav).departments).toBe('d1')
  })

  test('collection passes through', () => {
    expect((resolveLibraryNav(params('collection=c1')) as LibraryNav).collection).toBe('c1')
  })

  test('empty params resolve to DEFAULT_LIBRARY_NAV', () => {
    expect(resolveLibraryNav(params(''))).toEqual(DEFAULT_LIBRARY_NAV)
  })

  test('round-trips every URL-backed field through libraryNavToUrl', () => {
    for (const qs of [
      'status=draft',
      'status=published&owner=me',
      'departments=d1',
      'departments=none',
      'collection=c1',
      'view=access&sop=abc',
    ]) {
      const nav = resolveLibraryNav(params(qs))
      expect(nav).not.toBe('governance')
      const url = libraryNavToUrl(nav as LibraryNav)
      const resolved = resolveLibraryNav(new URL(url, 'http://x').searchParams)
      expect(resolved).toEqual(nav)
    }
    expect(libraryNavToUrl(DEFAULT_LIBRARY_NAV)).toBe('/sops')
  })
})

test.describe('AdminLibraryTable wiring', () => {
  test("'use client' directive present", () => {
    expect(read(TABLE_PATH).trimStart().startsWith("'use client'")).toBe(true)
  })

  test('AdminAccessLens is loaded only via dynamic( with ssr: false', () => {
    const code = stripComments(read(TABLE_PATH))
    expect(code).toMatch(/dynamic\(\s*\(\)\s*=>\s*import\('@\/components\/sop\/lenses\/AdminAccessLens'\)/)
    expect(code).toMatch(/\{\s*ssr:\s*false\b[^}]*\}/)
  })

  test('AdminAccessLens receives pinnedSopId={nav.sop}', () => {
    expect(stripComments(read(TABLE_PATH))).toContain('pinnedSopId={nav.sop}')
  })

  test('no router navigation at all -- ?view=attention is redirected by the session proxy (2026-09-29)', () => {
    const code = stripComments(read(TABLE_PATH))
    expect(code).toContain("if (resolved === 'governance') return")
    expect(code).not.toContain('router.replace')
    expect(code).not.toContain('router.push')
  })

  test('applyNav writes via window.history.replaceState(', () => {
    const code = stripComments(read(TABLE_PATH))
    const idx = code.indexOf('function applyNav(')
    expect(idx).toBeGreaterThan(-1)
    const body = code.slice(idx, idx + 300)
    expect(body).toContain('window.history.replaceState(')
  })

  test('deriveChecks( and tableStatus( are called, CHECK_ORDER.map is used', () => {
    const code = stripComments(read(TABLE_PATH))
    expect(code).toContain('deriveChecks(')
    expect(code).toContain('tableStatus(')
    expect(code).toContain('CHECK_ORDER.map')
  })

  test('every required testid is present', () => {
    const code = read(TABLE_PATH)
    for (const testid of [
      'library-table',
      'lib-row',
      'lib-check',
      'lib-edit',
      'lib-chip-where',
      'lib-chip-status',
      'lib-chip-owner',
      'lib-chip-checks',
      'lib-access',
    ]) {
      expect(code, `missing data-testid="${testid}"`).toContain(`data-testid="${testid}"`)
    }
  })

  test('exactly one /admin/sops/builder/ href template — the single list-to-builder chain (SUR-04)', () => {
    const code = read(TABLE_PATH)
    const hits = code.match(/\/admin\/sops\/builder\//g) ?? []
    expect(hits.length).toBe(1)
  })

  test('the row title links to /sops/${sop.id}', () => {
    expect(read(TABLE_PATH)).toContain('href={`/sops/${sop.id}`}')
  })

  test('no window.location read, no createClient anywhere in the file', () => {
    const code = stripComments(read(TABLE_PATH))
    expect(code).not.toContain('window.location')
    expect(code).not.toContain('createClient')
  })
})

test.describe('surviving affordances', () => {
  test('WorkerSimpleList passes hasNewerVersion/isRefresherDue/isRefresherOverdue to SopLibraryCard', () => {
    const code = read(WORKER_LIST_PATH)
    expect(code).toContain('hasNewerVersion={sop.hasNewerVersion}')
    expect(code).toContain('isRefresherDue={sop.isRefresherDue}')
    expect(code).toContain('isRefresherOverdue={sop.isRefresherOverdue}')
  })

  test('WorkerSimpleList wires onAdd/onRemove to the real callbacks', () => {
    const code = read(WORKER_LIST_PATH)
    expect(code).toContain('onClick={() => onAdd(sop.id)}')
    expect(code).toContain('onClick={() => onRemove(sop.id)}')
  })

  test('WorkerSimpleList carries worker-list / worker-list-row testids and no builder/walkthrough link', () => {
    const code = read(WORKER_LIST_PATH)
    expect(code).toContain('data-testid="worker-list"')
    expect(code).toContain('data-testid="worker-list-row"')
    expect(code).not.toContain('/admin/sops/builder')
    expect(code).not.toContain('/walkthrough')
  })

  test('worker-signal.ts exports WorkerScope', () => {
    expect(read(WORKER_SIGNAL_PATH)).toContain('export type WorkerScope')
  })

  test('BuilderCategoryButton calls setSopCategory(sopId, next) and imports SOP_CATEGORIES', () => {
    const code = read(CATEGORY_BUTTON_PATH)
    expect(code).toContain('setSopCategory(sopId, next)')
    expect(code).toContain('SOP_CATEGORIES')
  })

  test('BuilderStageShell renders <BuilderCategoryButton sopId={sopId}', () => {
    expect(read(STAGE_SHELL_PATH)).toContain('<BuilderCategoryButton sopId={sopId}')
  })
})

test.describe('page seam (54-04 Task 3): /sops swaps onto the table and the simple list', () => {
  test('page.tsx dynamic-binds WorkerSimpleList and AdminLibraryTable, both ssr: false', () => {
    const code = stripComments(read(SOPS_PAGE_PATH))
    expect(code).toMatch(/dynamic\(\s*\(\)\s*=>\s*import\('@\/components\/sop\/WorkerSimpleList'\)/)
    expect(code).toMatch(/dynamic\(\s*\(\)\s*=>\s*import\('@\/components\/admin\/AdminLibraryTable'\)/)
    const ssrFalseCount = (code.match(/\{\s*ssr:\s*false\b[^}]*\}/g) ?? []).length
    expect(ssrFalseCount).toBeGreaterThanOrEqual(2)
  })

  test('AdminLibraryTable receives onTakeoverChange={setTakeover}', () => {
    expect(read(SOPS_PAGE_PATH)).toContain('onTakeoverChange={setTakeover}')
  })

  test('<WorkerSimpleList receives onAdd={handleAdd} and onRemove={handleRemove}', () => {
    const code = stripComments(read(SOPS_PAGE_PATH))
    const idx = code.indexOf('<WorkerSimpleList')
    expect(idx).toBeGreaterThan(-1)
    const block = code.slice(idx, idx + 700)
    expect(block).toContain('onAdd={handleAdd}')
    expect(block).toContain('onRemove={handleRemove}')
  })

  test('page.tsx contains no lg:grid-cols-[176px (the retired Miller frame)', () => {
    expect(read(SOPS_PAGE_PATH)).not.toContain('lg:grid-cols-[176px')
  })
})
