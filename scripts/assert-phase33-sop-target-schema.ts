#!/usr/bin/env tsx
/**
 * assert-phase33-sop-target-schema.ts
 *
 * Phase 33 Plan 02 — pre/post equivalence + schema assertion for migration
 * 00050 (nullable-arm SOP target on access_grants). Mirrors the
 * assert-phase32-day-one-equivalence.ts --capture/--verify idiom.
 *
 * Usage:
 *   npx tsx scripts/assert-phase33-sop-target-schema.ts --capture   (run BEFORE db push)
 *   npx tsx scripts/assert-phase33-sop-target-schema.ts --verify    (run AFTER db push)
 *
 * Requirements — .env.local must contain:
 *   NEXT_PUBLIC_SUPABASE_URL     (project URL)
 *   SUPABASE_SERVICE_ROLE_KEY    (service-role key, for the access_grants snapshot query)
 *   SUPABASE_ACCESS_TOKEN        (Management API token, for cache-bypassing existence checks)
 *
 * --capture: snapshots every access_grants row (all columns, ordered by id)
 *   to a temp JSON file. Run before `supabase db push`.
 *
 * --verify:
 *   (a) re-reads access_grants and asserts every captured row still exists
 *       byte-identical with sop_id null (00050 must not mutate pre-existing
 *       rows — it only relaxes a NOT NULL and adds a nullable column).
 *   (b) asserts via Management API raw SQL (NOT the PostgREST client) that:
 *       - sop_id column exists on access_grants (information_schema.columns)
 *       - collection_id is nullable (information_schema.columns)
 *       - access_grants_exactly_one_target CHECK exists (pg_constraint)
 *       - uq_access_grants_subject_target index exists AND
 *         uq_access_grants_subject_collection does NOT (pg_indexes)
 *       - idx_access_grants_sop index exists (pg_indexes)
 *   PostgREST's schema cache can report PGRST205 "not found" immediately
 *   after a DDL push even though the object exists (CLAUDE.md 2026-06-15
 *   learning) — that is never treated as "missing"; any failing probe is
 *   retried once after `NOTIFY pgrst, 'reload schema'` before being reported
 *   as a genuine FAIL.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SNAPSHOT_PATH = path.join(os.tmpdir(), 'phase33-access-grants-snapshot.json')

// ---------------------------------------------------------------------------
// .env.local loader (mirrors assert-phase32-day-one-equivalence.ts)
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

type AccessGrantRow = {
  id: string
  organisation_id: string
  subject_type: string
  subject_id: string | null
  collection_id: string | null
  granted_by: string | null
  created_at: string
}

async function fetchAccessGrants(): Promise<AccessGrantRow[]> {
  const { data, error } = await admin
    .from('access_grants')
    .select('id, organisation_id, subject_type, subject_id, collection_id, granted_by, created_at')
    .order('id', { ascending: true })
  if (error) {
    console.error('ERROR reading access_grants:', error.message)
    process.exit(1)
  }
  return (data ?? []) as AccessGrantRow[]
}

async function capture() {
  console.log('=== Phase 33 SOP-Target Schema — CAPTURE ===')
  const rows = await fetchAccessGrants()
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(rows))
  console.log(`Captured ${rows.length} access_grants rows -> ${SNAPSHOT_PATH}`)
  console.log('Now run: npx supabase db push, then --verify')
}

async function verify() {
  console.log('=== Phase 33 SOP-Target Schema — VERIFY ===')
  console.log('Target:', SUPABASE_URL)
  console.log('')

  // 1. Every captured row survives byte-identical (00050 is pure-additive to rows).
  if (!existsSync(SNAPSHOT_PATH)) {
    console.error(`  FAIL  access_grants snapshot missing at ${SNAPSHOT_PATH} — run --capture before db push first`)
    allPassed = false
  } else {
    const before = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as AccessGrantRow[]
    const afterRows = await fetchAccessGrants()
    const afterById = new Map(afterRows.map((r) => [r.id, r]))
    const missing: string[] = []
    const mutated: string[] = []
    for (const b of before) {
      const a = afterById.get(b.id)
      if (!a) {
        missing.push(b.id)
        continue
      }
      // Pre-existing rows must have sop_id null — 00050 never backfills it.
      const expected = { ...b, sop_id: null as string | null }
      const actual = { ...a, sop_id: (a as AccessGrantRow & { sop_id?: string | null }).sop_id ?? null }
      if (JSON.stringify(expected) !== JSON.stringify(actual)) {
        mutated.push(b.id)
      }
    }
    if (missing.length === 0 && mutated.length === 0) {
      console.log(`  PASS  all ${before.length} pre-existing access_grants rows survive byte-identical (sop_id null)`)
    } else {
      console.error(`  FAIL  access_grants pre-existing rows changed: ${missing.length} missing, ${mutated.length} mutated`)
      if (missing.length > 0) console.error(`        missing ids: ${missing.join(', ')}`)
      if (mutated.length > 0) console.error(`        mutated ids: ${mutated.join(', ')}`)
      allPassed = false
    }
  }

  // 2. sop_id column exists on access_grants
  await assertSql(
    'access_grants.sop_id column exists',
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='access_grants' AND column_name='sop_id'`,
    (rows) => ({
      ok: rows.length > 0,
      detail: rows.length > 0 ? 'column found: sop_id' : 'sop_id not found on public.access_grants',
    })
  )

  // 3. collection_id is nullable
  await assertSql(
    'access_grants.collection_id is nullable',
    `SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='access_grants' AND column_name='collection_id'`,
    (rows) => {
      const isNullable = rows?.[0]?.is_nullable
      return { ok: isNullable === 'YES', detail: `is_nullable = ${isNullable ?? 'NOT FOUND'}` }
    }
  )

  // 4. access_grants_exactly_one_target CHECK exists
  await assertSql(
    'access_grants_exactly_one_target CHECK constraint exists',
    `SELECT conname FROM pg_constraint WHERE conname='access_grants_exactly_one_target' AND conrelid='public.access_grants'::regclass`,
    (rows) => ({
      ok: rows.length > 0,
      detail: rows.length > 0 ? 'constraint found' : 'access_grants_exactly_one_target not found in pg_constraint',
    })
  )

  // 5. uq_access_grants_subject_target index exists
  await assertSql(
    'uq_access_grants_subject_target index exists',
    `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='access_grants' AND indexname='uq_access_grants_subject_target'`,
    (rows) => ({
      ok: rows.length > 0,
      detail: rows.length > 0 ? 'index found' : 'uq_access_grants_subject_target not found in pg_indexes',
    })
  )

  // 6. old uq_access_grants_subject_collection index does NOT exist (dropped by 00050)
  await assertSql(
    'uq_access_grants_subject_collection index dropped',
    `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='access_grants' AND indexname='uq_access_grants_subject_collection'`,
    (rows) => ({
      ok: rows.length === 0,
      detail: rows.length === 0 ? 'old index absent, as expected' : 'old index still present — 00050 drop did not apply',
    })
  )

  // 7. idx_access_grants_sop index exists
  await assertSql(
    'idx_access_grants_sop index exists',
    `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='access_grants' AND indexname='idx_access_grants_sop'`,
    (rows) => ({
      ok: rows.length > 0,
      detail: rows.length > 0 ? 'index found' : 'idx_access_grants_sop not found in pg_indexes',
    })
  )

  // 8. No RLS recursion regression on access_grants (42P17 sanity check)
  await (async () => {
    const { error } = await admin.from('access_grants').select('id').limit(1)
    if (error && error.code === '42P17') {
      console.error('  FAIL  SELECT on public.access_grants — 42P17 infinite recursion detected!')
      allPassed = false
    } else if (error) {
      console.error(`  FAIL  SELECT on public.access_grants — ${error.code}: ${error.message}`)
      allPassed = false
    } else {
      console.log('  PASS  SELECT on public.access_grants returns without RLS recursion error')
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
    console.error('Usage: npx tsx scripts/assert-phase33-sop-target-schema.ts --capture|--verify')
    process.exit(1)
  }
}

main()
