#!/usr/bin/env node
/**
 * apply-phase46-migration.mjs
 *
 * Phase 46 migration applier -- pushes 00063 (CAP-02 owner-OR-role arm on
 * admins_can_manage_sections/_steps/_images) to the live remote DB and runs
 * post-apply assertions that bypass the PostgREST schema cache.
 * Copy-adapted from scripts/apply-phase37-migration.mjs (CLAUDE.md 2026-06-15
 * PostgREST schema-cache learning).
 *
 * MIGRATION_FILES lists every file that must be applied, in order, for the
 * live database to carry the correct final policy text. Today this is just
 * 00063. CLAUDE.md 2026-07-28: if a LATER migration ever corrects 00063 (the
 * way 00057 corrected 00056), that corrective file MUST be appended here in
 * apply order -- an applier that re-ships only 00063 on every re-run would
 * silently re-drop the correction on the live database.
 *
 * Usage:
 *   node scripts/apply-phase46-migration.mjs
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
const MIGRATION_FILES = [
  path.join(ROOT, 'supabase/migrations/00063_sop_content_owner_edit.sql'),
  // Phase 46 CR-02 corrective: owner arm on sop_section_blocks (block
  // junctions) that 00063 missed. Appended per the 2026-07-28 applier rule
  // -- re-running this script must apply BOTH, in this order.
  path.join(ROOT, 'supabase/migrations/00064_ssb_owner_edit.sql'),
]

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
// Management API helper -- executes raw SQL, bypassing PostgREST schema cache.
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
console.log('=== Phase 46 Migration Applier (00063 sop_content_owner_edit) ===')
console.log('Target:', SUPABASE_URL)
console.log('Project ref:', PROJECT_REF)
console.log('')
console.log('[1/4] Applying migration 00063 via supabase db push ...')
console.log('      (Only unapplied migrations are run -- idempotent)')
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
    console.log('Management API raw-SQL apply: SUCCESS (all MIGRATION_FILES, in order)')
    pushSucceeded = true
    pushPath = 'management-api-fallback'
  } catch (fallbackErr) {
    console.error('Management API raw-SQL apply also failed:', fallbackErr.message)
    console.error('')
    console.error('FALLBACK -- apply the migration manually:')
    console.error('')
    console.error('Option A: Supabase SQL Editor (paste the file body):')
    console.error('  supabase/migrations/00063_sop_content_owner_edit.sql')
    console.error(`  URL: https://supabase.com/dashboard/project/${PROJECT_REF}/sql`)
    console.error('')
    console.error('Option B: psql:')
    console.error('  psql "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" \\')
    console.error('    -f supabase/migrations/00063_sop_content_owner_edit.sql')
    console.error('')
    console.error('After applying manually, re-run this script for the post-apply assertions.')
    process.exit(1)
  }
}

console.log('')
console.log(`      applied via: ${pushPath}`)

// ---------------------------------------------------------------------------
// Step 2: Post-apply assertions via Management API (cache-bypassing raw SQL).
// Pin ALL FOUR clauses per policy, independently, on all THREE policies --
// pinning fewer is exactly how the 00056/00057 regression printed green
// (CLAUDE.md 2026-07-28).
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

const REQUIRED_SUBSTRINGS = ['current_organisation_id', 'current_user_role', 'owner_user_id', 'auth.uid()']
// withCheck semantics per policy:
//   'null'        -- the policy writes NO WITH CHECK, so Postgres reuses USING
//                    as the check (the three 00063 policies).
//   'equals-qual' -- the policy DOES write a WITH CHECK (00019 did), so 00064
//                    must restate the FULL predicate: the deparsed with_check
//                    must be byte-identical to the deparsed qual (CLAUDE.md
//                    2026-08-04: a partial WITH CHECK replaces USING).
const POLICIES = [
  { table: 'sop_sections', name: 'admins_can_manage_sections', withCheck: 'null' },
  { table: 'sop_steps', name: 'admins_can_manage_steps', withCheck: 'null' },
  { table: 'sop_images', name: 'admins_can_manage_images', withCheck: 'null' },
  { table: 'sop_section_blocks', name: 'ssb_admin_manage_own_org', withCheck: 'equals-qual' },
]

for (const { table, name, withCheck } of POLICIES) {
  await assertSql(
    `${table}.${name} qual contains current_organisation_id, current_user_role, owner_user_id, auth.uid()`,
    `SELECT policyname, qual, with_check FROM pg_policies WHERE schemaname='public' AND tablename='${table}' AND policyname='${name}'`,
    (rows) => {
      const row = rows?.[0]
      const qual = row?.qual ?? ''
      const missing = REQUIRED_SUBSTRINGS.filter((s) => !qual.includes(s))
      return {
        ok: !!row && missing.length === 0,
        detail: row ? `qual=${qual}` : 'policy not found',
      }
    }
  )

  if (withCheck === 'null') {
    await assertSql(
      `${table}.${name} with_check IS NULL (USING reused as the check -- no partial WITH CHECK narrowing)`,
      `SELECT with_check FROM pg_policies WHERE schemaname='public' AND tablename='${table}' AND policyname='${name}'`,
      (rows) => {
        const row = rows?.[0]
        return {
          ok: !!row && (row.with_check === null || row.with_check === undefined),
          detail: row ? `with_check=${row.with_check}` : 'policy not found',
        }
      }
    )
  } else {
    await assertSql(
      `${table}.${name} with_check is IDENTICAL to qual (full predicate restated -- no 00062-class narrowing)`,
      `SELECT qual, with_check FROM pg_policies WHERE schemaname='public' AND tablename='${table}' AND policyname='${name}'`,
      (rows) => {
        const row = rows?.[0]
        return {
          ok: !!row && typeof row.with_check === 'string' && row.with_check === row.qual,
          detail: row ? `with_check===qual: ${row.with_check === row.qual}` : 'policy not found',
        }
      }
    )
  }
}

// ---------------------------------------------------------------------------
// Step 3: NOTIFY pgrst to flush the PostgREST schema cache.
// ---------------------------------------------------------------------------
console.log('')
console.log("[3/4] Issuing NOTIFY pgrst, 'reload schema' via Management API ...")
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
  console.log('Migrations 00063+00064 are live on the DB: all four content policies')
  console.log('(sections, steps, images, block junctions) carry the owner-OR-role arm')
  console.log('inside their org-scoped USING; the junction policy restates the full')
  console.log('predicate in WITH CHECK; PostgREST has been told to reload its cache.')
  process.exit(0)
} else {
  console.error('=== ONE OR MORE ASSERTIONS FAILED ===')
  console.error('')
  console.error('Review the failures above. If a policy is unchanged, the migration may')
  console.error('not have been applied. Check the Supabase migration history:')
  console.error('  npx supabase migration list')
  console.error('')
  process.exit(1)
}
