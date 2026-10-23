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

const has = (s, ...parts) => parts.every((p) => (s ?? '').includes(p))
const KINDS_NEW = ['member_suspended', 'member_left', 'member_reinstated']

// -- columns, constraint, backfill -------------------------------------------------
await assertSql(
  'organisation_members has status (not null, default active), status_changed_at, status_changed_by and the three-state CHECK',
  `SELECT
     (SELECT json_agg(json_build_object('c', column_name, 'nullable', is_nullable, 'def', column_default) ORDER BY column_name)
        FROM information_schema.columns WHERE table_schema='public' AND table_name='organisation_members'
         AND column_name IN ('status','status_changed_at','status_changed_by')) AS cols,
     (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.organisation_members'::regclass AND conname='organisation_members_status_check') AS chk`,
  (rows) => {
    const r = rows?.[0] ?? {}
    const cols = r.cols ?? []
    const status = cols.find((c) => c.c === 'status')
    const ok = cols.length === 3 && status?.nullable === 'NO' && has(status?.def, "'active'") &&
      has(r.chk, "'active'", "'suspended'", "'left'")
    return { ok, detail: JSON.stringify({ cols: cols.map((c) => c.c), chk: r.chk }) }
  }
)
await assertSql(
  'every existing membership row has a valid status (no null, nothing outside active / suspended / left)',
  `SELECT count(*) FILTER (WHERE status IS NULL OR status NOT IN ('active','suspended','left')) AS bad,
          count(*) FILTER (WHERE status = 'active') AS active, count(*) AS total
     FROM public.organisation_members`,
  (rows) => ({ ok: Number(rows?.[0]?.bad) === 0, detail: JSON.stringify(rows?.[0]) })
)

// -- privileges --------------------------------------------------------------------
await assertSql(
  'authenticated may update organisation_members.role only (status, status_changed_at, status_changed_by, table-level not writable); anon writes nothing',
  `SELECT has_column_privilege('authenticated','public.organisation_members','status','UPDATE') AS status_w,
          has_column_privilege('authenticated','public.organisation_members','status_changed_at','UPDATE') AS at_w,
          has_column_privilege('authenticated','public.organisation_members','status_changed_by','UPDATE') AS by_w,
          has_column_privilege('authenticated','public.organisation_members','organisation_id','UPDATE') AS org_w,
          has_column_privilege('authenticated','public.organisation_members','role','UPDATE') AS role_w,
          has_table_privilege('authenticated','public.organisation_members','UPDATE') AS table_w,
          has_table_privilege('anon','public.organisation_members','UPDATE') AS anon_table_w,
          has_column_privilege('anon','public.organisation_members','role','UPDATE') AS anon_role_w,
          has_column_privilege('service_role','public.organisation_members','status','UPDATE') AS svc_status_w`,
  (rows) => {
    const r = rows?.[0] ?? {}
    return {
      ok: r.status_w === false && r.at_w === false && r.by_w === false && r.org_w === false && r.role_w === true &&
        r.table_w === false && r.anon_table_w === false && r.anon_role_w === false && r.svc_status_w === true,
      detail: JSON.stringify(r),
    }
  }
)
await assertSql(
  'revoke_user_sessions(uuid): EXECUTE false for anon and authenticated, true for service_role',
  `SELECT has_function_privilege('anon','public.revoke_user_sessions(uuid)','EXECUTE') AS anon_x,
          has_function_privilege('authenticated','public.revoke_user_sessions(uuid)','EXECUTE') AS auth_x,
          has_function_privilege('service_role','public.revoke_user_sessions(uuid)','EXECUTE') AS svc_x,
          (SELECT prosecdef FROM pg_proc WHERE oid='public.revoke_user_sessions(uuid)'::regprocedure) AS secdef`,
  (rows) => {
    const r = rows?.[0] ?? {}
    return { ok: r.anon_x === false && r.auth_x === false && r.svc_x === true && r.secdef === true, detail: JSON.stringify(r) }
  }
)

// -- function bodies -----------------------------------------------------------------
await assertSql(
  "both helpers, the hook (both selects) and the observation refs helper contain status = 'active'",
  `SELECT p.proname, pg_get_functiondef(p.oid) AS def FROM pg_proc p
    WHERE p.pronamespace='public'::regnamespace AND p.proname IN ('current_organisation_id','current_user_role','custom_access_token_hook','sop_observation_refs_in_org')
    ORDER BY p.proname`,
  (rows) => {
    const by = Object.fromEntries((rows ?? []).map((r) => [r.proname, r.def]))
    const count = (s) => (s?.match(/status = 'active'/g) ?? []).length
    const ok = count(by.current_organisation_id) >= 1 && count(by.current_user_role) >= 1 && count(by.custom_access_token_hook) === 2 && count(by.sop_observation_refs_in_org) >= 1
    return { ok, detail: JSON.stringify(Object.fromEntries(Object.entries(by).map(([k, v]) => [k, count(v)]))) }
  }
)
await assertSql(
  'custom_access_token_hook is executable by supabase_auth_admin',
  `SELECT has_function_privilege('supabase_auth_admin','public.custom_access_token_hook(jsonb)','EXECUTE') AS x`,
  (rows) => ({ ok: rows?.[0]?.x === true, detail: JSON.stringify(rows?.[0]) })
)

// -- policies -----------------------------------------------------------------------
await assertSql(
  'no policy (public or storage) reads auth.jwt() directly, so none reads the organisation or role claim',
  `SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname IN ('public','storage')
     AND (qual LIKE '%auth.jwt()%' OR with_check LIKE '%auth.jwt()%')`,
  (rows) => ({ ok: (rows ?? []).length === 0, detail: JSON.stringify(rows) })
)
await assertSql(
  'sop_observations_read_org: organisation predicate outside the role / own-row OR (own-row arm is ANDed)',
  `SELECT qual FROM pg_policies WHERE tablename='sop_observations' AND policyname='sop_observations_read_org'`,
  (rows) => {
    const q = rows?.[0]?.qual ?? ''
    return { ok: (rows ?? []).length === 1 && q.startsWith('((organisation_id = current_organisation_id()) AND (') && has(q, 'observed_worker_id = auth.uid()'), detail: q }
  }
)
await assertSql(
  'the generated-videos policy is gone; voice-bucket and sop-videos policies use the helper',
  `SELECT policyname, qual, with_check FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
     AND policyname IN ('org members can read generated videos','voice_bucket_select_org','voice_bucket_insert_own','Authenticated users can read from sop-videos')`,
  (rows) => {
    const by = Object.fromEntries((rows ?? []).map((r) => [r.policyname, r]))
    const ok = !by['org members can read generated videos'] &&
      has(by.voice_bucket_select_org?.qual, 'current_organisation_id') && has(by.voice_bucket_insert_own?.with_check, 'current_organisation_id') &&
      has(by['Authenticated users can read from sop-videos']?.qual, 'storage.foldername', 'current_organisation_id')
    return { ok, detail: JSON.stringify(Object.keys(by)) }
  }
)
await assertSql(
  'decisions_kind_check accepts the three member state kinds and still member_removed',
  `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='public.decisions'::regclass AND conname='decisions_kind_check'`,
  (rows) => {
    const def = rows?.[0]?.def ?? ''
    const missing = [...KINDS_NEW, 'member_removed'].filter((k) => !def.includes(`'${k}'::text`))
    return { ok: !!def && missing.length === 0, detail: missing.length ? `missing: ${missing.join(', ')}` : 'present' }
  }
)

// -- the hook end to end (no write) ---------------------------------------------------
await assertSql(
  'hook end to end: eval-site-worker2 gets their latest active organisation and role in the claims',
  `WITH u AS (SELECT id FROM auth.users WHERE email = 'eval-site-worker2@sopstart.com'),
        exp AS (SELECT m.organisation_id::text AS org, m.role::text AS role FROM public.organisation_members m, u
                 WHERE m.user_id = u.id AND m.status = 'active' ORDER BY m.created_at DESC LIMIT 1),
        got AS (SELECT public.custom_access_token_hook(jsonb_build_object('user_id', u.id::text, 'claims', jsonb_build_object('user_metadata', '{}'::jsonb))) -> 'claims' AS c FROM u)
   SELECT (SELECT org FROM exp) AS exp_org, (SELECT role FROM exp) AS exp_role,
          (SELECT c ->> 'organisation_id' FROM got) AS org, (SELECT c ->> 'user_role' FROM got) AS role`,
  (rows) => {
    const r = rows?.[0] ?? {}
    return { ok: !!r.exp_org && r.org === r.exp_org && r.role === r.exp_role, detail: `role ${r.role}` }
  }
)

// -- live probes (each ends in a rolled-back exception; nothing is left behind) -----------
const SITE = `SELECT id INTO org FROM public.organisations WHERE name = 'SOPstart Eval Site';`
async function liveProbe(label, declareExtra, body, check) {
  try {
    const r = await probe(declareExtra, body)
    const out = check(r)
    if (out.ok) {
      console.log(`  PASS  ${label}`)
      if (out.detail) console.log(`        ${out.detail}`)
    } else {
      console.error(`  FAIL  ${label}`)
      console.error(`        ${out.detail ?? JSON.stringify(r)}`)
      allPassed = false
    }
  } catch (e) {
    console.error(`  FAIL  ${label}`)
    console.error(`        ERROR: ${e.apiMessage || e.message}`)
    allPassed = false
  }
}

await liveProbe(
  'suspended probe: a suspended member gets NULL helpers, zero sops and zero members on the same claims, and the hook stops issuing that site',
  `uid uuid; org uuid; mrole text; a_org text; a_role text; b_org text; b_role text; sops_a bigint; sops_b bigint; mem_b bigint; hk jsonb; n int;`,
  `${SITE}
  SELECT id INTO uid FROM auth.users WHERE email = 'eval-site-worker2@sopstart.com';
  SELECT role::text INTO mrole FROM public.organisation_members WHERE user_id = uid AND organisation_id = org;
  res := res || jsonb_build_object('has_membership', mrole IS NOT NULL);
  IF mrole IS NULL THEN RAISE EXCEPTION 'PROBE_RESULT:%:END_PROBE', res::text; END IF;

  -- active baseline on these claims
  ${asUser('uid', 'org', 'mrole')}
  EXECUTE 'SELECT public.current_organisation_id()::text, public.current_user_role()::text, (SELECT count(*) FROM public.sops)' INTO a_org, a_role, sops_a;
  ${asPostgres}
  res := res || jsonb_build_object('active_org_ok', a_org = org::text, 'active_role', a_role, 'active_sops', sops_a);

  UPDATE public.organisation_members SET status = 'suspended', status_changed_at = now() WHERE user_id = uid AND organisation_id = org;
  GET DIAGNOSTICS n = ROW_COUNT;
  res := res || jsonb_build_object('rows_suspended', n);

  ${asUser('uid', 'org', 'mrole')}
  EXECUTE 'SELECT public.current_organisation_id()::text, public.current_user_role()::text, (SELECT count(*) FROM public.sops), (SELECT count(*) FROM public.organisation_members)' INTO b_org, b_role, sops_b, mem_b;
  ${asPostgres}
  res := res || jsonb_build_object('susp_org', b_org, 'susp_role', b_role, 'susp_sops', sops_b, 'susp_members', mem_b);

  hk := public.custom_access_token_hook(jsonb_build_object('user_id', uid::text, 'claims', jsonb_build_object('user_metadata', jsonb_build_object('active_org_id', org::text)))) -> 'claims';
  res := res || jsonb_build_object('hook_org_is_site', (hk ->> 'organisation_id') = org::text, 'hook_org', hk ->> 'organisation_id', 'hook_role', hk ->> 'user_role');`,
  (r) => {
    const ok = r.has_membership === true && r.active_org_ok === true && Number(r.active_sops) > 0 && r.rows_suspended === 1 &&
      r.susp_org === null && r.susp_role === null && Number(r.susp_sops) === 0 && Number(r.susp_members) === 0 &&
      !r.hook_org_is_site && (r.hook_org !== null || r.hook_role === 'pending')
    return { ok, detail: JSON.stringify(r) }
  }
)

await liveProbe(
  'active probe: the eval-site admin still gets the site and admin from the helpers, rows from sops and organisation_members, no recursion',
  `uid uuid; org uuid; h_org text; h_role text; n_sops bigint; n_mem bigint;`,
  `${SITE}
  SELECT id INTO uid FROM auth.users WHERE email = 'eval-site-admin@sopstart.com';
  ${asUser('uid', 'org', 'admin')}
  EXECUTE 'SELECT public.current_organisation_id()::text, public.current_user_role()::text, (SELECT count(*) FROM public.sops), (SELECT count(*) FROM public.organisation_members)' INTO h_org, h_role, n_sops, n_mem;
  ${asPostgres}
  res := res || jsonb_build_object('org_ok', h_org = org::text, 'role', h_role, 'sops', n_sops, 'members', n_mem);`,
  (r) => ({ ok: r.org_ok === true && r.role === 'admin' && Number(r.sops) > 0 && Number(r.members) > 0, detail: JSON.stringify(r) })
)

await liveProbe(
  'uat_feedback probe: the rewritten insert policy lets the eval-site admin insert an own row, and the read policy returns it',
  `uid uuid; org uuid; n bigint;`,
  `${SITE}
  SELECT id INTO uid FROM auth.users WHERE email = 'eval-site-admin@sopstart.com';
  ${asUser('uid', 'org', 'admin')}
  EXECUTE format('INSERT INTO public.uat_feedback (organisation_id, test_id, user_id) VALUES (%L, %L, %L)', org, 'phase64-probe', uid);
  EXECUTE 'SELECT count(*) FROM public.uat_feedback WHERE test_id = ''phase64-probe''' INTO n;
  ${asPostgres}
  res := res || jsonb_build_object('inserted_visible', n);`,
  (r) => ({ ok: Number(r.inserted_visible) === 1, detail: JSON.stringify(r) })
)

// -- PostgREST sees the column (retry for the schema reload) ----------------------------
{
  await managementSql("NOTIFY pgrst, 'reload schema'").catch(() => {})
  let ok = false
  let last = ''
  for (let i = 0; i < 15 && !ok; i++) {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/organisation_members?select=status&limit=1`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    })
    last = `HTTP ${resp.status}`
    ok = resp.ok
    if (!ok) await new Promise((r) => setTimeout(r, 2000))
  }
  if (ok) console.log('  PASS  PostgREST (service role) selects organisation_members.status')
  else {
    console.error(`  FAIL  PostgREST select of organisation_members.status (${last})`)
    allPassed = false
  }
}


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
