#!/usr/bin/env node
/**
 * apply-phase40-migration.mjs
 *
 * Phase 40 migration applier — pushes 00058 (sops.category_slug column,
 * index, and the deterministic pass-1 backfill) to the live remote DB and
 * runs post-apply assertions that bypass the PostgREST schema cache.
 * Copy-adapted from scripts/apply-phase36-migration.mjs.
 *
 * CLAUDE.md [2026-07-28] rule, applied here: this file's MIGRATIONS array
 * MUST include every LATER migration that corrects 00058, in order, if one
 * is ever added — apply-phase37-migration.mjs's fallback applied only its
 * OWN migration and silently re-dropped a later corrective one while its
 * assertions printed green. Do not "simplify" this back to a single bare
 * file path outside the array, and do not drop entries when extending it.
 *
 * Usage:
 *   node scripts/apply-phase40-migration.mjs
 *
 * Requirements:
 *   - .env.local must contain:
 *       NEXT_PUBLIC_SUPABASE_URL          (project URL)
 *       SUPABASE_SERVICE_ROLE_KEY         (service-role key for Management API calls)
 *       SUPABASE_ACCESS_TOKEN             (Supabase CLI token for non-interactive db push)
 *   - Supabase CLI must be installed (npx supabase)
 */

import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// Ordered migration file list for this phase. The apply ORDER is
// load-bearing (CLAUDE.md 2026-07-28) — a fallback that applies only the
// first entry, or applies out of order, can silently re-open a hole a later
// migration in this array exists to close. tests/phase40/dat01-migration.spec.ts
// asserts this array equals every phase-40 migration on disk, index by index.
const MIGRATIONS = ['00058_sop_category_slug.sql']
const MIGRATION_FILES = MIGRATIONS.map((f) => path.join(ROOT, 'supabase/migrations', f))

// ---------------------------------------------------------------------------
// .env.local loader
// ---------------------------------------------------------------------------
try {
  const envText = readFileSync(path.join(ROOT, '.env.local'), 'utf8')
  for (const line of envText.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
} catch (e) {
  console.error('Could not read .env.local:', e.message)
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

// ---------------------------------------------------------------------------
// Management API helper — executes raw SQL, bypassing PostgREST schema cache.
// ---------------------------------------------------------------------------
async function managementSql(sql) {
  if (!ACCESS_TOKEN) {
    throw new Error('SUPABASE_ACCESS_TOKEN required for Management API SQL calls')
  }
  const resp = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ query: sql }),
    }
  )
  const body = await resp.json()
  if (!resp.ok) {
    throw new Error(`Management API error ${resp.status}: ${JSON.stringify(body)}`)
  }
  return body
}

// ---------------------------------------------------------------------------
// Step 1: Apply migration(s) via `npx supabase db push`, falling back to the
// Management API raw-SQL endpoint if `db push` lacks a DB password. The
// fallback applies EVERY entry in MIGRATIONS, in order — never just the
// first (CLAUDE.md 2026-07-28).
// ---------------------------------------------------------------------------
console.log('=== Phase 40 Migration Applier (00058 sops.category_slug) ===')
console.log('Target:', SUPABASE_URL)
console.log('Project ref:', PROJECT_REF)
console.log('Migrations (ordered):', MIGRATIONS.join(', '))
console.log('')
console.log(`[1/4] Applying ${MIGRATIONS.join(', ')} via supabase db push ...`)
console.log('      (Only unapplied migrations are run — idempotent)')
console.log('')

let pushSucceeded = false
let pushPath = 'db push'
try {
  execSync('npx supabase db push', {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  })
  console.log('')
  console.log('supabase db push: SUCCESS')
  pushSucceeded = true
} catch (err) {
  console.error('')
  console.error('supabase db push failed (likely missing DB password for non-interactive push).')
  console.error('Falling back to Management API raw-SQL apply ...')
  console.error('')
  try {
    for (const file of MIGRATION_FILES) {
      console.log(`  Applying ${path.basename(file)} via Management API ...`)
      const migrationSql = readFileSync(file, 'utf8')
      await managementSql(migrationSql)
    }
    console.log(`Management API raw-SQL apply: SUCCESS (${MIGRATIONS.join(', ')})`)
    pushSucceeded = true
    pushPath = 'management-api-fallback'
  } catch (fallbackErr) {
    console.error('Management API raw-SQL apply also failed:', fallbackErr.message)
    console.error('')
    console.error('FALLBACK — apply the migration(s) manually, IN ORDER:')
    console.error('')
    console.error('Option A: Supabase SQL Editor (paste each file body, in order):')
    MIGRATIONS.forEach((f, i) => console.error(`  ${i + 1}. supabase/migrations/${f}`))
    console.error(`  URL: https://supabase.com/dashboard/project/${PROJECT_REF}/sql`)
    console.error('')
    console.error('Option B: psql (run each, in order):')
    MIGRATIONS.forEach((f) => {
      console.error('  psql "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" \\')
      console.error(`    -f supabase/migrations/${f}`)
    })
    console.error('')
    console.error('After applying manually, re-run this script for the post-apply assertions.')
    process.exit(1)
  }
}

console.log('')
console.log(`      applied via: ${pushPath}`)

// ---------------------------------------------------------------------------
// Step 2: Post-apply assertions via Management API (cache-bypassing raw SQL).
// Each assertion retries ONCE after a `NOTIFY pgrst, 'reload schema'` if the
// failure looks like PGRST205 (stale schema cache), never confusing that
// with a genuinely-missing object (42P01) (CLAUDE.md 2026-06-15).
// ---------------------------------------------------------------------------
console.log('')
console.log('[2/4] Running post-apply assertions via Management API (cache-bypassing) ...')
console.log('')

let allPassed = true

function isSchemaCacheError(msg) {
  return msg.includes('PGRST205') || msg.includes('schema cache')
}

async function assertSql(label, sql, checkFn) {
  let rows
  try {
    rows = await managementSql(sql)
  } catch (e) {
    const msg = e.message || ''
    if (isSchemaCacheError(msg)) {
      console.error(`  RETRY ${label} (PGRST205 stale schema cache — reloading and retrying once)`)
      try {
        await managementSql("NOTIFY pgrst, 'reload schema'")
        rows = await managementSql(sql)
      } catch (retryErr) {
        console.error(`  FAIL  ${label}`)
        console.error(`        ERROR after reload retry: ${retryErr.message}`)
        allPassed = false
        return
      }
    } else {
      console.error(`  FAIL  ${label}`)
      console.error(`        ERROR: ${msg}`)
      allPassed = false
      return
    }
  }
  const result = checkFn(rows)
  if (result.ok) {
    console.log(`  PASS  ${label}`)
    if (result.detail) console.log(`        ${result.detail}`)
  } else {
    console.error(`  FAIL  ${label}`)
    if (result.detail) console.error(`        ${result.detail}`)
    allPassed = false
  }
}

// Assertion 1: to_regclass('public.sops') is not null AND category_slug
// exists in information_schema.columns for public.sops.
await assertSql(
  'public.sops exists and category_slug column is present',
  "SELECT to_regclass('public.sops') IS NOT NULL AS table_exists, (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='sops' AND column_name='category_slug') AS col_count",
  (rows) => {
    const row = rows?.[0]
    return {
      ok: !!row && row.table_exists === true && Number(row.col_count) === 1,
      detail: row ? `table_exists=${row.table_exists}, col_count=${row.col_count}` : 'no row returned',
    }
  }
)

// Assertion 2: the index sops_category_slug_idx exists.
await assertSql(
  'index sops_category_slug_idx exists',
  "SELECT count(*) AS idx_count FROM pg_indexes WHERE schemaname='public' AND tablename='sops' AND indexname='sops_category_slug_idx'",
  (rows) => {
    const row = rows?.[0]
    return {
      ok: !!row && Number(row.idx_count) === 1,
      detail: row ? `idx_count=${row.idx_count}` : 'no row returned',
    }
  }
)

// Assertion 3: both retirement `comment on column` strings are present.
// This exists specifically because a schema-existence check alone would
// pass a migration that forgot the retirement markers.
await assertSql(
  'both sops.category and sops.category_tag carry the RETIRED Phase 40 comment',
  `SELECT
     col_description('public.sops'::regclass, (SELECT attnum FROM pg_attribute WHERE attrelid='public.sops'::regclass AND attname='category')) AS category_comment,
     col_description('public.sops'::regclass, (SELECT attnum FROM pg_attribute WHERE attrelid='public.sops'::regclass AND attname='category_tag')) AS category_tag_comment`,
  (rows) => {
    const row = rows?.[0]
    const categoryOk = !!row?.category_comment && row.category_comment.includes('RETIRED Phase 40')
    const categoryTagOk = !!row?.category_tag_comment && row.category_tag_comment.includes('RETIRED Phase 40')
    return {
      ok: categoryOk && categoryTagOk,
      detail: row
        ? `category_comment=${JSON.stringify(row.category_comment)}, category_tag_comment=${JSON.stringify(row.category_tag_comment)}`
        : 'no row returned',
    }
  }
)

// Assertion 4: at least one row has been backfilled onto category_slug.
await assertSql(
  'count(*) filter (where category_slug is not null) is greater than zero',
  'SELECT count(*) FILTER (WHERE category_slug IS NOT NULL) AS backfilled, count(*) AS total FROM public.sops',
  (rows) => {
    const row = rows?.[0]
    return {
      ok: !!row && Number(row.backfilled) > 0,
      detail: row ? `backfilled=${row.backfilled}, total=${row.total}` : 'no row returned',
    }
  }
)

// ---------------------------------------------------------------------------
// Step 3: NOTIFY pgrst to flush the PostgREST schema cache immediately.
// ---------------------------------------------------------------------------
console.log('')
console.log('[3/4] Issuing NOTIFY pgrst, \'reload schema\' via Management API ...')
try {
  await managementSql("NOTIFY pgrst, 'reload schema'")
  console.log('  PASS  NOTIFY pgrst reload schema issued')
} catch (e) {
  console.error('  FAIL  NOTIFY pgrst reload schema:', e.message)
  allPassed = false
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('')
console.log('[4/4] Summary')
if (allPassed) {
  console.log('=== ALL POST-APPLY ASSERTIONS PASSED ===')
  console.log('')
  console.log('Migration 00058 is live on the DB: sops.category_slug column,')
  console.log('sops_category_slug_idx index, both retirement comments, and at least')
  console.log('one backfilled row are all live and visible to PostgREST.')
  process.exit(0)
} else {
  console.error('=== ONE OR MORE ASSERTIONS FAILED ===')
  console.error('')
  console.error('Review the failures above. If a column/index/comment is unchanged, the')
  console.error('migration may not have been applied. Check the Supabase migration history:')
  console.error('  npx supabase migration list')
  console.error('')
  process.exit(1)
}
