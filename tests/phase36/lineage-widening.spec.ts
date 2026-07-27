/**
 * Phase 36 -- CMP-03 source-contract guard: proves resolveLineage exists once
 * and is wired into all THREE competency reads (getTrainingMatrix,
 * getTrainingRecordForPerson, getMyCompetencyStates), the lineage query is
 * batched (not a per-SOP loop), org self-enforcement is present, and the
 * worker self-read posture (no admin client) is preserved.
 *
 * A whole-file grep for "resolveLineage" would pass with only one call site
 * wired — the exact dead-feature class of CLAUDE.md 2026-06-05 — so each
 * function body is isolated and asserted separately.
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
const COMPETENCY_FILE = path.join(ROOT, 'src', 'actions', 'competency.ts')
// WR-07: resolveLineage lives in a plain module, NOT the 'use server' file
// (a 'use server' async export is a POST-invokable endpoint for any
// authenticated client).
const LINEAGE_FILE = path.join(ROOT, 'src', 'lib', 'competency', 'lineage.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n')
}

/** Extracts the body of a named exported async function up to the next
 * top-level `export` (or EOF) -- good enough to isolate one function's
 * source for a targeted grep without a full parser (mirrors
 * refresher-interval-write.spec.ts's extractFunctionBody). */
function extractFunctionBody(source: string, fnName: string): string {
  const startMarker = `export async function ${fnName}(`
  const startIdx = source.indexOf(startMarker)
  expect(startIdx, `expected to find "${startMarker}" in source`).toBeGreaterThanOrEqual(0)
  const rest = source.slice(startIdx + startMarker.length)
  const nextExportIdx = rest.search(/\nexport (async )?function /)
  const body = nextExportIdx === -1 ? rest : rest.slice(0, nextExportIdx)
  return body
}

test.describe('resolveLineage wiring across all three competency reads', () => {
  test('resolveLineage is defined once, in the plain lineage module (WR-07)', () => {
    const lineageSrc = read(LINEAGE_FILE)
    const defCount = (lineageSrc.match(/async function resolveLineage\(/g) ?? []).length
    expect(defCount).toBe(1)
    // The 'use server' action file must IMPORT it, never define/re-export it
    // (every async export there is a POST-invokable endpoint).
    const actionsSrc = read(COMPETENCY_FILE)
    expect(actionsSrc).not.toMatch(/async function resolveLineage\(/)
    expect(actionsSrc).toMatch(/import\s*\{[^}]*resolveLineage[^}]*\}\s*from\s*['"]@\/lib\/competency\/lineage['"]/)
  })

  test('getTrainingMatrix calls resolveLineage', () => {
    const src = read(COMPETENCY_FILE)
    const body = extractFunctionBody(src, 'getTrainingMatrix')
    expect(body).toContain('resolveLineage(')
  })

  test('getTrainingRecordForPerson calls resolveLineage', () => {
    const src = read(COMPETENCY_FILE)
    const body = extractFunctionBody(src, 'getTrainingRecordForPerson')
    expect(body).toContain('resolveLineage(')
  })

  test('getMyCompetencyStates calls resolveLineage', () => {
    const src = read(COMPETENCY_FILE)
    const body = extractFunctionBody(src, 'getMyCompetencyStates')
    expect(body).toContain('resolveLineage(')
  })
})

test.describe('evidence queries are lineage-widened, not bare current-sop scoped', () => {
  test('getTrainingMatrix no longer filters evidence on the bare current-sop array', () => {
    const src = read(COMPETENCY_FILE)
    const body = extractFunctionBody(src, 'getTrainingMatrix')
    expect(body).not.toContain(".in('sop_id', sopIds)")
  })

  test('getTrainingMatrix filters completions/observations on the widened lineage', () => {
    const src = read(COMPETENCY_FILE)
    const body = extractFunctionBody(src, 'getTrainingMatrix')
    expect(body).toContain("lineage.allSopIds")
  })
})

test.describe('lineage query is batched, not a per-SOP loop', () => {
  test('parent_sop_id.in. appears exactly once, in the lineage module', () => {
    const count = (read(LINEAGE_FILE).match(/parent_sop_id\.in\./g) ?? []).length
    expect(count).toBe(1)
    expect(read(COMPETENCY_FILE)).not.toMatch(/parent_sop_id\.in\./)
  })
})

test.describe('org self-enforcement on the batched lineage query', () => {
  test('resolveLineage carries .eq(\'organisation_id\' for admin-client callers', () => {
    const src = read(LINEAGE_FILE)
    const startIdx = src.indexOf('async function resolveLineage(')
    expect(startIdx).toBeGreaterThanOrEqual(0)
    expect(src.slice(startIdx)).toContain(".eq('organisation_id', orgId)")
  })
})

test.describe('getMyCompetencyStates preserves the self-scoped, no-admin-client posture', () => {
  test('getMyCompetencyStates body contains no createAdminClient(', () => {
    const src = read(COMPETENCY_FILE)
    const body = extractFunctionBody(src, 'getMyCompetencyStates')
    expect(body).not.toContain('createAdminClient(')
  })
})
