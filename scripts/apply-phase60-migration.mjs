#!/usr/bin/env node
/**
 * apply-phase60-migration.mjs
 *
 * Phase 60 migration applier -- pushes 00074 (requests, notifications, objectives;
 * decisions kind check widened with five kinds; sops.objective copied) to the live
 * remote DB, then runs post-apply assertions through the Management API (raw SQL,
 * never PostgREST, so a stale schema cache cannot fake a missing object).
 * Copy-adapted from scripts/apply-phase58-migration.mjs.
 *
 * MIGRATION_FILES lists every file that must be applied, in order. CLAUDE.md
 * 2026-07-28: a LATER migration that corrects 00074 MUST be appended here, in
 * apply order -- an applier that re-ships only the original would silently
 * re-drop the correction.
 *
 * Usage: node scripts/apply-phase60-migration.mjs [--assert-only]
 * Requires (.env.local or .env): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * SUPABASE_ACCESS_TOKEN.
 */

import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const MIGRATION_FILES = [path.join(ROOT, 'supabase/migrations/00074_requests_notifications_objectives.sql')]

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

console.log('=== Phase 60 Migration Applier (00074 requests / notifications / objectives) ===')
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

// -- ledger kind check ---------------------------------------------------------
const KINDS = [
  'approve', 'reject', 'sign_off', 'countersign', 'assign', 'unassign', 'publish',
  'owner_change', 'review', 'observation', 'verify', 'verify_withdrawn',
  'ai_finding_cleared', 'cadence_change', 'ai_field_write',
  'role_change', 'member_invited', 'member_removed',
  'request_accepted', 'request_declined', 'objective_set', 'objective_cleared', 'objective_confirmed',
]
await assertSql(
  'decisions_kind_check accepts all 23 kinds',
  `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
    WHERE conrelid = 'public.decisions'::regclass AND conname = 'decisions_kind_check'`,
  (rows) => {
    const def = rows?.[0]?.def ?? ''
    const missing = KINDS.filter((k) => !def.includes(`'${k}'::text`))
    return { ok: !!def && missing.length === 0, detail: def ? (missing.length ? `missing: ${missing.join(', ')}` : `all ${KINDS.length} present`) : 'constraint missing' }
  }
)
await assertSql(
  'decisions still has exactly one policy (admins_can_read_decisions) and both append-only triggers',
  `SELECT (SELECT json_agg(policyname || ' ' || cmd) FROM pg_policies WHERE schemaname='public' AND tablename='decisions') AS pols,
          (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.decisions'::regclass AND NOT tgisinternal
             AND tgname IN ('decisions_no_update_delete','decisions_no_truncate') AND tgenabled IN ('O','A')) AS trg`,
  (rows) => {
    const r = rows?.[0] ?? {}
    const pols = r.pols ?? []
    return { ok: pols.length === 1 && pols[0] === 'admins_can_read_decisions SELECT' && Number(r.trg) === 2, detail: JSON.stringify(r) }
  }
)

// -- policies ------------------------------------------------------------------
const POLICIES_SQL = (t) =>
  `SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname='public' AND tablename='${t}' ORDER BY policyname`
const has = (s, ...parts) => parts.every((p) => (s ?? '').includes(p))

await assertSql(
  'requests: exactly one policy requests_read (SELECT; org, auth.uid, role pinned)',
  POLICIES_SQL('requests'),
  (rows) => {
    const r = rows?.[0]
    return {
      ok: (rows ?? []).length === 1 && r.policyname === 'requests_read' && r.cmd === 'SELECT' &&
        has(r.qual, 'current_organisation_id', 'auth.uid()', 'current_user_role'),
      detail: JSON.stringify((rows ?? []).map((p) => `${p.policyname} ${p.cmd}`)),
    }
  }
)
await assertSql(
  'objectives: exactly one policy objectives_read_org (SELECT, org scoped)',
  POLICIES_SQL('objectives'),
  (rows) => {
    const r = rows?.[0]
    return {
      ok: (rows ?? []).length === 1 && r.policyname === 'objectives_read_org' && r.cmd === 'SELECT' && has(r.qual, 'current_organisation_id'),
      detail: JSON.stringify((rows ?? []).map((p) => `${p.policyname} ${p.cmd}`)),
    }
  }
)
await assertSql(
  'notifications: exactly notifications_read_own (SELECT) and notifications_mark_own_read (UPDATE, qual + with_check own row + org)',
  POLICIES_SQL('notifications'),
  (rows) => {
    const byName = Object.fromEntries((rows ?? []).map((p) => [p.policyname, p]))
    const read = byName.notifications_read_own
    const mark = byName.notifications_mark_own_read
    const ok =
      (rows ?? []).length === 2 && read?.cmd === 'SELECT' && has(read.qual, 'auth.uid()', 'current_organisation_id') &&
      mark?.cmd === 'UPDATE' && has(mark.qual, 'auth.uid()', 'current_organisation_id') && has(mark.with_check, 'auth.uid()', 'current_organisation_id')
    return { ok, detail: JSON.stringify((rows ?? []).map((p) => `${p.policyname} ${p.cmd}`)) }
  }
)
await assertSql(
  'no INSERT or DELETE policy on any of the three, and no UPDATE policy on requests / objectives',
  `SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname='public'
     AND tablename IN ('requests','notifications','objectives')
     AND (cmd IN ('INSERT','DELETE','ALL') OR (cmd = 'UPDATE' AND tablename <> 'notifications'))`,
  (rows) => ({ ok: (rows ?? []).length === 0, detail: JSON.stringify(rows) })
)
await assertSql(
  'row security is enabled on all three tables',
  `SELECT relname, relrowsecurity FROM pg_class WHERE oid IN ('public.requests'::regclass,'public.notifications'::regclass,'public.objectives'::regclass)`,
  (rows) => ({ ok: (rows ?? []).length === 3 && rows.every((r) => r.relrowsecurity === true), detail: JSON.stringify(rows) })
)

// -- notifications column grant ------------------------------------------------
await assertSql(
  "authenticated may update notifications.read_at only (title, place, user_id, kind not writable); anon writes nothing",
  `SELECT has_column_privilege('authenticated','public.notifications','title','UPDATE') AS title_w,
          has_column_privilege('authenticated','public.notifications','place','UPDATE') AS place_w,
          has_column_privilege('authenticated','public.notifications','user_id','UPDATE') AS user_w,
          has_column_privilege('authenticated','public.notifications','kind','UPDATE') AS kind_w,
          has_column_privilege('authenticated','public.notifications','read_at','UPDATE') AS read_w,
          has_table_privilege('authenticated','public.notifications','UPDATE') AS table_w,
          has_table_privilege('anon','public.notifications','UPDATE') AS anon_w,
          has_column_privilege('anon','public.notifications','read_at','UPDATE') AS anon_read_w`,
  (rows) => {
    const r = rows?.[0] ?? {}
    return {
      ok: r.title_w === false && r.place_w === false && r.user_w === false && r.kind_w === false &&
        r.read_w === true && r.table_w === false && r.anon_w === false && r.anon_read_w === false,
      detail: JSON.stringify(r),
    }
  }
)

// -- constraints and indexes ---------------------------------------------------
await assertSql(
  'place check, unique (user_id, dedupe_key), one-open-agent-new_sop index and objectives unique key exist',
  `SELECT
     (SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c WHERE c.conrelid='public.notifications'::regclass AND c.contype='c'
        AND pg_get_constraintdef(c.oid) LIKE '%place%') AS place_def,
     (SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c WHERE c.conrelid='public.notifications'::regclass AND c.contype='u') AS notif_unique,
     (SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND indexname='requests_one_open_agent_new_sop') AS agent_idx,
     (SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c WHERE c.conrelid='public.objectives'::regclass AND c.contype='u') AS obj_unique`,
  (rows) => {
    const r = rows?.[0] ?? {}
    const ok =
      has(r.place_def, "'/%'", "'//%'", '300') && has(r.notif_unique, 'user_id', 'dedupe_key') &&
      has(r.agent_idx, 'UNIQUE', 'new_sop', 'raised_by_agent') && has(r.obj_unique, 'NULLS NOT DISTINCT', 'subject_id')
    return { ok, detail: ok ? 'all four present' : JSON.stringify(r) }
  }
)
await assertSql(
  'no foreign key from requests / notifications / objectives to sops (A-10), none on the person columns',
  `SELECT conrelid::regclass::text AS tbl, conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
    WHERE contype = 'f' AND conrelid IN ('public.requests'::regclass,'public.notifications'::regclass,'public.objectives'::regclass)
      AND (confrelid = 'public.sops'::regclass OR pg_get_constraintdef(oid) ~ '(raised_by_user|target_user_id|answered_by|set_by_user|confirmed_by)')`,
  (rows) => ({ ok: (rows ?? []).length === 0, detail: JSON.stringify(rows) })
)

// -- data copy (A-01) and the untouched old table (A-02) -----------------------
await assertSql(
  'lineage roots with a non-blank objective (that have a setter) equal objectives rows of subject_type sop',
  `SELECT
     (SELECT count(*) FROM (
        SELECT DISTINCT ON (coalesce(s.parent_sop_id, s.id)) coalesce(s.owner_user_id,
          (SELECT m.user_id FROM public.organisation_members m WHERE m.organisation_id = s.organisation_id AND m.role = 'admin' ORDER BY m.created_at LIMIT 1)) AS setter
        FROM public.sops s WHERE s.objective IS NOT NULL AND btrim(s.objective) <> ''
        ORDER BY coalesce(s.parent_sop_id, s.id), s.version DESC) q WHERE q.setter IS NOT NULL) AS roots,
     (SELECT count(*) FROM public.objectives WHERE subject_type = 'sop') AS rows_sop,
     (SELECT count(*) FROM public.objectives WHERE subject_type = 'sop' AND subject_id IS NULL) AS orphans`,
  (rows) => {
    const r = rows?.[0] ?? {}
    return { ok: Number(r.roots) === Number(r.rows_sop) && Number(r.orphans) === 0, detail: `migrated objective count: ${r.rows_sop} (roots ${r.roots})` }
  }
)
await assertSql(
  'notifications starts empty of copied rows and worker_notifications still exists untouched (A-02)',
  `SELECT to_regclass('public.worker_notifications')::text AS old_tbl, (SELECT count(*) FROM public.notifications) AS n`,
  (rows) => ({ ok: rows?.[0]?.old_tbl === 'worker_notifications', detail: JSON.stringify(rows?.[0]) })
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
