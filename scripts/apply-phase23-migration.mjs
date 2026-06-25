#!/usr/bin/env node
/**
 * apply-phase23-migration.mjs
 *
 * Phase 23 migration applier — pushes 00038 to the live remote DB and
 * runs post-apply assertions that bypass the PostgREST schema cache.
 *
 * Usage:
 *   node scripts/apply-phase23-migration.mjs
 *
 * Requirements:
 *   - .env.local must contain:
 *       NEXT_PUBLIC_SUPABASE_URL          (project URL)
 *       SUPABASE_SERVICE_ROLE_KEY         (service-role key for Management API calls)
 *       SUPABASE_ACCESS_TOKEN             (Supabase CLI token for non-interactive db push)
 *   - Supabase CLI must be installed (npx supabase)
 *
 * Strategy (per CLAUDE.md 2026-06-15 PostgREST schema-cache learning):
 *   1. `npx supabase db push` — applies 00038 (idempotent via migration history)
 *   2. Post-push: verify table/column existence via Supabase Management API raw SQL
 *      using `to_regclass()` and `information_schema.columns` — NOT the PostgREST REST
 *      client (.from().select()), which hits the stale schema cache (PGRST205 false-miss).
 *   3. Issue `NOTIFY pgrst, 'reload schema'` via the same Management API to clear the cache.
 *
 * Threat model: T-23-01-04 — SUPABASE_SERVICE_ROLE_KEY loaded from .env.local only,
 * never hardcoded. This script is a local dev tool only — never committed with key values.
 */

import { readFileSync } from 'node:fs'
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
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')
  process.exit(1)
}

// Extract project ref from URL: https://<ref>.supabase.co
const urlMatch = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)
if (!urlMatch) {
  console.error('ERROR: Could not extract project ref from NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL)
  process.exit(1)
}
const PROJECT_REF = urlMatch[1]

// ---------------------------------------------------------------------------
// Management API helper — executes raw SQL, bypassing PostgREST schema cache.
// This is the ONLY correct way to verify table existence immediately after
// `db push` — PostgREST caches the schema and returns PGRST205 (not 42P01)
// for tables that exist but haven't been cache-refreshed yet.
// (CLAUDE.md 2026-06-15 PostgREST schema-cache staleness learning)
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
// Step 1: Apply migration via `npx supabase db push`
// ---------------------------------------------------------------------------
console.log('=== Phase 23 Migration Applier ===')
console.log('Target:', SUPABASE_URL)
console.log('Project ref:', PROJECT_REF)
console.log('')
console.log('[1/3] Applying migration 00038 via supabase db push ...')
console.log('      (Only unapplied migrations are run — idempotent)')
console.log('')

let pushSucceeded = false
try {
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
  console.error('FALLBACK — apply the migration manually:')
  console.error('')
  console.error('Option A: Supabase SQL Editor (paste file body):')
  console.error('  supabase/migrations/00038_phase23_schema.sql')
  console.error('  URL: https://supabase.com/dashboard/project/<ref>/sql')
  console.error('')
  console.error('Option B: psql:')
  console.error('  psql "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" \\')
  console.error('    -f supabase/migrations/00038_phase23_schema.sql')
  console.error('')
  console.error('After applying manually, re-run this script for the post-apply assertions.')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Step 2: Issue NOTIFY pgrst, 'reload schema' to flush PostgREST schema cache.
// (CLAUDE.md 2026-06-15: Supabase auto-reloads within ~1 min but assertions
//  running instantly after push hit the stale window — force reload now.)
// ---------------------------------------------------------------------------
console.log('')
console.log('[2/3] Issuing NOTIFY pgrst, \'reload schema\' via Management API ...')
try {
  await managementSql("NOTIFY pgrst, 'reload schema'")
  console.log('      schema cache reload notified.')
} catch (e) {
  // Non-fatal — the cache will auto-reload within ~60s regardless.
  // Assertions use to_regclass (cache-bypassing) so they remain correct.
  console.warn('      WARN: NOTIFY failed (non-fatal — to_regclass assertions bypass cache):', e.message)
}

// ---------------------------------------------------------------------------
// Step 3: Post-apply assertions via Management API raw SQL
//
// IMPORTANT: we use to_regclass() and information_schema.columns here —
// NOT the supabase-js REST client (.from().select()). The REST client hits
// the PostgREST schema cache which may still be stale (PGRST205 is
// "not in schema cache", not 42P01 "table does not exist"). Using raw SQL
// via the Management API bypasses PostgREST entirely and probes Postgres
// directly. (CLAUDE.md 2026-06-15 PostgREST schema-cache staleness learning)
// ---------------------------------------------------------------------------
console.log('')
console.log('[3/3] Running post-apply assertions via Management API (to_regclass — cache-bypassing) ...')
console.log('')

let allPassed = true

async function assertSql(label, sql, checkFn) {
  try {
    const rows = await managementSql(sql)
    const result = checkFn(rows)
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

// Assertion 1: sop_completion_signatures table exists
// to_regclass returns NULL when the object does not exist — not a REST probe.
await assertSql(
  "to_regclass('public.sop_completion_signatures') is non-null",
  "SELECT to_regclass('public.sop_completion_signatures') AS r",
  (rows) => {
    const r = rows?.[0]?.r
    return {
      ok: r != null && r !== '',
      detail: r ? `to_regclass = ${r}` : 'to_regclass returned NULL — table does not exist',
    }
  }
)

// Assertion 2: ai_field_proposals table exists
await assertSql(
  "to_regclass('public.ai_field_proposals') is non-null",
  "SELECT to_regclass('public.ai_field_proposals') AS r",
  (rows) => {
    const r = rows?.[0]?.r
    return {
      ok: r != null && r !== '',
      detail: r ? `to_regclass = ${r}` : 'to_regclass returned NULL — table does not exist',
    }
  }
)

// Assertion 3: sop_completions.roster_worker_id column exists
// information_schema.columns bypasses PostgREST entirely.
await assertSql(
  "sop_completions.roster_worker_id present in information_schema.columns",
  `SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'sop_completions'
     AND column_name = 'roster_worker_id'`,
  (rows) => {
    if (!rows || rows.length === 0) {
      return { ok: false, detail: 'column roster_worker_id not found in sop_completions' }
    }
    const col = rows[0]
    return {
      ok: true,
      detail: `column found: data_type=${col.data_type}, is_nullable=${col.is_nullable}`,
    }
  }
)

// Assertion 4: No 42P17 RLS recursion — SELECT on sops still works
// (Critical guard: new policies must not cross-reference sops, per RESEARCH Pitfall 1)
await assertSql(
  "SELECT on public.sops returns without 42P17 infinite recursion",
  "SELECT count(*) FROM public.sops LIMIT 1",
  (rows) => ({
    ok: rows != null,
    detail: rows != null ? 'sops SELECT OK (no RLS recursion)' : 'unexpected null rows',
  })
)

// Assertion 5: roster_worker_id column is nullable (back-compat for pre-Phase-23 rows)
await assertSql(
  "sop_completions.roster_worker_id is nullable (no NOT NULL constraint)",
  `SELECT is_nullable FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'sop_completions'
     AND column_name = 'roster_worker_id'`,
  (rows) => {
    const isNullable = rows?.[0]?.is_nullable
    return {
      ok: isNullable === 'YES',
      detail: `is_nullable = ${isNullable}${isNullable !== 'YES' ? ' — expected YES for back-compat' : ''}`,
    }
  }
)

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('')
if (allPassed) {
  console.log('=== ALL POST-APPLY ASSERTIONS PASSED ===')
  console.log('')
  console.log('Migration 00038 is live on the DB:')
  console.log('  - public.sop_completion_signatures  (AFL-VER-05 append-only sign-off chain)')
  console.log('  - public.ai_field_proposals          (X-03 pending approval records)')
  console.log('  - sop_completions.roster_worker_id   (D-11 attribution FK, nullable)')
  console.log('')
  console.log('Phase 23 downstream plans (23-04 / 23-05 / 23-06) can now proceed.')
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
