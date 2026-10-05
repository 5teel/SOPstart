#!/usr/bin/env node
/**
 * apply-phase58-migration.mjs
 *
 * Phase 58 migration applier -- pushes 00071 (sop_walks, sop_ai_findings, step
 * tick + self-clearing trigger, sops.objective / allow_forward_jump) to the live
 * remote DB, then runs post-apply assertions through the Management API (raw SQL,
 * never PostgREST, so a stale schema cache cannot fake a missing object).
 * Copy-adapted from scripts/apply-phase56-migration.mjs.
 *
 * MIGRATION_FILES lists every file that must be applied, in order. CLAUDE.md
 * 2026-07-28: a LATER migration that corrects 00071 MUST be appended here, in
 * apply order -- an applier that re-ships only the original would silently
 * re-drop the correction.
 *
 * Usage: node scripts/apply-phase58-migration.mjs [--assert-only]
 * Requires (.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * SUPABASE_ACCESS_TOKEN.
 */

import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const MIGRATION_FILES = [
  path.join(ROOT, 'supabase/migrations/00071_focus_editor_walk.sql'),
  // Corrective migrations, in apply order (CLAUDE.md 2026-07-28): 00072 drops the
  // two authenticated write policies 00071 created on sop_walks (review CR-01).
  path.join(ROOT, 'supabase/migrations/00072_sop_walks_server_written.sql'),
]

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

console.log('=== Phase 58 Migration Applier (00071 focus editor + walk) ===')
console.log('Target:', SUPABASE_URL)
console.log('Project ref:', PROJECT_REF)
console.log('')

const ASSERT_ONLY = process.argv.includes('--assert-only')
let pushPath = 'skipped (--assert-only)'

if (!ASSERT_ONLY) {
  console.log('[1/4] Remote migration history ...')
  let listing = ''
  try {
    listing = execSync('npx supabase migration list', { cwd: ROOT, env: process.env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
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

for (const table of ['sop_walks', 'sop_ai_findings']) {
  await assertSql(
    `public.${table} exists with RLS enabled`,
    `SELECT to_regclass('public.${table}') AS reg,
            (SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.${table}')) AS rls`,
    (rows) => {
      const r = rows?.[0]
      return { ok: !!r && r.reg !== null && r.rls === true, detail: r ? `reg=${r.reg} rls=${r.rls}` : 'no row' }
    }
  )
}

// -- columns -------------------------------------------------------------------
const COLUMNS = [
  ['sop_focus_steps', 'verified_by_admin_id'],
  ['sop_focus_steps', 'verified_at'],
  ['sop_focus_steps', 'needs_recheck'],
  ['sops', 'objective'],
  ['sops', 'allow_forward_jump'],
]
await assertSql(
  'five new columns exist (focus_steps tick x3, sops objective + allow_forward_jump)',
  `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public'
     AND ((table_name='sop_focus_steps' AND column_name IN ('verified_by_admin_id','verified_at','needs_recheck'))
       OR (table_name='sops' AND column_name IN ('objective','allow_forward_jump')))`,
  (rows) => {
    const have = new Set((rows ?? []).map((r) => `${r.table_name}.${r.column_name}`))
    const missing = COLUMNS.map(([t, c]) => `${t}.${c}`).filter((k) => !have.has(k))
    return { ok: missing.length === 0, detail: missing.length ? `missing: ${missing.join(', ')}` : `found ${have.size}` }
  }
)
await assertSql(
  'sop_focus_steps.run_id is nullable; sops.allow_forward_jump NOT NULL default false; objective check present',
  `SELECT
     (SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='sop_focus_steps' AND column_name='run_id') AS run_id_null,
     (SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='sops' AND column_name='allow_forward_jump') AS jump_null,
     (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='sops' AND column_name='allow_forward_jump') AS jump_default,
     (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='sops_objective_length_check' AND conrelid='public.sops'::regclass) AS chk`,
  (rows) => {
    const r = rows?.[0]
    const ok = r?.run_id_null === 'YES' && r?.jump_null === 'NO' && /false/.test(r?.jump_default ?? '') && /500/.test(r?.chk ?? '')
    return { ok, detail: JSON.stringify(r) }
  }
)

// -- trigger -------------------------------------------------------------------
await assertSql(
  'trigger clear_focus_step_tick on sop_focus_steps: enabled, BEFORE UPDATE row; function is not elevated-privilege',
  `SELECT t.tgenabled, t.tgtype::int AS tgtype, p.prosecdef, p.prosrc
     FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid='public.sop_focus_steps'::regclass AND t.tgname='clear_focus_step_tick' AND NOT t.tgisinternal`,
  (rows) => {
    const r = rows?.[0]
    if (!r) return { ok: false, detail: 'trigger missing' }
    // tgtype bits: 1 row, 2 before, 4 insert, 8 delete, 16 update
    const row = (r.tgtype & 1) === 1, before = (r.tgtype & 2) === 2, ins = (r.tgtype & 4) === 4, del = (r.tgtype & 8) === 8, upd = (r.tgtype & 16) === 16
    const clauses = ['text', 'kind', 'tip', 'photo_required', 'image_paths', 'verified_by_admin_id', 'needs_recheck'].every((c) => r.prosrc.includes(c))
    return {
      ok: r.tgenabled === 'O' && row && before && upd && !ins && !del && r.prosecdef === false && clauses,
      detail: `tgenabled=${r.tgenabled} tgtype=${r.tgtype} prosecdef=${r.prosecdef} clauses=${clauses}`,
    }
  }
)

// -- policies ------------------------------------------------------------------
// 00072 (review CR-01): the only policy left on sop_walks is the own-row SELECT;
// every write is service-role from src/actions/walk.ts.
await assertSql(
  'sop_walks carries exactly 1 policy: the own-row SELECT (no insert, update or delete policy after 00072)',
  `SELECT policyname, cmd, roles::text AS roles, qual, with_check FROM pg_policies WHERE schemaname='public' AND tablename='sop_walks'`,
  (rows) => {
    const r = rows?.[0]
    const ok =
      (rows ?? []).length === 1 && r.cmd === 'SELECT' && r.policyname === 'workers_can_view_own_sop_walks' &&
      r.roles.includes('authenticated') && !r.roles.includes('anon') &&
      (r.qual ?? '').includes('current_organisation_id') && (r.qual ?? '').includes('auth.uid()')
    return { ok, detail: JSON.stringify((rows ?? []).map((p) => `${p.policyname} ${p.cmd}`)) }
  }
)
await assertSql(
  'sop_ai_findings select policy is org-scoped and admin/safety_manager only',
  `SELECT policyname, cmd, roles::text AS roles, qual FROM pg_policies WHERE schemaname='public' AND tablename='sop_ai_findings'`,
  (rows) => {
    const r = rows?.[0]
    const ok =
      (rows ?? []).length === 1 && r.cmd === 'SELECT' && r.roles.includes('authenticated') && !r.roles.includes('anon') &&
      ['current_organisation_id', 'current_user_role', 'admin', 'safety_manager'].every((s) => (r.qual ?? '').includes(s))
    return { ok, detail: JSON.stringify(rows) }
  }
)
await assertSql(
  'no non-SELECT policy exists on sop_focus_steps or sop_ai_findings (writes stay service-role)',
  `SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname='public'
     AND tablename IN ('sop_focus_steps','sop_ai_findings') AND cmd <> 'SELECT'`,
  (rows) => ({ ok: (rows ?? []).length === 0, detail: JSON.stringify(rows) })
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
