#!/usr/bin/env tsx
/**
 * assert-phase32-day-one-equivalence.ts
 *
 * Phase 32 Plan 03 — day-one equivalence + table-existence assertion for
 * migrations 00046 (org model schema) + 00047 (day-one data seed).
 *
 * Usage:
 *   npx tsx scripts/assert-phase32-day-one-equivalence.ts --capture   (run BEFORE db push)
 *   npx tsx scripts/assert-phase32-day-one-equivalence.ts --verify    (run AFTER db push)
 *
 * Requirements:
 *   - .env.local must contain:
 *       NEXT_PUBLIC_SUPABASE_URL     (project URL)
 *       SUPABASE_SERVICE_ROLE_KEY    (service-role key, for the sop_departments snapshot query)
 *       SUPABASE_ACCESS_TOKEN        (Management API token, for cache-bypassing existence checks)
 *
 * --capture: snapshots every sop_departments row (ordered by sop_id, department_id)
 *   to a temp JSON file. Run before `supabase db push`.
 *
 * --verify: re-reads sop_departments and asserts the row set is byte-identical
 *   to the captured snapshot (D-03 day-one cutover safety), then asserts:
 *     - all 7 new tables exist (areas, roles, collections, role_members,
 *       sop_collections, access_grants, sop_access_people)
 *     - departments.area_id column exists
 *     - sop_in_user_person_grants() function exists
 *     - sops_visible_by_person_grant policy exists
 *   via Management API raw SQL (to_regclass / to_regprocedure / pg_policies) —
 *   NOT the PostgREST REST client — because PostgREST's schema cache can
 *   report PGRST205 "not found" immediately after a DDL push even though the
 *   object exists (CLAUDE.md 2026-06-15 learning). Any failing existence probe
 *   is retried once after `NOTIFY pgrst, 'reload schema'` before being reported
 *   as a genuine FAIL.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SNAPSHOT_PATH = path.join(os.tmpdir(), 'phase32-sop-departments-snapshot.json')

// ---------------------------------------------------------------------------
// .env.local loader (mirrors apply-phase29-migration.mjs — no dotenv dep)
// ---------------------------------------------------------------------------
try {
  const envText = readFileSync(path.join(ROOT, '.env.local'), 'utf8')
  for (const line of envText.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
} catch (e) {
  console.error('Could not read .env.local:', (e as Error).message)
  process.exit(1)
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')
  process.exit(1)
}

const urlMatch = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)
if (!urlMatch) {
  console.error('ERROR: Could not extract project ref from NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL)
  process.exit(1)
}
const PROJECT_REF = urlMatch[1]

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ---------------------------------------------------------------------------
// Management API helper — executes raw SQL, bypassing the PostgREST schema
// cache (CLAUDE.md 2026-06-15 learning).
// ---------------------------------------------------------------------------
async function managementSql(sql: string): Promise<Record<string, unknown>[]> {
  if (!ACCESS_TOKEN) {
    throw new Error('SUPABASE_ACCESS_TOKEN required for Management API SQL calls')
  }
  const resp = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ query: sql }),
  })
  const body = await resp.json()
  if (!resp.ok) {
    throw new Error(`Management API error ${resp.status}: ${JSON.stringify(body)}`)
  }
  return body
}

type CheckResult = { ok: boolean; detail?: string }

let allPassed = true

async function assertSql(label: string, sql: string, checkFn: (rows: Record<string, unknown>[]) => CheckResult) {
  let rows: Record<string, unknown>[]
  try {
    rows = await managementSql(sql)
  } catch (e) {
    console.error(`  ERROR ${label}: ${(e as Error).message}`)
    allPassed = false
    return
  }
  let result = checkFn(rows)
  if (!result.ok) {
    // PGRST205-style false-miss retry: reload the schema cache once, re-probe.
    try {
      await managementSql("NOTIFY pgrst, 'reload schema'")
      rows = await managementSql(sql)
      result = checkFn(rows)
    } catch {
      // fall through to reporting the original result
    }
  }
  if (result.ok) {
    console.log(`  PASS  ${label}`)
    if (result.detail) console.log(`        ${result.detail}`)
  } else {
    console.error(`  FAIL  ${label}`)
    if (result.detail) console.error(`        ${result.detail}`)
    allPassed = false
  }
}

async function fetchSopDepartments(): Promise<{ sop_id: string; department_id: string }[]> {
  const { data, error } = await admin
    .from('sop_departments')
    .select('sop_id, department_id')
    .order('sop_id', { ascending: true })
    .order('department_id', { ascending: true })
  if (error) {
    console.error('ERROR reading sop_departments:', error.message)
    process.exit(1)
  }
  return (data ?? []) as { sop_id: string; department_id: string }[]
}

async function capture() {
  console.log('=== Phase 32 Day-One Equivalence — CAPTURE ===')
  const rows = await fetchSopDepartments()
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(rows))
  console.log(`Captured ${rows.length} sop_departments rows -> ${SNAPSHOT_PATH}`)
  console.log('Now run: npx supabase db push, then --verify')
}

async function verify() {
  console.log('=== Phase 32 Day-One Equivalence — VERIFY ===')
  console.log('Target:', SUPABASE_URL)
  console.log('')

  // 1. sop_departments byte-identical pre/post migration (D-03)
  if (!existsSync(SNAPSHOT_PATH)) {
    console.error(`  FAIL  sop_departments snapshot missing at ${SNAPSHOT_PATH} — run --capture before db push first`)
    allPassed = false
  } else {
    const before = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as { sop_id: string; department_id: string }[]
    const after = await fetchSopDepartments()
    const identical = JSON.stringify(before) === JSON.stringify(after)
    if (identical) {
      console.log(`  PASS  sop_departments byte-identical pre/post migration (${after.length} rows)`)
    } else {
      console.error(`  FAIL  sop_departments changed: before=${before.length} rows, after=${after.length} rows`)
      allPassed = false
    }
  }

  // 2. All 7 new tables exist (to_regclass, cache-bypassing)
  const TABLES = ['areas', 'roles', 'collections', 'role_members', 'sop_collections', 'access_grants', 'sop_access_people']
  for (const table of TABLES) {
    await assertSql(
      `to_regclass('public.${table}') is non-null`,
      `SELECT to_regclass('public.${table}') AS r`,
      (rows) => {
        const r = rows?.[0]?.r
        return { ok: r != null && r !== '', detail: r ? `to_regclass = ${r}` : 'to_regclass returned NULL — table does not exist' }
      }
    )
  }

  // 3. departments.area_id column exists
  await assertSql(
    'departments.area_id column exists',
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='departments' AND column_name='area_id'`,
    (rows) => ({
      ok: rows.length > 0,
      detail: rows.length > 0 ? 'column found: area_id' : 'area_id not found on public.departments',
    })
  )

  // 4. sop_in_user_person_grants() function exists (D-13)
  await assertSql(
    "to_regprocedure('public.sop_in_user_person_grants(uuid)') is non-null",
    `SELECT to_regprocedure('public.sop_in_user_person_grants(uuid)') AS r`,
    (rows) => {
      const r = rows?.[0]?.r
      return { ok: r != null && r !== '', detail: r ? `to_regprocedure = ${r}` : 'function does not exist' }
    }
  )

  // 5. sops_visible_by_person_grant policy exists (D-13)
  await assertSql(
    'sops_visible_by_person_grant policy exists on public.sops',
    `SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='sops' AND policyname='sops_visible_by_person_grant'`,
    (rows) => ({
      ok: rows.length > 0,
      detail: rows.length > 0 ? 'policy found' : 'policy not found in pg_policies',
    })
  )

  // 6. No RLS recursion regression on sops (42P17 sanity check)
  await (async () => {
    const { error } = await admin.from('sops').select('id').limit(1)
    if (error && error.code === '42P17') {
      console.error('  FAIL  SELECT on public.sops — 42P17 infinite recursion detected!')
      allPassed = false
    } else if (error) {
      console.error(`  FAIL  SELECT on public.sops — ${error.code}: ${error.message}`)
      allPassed = false
    } else {
      console.log('  PASS  SELECT on public.sops returns without RLS recursion error')
    }
  })()

  console.log('')
  if (allPassed) {
    console.log('=== ALL CHECKS PASSED ===')
    process.exit(0)
  } else {
    console.error('=== ONE OR MORE CHECKS FAILED ===')
    process.exit(1)
  }
}

async function main() {
  const mode = process.argv[2]
  if (mode === '--capture') {
    await capture()
  } else if (mode === '--verify') {
    await verify()
  } else {
    console.error('Usage: npx tsx scripts/assert-phase32-day-one-equivalence.ts --capture|--verify')
    process.exit(1)
  }
}

main()
