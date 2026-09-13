/**
 * Phase 41 Plan 02 — source-contract spec for `listAdminSopRows`
 * (src/actions/admin-sop-list.ts), extracted from admin/sops/page.tsx.
 *
 * Pins: guard-before-first-read ordering (positional, not mere presence —
 * CLAUDE.md 2026-07-28), the guard-failure return shape, every preserved
 * filter branch (owner, draft-triage order, departments=none audience
 * exclusion, NO_MATCH_ID sentinel, collection resolution), the absence of
 * createAdminClient, and the 'use server' async-only export constraint
 * (CLAUDE.md 2026-06-27).
 *
 * All assertions run against COMMENT-STRIPPED source so the file's own
 * explanatory comments (which quote these same tokens) cannot satisfy an
 * assertion about its code. Normalises \r\n to \n per CLAUDE.md 2026-07-18.
 *
 * Registration: playwright.config.ts `phase41` project
 *   testDir: '.', testMatch: /tests\/phase41\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase41`
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const ACTION = path.join(ROOT, 'src', 'actions', 'admin-sop-list.ts')

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

test.describe('listAdminSopRows — extracted admin SOP list action', () => {
  test('requireAdminContext() appears BEFORE the first .from( call (positional guard)', () => {
    const code = stripComments(read(ACTION))
    const guardIndex = code.indexOf('requireAdminContext()')
    const firstFromIndex = code.indexOf('.from(')
    expect(guardIndex).toBeGreaterThan(-1)
    expect(firstFromIndex).toBeGreaterThan(-1)
    expect(guardIndex).toBeLessThan(firstFromIndex)
  })

  test('returns { error: ctx.error } when the guard fails', () => {
    const code = stripComments(read(ACTION))
    expect(code).toMatch(/if\s*\(\s*'error'\s*in\s*ctx\s*\)\s*return\s*\{\s*error:\s*ctx\.error\s*\}/)
  })

  test('the owner filter is a real .eq(\'owner_user_id\' — not a no-op', () => {
    const code = stripComments(read(ACTION))
    expect(code).toContain("query.eq('owner_user_id'")
    expect(code).toContain('ownerOnly')
  })

  test('draft triage orders on overall_confidence with nullsFirst: true', () => {
    const code = stripComments(read(ACTION))
    expect(code).toMatch(/order\(\s*'overall_confidence'\s*,\s*\{\s*ascending:\s*true,\s*nullsFirst:\s*true\s*\}\s*\)/)
  })

  test("departments === 'none' excludes all_departments rows (both clauses, same expression)", () => {
    const code = stripComments(read(ACTION))
    expect(code).toMatch(/!tagged\.has\(r\.id\)\s*&&\s*!r\.all_departments/)
  })

  test("the NO_MATCH_ID sentinel guards the empty .in('id', …) case", () => {
    const code = stripComments(read(ACTION))
    expect(code).toContain('NO_MATCH_ID')
    expect(code).toMatch(/\.in\('id',\s*filterIds\.length > 0 \? filterIds : \[NO_MATCH_ID\]\)/)
  })

  test('collection resolves through sop_collections', () => {
    const code = stripComments(read(ACTION))
    expect(code).toContain("from('sop_collections')")
    expect(code).toContain("eq('collection_id', params.collection)")
  })

  test('no createAdminClient anywhere in the file', () => {
    const code = stripComments(read(ACTION))
    expect(code).not.toContain('createAdminClient')
  })

  test("the file's only exports are async functions or types ('use server' constraint)", () => {
    const code = stripComments(read(ACTION))
    const exportLines = code
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('export '))
    expect(exportLines.length).toBeGreaterThan(0)
    for (const line of exportLines) {
      expect(line.startsWith('export async function') || line.startsWith('export type')).toBe(true)
    }
  })

  test("file opens with 'use server'", () => {
    const raw = read(ACTION)
    expect(raw.trimStart().startsWith("'use server'")).toBe(true)
  })
})
