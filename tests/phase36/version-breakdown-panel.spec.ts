/**
 * Phase 36 -- TRN-03 version completion breakdown panel. All assertions are
 * live (no existence guards or conditional skips) — the action (Plan 36-06)
 * and the versions-page wiring (Plan 36-09) both exist now.
 *
 * Covers:
 *   - `getVersionCompletionBreakdown` exported from src/actions/competency.ts (Plan 36-06)
 *   - its role gate is the STRICTER existing versions-page gate
 *     ['admin', 'safety_manager'] -- NOT RECORDER_ROLES (RESEARCH Open
 *     Question 1 resolution; RECORDER_ROLES also includes 'supervisor',
 *     which the versions page does not expose to)
 *   - the panel is rendered by
 *     src/app/(protected)/admin/sops/[sopId]/versions/page.tsx (Plan 36-09)
 *   - the refresher-interval control on the same page is wired to
 *     setRefresherInterval, not an empty handler (Plan 36-09)
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
  return fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n')
}

function functionBody(src: string, exportSignature: string): string {
  const start = src.indexOf(exportSignature)
  const nextFnMatch = src.slice(start + 1).search(/\nexport async function /)
  return nextFnMatch === -1 ? src.slice(start) : src.slice(start, start + 1 + nextFnMatch)
}

test.describe('TRN-03 -- version completion breakdown panel', () => {
  test('getVersionCompletionBreakdown is exported from competency.ts', () => {
    const src = read(COMPETENCY_ACTIONS)
    expect(src).toContain('export async function getVersionCompletionBreakdown')
  })

  test("getVersionCompletionBreakdown gates to ['admin', 'safety_manager'], NOT RECORDER_ROLES", () => {
    const src = read(COMPETENCY_ACTIONS)
    const fnBody = functionBody(src, 'export async function getVersionCompletionBreakdown')
    expect(fnBody).toContain("['admin', 'safety_manager']")
    expect(fnBody).not.toContain('RECORDER_ROLES')
  })

  test('VersionCompletionBreakdown type/interface is exported', () => {
    const src = read(COMPETENCY_ACTIONS)
    expect(src).toMatch(/export (interface|type) VersionCompletionBreakdown/)
  })

  test('getVersionCompletionBreakdown self-enforces organisation scope', () => {
    const src = read(COMPETENCY_ACTIONS)
    const fnBody = functionBody(src, 'export async function getVersionCompletionBreakdown')
    expect(fnBody).toContain(".eq('organisation_id'")
  })

  test('getVersionCompletionBreakdown is read-only (no write calls)', () => {
    const src = read(COMPETENCY_ACTIONS)
    const fnBody = functionBody(src, 'export async function getVersionCompletionBreakdown')
    expect(fnBody).not.toContain('.update(')
    expect(fnBody).not.toContain('.insert(')
    expect(fnBody).not.toContain('.delete(')
  })

  test('versions page imports and calls getVersionCompletionBreakdown', () => {
    const src = read(VERSIONS_PAGE)
    expect(src).toContain('getVersionCompletionBreakdown')
  })

  test('versions page setRefresherInterval handler is wired, not empty', () => {
    const src = read(VERSIONS_PAGE)
    expect(src).toContain("from '@/actions/governance'")
    expect(src).toContain('await setRefresherInterval(')
  })

  test('versions page renders per-version completion summary and worker-list toggle', () => {
    const src = read(VERSIONS_PAGE)
    expect(src).toContain('No completions on this version')
    expect(src).toContain('aria-expanded')
  })

  test('versions page disables no button based on competency/refresher-due/version-currency state', () => {
    const src = read(VERSIONS_PAGE)
    const disabledExprs = src.match(/disabled=\{[^}]*\}/g) ?? []
    const forbidden = /isOutdatedVersion|isRefresherOverdue|refresherDueAt|needsSupportFlag|competency/i
    for (const expr of disabledExprs) {
      expect(expr).not.toMatch(forbidden)
    }
  })
})
