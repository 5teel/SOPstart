#!/usr/bin/env node
/**
 * apply-phase56-migration.mjs
 *
 * Phase 56 migration applier -- pushes 00069 (placement, generated steps,
 * conversion runs, standards) and 00070 (decisions ledger) to the live remote
 * DB, runs post-apply assertions that bypass the PostgREST schema cache, then
 * runs the append-only probe against a real decision row.
 * Copy-adapted from scripts/apply-phase51-migration.mjs.
 *
 * MIGRATION_FILES lists every file that must be applied, in order. CLAUDE.md
 * 2026-07-28: if a LATER migration ever corrects 00069 or 00070, that
 * corrective file MUST be appended here, in apply order -- an applier that
 * re-ships only the originals would silently re-drop the correction.
 *
 * The Management-API fallback runs each file as one statement (one implicit
 * transaction), so a failing file leaves nothing of itself behind. Both files
 * are idempotent.
 *
 * Usage: node scripts/apply-phase56-migration.mjs [--assert-only]
 * Requires (.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * SUPABASE_ACCESS_TOKEN.
 */

import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { probeDecisionsImmutable } from './probe-decisions-immutable.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const MIGRATION_FILES = [
  path.join(ROOT, 'supabase/migrations/00069_sop_kinds_placement_standards.sql'),
  path.join(ROOT, 'supabase/migrations/00070_decisions_ledger.sql'),
  // A later corrective migration is appended here, in apply order (CLAUDE.md 2026-07-28).
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

// ---------------------------------------------------------------------------
// Step 1: apply
// ---------------------------------------------------------------------------
console.log('=== Phase 56 Migration Applier (00069 placement/standards + 00070 decisions ledger) ===')
console.log('Target:', SUPABASE_URL)
console.log('Project ref:', PROJECT_REF)
console.log('')
console.log('[1/5] Applying migrations via supabase db push ...')

// --assert-only: skip the apply (both files are already live) and re-run the
// assertions, probe and cache reload. A live migration is never re-applied.
const ASSERT_ONLY = process.argv.includes('--assert-only')
let pushPath = ASSERT_ONLY ? 'skipped (--assert-only)' : 'db push'
if (!ASSERT_ONLY) try {
  execSync('npx supabase db push', { cwd: ROOT, stdio: 'inherit', env: process.env })
  console.log('supabase db push: SUCCESS')
} catch {
  console.error('')
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
    console.error('Nothing further was attempted. Check which of the two files is live before retrying.')
    process.exit(1)
  }
}
console.log(`      applied via: ${pushPath}`)

// ---------------------------------------------------------------------------
// Step 2: assertions (cache-bypassing raw SQL; pin every security clause)
// ---------------------------------------------------------------------------
console.log('')
console.log('[2/5] Running post-apply assertions via Management API ...')
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

const TABLES = {
  sop_focus_steps: 1,
  sop_conversion_runs: 1,
  standards: 2,
  standard_attachments: 3,
  decisions: 1,
}

for (const [table, policyCount] of Object.entries(TABLES)) {
  await assertSql(
    `public.${table} exists with RLS enabled`,
    `SELECT to_regclass('public.${table}') AS reg,
            (SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.${table}')) AS rls`,
    (rows) => {
      const r = rows?.[0]
      return { ok: !!r && r.reg !== null && r.rls === true, detail: r ? `reg=${r.reg} rls=${r.rls}` : 'no row' }
    }
  )
  await assertSql(
    `public.${table} carries exactly ${policyCount} policies`,
    `SELECT count(*)::int AS n FROM pg_policies WHERE schemaname='public' AND tablename='${table}'`,
    (rows) => ({ ok: rows?.[0]?.n === policyCount, detail: `count=${rows?.[0]?.n}` })
  )
}

// -- policy text pins ----------------------------------------------------------
const POLICY_PINS = [
  // [table, policy, cmd, qualMust, checkMust ('identical' = equals qual, [] = none required)]
  ['sop_focus_steps', 'org_members_can_view_sop_focus_steps', 'SELECT', ['current_organisation_id', 'sop_focus_steps.sop_id'], null],
  ['sop_conversion_runs', 'admins_can_view_sop_conversion_runs', 'SELECT', ['current_organisation_id', 'current_user_role', 'admin', 'safety_manager'], null],
  ['standards', 'org_members_can_view_standards', 'SELECT', ['current_organisation_id'], null],
  ['standards', 'admins_can_write_standards', 'ALL', ['current_organisation_id', 'current_user_role', 'admin', 'safety_manager'], 'identical'],
  ['standard_attachments', 'org_members_can_view_standard_attachments', 'SELECT', ['current_organisation_id'], null],
  ['standard_attachments', 'admins_can_attach_standards', 'INSERT', [], ['current_organisation_id', 'current_user_role', 'admin', 'safety_manager', 'sop_sections', 'sop_focus_steps', 'standard_attachments.sop_id', 'standard_attachments.section_id', 'standard_attachments.focus_step_id']],
  ['standard_attachments', 'admins_can_detach_standards', 'DELETE', ['current_organisation_id', 'current_user_role', 'admin', 'safety_manager'], null],
  ['decisions', 'admins_can_read_decisions', 'SELECT', ['current_organisation_id', 'current_user_role', 'admin', 'safety_manager'], null],
]
for (const [table, name, cmd, qualMust, checkMust] of POLICY_PINS) {
  await assertSql(
    `policy ${table}.${name} (${cmd}) is org-scoped${checkMust === 'identical' ? ', WITH CHECK identical to USING' : ''}`,
    `SELECT cmd, roles::text AS roles, qual, with_check FROM pg_policies
       WHERE schemaname='public' AND tablename='${table}' AND policyname='${name}'`,
    (rows) => {
      const r = rows?.[0]
      if (!r) return { ok: false, detail: 'policy not found' }
      const qual = r.qual ?? ''
      const check = r.with_check ?? ''
      const okCmd = r.cmd === cmd
      const okRole = r.roles.includes('authenticated') && !r.roles.includes('anon')
      const okQual = qualMust.every((s) => qual.includes(s))
      let okCheck = true
      if (checkMust === 'identical') okCheck = check === qual
      else if (Array.isArray(checkMust)) okCheck = checkMust.every((s) => check.includes(s))
      return {
        ok: okCmd && okRole && okQual && okCheck,
        detail: `cmd=${r.cmd} roles=${r.roles} okQual=${okQual} okCheck=${okCheck}`,
      }
    }
  )
}

// -- placement ---------------------------------------------------------------------
await assertSql(
  'sops.placement exists, NOT NULL, default site, with sops_placement_check',
  `SELECT c.is_nullable, c.column_default,
          (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='sops_placement_check' AND conrelid='public.sops'::regclass) AS chk
     FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name='sops' AND c.column_name='placement'`,
  (rows) => {
    const r = rows?.[0]
    const ok = !!r && r.is_nullable === 'NO' && /site/.test(r.column_default ?? '') && /machine/.test(r.chk ?? '') && /site/.test(r.chk ?? '')
    return { ok, detail: r ? `nullable=${r.is_nullable} default=${r.column_default} check=${r.chk}` : 'column missing' }
  }
)
await assertSql(
  "count(placement='machine') equals count(distinct sop_id) from sop_machines",
  `SELECT (SELECT count(*) FROM public.sops WHERE placement='machine')::int AS a,
          (SELECT count(DISTINCT sop_id) FROM public.sop_machines)::int AS b,
          (SELECT count(*) FROM public.sops WHERE placement='site' AND EXISTS (SELECT 1 FROM public.sop_machines m WHERE m.sop_id = sops.id))::int AS wrong_site`,
  (rows) => {
    const r = rows?.[0]
    return { ok: r?.a === r?.b && r?.wrong_site === 0, detail: `machine=${r?.a} linked=${r?.b} wrong_site=${r?.wrong_site}` }
  }
)
await assertSql(
  'trigger sop_machines_sync_placement exists, enabled, AFTER INSERT OR DELETE row; sync function is not elevated-privilege',
  `SELECT t.tgenabled, t.tgtype::int AS tgtype, p.prosecdef
     FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid='public.sop_machines'::regclass AND t.tgname='sop_machines_sync_placement' AND NOT t.tgisinternal`,
  (rows) => {
    const r = rows?.[0]
    if (!r) return { ok: false, detail: 'trigger missing' }
    // tgtype bits: 1 row, 2 before, 4 insert, 8 delete, 16 update
    const row = (r.tgtype & 1) === 1, before = (r.tgtype & 2) === 2, ins = (r.tgtype & 4) === 4, del = (r.tgtype & 8) === 8, upd = (r.tgtype & 16) === 16
    return {
      ok: r.tgenabled === 'O' && row && !before && ins && del && !upd && r.prosecdef === false,
      detail: `tgenabled=${r.tgenabled} tgtype=${r.tgtype} prosecdef=${r.prosecdef}`,
    }
  }
)

// -- standards seed ------------------------------------------------------------------
await assertSql(
  'every organisation has >= 6 standards (seed)',
  `SELECT count(*)::int AS orgs, count(*) FILTER (WHERE n >= 6)::int AS seeded
     FROM (SELECT o.id, (SELECT count(*) FROM public.standards s WHERE s.organisation_id = o.id) AS n FROM public.organisations o) x`,
  (rows) => ({ ok: rows?.[0]?.orgs === rows?.[0]?.seeded, detail: `orgs=${rows?.[0]?.orgs} seeded=${rows?.[0]?.seeded}` })
)

// -- attachment shape --------------------------------------------------------------
await assertSql(
  'standard_attachments: num_nonnulls check, composite FK to standards, per-level cascades',
  `SELECT
     (SELECT count(*) FROM pg_constraint WHERE conrelid='public.standard_attachments'::regclass AND contype='c' AND pg_get_constraintdef(oid) ILIKE '%num_nonnulls%')::int AS chk,
     (SELECT count(*) FROM pg_constraint WHERE conrelid='public.standard_attachments'::regclass AND contype='f' AND confrelid='public.standards'::regclass AND cardinality(conkey)=2 AND confdeltype='c')::int AS std_fk,
     (SELECT count(*) FROM pg_constraint WHERE conrelid='public.standard_attachments'::regclass AND contype='f' AND confrelid IN ('public.sops'::regclass,'public.sop_sections'::regclass,'public.sop_focus_steps'::regclass) AND confdeltype='c')::int AS target_fks`,
  (rows) => {
    const r = rows?.[0]
    return { ok: r?.chk === 1 && r?.std_fk === 1 && r?.target_fks === 3, detail: JSON.stringify(r) }
  }
)

// -- decisions: triggers, constraints, FKs -----------------------------------------------
await assertSql(
  "decisions triggers present, tgenabled = 'A' (always), row BEFORE UPDATE/DELETE + statement BEFORE TRUNCATE",
  `SELECT tgname, tgenabled, tgtype::int AS tgtype FROM pg_trigger
    WHERE tgrelid='public.decisions'::regclass AND NOT tgisinternal ORDER BY tgname`,
  (rows) => {
    const byName = Object.fromEntries((rows ?? []).map((r) => [r.tgname, r]))
    const ud = byName.decisions_no_update_delete
    const tr = byName.decisions_no_truncate
    // tgtype bits: 1 row, 2 before, 4 insert, 8 delete, 16 update, 32 truncate
    const udOk = !!ud && ud.tgenabled === 'A' && (ud.tgtype & 1) === 1 && (ud.tgtype & 2) === 2 && (ud.tgtype & 8) === 8 && (ud.tgtype & 16) === 16 && (ud.tgtype & 4) === 0
    const trOk = !!tr && tr.tgenabled === 'A' && (tr.tgtype & 1) === 0 && (tr.tgtype & 2) === 2 && (tr.tgtype & 32) === 32
    return { ok: (rows ?? []).length === 2 && udOk && trOk, detail: JSON.stringify(rows) }
  }
)
await assertSql(
  'decisions_refuse_change is not elevated-privilege and raises append-only',
  `SELECT prosecdef, prosrc FROM pg_proc WHERE oid = 'public.decisions_refuse_change()'::regprocedure`,
  (rows) => {
    const r = rows?.[0]
    return { ok: !!r && r.prosecdef === false && /append-only/.test(r.prosrc), detail: `prosecdef=${r?.prosecdef}` }
  }
)
await assertSql(
  'decisions CHECK constraints decisions_agent_named + decisions_person_has_id present',
  `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
    WHERE conrelid='public.decisions'::regclass AND contype='c' AND conname IN ('decisions_agent_named','decisions_person_has_id')`,
  (rows) => {
    const n = Object.fromEntries((rows ?? []).map((r) => [r.conname, r.def]))
    const ok = /btrim/.test(n.decisions_agent_named ?? '') && /actor_name/.test(n.decisions_agent_named ?? '') && /backfill/.test(n.decisions_person_has_id ?? '')
    return { ok, detail: JSON.stringify(n) }
  }
)
await assertSql(
  "decisions has no cascading / set-null foreign key (every FK confdeltype = 'a')",
  `SELECT conname, confdeltype FROM pg_constraint WHERE conrelid='public.decisions'::regclass AND contype='f'`,
  (rows) => ({ ok: (rows ?? []).every((r) => r.confdeltype === 'a'), detail: JSON.stringify(rows) })
)

// -- decisions: privileges ----------------------------------------------------------------
const PRIV = [
  ['service_role', 'UPDATE', false],
  ['service_role', 'DELETE', false],
  ['service_role', 'TRUNCATE', false],
  ['service_role', 'INSERT', true],
  ['service_role', 'SELECT', true],
  ['authenticated', 'INSERT', false],
  ['authenticated', 'UPDATE', false],
  ['authenticated', 'DELETE', false],
  ['authenticated', 'TRUNCATE', false],
  ['anon', 'SELECT', false],
  ['anon', 'INSERT', false],
]
for (const [role, priv, expected] of PRIV) {
  await assertSql(
    `has_table_privilege(${role}, public.decisions, ${priv}) = ${expected}`,
    `SELECT has_table_privilege('${role}', 'public.decisions', '${priv}') AS p`,
    (rows) => ({ ok: rows?.[0]?.p === expected, detail: `p=${rows?.[0]?.p}` })
  )
}
for (const fn of ['accept_block_update', 'decline_block_update']) {
  for (const role of ['authenticated', 'anon']) {
    await assertSql(
      `has_function_privilege(${role}, ${fn}(uuid, uuid, text), EXECUTE) = false`,
      `SELECT has_function_privilege('${role}', 'public.${fn}(uuid, uuid, text)', 'EXECUTE') AS p`,
      (rows) => ({ ok: rows?.[0]?.p === false, detail: `p=${rows?.[0]?.p}` })
    )
  }
}

// -- backfill ------------------------------------------------------------------------------
const SOURCES = [
  ['sop_approvals', 'SELECT count(*) FROM public.sop_approvals'],
  ['sop_completion_signatures', 'SELECT count(*) FROM public.sop_completion_signatures'],
  ['sop_observations', 'SELECT count(*) FROM public.sop_observations'],
  ['sop_review_events', 'SELECT count(*) FROM public.sop_review_events'],
  [
    'sop_block_update_decisions',
    `SELECT count(*) FROM public.sop_block_update_decisions d
       JOIN public.sop_section_blocks ssb ON ssb.id = d.sop_section_block_id
       JOIN public.sop_sections sec ON sec.id = ssb.sop_section_id
       JOIN public.sops s ON s.id = sec.sop_id`,
  ],
  ['completion_sign_offs', 'SELECT count(*) FROM public.completion_sign_offs'],
  [
    'sop_assignments',
    `SELECT count(*) FROM public.sop_assignments sa WHERE NOT (sa.assignment_type::text = 'individual' AND sa.user_id = sa.assigned_by)`,
  ],
]
await assertSql(
  'per-source backfill counts (source, eligible, backfilled) equal while the ledger holds no live rows',
  `SELECT (SELECT count(*) FROM public.decisions WHERE source='live')::int AS live,
          (SELECT count(*) FROM public.decisions)::int AS total,
          ${SOURCES.map(([t, q], i) => `(${q})::int AS e${i}, (SELECT count(*) FROM public.decisions WHERE legacy_table='${t}')::int AS b${i}`).join(',\n          ')}`,
  (rows) => {
    const r = rows?.[0]
    if (!r) return { ok: false, detail: 'no row' }
    const lines = ['source | eligible | backfilled']
    let equal = true
    SOURCES.forEach(([t], i) => {
      lines.push(`${t} | ${r['e' + i]} | ${r['b' + i]}`)
      if (r['e' + i] !== r['b' + i]) equal = false
    })
    lines.push(`ledger total=${r.total} live=${r.live}`)
    const ok = r.total > 0 && (r.live > 0 || equal)
    return { ok, detail: '\n        ' + lines.join('\n        ') + (equal ? '' : '\n        (counts differ; report-only because live rows exist)') }
  }
)

// ---------------------------------------------------------------------------
// Step 3: immutability probe against a real row
// ---------------------------------------------------------------------------
console.log('')
console.log('[3/5] Append-only probe against an existing decision row ...')
{
  const { status, lines } = await probeDecisionsImmutable(managementSql)
  for (const l of lines) console.log(`  ${l}`)
  if (status === 'ok') console.log('  PASS  every UPDATE/DELETE/TRUNCATE refused (owner and service_role)')
  else {
    console.error(`  FAIL  probe status: ${status}`)
    allPassed = false
  }
}

// ---------------------------------------------------------------------------
// Step 4: reload PostgREST schema cache
// ---------------------------------------------------------------------------
console.log('')
console.log("[4/5] Issuing NOTIFY pgrst, 'reload schema' via Management API ...")
try {
  await managementSql("NOTIFY pgrst, 'reload schema'")
  console.log('  PASS  NOTIFY pgrst reload schema issued')
} catch (e) {
  console.error('  FAIL  NOTIFY pgrst reload schema:', e.message)
  allPassed = false
}

console.log('')
console.log('[5/5] Summary')
if (allPassed) {
  console.log('=== ALL POST-APPLY ASSERTIONS PASSED ===')
  process.exit(0)
} else {
  console.error('=== ONE OR MORE ASSERTIONS FAILED ===')
  process.exit(1)
}
