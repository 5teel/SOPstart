/**
 * Phase 41 Plan 03 — source-contract spec for `listAdminAccessData`
 * (src/actions/admin-access-view.ts) and `AdminAccessLens`
 * (src/components/sop/lenses/AdminAccessLens.tsx).
 *
 * Pins: guard-before-first-read ordering (positional — the guard must run
 * before BOTH ensureSopCollections and the first raw .from( read,
 * CLAUDE.md 2026-07-28), the guard-failure return shape, the CR-02
 * ensure-before-collections-read ordering, the single .in('collection_id',
 * …) join read (no per-collection loop), the absence of the departments/
 * collection parameters and of createAdminClient, and the lens's
 * useQuery + WiringPatchBayShell wiring with a callback-only exit.
 *
 * All assertions run against COMMENT-STRIPPED source so the files' own
 * explanatory comments (which quote these same tokens) cannot satisfy an
 * assertion about the code. Normalises \r\n to \n per CLAUDE.md 2026-07-18.
 *
 * Registration: playwright.config.ts `phase41` project
 *   testDir: '.', testMatch: /tests\/phase41\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase41 -g "access"`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const ACTION = path.join(ROOT, 'src', 'actions', 'admin-access-view.ts')
const LENS = path.join(ROOT, 'src', 'components', 'sop', 'lenses', 'AdminAccessLens.tsx')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n')
}

/** Strips // line comments and /* block comments *[/] so assertions can't be
 * satisfied by a comment merely quoting the token being checked. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

test.describe('listAdminAccessData — extracted access-view action', () => {
  test('requireAdminContext() appears BEFORE the first .from( call (positional guard)', () => {
    const code = stripComments(read(ACTION))
    const guardIndex = code.indexOf('requireAdminContext()')
    const firstFromIndex = code.indexOf('.from(')
    expect(guardIndex).toBeGreaterThan(-1)
    expect(firstFromIndex).toBeGreaterThan(-1)
    expect(guardIndex).toBeLessThan(firstFromIndex)
  })

  test('requireAdminContext() appears BEFORE the ensureSopCollections call (positional guard)', () => {
    const code = stripComments(read(ACTION))
    const guardIndex = code.indexOf('requireAdminContext()')
    const ensureCallIndex = code.indexOf('ensureSopCollections(params.sop)')
    expect(guardIndex).toBeGreaterThan(-1)
    expect(ensureCallIndex).toBeGreaterThan(-1)
    expect(guardIndex).toBeLessThan(ensureCallIndex)
  })

  test('returns { error: ctx.error } when the guard fails', () => {
    const code = stripComments(read(ACTION))
    expect(code).toMatch(/if\s*\(\s*'error'\s*in\s*ctx\s*\)\s*return\s*\{\s*error:\s*ctx\.error\s*\}/)
  })

  test('ensureSopCollections is awaited BEFORE the collections read (CR-02 ordering)', () => {
    const code = stripComments(read(ACTION))
    const ensureCallIndex = code.indexOf('ensureSopCollections(params.sop)')
    const collectionsFromIndex = code.indexOf("from('collections')")
    expect(ensureCallIndex).toBeGreaterThan(-1)
    expect(collectionsFromIndex).toBeGreaterThan(-1)
    expect(ensureCallIndex).toBeLessThan(collectionsFromIndex)
  })

  test("exactly one .in('collection_id', …) join read — no per-collection loop", () => {
    const code = stripComments(read(ACTION))
    const matches = code.match(/\.in\('collection_id'/g) ?? []
    expect(matches.length).toBe(1)
  })

  test('the params type mentions sop and does NOT mention departments or collection', () => {
    const code = stripComments(read(ACTION))
    expect(code).toContain('params: { sop?: string }')
    expect(code).not.toContain('params.departments')
    expect(code).not.toContain('params.collection')
  })

  test('no createAdminClient anywhere in the file', () => {
    const code = stripComments(read(ACTION))
    expect(code).not.toContain('createAdminClient')
  })

  test("the file's only value export is the async listAdminAccessData function ('use server' constraint)", () => {
    const code = stripComments(read(ACTION))
    const exportLines = code
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('export '))
    expect(exportLines.length).toBeGreaterThan(0)
    for (const line of exportLines) {
      expect(line.startsWith('export async function') || line.startsWith('export interface')).toBe(true)
    }
  })

  test("file opens with 'use server'", () => {
    const raw = read(ACTION)
    expect(raw.trimStart().startsWith("'use server'")).toBe(true)
  })
})

test.describe('AdminAccessLens — client wrapper', () => {
  test("opens with 'use client'", () => {
    const raw = read(LENS)
    expect(raw.trimStart().startsWith("'use client'")).toBe(true)
  })

  test('calls listAdminAccessData inside a useQuery', () => {
    const code = stripComments(read(LENS))
    expect(code).toContain('useQuery(')
    expect(code).toContain('listAdminAccessData(')
  })

  test('imports WiringPatchBayShell', () => {
    const code = stripComments(read(LENS))
    expect(code).toContain('WiringPatchBayShell')
  })

  test('scope exit is a callback (onBack) — no router.push, no <Link, no href=', () => {
    const code = stripComments(read(LENS))
    expect(code).toContain('onBack')
    expect(code).not.toContain('router.push')
    expect(code).not.toContain('<Link')
    expect(code).not.toContain('href=')
  })

  test('renders a loading state', () => {
    const code = stripComments(read(LENS))
    expect(code).toContain('isLoading')
  })

  test("renders an error state from the returned error string, not a hardcoded message", () => {
    const code = stripComments(read(LENS))
    expect(code).toMatch(/'error'\s*in\s*data/)
    expect(code).toContain('{data.error}')
  })
})
