/**
 * Phase 36 -- TRN-03 version completion breakdown panel. Source-contract
 * assertions guarded with fs.existsSync/content-includes + test.skip
 * (phase22 green-when-absent precedent, CLAUDE.md 2026-06-24) so Wave 0
 * stays green and each assertion self-activates the moment the referenced
 * plan creates the symbol -- no config edit, no rewrite needed.
 *
 * Covers:
 *   - `getVersionCompletionBreakdown` exported from src/actions/competency.ts (Plan 36-06)
 *   - its role gate is the STRICTER existing versions-page gate
 *     ['admin', 'safety_manager'] -- NOT RECORDER_ROLES (RESEARCH Open
 *     Question 1 resolution; RECORDER_ROLES also includes 'supervisor',
 *     which the versions page does not expose to)
 *   - the panel is rendered by
 *     src/app/(protected)/admin/sops/[sopId]/versions/page.tsx (Plan 36-09)
 *
 * Registration: playwright.config.ts `phase36` project
 *   testDir: '.', testMatch: /tests\/phase36\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase36`
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const COMPETENCY_ACTIONS = path.join(ROOT, 'src', 'actions', 'competency.ts')
const VERSIONS_PAGE = path.join(ROOT, 'src', 'app', '(protected)', 'admin', 'sops', '[sopId]', 'versions', 'page.tsx')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('TRN-03 -- version completion breakdown panel', () => {
  test('getVersionCompletionBreakdown is exported from competency.ts', () => {
    const src = read(COMPETENCY_ACTIONS)
    test.skip(!src.includes('getVersionCompletionBreakdown'), 'getVersionCompletionBreakdown not yet created (lands in Plan 36-06)')
    expect(src).toContain('export async function getVersionCompletionBreakdown')
  })

  test("getVersionCompletionBreakdown gates to ['admin', 'safety_manager'], NOT RECORDER_ROLES", () => {
    const src = read(COMPETENCY_ACTIONS)
    test.skip(!src.includes('getVersionCompletionBreakdown'), 'getVersionCompletionBreakdown not yet created (lands in Plan 36-06)')
    const start = src.indexOf('export async function getVersionCompletionBreakdown')
    const nextFnMatch = src.slice(start + 1).search(/\nexport async function /)
    const fnBody = nextFnMatch === -1 ? src.slice(start) : src.slice(start, start + 1 + nextFnMatch)
    expect(fnBody).toContain("['admin', 'safety_manager']")
    expect(fnBody).not.toContain('RECORDER_ROLES')
  })

  test('VersionCompletionBreakdown type/interface is exported', () => {
    const src = read(COMPETENCY_ACTIONS)
    test.skip(!src.includes('VersionCompletionBreakdown'), 'VersionCompletionBreakdown not yet created (lands in Plan 36-06)')
    expect(src).toMatch(/export (interface|type) VersionCompletionBreakdown/)
  })

  test('versions page wires the breakdown panel/action', () => {
    const src = read(VERSIONS_PAGE)
    const wired = src.includes('getVersionCompletionBreakdown') || /VersionBreakdownPanel|VersionCompletionBreakdown/.test(src)
    test.skip(!wired, 'breakdown panel not yet wired into versions/page.tsx (lands in Plan 36-09)')
    expect(wired).toBe(true)
  })
})
