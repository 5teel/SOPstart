#!/usr/bin/env node
/**
 * apply-phase51-migration.mjs
 *
 * Phase 51 migration applier -- pushes 00067_site_model (site_layouts,
 * site_machines, sop_machines, site-scenes bucket + policies) to the live
 * remote DB and runs post-apply assertions that bypass the PostgREST schema
 * cache. Copy-adapted from scripts/apply-phase46-migration.mjs.
 *
 * MIGRATION_FILES lists every file that must be applied, in order, for the
 * live database to carry the correct final policy text. Today this is just
 * 00067. CLAUDE.md 2026-07-28: if a LATER migration ever corrects 00067,
 * that corrective file MUST be appended here, in apply order -- an applier
 * that re-ships only 00067 on every re-run would silently re-drop the
 * correction on the live database.
 *
 * Usage:
 *   node scripts/apply-phase51-migration.mjs
 *
 * Requirements (read from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL          (project URL)
 *   SUPABASE_SERVICE_ROLE_KEY         (service-role key -- unused directly here,
 *                                      kept for parity with sibling appliers)
 *   SUPABASE_ACCESS_TOKEN             (Supabase CLI token for non-interactive db push
 *                                      AND for Management API raw-SQL calls)
 */

import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const MIGRATION_FILES = [
  path.join(ROOT, 'supabase/migrations/00067_site_model.sql'),
  // If a later migration corrects 00067, append it here (CLAUDE.md 2026-07-28).
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
console.log('=== Phase 51 Migration Applier (00067 site model) ===')
console.log('Target:', SUPABASE_URL)
console.log('Project ref:', PROJECT_REF)
console.log('')
console.log('[1/4] Applying migration via supabase db push ...')
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
    console.error('Option A: Supabase SQL Editor (paste 00067_site_model.sql body):')
    console.error(`  URL: https://supabase.com/dashboard/project/${PROJECT_REF}/sql`)
    console.error('')
    console.error('Option B: psql:')
    console.error('  psql "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" \\')
    console.error('    -f supabase/migrations/00067_site_model.sql')
    console.error('')
    console.error('After applying manually, re-run this script for the post-apply assertions.')
    process.exit(1)
  }
}

console.log('')
console.log(`      applied via: ${pushPath}`)

// ---------------------------------------------------------------------------
// Step 2: Post-apply assertions via Management API (cache-bypassing raw SQL).
// Pin EVERY security-relevant clause (CLAUDE.md 2026-07-28: an assertion
// that pins fewer clauses certifies whatever happens to be live).
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

const TABLES = ['site_layouts', 'site_machines', 'sop_machines']

// -- tables exist + RLS enabled ----------------------------------------------
for (const table of TABLES) {
  await assertSql(
    `public.${table} exists and has RLS enabled`,
    `SELECT to_regclass('public.${table}') AS reg,
            (SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.${table}')) AS rls`,
    (rows) => {
      const row = rows?.[0]
      return {
        ok: !!row && row.reg !== null && row.rls === true,
        detail: row ? `reg=${row.reg} rls=${row.rls}` : 'no row returned',
      }
    }
  )
}

// -- exactly two policies per table, select org-scoped, write org+role-scoped
// with WITH CHECK byte-identical to USING (the 00062 class) --------------------
for (const table of TABLES) {
  await assertSql(
    `public.${table} carries exactly 2 policies`,
    `SELECT count(*)::int AS n FROM pg_policies WHERE schemaname='public' AND tablename='${table}'`,
    (rows) => {
      const n = rows?.[0]?.n
      return { ok: n === 2, detail: `count=${n}` }
    }
  )

  await assertSql(
    `public.${table} org_members_can_view_${table} SELECT qual contains current_organisation_id()`,
    `SELECT qual FROM pg_policies WHERE schemaname='public' AND tablename='${table}' AND policyname='org_members_can_view_${table}'`,
    (rows) => {
      const qual = rows?.[0]?.qual ?? ''
      return { ok: qual.includes('current_organisation_id'), detail: `qual=${qual}` }
    }
  )

  await assertSql(
    `public.${table} admins_can_write_${table}: qual has current_organisation_id() AND current_user_role(); with_check IDENTICAL to qual`,
    `SELECT qual, with_check FROM pg_policies WHERE schemaname='public' AND tablename='${table}' AND policyname='admins_can_write_${table}'`,
    (rows) => {
      const row = rows?.[0]
      if (!row) return { ok: false, detail: 'policy not found' }
      const qual = row.qual ?? ''
      const check = row.with_check ?? ''
      const hasOrg = qual.includes('current_organisation_id')
      const hasRole = qual.includes('current_user_role')
      const identical = typeof check === 'string' && check === qual
      return {
        ok: hasOrg && hasRole && identical,
        detail: `hasOrg=${hasOrg} hasRole=${hasRole} withCheckIdenticalToQual=${identical} qual=${qual}`,
      }
    }
  )
}

// -- FK delete actions from pg_constraint ------------------------------------
// confdeltype: c=cascade, n=set null, r=restrict, a=no action
await assertSql(
  'sop_machines -> sops FK is ON DELETE CASCADE',
  `SELECT confdeltype FROM pg_constraint WHERE contype='f' AND conrelid = 'public.sop_machines'::regclass
     AND confrelid = 'public.sops'::regclass`,
  (rows) => {
    const row = rows?.[0]
    return { ok: row?.confdeltype === 'c', detail: `confdeltype=${row?.confdeltype}` }
  }
)

await assertSql(
  'sop_machines -> site_machines composite FK is ON DELETE CASCADE with 2 key columns',
  `SELECT confdeltype, cardinality(conkey) AS n_cols FROM pg_constraint WHERE contype='f'
     AND conrelid = 'public.sop_machines'::regclass AND confrelid = 'public.site_machines'::regclass`,
  (rows) => {
    const row = rows?.[0]
    return {
      ok: row?.confdeltype === 'c' && row?.n_cols === 2,
      detail: `confdeltype=${row?.confdeltype} n_cols=${row?.n_cols}`,
    }
  }
)

await assertSql(
  'site_machines -> site_layouts composite FK is ON DELETE CASCADE with 2 key columns',
  `SELECT confdeltype, cardinality(conkey) AS n_cols FROM pg_constraint WHERE contype='f'
     AND conrelid = 'public.site_machines'::regclass AND confrelid = 'public.site_layouts'::regclass`,
  (rows) => {
    const row = rows?.[0]
    return {
      ok: row?.confdeltype === 'c' && row?.n_cols === 2,
      detail: `confdeltype=${row?.confdeltype} n_cols=${row?.n_cols}`,
    }
  }
)

await assertSql(
  'site_machines -> departments FK is ON DELETE SET NULL',
  `SELECT confdeltype FROM pg_constraint WHERE contype='f'
     AND conrelid = 'public.site_machines'::regclass AND confrelid = 'public.departments'::regclass`,
  (rows) => {
    const row = rows?.[0]
    return { ok: row?.confdeltype === 'n', detail: `confdeltype=${row?.confdeltype}` }
  }
)

// -- storage.buckets row ------------------------------------------------------
await assertSql(
  "storage.buckets 'site-scenes' row: private, 15728640 bytes, jpeg/png only",
  `SELECT public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'site-scenes'`,
  (rows) => {
    const row = rows?.[0]
    if (!row) return { ok: false, detail: 'bucket not found' }
    const mimes = row.allowed_mime_types ?? []
    const mimeOk =
      Array.isArray(mimes) &&
      mimes.length === 2 &&
      mimes.includes('image/jpeg') &&
      mimes.includes('image/png')
    return {
      ok: row.public === false && row.file_size_limit === 15728640 && mimeOk,
      detail: `public=${row.public} file_size_limit=${row.file_size_limit} allowed_mime_types=${JSON.stringify(mimes)}`,
    }
  }
)

// -- storage.objects policies -------------------------------------------------
const STORAGE_POLICIES = [
  { name: 'admins_can_upload_site_scenes', needsRole: true, clause: 'with_check' },
  { name: 'org_members_can_read_site_scenes', needsRole: false, clause: 'qual' },
  { name: 'admins_can_delete_site_scenes', needsRole: true, clause: 'qual' },
]

for (const { name, needsRole, clause } of STORAGE_POLICIES) {
  await assertSql(
    `storage.objects ${name}: ${clause} contains site-scenes + current_organisation_id()${needsRole ? ' + current_user_role()' : ''}`,
    `SELECT qual, with_check FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='${name}'`,
    (rows) => {
      const row = rows?.[0]
      if (!row) return { ok: false, detail: 'policy not found' }
      const text = clause === 'qual' ? row.qual ?? '' : row.with_check ?? ''
      const hasBucket = text.includes('site-scenes')
      const hasOrg = text.includes('current_organisation_id')
      const hasRole = !needsRole || text.includes('current_user_role')
      return {
        ok: hasBucket && hasOrg && hasRole,
        detail: `hasBucket=${hasBucket} hasOrg=${hasOrg} hasRole=${hasRole} text=${text}`,
      }
    }
  )
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
  console.log('Migration 00067 is live on the DB: site_layouts, site_machines,')
  console.log('sop_machines exist with RLS enabled, exactly 2 org/role-scoped')
  console.log('policies each with WITH CHECK identical to USING, composite FK')
  console.log('cascades match D-13, the site-scenes bucket is private/15MB/')
  console.log('jpeg+png, and its 3 storage policies are org-scoped.')
  console.log('PostgREST has been told to reload its cache.')
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
