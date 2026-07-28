#!/usr/bin/env node
/**
 * apply-phase37-migration.mjs
 *
 * Phase 37 migration applier — pushes 00056 (assessor governance override
 * audit columns + constraints + insert-policy override clause) to the live
 * remote DB and runs post-apply assertions that bypass the PostgREST schema
 * cache. Copy-adapted from scripts/apply-phase36-migration.mjs (CLAUDE.md
 * 2026-06-15 PostgREST schema-cache learning).
 *
 * Usage:
 *   node scripts/apply-phase37-migration.mjs
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
const MIGRATION_FILE = path.join(ROOT, 'supabase/migrations/00056_assessor_governance.sql')

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
console.log('=== Phase 37 Migration Applier (00056 assessor_governance) ===')
console.log('Target:', SUPABASE_URL)
console.log('Project ref:', PROJECT_REF)
console.log('')
console.log('[1/4] Applying migration 00056 via supabase db push ...')
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
    console.error('  supabase/migrations/00056_assessor_governance.sql')
    console.error(`  URL: https://supabase.com/dashboard/project/${PROJECT_REF}/sql`)
    console.error('')
    console.error('Option B: psql:')
    console.error('  psql "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" \\')
    console.error('    -f supabase/migrations/00056_assessor_governance.sql')
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

// ---------------------------------------------------------------------------
// Assertion group 1: five columns exist with correct type/nullability.
// ---------------------------------------------------------------------------
await assertSql(
  'sop_observations.is_assessor_override exists (boolean, NOT NULL, default false)',
  "SELECT data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='sop_observations' AND column_name='is_assessor_override'",
  (rows) => {
    const row = rows?.[0]
    return {
      ok: !!row && row.data_type === 'boolean' && row.is_nullable === 'NO' && String(row.column_default ?? '').includes('false'),
      detail: row ? `data_type=${row.data_type}, is_nullable=${row.is_nullable}, column_default=${row.column_default}` : 'column not found',
    }
  }
)

await assertSql(
  'sop_observations.override_reason exists (text, nullable)',
  "SELECT data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='sop_observations' AND column_name='override_reason'",
  (rows) => {
    const row = rows?.[0]
    return {
      ok: !!row && row.data_type === 'text' && row.is_nullable === 'YES',
      detail: row ? `data_type=${row.data_type}, is_nullable=${row.is_nullable}` : 'column not found',
    }
  }
)

await assertSql(
  'completion_sign_offs.is_assessor_override exists (boolean, NOT NULL, default false)',
  "SELECT data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='completion_sign_offs' AND column_name='is_assessor_override'",
  (rows) => {
    const row = rows?.[0]
    return {
      ok: !!row && row.data_type === 'boolean' && row.is_nullable === 'NO' && String(row.column_default ?? '').includes('false'),
      detail: row ? `data_type=${row.data_type}, is_nullable=${row.is_nullable}, column_default=${row.column_default}` : 'column not found',
    }
  }
)

await assertSql(
  'completion_sign_offs.override_reason exists (text, nullable)',
  "SELECT data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='completion_sign_offs' AND column_name='override_reason'",
  (rows) => {
    const row = rows?.[0]
    return {
      ok: !!row && row.data_type === 'text' && row.is_nullable === 'YES',
      detail: row ? `data_type=${row.data_type}, is_nullable=${row.is_nullable}` : 'column not found',
    }
  }
)

await assertSql(
  'worker_notifications.subject_user_id exists (uuid, nullable)',
  "SELECT data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='worker_notifications' AND column_name='subject_user_id'",
  (rows) => {
    const row = rows?.[0]
    return {
      ok: !!row && row.data_type === 'uuid' && row.is_nullable === 'YES',
      detail: row ? `data_type=${row.data_type}, is_nullable=${row.is_nullable}` : 'column not found',
    }
  }
)

// ---------------------------------------------------------------------------
// Assertion group 2: both CHECK constraints exist by name AND reject a
// reasonless override in a rolled-back transaction.
// ---------------------------------------------------------------------------
await assertSql(
  'sop_observations_override_reason_required constraint is live (name + behaviour)',
  `DO $$
   DECLARE
     v_org uuid;
     v_user uuid;
     v_sop uuid;
     v_constraint_exists boolean;
     v_rejected boolean := false;
   BEGIN
     SELECT EXISTS (
       SELECT 1 FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       WHERE c.conname = 'sop_observations_override_reason_required'
         AND t.relname = 'sop_observations'
     ) INTO v_constraint_exists;
     IF NOT v_constraint_exists THEN
       RAISE EXCEPTION 'constraint sop_observations_override_reason_required not found on pg_constraint';
     END IF;

     SELECT id INTO v_org FROM public.organisations LIMIT 1;
     SELECT id INTO v_user FROM auth.users LIMIT 1;
     SELECT id INTO v_sop FROM public.sops WHERE organisation_id = v_org LIMIT 1;
     IF v_org IS NULL OR v_user IS NULL OR v_sop IS NULL THEN
       RAISE EXCEPTION 'no organisation/user/sop row available to probe with';
     END IF;

     BEGIN
       INSERT INTO public.sop_observations (organisation_id, sop_id, sop_version, observed_worker_id, observed_by, verdict, is_assessor_override, override_reason)
       VALUES (v_org, v_sop, 1, v_user, v_user, 'performed_to_sop', true, null);
     EXCEPTION WHEN check_violation THEN
       v_rejected := true;
     END;

     -- The failed INSERT's implicit savepoint already rolled back any partial
     -- effect (no row was ever committed). Defensive cleanup by marker in
     -- case the constraint was somehow absent and the row landed anyway.
     DELETE FROM public.sop_observations WHERE observed_worker_id = v_user AND observed_by = v_user AND is_assessor_override = true AND override_reason IS NULL;

     IF NOT v_rejected THEN
       RAISE EXCEPTION 'reasonless override was NOT rejected by the CHECK constraint';
     END IF;
   END $$;`,
  () => ({ ok: true, detail: 'constraint present by name; reasonless override insert rejected by CHECK constraint' })
)

await assertSql(
  'completion_sign_offs_override_reason_required constraint is live (name + behaviour)',
  `DO $$
   DECLARE
     v_org uuid;
     v_user uuid;
     v_completion uuid;
     v_constraint_exists boolean;
     v_rejected boolean := false;
   BEGIN
     SELECT EXISTS (
       SELECT 1 FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       WHERE c.conname = 'completion_sign_offs_override_reason_required'
         AND t.relname = 'completion_sign_offs'
     ) INTO v_constraint_exists;
     IF NOT v_constraint_exists THEN
       RAISE EXCEPTION 'constraint completion_sign_offs_override_reason_required not found on pg_constraint';
     END IF;

     SELECT id INTO v_org FROM public.organisations LIMIT 1;
     SELECT id INTO v_user FROM auth.users LIMIT 1;
     SELECT id INTO v_completion FROM public.sop_completions WHERE organisation_id = v_org LIMIT 1;
     IF v_org IS NULL OR v_user IS NULL OR v_completion IS NULL THEN
       RAISE EXCEPTION 'no organisation/user/completion row available to probe with';
     END IF;

     BEGIN
       INSERT INTO public.completion_sign_offs (organisation_id, completion_id, supervisor_id, decision, is_assessor_override, override_reason)
       VALUES (v_org, v_completion, v_user, 'approved', true, null);
     EXCEPTION WHEN check_violation THEN
       v_rejected := true;
     END;

     -- Defensive cleanup by marker in case the constraint was somehow absent.
     DELETE FROM public.completion_sign_offs WHERE completion_id = v_completion AND supervisor_id = v_user AND is_assessor_override = true AND override_reason IS NULL;

     IF NOT v_rejected THEN
       RAISE EXCEPTION 'reasonless override was NOT rejected by the CHECK constraint';
     END IF;
   END $$;`,
  () => ({ ok: true, detail: 'constraint present by name; reasonless override insert rejected by CHECK constraint' })
)

// ---------------------------------------------------------------------------
// Assertion group 3: the re-created insert policy carries the override clause.
// ---------------------------------------------------------------------------
await assertSql(
  'sop_observations_insert_recorder policy with_check contains current_user_role AND is_assessor_override',
  "SELECT policyname, with_check FROM pg_policies WHERE schemaname='public' AND tablename='sop_observations' AND policyname='sop_observations_insert_recorder'",
  (rows) => {
    const row = rows?.[0]
    const withCheck = row?.with_check ?? ''
    return {
      ok: !!row && withCheck.includes('current_user_role') && withCheck.includes('is_assessor_override'),
      detail: row ? `with_check=${withCheck}` : 'policy not found',
    }
  }
)

// ---------------------------------------------------------------------------
// Assertion group 4: A3 check — worker_notifications.type has no CHECK
// constraint restricting values (so 'assessment_requested' is a free string).
// ---------------------------------------------------------------------------
await assertSql(
  'worker_notifications.type has zero CHECK constraints (A3 — new type value needs no migration)',
  `SELECT c.conname, pg_get_constraintdef(c.oid) AS def
   FROM pg_constraint c
   JOIN pg_class t ON t.oid = c.conrelid
   WHERE t.relname = 'worker_notifications' AND c.contype = 'c'
     AND pg_get_constraintdef(c.oid) ILIKE '%type%'`,
  (rows) => ({
    ok: (rows ?? []).length === 0,
    detail: (rows ?? []).length === 0 ? 'zero rows — confirmed unrestricted' : `FOUND constraint(s): ${JSON.stringify(rows)}`,
  })
)

// ---------------------------------------------------------------------------
// Assertion group 5: NOTIFY pgrst to flush the PostgREST schema cache.
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
  console.log('Migration 00056 is live on the DB: all five columns, both CHECK')
  console.log('constraints (behaviourally proven), and the amended insert policy')
  console.log('are live and visible to PostgREST.')
  process.exit(0)
} else {
  console.error('=== ONE OR MORE ASSERTIONS FAILED ===')
  console.error('')
  console.error('Review the failures above. If a column/constraint is unchanged, the')
  console.error('migration may not have been applied. Check the Supabase migration history:')
  console.error('  npx supabase migration list')
  console.error('')
  process.exit(1)
}
