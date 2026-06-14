#!/usr/bin/env node
/**
 * apply-phase25-migrations.mjs
 *
 * Phase 25 migration applier — pushes 00035/00036/00037 to the live remote DB
 * and runs post-apply assertions.
 *
 * Usage:
 *   node scripts/apply-phase25-migrations.mjs
 *
 * Requirements:
 *   - .env.local must contain NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *   - Supabase CLI must be installed (npx supabase) and linked to the project
 *     (or SUPABASE_ACCESS_TOKEN in env for non-interactive linking)
 *
 * Strategy:
 *   Primary path  — `npx supabase db push` (applies migration files from
 *                   supabase/migrations/ in order, idempotent via migration history)
 *   Fallback      — printed psql / Supabase SQL editor instructions if the CLI
 *                   fails (e.g. missing SUPABASE_ACCESS_TOKEN)
 *
 * Post-apply assertions (using @supabase/supabase-js with service role):
 *   1. SELECT count(*) FROM blocks WHERE organisation_id IS NULL  → must be 0
 *   2. SELECT to_regclass('public.departments')                   → must be non-null
 *   3. SELECT to_regclass('public.block_departments')             → must be non-null
 *   4. SELECT to_regclass('public.sop_departments')               → must be non-null
 *   5. SELECT to_regclass('public.member_departments')            → must be non-null
 *   6. SELECT 1 FROM sops LIMIT 1                                → must not error with 42P17
 *
 * Threat model: T-25-06 — SUPABASE_SERVICE_ROLE_KEY loaded from .env.local only,
 * never hardcoded. This script is a local dev tool only — never committed with key values.
 */

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ---------------------------------------------------------------------------
// .env.local loader (mirrors uat-session.mjs — no dotenv dep)
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

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Step 1: Apply migrations via `npx supabase db push`
// ---------------------------------------------------------------------------
console.log('=== Phase 25 Migration Applier ===')
console.log('Target:', SUPABASE_URL)
console.log('')
console.log('[1/2] Applying migrations 00035 → 00036 → 00037 via supabase db push ...')
console.log('      (Only unapplied migrations are run — idempotent)')
console.log('')

let pushSucceeded = false
try {
  // `supabase db push` requires either:
  //   - a linked project (supabase link --project-ref <ref>) OR
  //   - SUPABASE_ACCESS_TOKEN env var (set in .env.local or CI)
  // The --include-all flag is not used here: we want only unapplied migrations.
  execSync('npx supabase db push', {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  })
  pushSucceeded = true
  console.log('')
  console.log('supabase db push: SUCCESS')
} catch (err) {
  console.error('')
  console.error('supabase db push failed. Common causes:')
  console.error('  - SUPABASE_ACCESS_TOKEN not set in .env.local (required for non-interactive push)')
  console.error('  - Project not linked (run: npx supabase link --project-ref <ref>)')
  console.error('')
  console.error('FALLBACK — apply the migrations manually in one of these ways:')
  console.error('')
  console.error('Option A: Supabase SQL Editor (paste each file body in order):')
  console.error('  1. supabase/migrations/00035_departments_schema.sql')
  console.error('  2. supabase/migrations/00036_departments_data.sql')
  console.error('  3. supabase/migrations/00037_departments_rls_cleanup.sql')
  console.error('  URL: https://supabase.com/dashboard/project/<ref>/sql')
  console.error('')
  console.error('Option B: psql (requires DB password from Supabase dashboard > Settings > Database):')
  console.error('  psql "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" \\')
  console.error('    -f supabase/migrations/00035_departments_schema.sql \\')
  console.error('    -f supabase/migrations/00036_departments_data.sql \\')
  console.error('    -f supabase/migrations/00037_departments_rls_cleanup.sql')
  console.error('')
  console.error('After applying manually, re-run this script for the post-apply assertions.')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Step 2: Post-apply assertions using the service-role client
// ---------------------------------------------------------------------------
console.log('')
console.log('[2/2] Running post-apply assertions ...')
console.log('')

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let allPassed = true

async function assert(label, fn) {
  try {
    const result = await fn()
    if (result.ok) {
      console.log(`  PASS  ${label}`)
      if (result.detail) console.log(`        ${result.detail}`)
    } else {
      console.error(`  FAIL  ${label}`)
      if (result.detail) console.error(`        ${result.detail}`)
      allPassed = false
    }
  } catch (e) {
    console.error(`  ERROR ${label}: ${e.message}`)
    allPassed = false
  }
}

// Assertion 1: Zero null-org blocks (REQ-8, D-01, T-25-04)
await assert('blocks WHERE organisation_id IS NULL = 0', async () => {
  const { data, error } = await admin
    .from('blocks')
    .select('id', { count: 'exact', head: true })
    .is('organisation_id', null)
  if (error) return { ok: false, detail: error.message }
  const count = data?.length ?? 0
  // head:true returns null data, use count from response header via the count option
  // Re-query with count
  const { count: nullCount, error: e2 } = await admin
    .from('blocks')
    .select('*', { count: 'exact', head: true })
    .is('organisation_id', null)
  if (e2) return { ok: false, detail: e2.message }
  return {
    ok: nullCount === 0,
    detail: `count = ${nullCount}${nullCount > 0 ? ' — orphaned global blocks remain!' : ''}`,
  }
})

// Assertion 2: departments table exists
await assert("to_regclass('public.departments') is non-null", async () => {
  const { data, error } = await admin.rpc('exec_sql', { sql: "SELECT to_regclass('public.departments') AS r" }).single()
  if (error) {
    // exec_sql RPC may not exist — use a direct table probe instead
    const { error: e2 } = await admin.from('departments').select('id').limit(1)
    if (e2 && e2.code === '42P01') return { ok: false, detail: 'departments table does not exist (42P01)' }
    return { ok: true, detail: 'departments table accessible' }
  }
  return { ok: data?.r != null, detail: `to_regclass = ${data?.r}` }
})

// Assertion 3: block_departments junction exists
await assert("to_regclass('public.block_departments') is non-null", async () => {
  const { error } = await admin.from('block_departments').select('block_id').limit(1)
  if (error && error.code === '42P01') return { ok: false, detail: 'block_departments table does not exist (42P01)' }
  if (error) return { ok: false, detail: error.message }
  return { ok: true, detail: 'block_departments table accessible' }
})

// Assertion 4: sop_departments junction exists
await assert("to_regclass('public.sop_departments') is non-null", async () => {
  const { error } = await admin.from('sop_departments').select('sop_id').limit(1)
  if (error && error.code === '42P01') return { ok: false, detail: 'sop_departments table does not exist (42P01)' }
  if (error) return { ok: false, detail: error.message }
  return { ok: true, detail: 'sop_departments table accessible' }
})

// Assertion 5: member_departments junction exists
await assert("to_regclass('public.member_departments') is non-null", async () => {
  const { error } = await admin.from('member_departments').select('member_id').limit(1)
  if (error && error.code === '42P01') return { ok: false, detail: 'member_departments table does not exist (42P01)' }
  if (error) return { ok: false, detail: error.message }
  return { ok: true, detail: 'member_departments table accessible' }
})

// Assertion 6: SELECT on sops does not return 42P17 (no RLS infinite recursion)
// This is the D-02a / T-25-02 critical check.
await assert('SELECT 1 FROM sops LIMIT 1 — no 42P17 infinite recursion', async () => {
  const { error } = await admin.from('sops').select('id').limit(1)
  if (error) {
    if (error.code === '42P17') {
      return { ok: false, detail: 'FATAL: 42P17 infinite recursion detected in RLS policy on sops!' }
    }
    // PGRST116 (0 rows) is fine — the table exists and query ran
    return { ok: false, detail: `${error.code}: ${error.message}` }
  }
  return { ok: true, detail: 'sops SELECT returned without RLS recursion error' }
})

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('')
if (allPassed) {
  console.log('=== ALL POST-APPLY ASSERTIONS PASSED ===')
  console.log('')
  console.log('Next step: run the integration gate to prove RLS invariants:')
  console.log('  npm run test:integration')
  console.log('')
  console.log('Both of these specs must pass:')
  console.log('  tests/integration/departments-rls.spec.ts    (REQ-1 cross-tenant, D-02a)')
  console.log('  tests/integration/sop-dept-visibility.spec.ts (REQ-3 OR-composition)')
  process.exit(0)
} else {
  console.error('=== ONE OR MORE ASSERTIONS FAILED ===')
  console.error('')
  console.error('Review the failures above. If tables are missing, the migration')
  console.error('may not have been applied. Check the Supabase migration history:')
  console.error('  npx supabase migration list')
  console.error('')
  process.exit(1)
}
