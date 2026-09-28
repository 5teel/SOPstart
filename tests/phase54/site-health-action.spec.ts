/**
 * Phase 54 / Plan 54-01 -- ADM-02/T-54-01 source-contract tests for the new
 * data layer: `listSiteHealthForOrg` (src/actions/site.ts) and the check
 * inputs added to `listAdminSopRows` (src/actions/admin-sop-list.ts).
 *
 * Comments are stripped before every code-shape assertion (CLAUDE.md
 * self-invalidating-header class) so this file's own prose about the guard
 * order can't satisfy or break a positional match.
 *
 * Registration: playwright.config.ts `phase54` project
 *   testDir: '.', testMatch: /tests\/phase54\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase54`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

function read(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8').replace(/\r\n/g, '\n')
}

function stripComments(src: string): string {
  return src
    .split('\n')
    .map((line) => (/^\s*(\/\/|\/\*|\*\/|\*)/.test(line) ? '' : line))
    .join('\n')
}

test.describe('listSiteHealthForOrg (src/actions/site.ts)', () => {
  const raw = read(path.join('src', 'actions', 'site.ts'))
  const stripped = stripComments(raw)

  test('requireAdminContext() precedes listSiteForOrg() and createSignedUrl( inside the function body', () => {
    const body = stripped.split('export async function listSiteHealthForOrg')[1]
    expect(body, 'listSiteHealthForOrg not found').toBeTruthy()
    const guardIdx = body.indexOf('requireAdminContext()')
    const siteIdx = body.indexOf('listSiteForOrg()')
    const signIdx = body.indexOf('createSignedUrl(')
    expect(guardIdx).toBeGreaterThan(-1)
    expect(siteIdx).toBeGreaterThan(guardIdx)
    expect(signIdx).toBeGreaterThan(siteIdx)
  })

  test('checks the ctx error union and returns site.links unfiltered', () => {
    expect(stripped).toContain("if ('error' in ctx)")
    expect(stripped).toContain('links: site.links')
  })

  test('no service-role client; every value export is async', () => {
    expect(raw).not.toContain('createAdminClient')
    const exportLines = stripped.match(/^export .+$/gm) ?? []
    for (const line of exportLines) {
      if (line.startsWith('export type') || line.startsWith('export interface')) continue
      expect(line, `non-async value export: ${line}`).toMatch(/^export async function/)
    }
  })
})

test.describe('listAdminSopRows check inputs (src/actions/admin-sop-list.ts)', () => {
  const raw = read(path.join('src', 'actions', 'admin-sop-list.ts'))
  const stripped = stripComments(raw)

  for (const table of ['approval_chains', 'parse_jobs', 'sop_machines', 'site_machines']) {
    test(`from('${table}') is org-scoped in its statement`, () => {
      const idx = stripped.indexOf(`from('${table}')`)
      expect(idx, `from('${table}') not found`).toBeGreaterThan(-1)
      const statementEnd = stripped.indexOf(';', idx) === -1 ? stripped.indexOf('\n\n', idx) : stripped.indexOf(';', idx)
      const statement = stripped.slice(idx, statementEnd === -1 ? idx + 400 : statementEnd)
      expect(statement).toContain(".eq('organisation_id', organisationId)")
    })
  }

  test("from('sop_access_people') is present", () => {
    expect(stripped).toContain("from('sop_access_people')")
  })

  test('no service-role client', () => {
    expect(raw).not.toContain('createAdminClient')
  })

  test('pinned literals from the existing lens survive byte-identical', () => {
    for (const literal of [
      "params.owner === 'me'",
      "query.eq('owner_user_id', user.id)",
      'FLAG_PRIORITY.find((f) => r.flags.includes(f))',
      'flagLabel: flag ? FLAG_LABEL[flag] : null',
      'ownerLabelById[sop.owner_user_id]',
      "flag === 'unowned' ? null : shortOwner(owner)",
      "select('id, all_departments')",
      "select('id, status, all_departments')",
      '!tagged.has(r.id) && !r.all_departments',
      '!sopIdsWithDept.has(r.id) && !r.all_departments',
      "listGovernanceQueue()",
      "from '@/actions/governance'",
    ]) {
      expect(raw, `missing pinned literal: ${literal}`).toContain(literal)
    }
  })
})

test('MillerSop declares the seven Phase 54 check-input fields', () => {
  const stripped = stripComments(read(path.join('src', 'lib', 'sop-list', 'admin-rows.ts')))
  for (const field of [
    'ownerUserId: string | null',
    'flags: GovernanceFlag[]',
    'lastReviewedAt: string | null',
    'chainRequired: boolean',
    'hasPersonGrant: boolean',
    'parseFailed: boolean',
    'machines: string[]',
  ]) {
    expect(stripped, `missing field: ${field}`).toContain(field)
  }
})

test('src/lib/validators/site.ts exports AdminSiteFloor', () => {
  const stripped = stripComments(read(path.join('src', 'lib', 'validators', 'site.ts')))
  expect(stripped).toContain('export type AdminSiteFloor')
})
