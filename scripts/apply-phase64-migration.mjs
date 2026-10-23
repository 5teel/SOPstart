#!/usr/bin/env node
/**
 * apply-phase64-migration.mjs
 *
 * Phase 64 migration applier -- pushes 00082 (membership status, row-checking RLS helpers,
 * hook filter, raw-claim policies, revoke_user_sessions, three ledger kinds) to the live
 * remote DB, then runs post-apply assertions through the Management API (raw SQL, never
 * PostgREST, so a stale schema cache cannot fake a missing object).
 * Copy-adapted from scripts/apply-phase60-migration.mjs.
 *
 * MIGRATION_FILES lists every file that must be applied, in order. CLAUDE.md 2026-07-28: a
 * LATER migration that corrects 00082 MUST be appended here, in apply order.
 *
 * Usage:
 *   node scripts/apply-phase64-migration.mjs               apply, then assert
 *   node scripts/apply-phase64-migration.mjs --assert-only assertions only
 *   node scripts/apply-phase64-migration.mjs --audit       read-only live inventory (no writes)
 *   node scripts/apply-phase64-migration.mjs --rollback    restore the 00001 helper bodies and the
 *                                                          00081 hook body (the additive column stays)
 * Requires (.env.local or .env): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * SUPABASE_ACCESS_TOKEN. Nothing here prints a key, token or JWT: probe claims hold ids and role
 * names only.
 */

import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const MIGRATION_FILES = [path.join(ROOT, 'supabase/migrations/00082_member_status.sql')]

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
  if (!resp.ok) {
    const err = new Error(`Management API error ${resp.status}: ${JSON.stringify(body)}`)
    err.apiMessage = typeof body?.message === 'string' ? body.message : JSON.stringify(body)
    throw err
  }
  return body
}

/**
 * Run a plpgsql block that always ends in an exception, so everything it did is rolled back
 * (no explicit transaction control needed over the Management API). The block fills the jsonb
 * variable `res`; the final exception carries it back as PROBE_RESULT:<json>:END_PROBE.
 * `declare_extra` is extra plpgsql declarations, `body` the statements.
 */
async function probe(declareExtra, body) {
  const sql = `DO $probe$
DECLARE
  res jsonb := '{}'::jsonb;
  ${declareExtra}
BEGIN
  ${body}
  RAISE EXCEPTION 'PROBE_RESULT:%:END_PROBE', res::text;
END
$probe$`
  try {
    await managementSql(sql)
  } catch (e) {
    const msg = e.apiMessage || e.message || ''
    const m = msg.match(/PROBE_RESULT:([\s\S]*?):END_PROBE/)
    if (m) return JSON.parse(m[1])
    throw e
  }
  throw new Error('probe did not raise its result exception')
}

/** SQL fragment: act as `uid` in `org` with claim role `role` (claims carry ids and names only). */
const asUser = (uidExpr, orgExpr, role) =>
  `PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', (${uidExpr})::text, 'role', 'authenticated', 'organisation_id', (${orgExpr})::text, 'user_role', '${role}')::text, true);
  EXECUTE 'set local role authenticated';`
const asPostgres = `EXECUTE 'reset role'; PERFORM set_config('request.jwt.claims', '', true);`

const ASSERT_ONLY = process.argv.includes('--assert-only')
const AUDIT = process.argv.includes('--audit')
const ROLLBACK = process.argv.includes('--rollback')

const show = (title, rows) => {
  console.log(`\n### ${title}`)
  console.log(typeof rows === 'string' ? rows : JSON.stringify(rows, null, 1))
}

console.log('=== Phase 64 Migration Applier (00082 member status) ===')
console.log('Target:', SUPABASE_URL)
console.log('Project ref:', PROJECT_REF)

// -- audit (read-only) ------------------------------------------------------------
if (AUDIT) {
  console.log('Mode: --audit (read-only; the only probes run inside a block that always rolls back)')

  show(
    '(a) policies reading auth.jwt() directly (schemas public + storage)',
    await managementSql(`SELECT schemaname, tablename, policyname, cmd, roles::text AS roles, qual, with_check
      FROM pg_policies WHERE schemaname IN ('public','storage')
        AND (qual LIKE '%auth.jwt()%' OR with_check LIKE '%auth.jwt()%')
      ORDER BY schemaname, tablename, policyname`)
  )
  show(
    '(b) sop_observations_read_org',
    await managementSql(`SELECT schemaname, tablename, policyname, cmd, roles::text AS roles, qual, with_check
      FROM pg_policies WHERE policyname = 'sop_observations_read_org'`)
  )
  show(
    '(c) helper definitions, result types, owners',
    await managementSql(`SELECT p.proname, pg_get_function_result(p.oid) AS result, pg_get_userbyid(p.proowner) AS owner,
        p.prosecdef AS security_definer, p.proconfig::text AS config, pg_get_functiondef(p.oid) AS def
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN ('current_organisation_id','current_user_role','custom_access_token_hook','sop_observation_refs_in_org')
      ORDER BY p.proname`)
  )
  show(
    '(d) RLS flags on public.organisation_members',
    await managementSql(`SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = 'public.organisation_members'::regclass`)
  )
  show(
    '(e) grants on public.organisation_members',
    {
      table: await managementSql(`SELECT grantee, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privileges
        FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'organisation_members'
          AND grantee IN ('anon','authenticated','service_role','supabase_auth_admin') GROUP BY grantee ORDER BY grantee`),
      columns: await managementSql(`SELECT grantee, privilege_type, string_agg(column_name, ',' ORDER BY column_name) AS columns
        FROM information_schema.column_privileges WHERE table_schema = 'public' AND table_name = 'organisation_members'
          AND grantee IN ('anon','authenticated','service_role','supabase_auth_admin') GROUP BY grantee, privilege_type ORDER BY grantee, privilege_type`),
    }
  )
  show(
    '(f) non-internal triggers on organisation_members and sops',
    await managementSql(`SELECT c.relname AS tbl, t.tgname, p.proname AS fn, t.tgenabled
      FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE NOT t.tgisinternal AND t.tgrelid IN ('public.organisation_members'::regclass, 'public.sops'::regclass)
      ORDER BY c.relname, t.tgname`)
  )
  show(
    '(g) sop-videos objects and bucket policies',
    {
      counts: await managementSql(`SELECT
          (SELECT count(*) FROM storage.objects WHERE bucket_id = 'sop-videos') AS total,
          (SELECT count(*) FROM storage.objects o WHERE o.bucket_id = 'sop-videos'
             AND NOT EXISTS (SELECT 1 FROM public.organisations g WHERE g.id::text = (storage.foldername(o.name))[1])) AS not_org_prefixed`),
      policies: await managementSql(`SELECT policyname, cmd, roles::text AS roles, qual, with_check FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects' ORDER BY policyname`),
    }
  )
  show(
    '(h) timing probes as the eval-site admin (rolled back)',
    await probe(
      `uid uuid; org uuid; plan json; plan2 json; i int; n bigint;`,
      `SELECT id INTO uid FROM auth.users WHERE email = 'eval-site-admin@sopstart.com';
  SELECT id INTO org FROM public.organisations WHERE name = 'SOPstart Eval Site';
  res := res || jsonb_build_object('found_user', uid IS NOT NULL, 'found_org', org IS NOT NULL);
  ${asUser('uid', 'org', 'admin')}
  -- each statement runs twice; the second (warm) time is the one reported
  FOR i IN 1..2 LOOP
    EXECUTE 'EXPLAIN (ANALYZE, FORMAT JSON) SELECT count(*) FROM public.sops' INTO plan;
    EXECUTE 'EXPLAIN (ANALYZE, FORMAT JSON) SELECT * FROM public.decisions WHERE organisation_id = ' || quote_literal(org) || ' ORDER BY created_at DESC LIMIT 50' INTO plan2;
    IF i = 2 THEN
      res := res || jsonb_build_object('sops_ms', plan->0->'Execution Time', 'decisions_ms', plan2->0->'Execution Time');
    END IF;
  END LOOP;
  EXECUTE 'SELECT count(*) FROM public.sops' INTO n;
  res := res || jsonb_build_object('sops_visible', n);
  ${asPostgres}`
    )
  )
  show('(i) auth.sessions row count (no ids)', await managementSql(`SELECT count(*) AS sessions FROM auth.sessions`))
  console.log('\n=== AUDIT COMPLETE (nothing written) ===')
  process.exit(0)
}

// -- rollback ---------------------------------------------------------------------
if (ROLLBACK) {
  console.log('Mode: --rollback (restores 00001 helper bodies + 00081 hook body; the column stays)')
  await managementSql(`
create or replace function public.current_organisation_id()
returns uuid language sql stable security definer set search_path = ''
as $$ select nullif(auth.jwt() ->> 'organisation_id', 'null')::uuid $$;

create or replace function public.current_user_role()
returns public.app_role language sql stable security definer set search_path = ''
as $$ select (auth.jwt() ->> 'user_role')::public.app_role $$;

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  claims         jsonb;
  member_record  record;
  active_org     uuid;
  raw_meta       jsonb;
  approval       text;
begin
  select status into approval from public.user_approvals where user_id = (event->>'user_id')::uuid;
  approval := coalesce(approval, 'pending');

  if approval = 'approved' then
    raw_meta := event->'claims'->'user_metadata';
    if raw_meta is not null and raw_meta->>'active_org_id' is not null then
      active_org := (raw_meta->>'active_org_id')::uuid;
      select organisation_id, role into member_record
      from public.organisation_members
      where user_id = (event->>'user_id')::uuid and organisation_id = active_org
      limit 1;
    end if;

    if member_record is null then
      select organisation_id, role into member_record
      from public.organisation_members
      where user_id = (event->>'user_id')::uuid
      order by created_at desc
      limit 1;
    end if;
  end if;

  claims := event->'claims';
  claims := jsonb_set(claims, '{approval}', to_jsonb(approval));
  if member_record is not null then
    claims := jsonb_set(claims, '{organisation_id}', to_jsonb(member_record.organisation_id::text));
    claims := jsonb_set(claims, '{user_role}', to_jsonb(member_record.role::text));
  else
    claims := jsonb_set(claims, '{organisation_id}', 'null');
    claims := jsonb_set(claims, '{user_role}', '"pending"');
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;
`)
  const defs = await managementSql(`SELECT proname, pg_get_functiondef(oid) AS def FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace AND proname IN ('current_organisation_id','current_user_role','custom_access_token_hook')`)
  const back = defs.every((d) => !d.def.includes("status = 'active'"))
  console.log(back ? 'ROLLBACK OK: helpers and hook are on the old bodies' : 'ROLLBACK FAILED: a body still mentions the active filter')
  process.exit(back ? 0 : 1)
}

// -- apply ------------------------------------------------------------------------
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

// ASSERTIONS-BEGIN (filled in by plan 64-01 task 3)
// ASSERTIONS-END

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
