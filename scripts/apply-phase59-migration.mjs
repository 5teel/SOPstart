#!/usr/bin/env node
/**
 * apply-phase59-migration.mjs
 *
 * Phase 59 migration applier -- pushes 00073 (decisions kind check widened with
 * role_change, member_invited, member_removed; no policy change) to the live
 * remote DB, then runs post-apply assertions through the Management API (raw SQL,
 * never PostgREST, so a stale schema cache cannot fake a missing object).
 * Copy-adapted from scripts/apply-phase58-migration.mjs.
 *
 * MIGRATION_FILES lists every file that must be applied, in order. CLAUDE.md
 * 2026-07-28: a LATER migration that corrects 00073 MUST be appended here, in
 * apply order -- an applier that re-ships only the original would silently
 * re-drop the correction.
 *
 * Usage: node scripts/apply-phase59-migration.mjs [--assert-only]
 * Requires (.env.local or .env): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * SUPABASE_ACCESS_TOKEN.
 */

import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const MIGRATION_FILES = [path.join(ROOT, 'supabase/migrations/00073_office_ledger.sql')]

for (const f of ['.env.local', '.env']) {
  try {
    for (const line of readFileSync(path.join(ROOT, f), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
    }
  } catch {
    // file absent: env may already be populated by the shell
  }
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

async function managementSql(sql) {
  if (!ACCESS_TOKEN) throw new Error('SUPABASE_ACCESS_TOKEN required for Management API SQL calls')
  const resp = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ACCESS_TOKEN}` },
    body: JSON.stringify({ query: sql }),
  })
  const body = await resp.json()
  if (!resp.ok) throw new Error(`Management API error ${resp.status}: ${JSON.stringify(body)}`)
  return body
}

console.log('=== Phase 59 Migration Applier (00073 office ledger kinds) ===')
console.log('Target:', SUPABASE_URL)
console.log('Project ref:', PROJECT_REF)
console.log('')

const ASSERT_ONLY = process.argv.includes('--assert-only')
let pushPath = 'skipped (--assert-only)'

if (!ASSERT_ONLY) {
  console.log('[1/4] Remote migration history ...')
  try {
    const listing = execSync('npx supabase migration list', { cwd: ROOT, env: process.env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    console.log(listing)
    // CLAUDE.md 2026-10-04: a stale remote history makes db push refuse. A row with a local
    // version and no remote one, other than our own files, means history drift.
    const ours = new Set(MIGRATION_FILES.map((f) => path.basename(f).slice(0, 5)))
    const stale = listing
      .split(/\r?\n/)
      .map((l) => l.split('|').map((c) => c.trim()))
      .filter((c) => c.length >= 2 && /^\d{5}$/.test(c[0]) && c[1] === '' && !ours.has(c[0]))
      .map((c) => c[0])
    if (stale.length) {
      console.error(`Remote history is stale for: ${stale.join(', ')}`)
      console.error(`Repair first: npx supabase migration repair --status applied ${stale.join(' ')}`)
      process.exit(1)
    }
  } catch (e) {
    console.error('supabase migration list failed (continuing, db push / fallback will decide):', e.message)
  }

  console.log('Applying via supabase db push ...')
  pushPath = 'db push'
  try {
    execSync('npx supabase db push', { cwd: ROOT, stdio: 'inherit', env: process.env })
    console.log('supabase db push: SUCCESS')
  } catch {
    console.error('supabase db push failed (no DB password, or history drift). Falling back to Management API ...')
    try {
      for (const file of MIGRATION_FILES) {
        console.log(`  Applying ${path.basename(file)} via Management API ...`)
        await managementSql(readFileSync(file, 'utf8'))
      }
      console.log('Management API raw-SQL apply: SUCCESS (all MIGRATION_FILES, in order)')
      pushPath = 'management-api-fallback'
    } catch (fallbackErr) {
      console.error('Management API raw-SQL apply also failed:', fallbackErr.message)
      process.exit(1)
    }
  }
}
console.log(`      applied via: ${pushPath}`)

console.log('')
console.log('[2/4] Post-apply assertions via Management API ...')
console.log('')

let allPassed = true

async function assertSql(label, sql, checkFn) {
  let rows
  try {
    rows = await managementSql(sql)
  } catch (e) {
    const msg = e.message || ''
    console.error(`  FAIL  ${label}`)
    console.error(
      msg.includes('PGRST205') || msg.includes('schema cache')
        ? `        PGRST205 stale schema cache (NOT a missing object): ${msg}`
        : `        ERROR: ${msg}`
    )
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

// -- constraint ----------------------------------------------------------------
const KINDS = [
  'approve', 'reject', 'sign_off', 'countersign', 'assign', 'unassign', 'publish',
  'owner_change', 'review', 'observation', 'verify', 'verify_withdrawn',
  'ai_finding_cleared', 'cadence_change', 'ai_field_write',
  'role_change', 'member_invited', 'member_removed',
]
await assertSql(
  'decisions_kind_check accepts all eighteen kinds',
  `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
    WHERE conrelid = 'public.decisions'::regclass AND conname = 'decisions_kind_check'`,
  (rows) => {
    const def = rows?.[0]?.def ?? ''
    const missing = KINDS.filter((k) => !def.includes(`'${k}'::text`))
    return {
      ok: !!def && missing.length === 0,
      detail: def ? (missing.length ? `missing: ${missing.join(', ')}` : `all ${KINDS.length} present`) : 'constraint missing',
    }
  }
)

// -- policies (A-04: unchanged) ------------------------------------------------
await assertSql(
  'decisions carries exactly one policy: admins_can_read_decisions (SELECT, org + role scoped)',
  `SELECT policyname, cmd, roles::text AS roles, qual FROM pg_policies WHERE schemaname='public' AND tablename='decisions'`,
  (rows) => {
    const r = rows?.[0]
    const ok =
      (rows ?? []).length === 1 && r.policyname === 'admins_can_read_decisions' && r.cmd === 'SELECT' &&
      (r.qual ?? '').includes('current_organisation_id') && (r.qual ?? '').includes('current_user_role')
    return { ok, detail: JSON.stringify((rows ?? []).map((p) => `${p.policyname} ${p.cmd}`)) }
  }
)
await assertSql(
  'no INSERT / UPDATE / DELETE policy exists on decisions',
  `SELECT policyname, cmd FROM pg_policies WHERE schemaname='public' AND tablename='decisions' AND cmd <> 'SELECT'`,
  (rows) => ({ ok: (rows ?? []).length === 0, detail: JSON.stringify(rows) })
)

// -- append-only triggers ------------------------------------------------------
await assertSql(
  'append-only triggers decisions_no_update_delete and decisions_no_truncate exist and are enabled',
  `SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid='public.decisions'::regclass AND NOT tgisinternal
      AND tgname IN ('decisions_no_update_delete','decisions_no_truncate')`,
  (rows) => ({ ok: (rows ?? []).length === 2 && rows.every((r) => r.tgenabled === 'O'), detail: JSON.stringify(rows) })
)

// -- cache reload --------------------------------------------------------------
console.log('')
console.log("[3/4] Issuing NOTIFY pgrst, 'reload schema' via Management API ...")
try {
  await managementSql("NOTIFY pgrst, 'reload schema'")
  console.log('  PASS  NOTIFY pgrst reload schema issued')
} catch (e) {
  console.error('  FAIL  NOTIFY pgrst reload schema:', e.message)
  allPassed = false
}

console.log('')
console.log('[4/4] Summary')
if (allPassed) {
  console.log('=== ALL POST-APPLY ASSERTIONS PASSED ===')
  process.exit(0)
} else {
  console.error('=== ONE OR MORE ASSERTIONS FAILED ===')
  process.exit(1)
}
