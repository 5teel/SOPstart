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
  // Phase 46 WR-04: reorder_sop_section_blocks now RETURNS integer (affected
  // row count) so zero-row reorders are detectable. Must apply AFTER 00064.
  path.join(ROOT, 'supabase/migrations/00065_reorder_ssb_rpc_rowcount.sql'),
  // A1 RESOLVED (Simon, 2026-08-25): sign-off authority = approval-chain
  // approvers, not sops.owner_user_id. 00066 CORRECTS 00063/00064 (recreates
  // all four content policies with is_sop_sign_off_approver replacing the
  // owner arm) -- per the 2026-07-28 applier rule it MUST be listed here,
  // after them, or a re-run would re-ship the retired owner arm.
  path.join(ROOT, 'supabase/migrations/00066_sign_off_approver_edit.sql'),
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
console.log('=== Phase 46 Migration Applier (00063..00066 CAP-02 content-edit policies) ===')
console.log('Target:', SUPABASE_URL)
console.log('Project ref:', PROJECT_REF)
console.log('')
console.log('[1/4] Applying migrations (through 00066) via supabase db push ...')
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
    console.error('Option A: Supabase SQL Editor (paste each MIGRATION_FILES body, in order):')
    console.error('  supabase/migrations/00063 -> 00064 -> 00065 -> 00066')
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

// WR-01: token-presence checks alone would print PASS on the exact T1 hole
// this script exists to catch -- a regressed `(org AND role) OR approver`
// shape (the top-level-OR cross-tenant hole 00061 fixed) contains all the
// tokens. So we assert the NESTING: after whitespace-normalizing the
// deparsed qual, the org predicate must be AND-conjoined with the
// (role OR approver) group -- i.e. `...organisation_id =
// current_organisation_id()) AND ((current_user_role() = ANY (...)) OR
// is_sop_sign_off_approver(<sop id expr>))`. A top-level-OR regression
// deparse cannot match this shape.
// A1 RESOLVED (2026-08-25): the arm is is_sop_sign_off_approver(), not
// owner_user_id = auth.uid() -- an owner_user_id token reappearing in any
// of these quals is itself a regression (asserted below).
// (the live deparse casts the role literals to ::app_role -- the enum the
// column actually is -- not ::text; accept either so a type re-declare
// doesn't false-fail)
const NESTED_APPROVER_ARM =
  /organisation_id = current_organisation_id\(\)\) AND \(\(current_user_role\(\) = ANY \(ARRAY\['admin'::(?:text|app_role),\s*'safety_manager'::(?:text|app_role)\]\)\) OR is_sop_sign_off_approver\([\w.]+\)\)/
const REQUIRED_SUBSTRINGS = ['current_organisation_id', 'current_user_role', 'is_sop_sign_off_approver']
const normalizeQual = (q) => (q ?? '').replace(/\s+/g, ' ')
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
    `${table}.${name} qual: approver arm is NESTED under the org-scope AND (structural, not token presence); owner arm is GONE`,
    `SELECT policyname, qual, with_check FROM pg_policies WHERE schemaname='public' AND tablename='${table}' AND policyname='${name}'`,
    (rows) => {
      const row = rows?.[0]
      const qual = normalizeQual(row?.qual)
      const missing = REQUIRED_SUBSTRINGS.filter((s) => !qual.includes(s))
      const nested = NESTED_APPROVER_ARM.test(qual)
      const ownerArmGone = !qual.includes('owner_user_id')
      return {
        ok: !!row && missing.length === 0 && nested && ownerArmGone,
        detail: row
          ? `nested-approver-arm=${nested} owner-arm-gone=${ownerArmGone} missing-tokens=[${missing.join(',')}] qual=${qual}`
          : 'policy not found',
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

// WR-04 (00065): pin every security-relevant clause of the reorder RPC --
// returns integer, counts rows via GET DIAGNOSTICS, is NOT SECURITY DEFINER
// (must run as caller so ssb_admin_manage_own_org gates it), and stays
// executable by authenticated.
await assertSql(
  'reorder_sop_section_blocks: returns integer, GET DIAGNOSTICS row count, NOT SECURITY DEFINER, authenticated may execute',
  `SELECT pg_get_functiondef(p.oid) AS def,
          p.prosecdef AS secdef,
          has_function_privilege('authenticated', p.oid, 'execute') AS auth_exec
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'reorder_sop_section_blocks'`,
  (rows) => {
    const row = rows?.[0]
    if (!row) return { ok: false, detail: 'function not found' }
    const def = row.def ?? ''
    const returnsInt = /RETURNS integer/i.test(def)
    const countsRows = /GET DIAGNOSTICS/i.test(def) && /ROW_COUNT/i.test(def)
    const notSecDef = row.secdef === false
    const authExec = row.auth_exec === true
    return {
      ok: returnsInt && countsRows && notSecDef && authExec,
      detail: `returnsInt=${returnsInt} countsRows=${countsRows} notSecurityDefiner=${notSecDef} authenticatedExecute=${authExec}`,
    }
  }
)

// A1 (00066): pin EVERY security-relevant clause of the helper the four
// policies now delegate to (CLAUDE.md 2026-07-28: an assertion that pins
// fewer clauses certifies whatever happens to be live) -- SECURITY DEFINER,
// search_path pinned, the org conjunct sourced from current_organisation_id()
// (never the fetched row alone), both step-match arms (userId vs auth.uid(),
// role vs current_user_role()), the category join, and the execute grants
// (authenticated yes -- identity derives from auth.uid() internally, the
// 00030 precedent -- anon no).
await assertSql(
  'is_sop_sign_off_approver: SECURITY DEFINER, search_path=public, org conjunct, both step arms, category join, authenticated-yes/anon-no execute',
  `SELECT pg_get_functiondef(p.oid) AS def,
          p.prosecdef AS secdef,
          has_function_privilege('authenticated', p.oid, 'execute') AS auth_exec,
          has_function_privilege('anon', p.oid, 'execute') AS anon_exec
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_sop_sign_off_approver'`,
  (rows) => {
    const row = rows?.[0]
    if (!row) return { ok: false, detail: 'function not found' }
    const def = (row.def ?? '').replace(/\s+/g, ' ')
    const secDef = row.secdef === true
    const searchPath = /SET search_path TO '?public'?/i.test(def)
    const orgConjunct = def.includes('s.organisation_id = public.current_organisation_id()')
    const userIdArm = def.includes("step->>'userId' = auth.uid()::text") || def.includes("(step ->> 'userId'::text) = (auth.uid())::text")
    const roleArm = def.includes("step->>'role' = public.current_user_role()::text") || def.includes("(step ->> 'role'::text) = (public.current_user_role())::text")
    const categoryJoin = def.includes('ac.category = s.category_slug')
    const authExec = row.auth_exec === true
    const anonDenied = row.anon_exec === false
    return {
      ok: secDef && searchPath && orgConjunct && userIdArm && roleArm && categoryJoin && authExec && anonDenied,
      detail: `securityDefiner=${secDef} searchPathPublic=${searchPath} orgConjunct=${orgConjunct} userIdArm=${userIdArm} roleArm=${roleArm} categoryJoin=${categoryJoin} authenticatedExecute=${authExec} anonDenied=${anonDenied}`,
    }
  }
)

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
  console.log('Migrations 00063..00066 are live on the DB: all four content policies')
  console.log('(sections, steps, images, block junctions) carry the approver-OR-role')
  console.log('arm (is_sop_sign_off_approver, A1 resolved 2026-08-25) inside their')
  console.log('org-scoped USING; the junction policy restates the full predicate in')
  console.log('WITH CHECK; PostgREST has been told to reload its cache.')
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
