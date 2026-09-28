/**
 * Phase 52 -- HOM-02/HOM-06, T-52-01/T-52-02. Source-contract assertions for
 * `src/actions/site-worker.ts` — the worker-readable (NOT admin-gated)
 * sibling of `src/actions/site.ts`. Lives in its own file so `site.ts` keeps
 * its "every export is admin-gated" invariant (D-03, RESEARCH Pitfall 1/A1).
 *
 * Registration: playwright.config.ts `phase52` project
 *   testDir: '.', testMatch: /tests\/phase52\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase52`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const SITE_WORKER_PATH = 'src/actions/site-worker.ts'

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')
}

test('(1) first non-comment line is \'use server\'', () => {
  const src = read(SITE_WORKER_PATH)
  const firstCodeLine = src
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith('//') && !l.startsWith('*') && !l.startsWith('/*'))
  expect(firstCodeLine).toBe("'use server'")
})

test('(2) session-scoped, not admin-gated -- no requireAdminContext/createAdminClient/service-role', () => {
  const src = read(SITE_WORKER_PATH)
  expect(src).toContain("import { getSessionContext } from '@/lib/auth/session-context'")
  expect(src.includes('requireAdminContext')).toBe(false)
  expect(src.includes('createAdminClient')).toBe(false)
  expect(src.includes('SUPABASE_SERVICE_ROLE_KEY')).toBe(false)
  expect(src.includes('lib/supabase/admin')).toBe(false)
})

test('(3) exactly one export async function, listSiteForWorker; no non-async value export', () => {
  const src = read(SITE_WORKER_PATH)
  const exportLines = src.split('\n').filter((l) => l.startsWith('export '))
  for (const line of exportLines) {
    expect(line.startsWith('export async function ') || line.startsWith('export type ') || line.startsWith('export interface '), line).toBe(true)
  }
  const fnExports = [...src.matchAll(/^export async function (\w+)/gm)].map((m) => m[1])
  expect(fnExports).toEqual(['listSiteForWorker'])
})

test('(4) orgId comes only from ctx.organisationId, never a fetched row', () => {
  const src = read(SITE_WORKER_PATH)
  expect(src).toMatch(/const orgId = ctx\.organisationId/)
  expect(src).not.toMatch(/orgId\s*=\s*\w+(Row|row|data)\b/)
})

test('(5) every site_layouts/site_machines/sop_machines/departments/sops query carries .eq(\'organisation_id\', orgId) before the next query', () => {
  const src = read(SITE_WORKER_PATH)
  const segments = src.split(".from('")
  const scopedTables = ['site_layouts', 'site_machines', 'sop_machines', 'departments', 'sops']
  for (const seg of segments.slice(1)) {
    const table = scopedTables.find((t) => seg.startsWith(t + "'"))
    if (!table) continue
    // Only look up to the next .from( call (this segment's own query body).
    const nextFromIndex = seg.indexOf(".from('")
    const body = nextFromIndex === -1 ? seg : seg.slice(0, nextFromIndex)
    expect(body, `${table} query missing .eq('organisation_id', orgId)`).toContain(".eq('organisation_id', orgId)")
  }
})

test('(6) signed URLs use the shared bucket/TTL constants, no numeric TTL literal', () => {
  const src = read(SITE_WORKER_PATH)
  expect(src).toContain('SCENE_BUCKET')
  expect(src).toContain('SCENE_SIGNED_TTL_SEC')
  expect(src).toContain('createSignedUrl(')
  // No bare numeric-seconds literal passed where the TTL constant belongs
  // (e.g. createSignedUrl(path, 3600)) -- the constant must be used instead.
  expect(src).not.toMatch(/createSignedUrl\([^)]*,\s*\d+\s*\)/)
})

test('(7) never logs a signed URL -- no console.log at all, no console.* call mentioning a URL variable', () => {
  const src = read(SITE_WORKER_PATH)
  expect(src.includes('console.log(')).toBe(false)
  const consoleCalls = [...src.matchAll(/console\.\w+\([^)]*\)/g)].map((m) => m[0])
  for (const call of consoleCalls) {
    expect(call.includes('signedUrl'), call).toBe(false)
    expect(call.includes('sceneUrl'), call).toBe(false)
    expect(call.includes('spriteUrl'), call).toBe(false)
  }
})

test('(8) no select(\'*\')', () => {
  const src = read(SITE_WORKER_PATH)
  expect(src.includes("select('*')")).toBe(false)
})
