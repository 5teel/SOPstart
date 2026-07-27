/**
 * Phase 36 -- REF-01/REF-02: source-contract guard for the setRefresherInterval
 * admin write action and BOTH version-supersede copy-forward sites
 * (RESEARCH Pitfall 2 -- two insert sites, not one).
 *
 * Registration: playwright.config.ts `phase36` project
 *   testDir: '.', testMatch: /tests\/phase36\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase36`
 *
 * Uses [\s\S] instead of the regex /s flag (CLAUDE.md 2026-06-02 TS-target
 * learning) and strips \r before matching multi-line literals (CLAUDE.md
 * 2026-07-18 worktree CRLF learning).
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const GOVERNANCE_FILE = path.join(ROOT, 'src', 'actions', 'governance.ts')
const VERSIONING_FILE = path.join(ROOT, 'src', 'actions', 'versioning.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n')
}

/** Extracts the body of a named exported async function up to the next
 * top-level `export` (or EOF) -- good enough to isolate one function's
 * source for a targeted grep without a full parser. */
function extractFunctionBody(source: string, fnName: string): string {
  const startMarker = `export async function ${fnName}(`
  const startIdx = source.indexOf(startMarker)
  expect(startIdx, `expected to find "${startMarker}" in source`).toBeGreaterThanOrEqual(0)
  const rest = source.slice(startIdx + startMarker.length)
  const nextExportIdx = rest.search(/\nexport (async )?function /)
  const body = nextExportIdx === -1 ? rest : rest.slice(0, nextExportIdx)
  return body
}

test.describe('setRefresherInterval admin write action', () => {
  test('governance.ts exports setRefresherInterval', () => {
    const src = read(GOVERNANCE_FILE)
    expect(src).toContain('export async function setRefresherInterval')
  })

  test('setRefresherInterval calls requireAdmin before any DB touch', () => {
    const src = read(GOVERNANCE_FILE)
    const body = extractFunctionBody(src, 'setRefresherInterval')
    expect(body).toContain('requireAdmin(')
  })

  test('setRefresherInterval enforces the 1..120 range with the shared wording', () => {
    const src = read(GOVERNANCE_FILE)
    const body = extractFunctionBody(src, 'setRefresherInterval')
    expect(body).toContain('months must be an integer between 1 and 120')
  })

  test('setRefresherInterval writes with the plain session client, never createAdminClient', () => {
    const src = read(GOVERNANCE_FILE)
    const body = extractFunctionBody(src, 'setRefresherInterval')
    expect(body).toContain('createClient(')
    expect(body).not.toContain('createAdminClient(')
  })

  test('setRefresherInterval surfaces zero-row RLS-filtered writes as SOP not found', () => {
    const src = read(GOVERNANCE_FILE)
    const body = extractFunctionBody(src, 'setRefresherInterval')
    expect(body).toContain("'SOP not found'")
  })
})

test.describe('refresher_interval_months copy-forward across both supersede paths', () => {
  test('appears at least 4 times in versioning.ts (two selects + two insert payloads)', () => {
    const src = read(VERSIONING_FILE)
    const count = (src.match(/refresher_interval_months/g) ?? []).length
    expect(count).toBeGreaterThanOrEqual(4)
  })

  test('uploadNewVersion body carries refresher_interval_months forward independently', () => {
    const src = read(VERSIONING_FILE)
    const body = extractFunctionBody(src, 'uploadNewVersion')
    // Select list
    expect(body).toContain('refresher_interval_months')
    // Insert payload reads from the fetched source row, not a literal/parameter
    expect(body).toMatch(/refresher_interval_months:\s*oldSop\.refresher_interval_months/)
  })

  test('cloneSopAsDraft body carries refresher_interval_months forward independently', () => {
    const src = read(VERSIONING_FILE)
    const body = extractFunctionBody(src, 'cloneSopAsDraft')
    // Select list
    expect(body).toContain('refresher_interval_months')
    // Insert payload reads from the fetched source row, not a literal/parameter
    expect(body).toMatch(/refresher_interval_months:\s*sourceSop\.refresher_interval_months/)
  })
})
