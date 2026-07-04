#!/usr/bin/env node
/**
 * apply-phase26.5-migration.mjs
 *
 * Phase 26.5 migration applier — pushes 00040 to the live remote DB and runs
 * post-apply assertions that bypass the PostgREST schema cache.
 *
 * Usage:
 *   node scripts/apply-phase26.5-migration.mjs
 *
 * Requirements:
 *   - .env.local must contain:
 *       NEXT_PUBLIC_SUPABASE_URL          (project URL)
 *       SUPABASE_SERVICE_ROLE_KEY         (service-role key for Management API calls)
 *       SUPABASE_ACCESS_TOKEN             (Supabase CLI token for non-interactive db push)
 *   - Supabase CLI must be installed (npx supabase)
 *
 * Strategy (per CLAUDE.md 2026-06-15 PostgREST schema-cache learning):
 *   1. `npx supabase db push` — applies 00040 (idempotent via migration history)
 *   2. Post-push: verify table/extension/function existence via Supabase Management
 *      API raw SQL using `to_regclass()` / `pg_extension` / `pg_proc` — NOT the
 *      PostgREST REST client (.from().select()), which hits the stale schema cache
 *      (PGRST205 false-miss, distinct from a genuine 42P01 absence).
 *   3. Issue `NOTIFY pgrst, 'reload schema'` via the same Management API to clear
 *      the cache, then re-probe once before declaring a genuine failure.
 *
 * Threat model: T-26.5-02-04 — SUPABASE_SERVICE_ROLE_KEY loaded from .env.local
 * only, never hardcoded. This script is a local dev tool only — never committed
 * with key values.
 */

import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ---------------------------------------------------------------------------
// .env.local loader (mirrors apply-phase23-migration.mjs — no dotenv dep)
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
// This is the ONLY correct way to verify table/extension/function existence
// immediately after `db push` — PostgREST caches the schema and returns
// PGRST205 (not 42P01) for objects that exist but haven't been cache-refreshed
// yet (CLAUDE.md 2026-06-15 PostgREST schema-cache staleness learning).
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
console.log('=== Phase 26.5 Migration Applier ===')
console.log('Target:', SUPABASE_URL)
console.log('Project ref:', PROJECT_REF)
console.log('')
console.log('[1/3] Applying migration 00040 via supabase db push ...')
console.log('      (Only unapplied migrations are run — idempotent)')
console.log('')

try {
  execSync('npx supabase db push', {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  })
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
  console.error('  supabase/migrations/00040_agent_metadata_schema.sql')
  console.error(`  URL: https://supabase.com/dashboard/project/${PROJECT_REF}/sql`)
  console.error('')
  console.error('Option B: psql:')
  console.error('  psql "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" \\')
  console.error('    -f supabase/migrations/00040_agent_metadata_schema.sql')
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
// IMPORTANT: we use to_regclass()/pg_extension/pg_proc here — NOT the
// supabase-js REST client (.from().select()). The REST client hits the
// PostgREST schema cache which may still be stale (PGRST205 is "not in
// schema cache", not 42P01 "table does not exist"). Using raw SQL via the
// Management API bypasses PostgREST entirely and probes Postgres directly.
// (CLAUDE.md 2026-06-15 PostgREST schema-cache staleness learning)
//
// If a probe comes back looking like a genuine 42P01-class absence, retry
// once after an explicit reload — distinguishes real absence from cache lag.
// ---------------------------------------------------------------------------
console.log('')
console.log('[3/3] Running post-apply assertions via Management API (cache-bypassing) ...')
console.log('')

let allPassed = true

async function assertSql(label, sql, checkFn) {
  let rows
  try {
    rows = await managementSql(sql)
  } catch (e) {
    console.error(`  ERROR ${label}: ${e.message}`)
    allPassed = false
    return
  }
  let result = checkFn(rows)
  if (!result.ok) {
    // Retry once after an explicit schema-cache reload before failing —
    // distinguishes genuine 42P01 absence from PGRST205 cache staleness.
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

const TABLES = [
  'sop_agent_metadata',
  'block_agent_metadata',
  'agent_memory',
  'agent_learning_proposals',
  'sop_voice_qa_log',
]

for (const table of TABLES) {
  await assertSql(
    `to_regclass('public.${table}') is non-null`,
    `SELECT to_regclass('public.${table}') AS r`,
    (rows) => {
      const r = rows?.[0]?.r
      return {
        ok: r != null && r !== '',
        // NULL to_regclass here means genuine 42P01-class absence (bypasses
        // PostgREST entirely — this is never a PGRST205 false-negative).
        detail: r ? `to_regclass = ${r}` : 'to_regclass returned NULL — table does not exist',
      }
    }
  )
}

await assertSql(
  "pgvector extension ('vector') is installed",
  "SELECT extname FROM pg_extension WHERE extname = 'vector'",
  (rows) => ({
    ok: Array.isArray(rows) && rows.length > 0,
    detail: rows?.[0]?.extname ? `extension found: ${rows[0].extname}` : 'vector extension not found in pg_extension',
  })
)

await assertSql(
  "match_sop_agent_metadata function exists",
  "SELECT proname FROM pg_proc WHERE proname = 'match_sop_agent_metadata'",
  (rows) => ({
    ok: Array.isArray(rows) && rows.length > 0,
    detail: rows?.[0]?.proname ? `function found: ${rows[0].proname}` : 'match_sop_agent_metadata not found in pg_proc',
  })
)

await assertSql(
  'SELECT on public.sops returns without 42P17 infinite recursion',
  'SELECT count(*) FROM public.sops LIMIT 1',
  (rows) => ({
    ok: rows != null,
    detail: rows != null ? 'sops SELECT OK (no RLS recursion)' : 'unexpected null rows',
  })
)

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('')
if (allPassed) {
  console.log('=== ALL POST-APPLY ASSERTIONS PASSED ===')
  console.log('')
  console.log('Migration 00040 is live on the DB:')
  for (const table of TABLES) console.log(`  - public.${table}`)
  console.log('  - vector extension enabled')
  console.log('  - match_sop_agent_metadata() RPC live')
  console.log('')
  console.log('Phase 26.5 downstream plans (26.5-03..08) can now proceed.')
  process.exit(0)
} else {
  console.error('=== ONE OR MORE ASSERTIONS FAILED ===')
  console.error('')
  console.error('Review the failures above. If objects are missing, the migration')
  console.error('may not have been applied. Check the Supabase migration history:')
  console.error('  npx supabase migration list')
  console.error('')
  process.exit(1)
}
