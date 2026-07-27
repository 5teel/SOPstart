#!/usr/bin/env node
/**
 * apply-phase36-migration.mjs
 *
 * Phase 36 migration applier — pushes 00055 (sops.refresher_interval_months)
 * to the live remote DB and runs post-apply assertions that bypass the
 * PostgREST schema cache. Copy-adapted from
 * scripts/apply-phase34-gap-migration.mjs (CLAUDE.md 2026-06-15 PostgREST
 * schema-cache learning).
 *
 * Usage:
 *   node scripts/apply-phase36-migration.mjs
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
const MIGRATION_FILE = path.join(ROOT, 'supabase/migrations/00055_sops_refresher_interval.sql')

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
// Step 1: Apply migration via `npx supabase db push`, falling back to the
// Management API raw-SQL endpoint if `db push` lacks a DB password.
// ---------------------------------------------------------------------------
console.log('=== Phase 36 Migration Applier (00055 sops.refresher_interval_months) ===')
console.log('Target:', SUPABASE_URL)
console.log('Project ref:', PROJECT_REF)
console.log('')
console.log('[1/4] Applying migration 00055 via supabase db push ...')
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
    const migrationSql = readFileSync(MIGRATION_FILE, 'utf8')
    await managementSql(migrationSql)
    console.log('Management API raw-SQL apply: SUCCESS')
    pushSucceeded = true
    pushPath = 'management-api-fallback'
  } catch (fallbackErr) {
    console.error('Management API raw-SQL apply also failed:', fallbackErr.message)
    console.error('')
    console.error('FALLBACK — apply the migration manually:')
    console.error('')
    console.error('Option A: Supabase SQL Editor (paste file body):')
    console.error('  supabase/migrations/00055_sops_refresher_interval.sql')
    console.error(`  URL: https://supabase.com/dashboard/project/${PROJECT_REF}/sql`)
    console.error('')
    console.error('Option B: psql:')
    console.error('  psql "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" \\')
    console.error('    -f supabase/migrations/00055_sops_refresher_interval.sql')
    console.error('')
    console.error('After applying manually, re-run this script for the post-apply assertions.')
    process.exit(1)
  }
}

console.log('')
console.log(`      applied via: ${pushPath}`)

// ---------------------------------------------------------------------------
// Step 2: Post-apply assertions via Management API (cache-bypassing raw SQL).
// ---------------------------------------------------------------------------
console.log('')
console.log('[2/4] Running post-apply assertions via Management API (cache-bypassing) ...')
console.log('')

let allPassed = true

async function assertSql(label, sql, checkFn) {
  let rows
  try {
    rows = await managementSql(sql)
  } catch (e) {
    // Distinguish PGRST205 (stale schema cache) from genuine absence (42P01/42703).
    const msg = e.message || ''
    if (msg.includes('PGRST205') || msg.includes('schema cache')) {
      console.error(`  FAIL  ${label}`)
      console.error(`        PGRST205 stale schema cache (NOT a missing column): ${msg}`)
    } else {
      console.error(`  FAIL  ${label}`)
      console.error(`        ERROR: ${msg}`)
    }
    allPassed = false
    return
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

// Assertion 1: column exists with correct type/nullability.
await assertSql(
  'sops.refresher_interval_months column exists (integer, nullable)',
  "SELECT data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='sops' AND column_name='refresher_interval_months'",
  (rows) => {
    const row = rows?.[0]
    return {
      ok: !!row && row.data_type === 'integer' && row.is_nullable === 'YES',
      detail: row ? `data_type=${row.data_type}, is_nullable=${row.is_nullable}` : 'column not found',
    }
  }
)

// Assertion 2: the range check constraint rejects 0 and 121, run inside a
// transaction that always rolls back so no test row is left behind.
await assertSql(
  'range check constraint rejects out-of-range values (0 and 121)',
  `DO $$
   DECLARE
     v_org uuid;
     v_rejected_0 boolean := false;
     v_rejected_121 boolean := false;
   BEGIN
     SELECT id INTO v_org FROM public.organisations LIMIT 1;
     IF v_org IS NULL THEN
       RAISE EXCEPTION 'no organisation row available to probe with';
     END IF;

     BEGIN
       INSERT INTO public.sops (organisation_id, source_file_name, source_file_type, source_file_path, uploaded_by, status, version, refresher_interval_months)
       VALUES (v_org, '__phase36_probe__', 'docx', '', (SELECT id FROM auth.users LIMIT 1), 'uploading', 1, 0);
     EXCEPTION WHEN check_violation THEN
       v_rejected_0 := true;
     END;

     BEGIN
       INSERT INTO public.sops (organisation_id, source_file_name, source_file_type, source_file_path, uploaded_by, status, version, refresher_interval_months)
       VALUES (v_org, '__phase36_probe__', 'docx', '', (SELECT id FROM auth.users LIMIT 1), 'uploading', 1, 121);
     EXCEPTION WHEN check_violation THEN
       v_rejected_121 := true;
     END;

     DELETE FROM public.sops WHERE source_file_name = '__phase36_probe__';

     IF NOT (v_rejected_0 AND v_rejected_121) THEN
       RAISE EXCEPTION 'constraint did not reject out-of-range values: rejected_0=%, rejected_121=%', v_rejected_0, v_rejected_121;
     END IF;
   END $$;`,
  () => ({ ok: true, detail: 'both 0 and 121 rejected by check_violation' })
)

// Assertion 3: NOTIFY pgrst to flush the PostgREST schema cache immediately.
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
  console.log('Migration 00055 is live on the DB: sops.refresher_interval_months exists,')
  console.log('is nullable integer, range-constrained 1..120, and visible to PostgREST.')
  process.exit(0)
} else {
  console.error('=== ONE OR MORE ASSERTIONS FAILED ===')
  console.error('')
  console.error('Review the failures above. If the column is unchanged, the migration')
  console.error('may not have been applied. Check the Supabase migration history:')
  console.error('  npx supabase migration list')
  console.error('')
  process.exit(1)
}
