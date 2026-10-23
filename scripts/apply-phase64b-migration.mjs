#!/usr/bin/env node
/**
 * apply-phase64b-migration.mjs
 *
 * Phase 64 review-fix migration applier -- pushes 00083 (membership inserts service-role-only,
 * keep_one_active_admin trigger, org-tied member_departments / users_sub_trades reads, the
 * 2-argument sop_observation_refs_in_org) to the live remote DB, then runs post-apply assertions
 * through the Management API (raw SQL, never PostgREST, so a stale schema cache cannot fake a
 * missing object). Copy-adapted from scripts/apply-phase64-migration.mjs.
 *
 * MIGRATION_FILES lists every file that must be applied, in order. CLAUDE.md 2026-07-28: a
 * LATER migration that corrects 00083 MUST be appended here, in apply order.
 *
 * Usage:
 *   node scripts/apply-phase64b-migration.mjs               apply, then assert
 *   node scripts/apply-phase64b-migration.mjs --assert-only assertions only
 *   node scripts/apply-phase64b-migration.mjs --audit       read-only live inventory (no writes)
 *   node scripts/apply-phase64b-migration.mjs --rollback    restore the pre-00083 policies, grants and
 *                                                           functions (the app_metadata copy stays)
 * Requires (.env.local or .env): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * SUPABASE_ACCESS_TOKEN. Nothing here prints a key, token or JWT: probe claims hold ids and role
 * names only, and the invite audit prints counts, never emails.
 *
 * The last-admin race assertion commits: it creates a scratch organisation with two admin rows
 * (the eval-site admin and eval-site-worker2, created_at 2000-01-01 so the token hook never
 * prefers it), races two suspensions through two Management API connections, then deletes the
 * scratch organisation in a finally block.
 */

import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const MIGRATION_FILES = [path.join(ROOT, 'supabase/migrations/00083_member_hardening.sql')]

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
  console.error('ERROR: Could not extract project ref from NEXT_PUBLIC_SUPABASE_URL')
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
 * Run a plpgsql block that always ends in an exception, so everything it did is rolled back.
 * The block fills the jsonb variable `res`; the final exception carries it back as
 * PROBE_RESULT:<json>:END_PROBE.
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

const SITE = `SELECT id INTO org FROM public.organisations WHERE name = 'SOPstart Eval Site';`

/** Rolled-back read as the eval-site admin: junction rows they see vs the rows that are the site's. */
const junctionProbe = () =>
  probe(
    `uid uuid; org uuid; md_total bigint; md_site bigint; md_seen bigint; md_foreign bigint; st_total bigint; st_site bigint; st_seen bigint; st_foreign bigint;`,
    `${SITE}
  SELECT id INTO uid FROM auth.users WHERE email = 'eval-site-admin@sopstart.com';
  SELECT count(*) INTO md_total FROM public.member_departments;
  SELECT count(*) INTO md_site FROM public.member_departments md JOIN public.departments d ON d.id = md.department_id WHERE d.organisation_id = org;
  SELECT count(*) INTO st_total FROM public.users_sub_trades;
  SELECT count(*) INTO st_site FROM public.users_sub_trades t WHERE EXISTS (SELECT 1 FROM public.organisation_members m WHERE m.user_id = t.user_id AND m.organisation_id = org);
  ${asUser('uid', 'org', 'admin')}
  EXECUTE format('SELECT count(*), count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.departments d WHERE d.id = md.department_id AND d.organisation_id = %L)) FROM public.member_departments md', org) INTO md_seen, md_foreign;
  ${asPostgres}
  ${asUser('uid', 'org', 'admin')}
  EXECUTE 'SELECT count(*) FROM public.users_sub_trades' INTO st_seen;
  ${asPostgres}
  st_foreign := st_seen - st_site; -- rows seen beyond the site's own
  res := res || jsonb_build_object('found', uid IS NOT NULL AND org IS NOT NULL,
    'md_total', md_total, 'md_site', md_site, 'md_seen', md_seen, 'md_foreign_seen', md_foreign,
    'st_total', st_total, 'st_site', st_site, 'st_seen', st_seen, 'st_foreign_seen', st_foreign);`,
  )

console.log('=== Phase 64 review-fix Migration Applier (00083 member hardening) ===')
console.log('Target:', SUPABASE_URL)
console.log('Project ref:', PROJECT_REF)

// -- audit (read-only) ------------------------------------------------------------
if (AUDIT) {
  console.log('Mode: --audit (read-only; the only probes run inside a block that always rolls back)')
  show(
    '(a) policies on organisation_members, member_departments, users_sub_trades, sop_observations (insert)',
    await managementSql(`SELECT tablename, policyname, cmd, roles::text AS roles, qual, with_check FROM pg_policies
      WHERE schemaname = 'public' AND (tablename IN ('organisation_members','member_departments','users_sub_trades')
        OR (tablename = 'sop_observations' AND cmd = 'INSERT'))
      ORDER BY tablename, policyname`),
  )
  show(
    '(b) table privileges on organisation_members',
    await managementSql(`SELECT grantee, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privileges
      FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'organisation_members'
        AND grantee IN ('anon','authenticated','service_role') GROUP BY grantee ORDER BY grantee`),
  )
  show(
    '(c) sop_observation_refs_in_org signatures and keep_one_active_admin',
    await managementSql(`SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, p.prosecdef AS secdef
      FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('sop_observation_refs_in_org','keep_one_active_admin')`),
  )
  show(
    '(d) non-internal triggers on organisation_members and organisations',
    await managementSql(`SELECT c.relname AS tbl, t.tgname, p.proname AS fn FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE NOT t.tgisinternal AND t.tgrelid IN ('public.organisation_members'::regclass, 'public.organisations'::regclass)
      ORDER BY c.relname, t.tgname`),
  )
  show(
    '(e) invitees who never signed in (counts only): to copy into app_metadata / already copied',
    await managementSql(`SELECT
        count(*) FILTER (WHERE NOT (coalesce(raw_app_meta_data, '{}'::jsonb) ? 'invite_org_id')) AS to_copy,
        count(*) FILTER (WHERE coalesce(raw_app_meta_data, '{}'::jsonb) ? 'invite_org_id') AS copied
      FROM auth.users WHERE invited_at IS NOT NULL AND last_sign_in_at IS NULL AND raw_user_meta_data ? 'organisation_id'`),
  )
  show('(f) junction rows the eval-site admin can read (rolled back)', await junctionProbe())
  show(
    '(g) organisations with no active admin (count) and foreign keys into organisations without cascade',
    {
      no_admin: await managementSql(`SELECT count(*) AS orgs FROM public.organisations o WHERE NOT EXISTS (
          SELECT 1 FROM public.organisation_members m WHERE m.organisation_id = o.id AND m.role = 'admin' AND m.status = 'active')`),
      fks: await managementSql(`SELECT conrelid::regclass::text AS tbl, confdeltype FROM pg_constraint
          WHERE contype = 'f' AND confrelid = 'public.organisations'::regclass AND confdeltype NOT IN ('c','n') ORDER BY 1`),
    },
  )
  console.log('\n=== AUDIT COMPLETE (nothing written) ===')
  process.exit(0)
}

// -- rollback ---------------------------------------------------------------------
if (ROLLBACK) {
  console.log('Mode: --rollback (restores the pre-00083 policies, grants and functions; the app_metadata copy stays)')
  await managementSql(`
drop trigger if exists organisation_members_keep_admin on public.organisation_members;
drop function if exists public.keep_one_active_admin();

grant insert, delete on public.organisation_members to anon, authenticated;
drop policy if exists "admins_can_insert_members" on public.organisation_members;
create policy "admins_can_insert_members"
  on public.organisation_members for insert
  to authenticated
  with check (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager')
  );

drop policy if exists "member_departments_self_read" on public.member_departments;
create policy "member_departments_self_read" on public.member_departments
  for select to authenticated
  using (
    member_id = auth.uid()
    or exists (
      select 1 from public.organisation_members om
      where om.user_id = auth.uid()
        and om.role in ('admin', 'safety_manager')
    )
  );

drop policy if exists "users_sub_trades_self_read" on public.users_sub_trades;
create policy "users_sub_trades_self_read" on public.users_sub_trades
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.organisation_members om
      where om.user_id = auth.uid()
        and om.role in ('admin', 'safety_manager')
    )
  );

create or replace function public.sop_observation_refs_in_org(p_sop_id uuid, p_worker_id uuid, p_org_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select
    exists (select 1 from public.sops s where s.id = p_sop_id and s.organisation_id = p_org_id)
    and exists (
      select 1 from public.organisation_members m
      where m.user_id = p_worker_id and m.organisation_id = p_org_id and m.status = 'active'
    )
$$;

drop policy if exists sop_observations_insert_recorder on public.sop_observations;
create policy sop_observations_insert_recorder on public.sop_observations
  for insert to authenticated
  with check (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager', 'supervisor')
    and observed_by = auth.uid()
    and public.sop_observation_refs_in_org(sop_id, observed_worker_id, organisation_id)
    and (not is_assessor_override or public.current_user_role() in ('admin', 'safety_manager'))
  );

drop function if exists public.sop_observation_refs_in_org(uuid, uuid);
`)
  const [r] = await managementSql(`SELECT
      (SELECT count(*) FROM pg_policies WHERE tablename = 'organisation_members' AND policyname = 'admins_can_insert_members') AS ins_policy,
      (SELECT count(*) FROM pg_trigger WHERE tgname = 'organisation_members_keep_admin') AS trig,
      (SELECT string_agg(pg_get_function_identity_arguments(oid), ' | ') FROM pg_proc WHERE proname = 'sop_observation_refs_in_org') AS refs_args`)
  const back = Number(r.ins_policy) === 1 && Number(r.trig) === 0 && /p_org_id/.test(r.refs_args ?? '') && !(r.refs_args ?? '').includes('|')
  console.log(back ? 'ROLLBACK OK: pre-00083 policies, grants and functions restored' : `ROLLBACK FAILED: ${JSON.stringify(r)}`)
  console.log('If 00083 is recorded in the remote history: npx supabase migration repair --status reverted 00083')
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
      const versions = MIGRATION_FILES.map((f) => path.basename(f).slice(0, 5)).join(' ')
      try {
        execSync(`npx supabase migration repair --status applied ${versions}`, { cwd: ROOT, stdio: 'inherit', env: process.env })
      } catch {
        console.error(`Record the history by hand: npx supabase migration repair --status applied ${versions}`)
      }
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
const pass = (label, detail) => {
  console.log(`  PASS  ${label}`)
  if (detail) console.log(`        ${detail}`)
}
const fail = (label, detail) => {
  console.error(`  FAIL  ${label}`)
  if (detail) console.error(`        ${detail}`)
  allPassed = false
}

async function assertSql(label, sql, checkFn) {
  let rows
  try {
    rows = await managementSql(sql)
  } catch (e) {
    const msg = e.message || ''
    fail(label, msg.includes('PGRST205') || msg.includes('schema cache') ? `PGRST205 stale schema cache (NOT a missing object): ${msg}` : `ERROR: ${msg}`)
    return
  }
  const result = checkFn(rows)
  if (result.ok) pass(label, result.detail)
  else fail(label, result.detail)
}

async function liveProbe(label, declareExtra, body, check) {
  try {
    const r = await probe(declareExtra, body)
    const out = check(r)
    if (out.ok) pass(label, out.detail)
    else fail(label, out.detail ?? JSON.stringify(r))
  } catch (e) {
    fail(label, `ERROR: ${e.apiMessage || e.message}`)
  }
}

const has = (s, ...parts) => parts.every((p) => (s ?? '').includes(p))

// -- HI-01 ------------------------------------------------------------------------------------
await assertSql(
  'HI-01: no INSERT or DELETE policy on organisation_members; anon and authenticated hold neither privilege; service_role does',
  `SELECT (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'organisation_members' AND cmd IN ('INSERT','DELETE','ALL')) AS write_policies,
          has_table_privilege('authenticated','public.organisation_members','INSERT') AS auth_ins,
          has_table_privilege('authenticated','public.organisation_members','DELETE') AS auth_del,
          has_table_privilege('anon','public.organisation_members','INSERT') AS anon_ins,
          has_table_privilege('anon','public.organisation_members','DELETE') AS anon_del,
          has_table_privilege('service_role','public.organisation_members','INSERT') AS svc_ins,
          has_column_privilege('authenticated','public.organisation_members','role','UPDATE') AS auth_role_upd`,
  (rows) => {
    const r = rows?.[0] ?? {}
    return {
      ok: Number(r.write_policies) === 0 && r.auth_ins === false && r.auth_del === false && r.anon_ins === false &&
        r.anon_del === false && r.svc_ins === true && r.auth_role_upd === true,
      detail: JSON.stringify(r),
    }
  },
)

await liveProbe(
  "HI-01: a safety manager's session INSERT of an admin row and DELETE of a row are refused (rolled back)",
  `uid uuid; org uuid; other uuid; n int;`,
  `${SITE}
  SELECT id INTO uid FROM auth.users WHERE email = 'eval-site-worker2@sopstart.com';
  SELECT u.id INTO other FROM auth.users u WHERE NOT EXISTS (
    SELECT 1 FROM public.organisation_members m WHERE m.user_id = u.id AND m.organisation_id = org) LIMIT 1;
  UPDATE public.organisation_members SET role = 'safety_manager' WHERE user_id = uid AND organisation_id = org AND status = 'active';
  GET DIAGNOSTICS n = ROW_COUNT;
  res := res || jsonb_build_object('made_sm', n, 'has_other', other IS NOT NULL);
  BEGIN
    ${asUser('uid', 'org', 'safety_manager')}
    res := res || jsonb_build_object('helper_role', public.current_user_role()::text);
    EXECUTE format('INSERT INTO public.organisation_members (organisation_id, user_id, role) VALUES (%L, %L, %L)', org, other, 'admin');
    ${asPostgres}
    res := res || jsonb_build_object('insert', 'allowed');
  EXCEPTION WHEN OTHERS THEN
    res := res || jsonb_build_object('insert', SQLSTATE);
  END;
  ${asPostgres}
  BEGIN
    ${asUser('uid', 'org', 'safety_manager')}
    EXECUTE format('DELETE FROM public.organisation_members WHERE organisation_id = %L AND user_id <> %L', org, uid);
    GET DIAGNOSTICS n = ROW_COUNT;
    ${asPostgres}
    res := res || jsonb_build_object('delete', 'allowed', 'deleted', n);
  EXCEPTION WHEN OTHERS THEN
    res := res || jsonb_build_object('delete', SQLSTATE);
  END;
  ${asPostgres}`,
  (r) => ({
    ok: r.made_sm === 1 && r.has_other === true && r.helper_role === 'safety_manager' && r.insert === '42501' && r.delete === '42501',
    detail: JSON.stringify(r),
  }),
)

await assertSql(
  'HI-01: every invitee who never signed in carries the invite in app_metadata (counts only)',
  `SELECT count(*) FILTER (WHERE NOT (coalesce(raw_app_meta_data, '{}'::jsonb) ? 'invite_org_id')) AS missing, count(*) AS invitees
     FROM auth.users WHERE invited_at IS NOT NULL AND last_sign_in_at IS NULL AND raw_user_meta_data ? 'organisation_id'`,
  (rows) => ({ ok: Number(rows?.[0]?.missing) === 0, detail: JSON.stringify(rows?.[0]) }),
)

// -- ME-01 ------------------------------------------------------------------------------------
await assertSql(
  'ME-01: keep_one_active_admin (security definer, organisation lock) fires BEFORE UPDATE on organisation_members',
  `SELECT pg_get_functiondef('public.keep_one_active_admin()'::regprocedure) AS def,
          (SELECT count(*) FROM pg_trigger WHERE tgname = 'organisation_members_keep_admin' AND tgrelid = 'public.organisation_members'::regclass AND tgenabled = 'O') AS trig`,
  (rows) => {
    const r = rows?.[0] ?? {}
    return { ok: Number(r.trig) === 1 && has(r.def, 'SECURITY DEFINER', 'for no key update', 'last active admin'), detail: `trigger ${r.trig}` }
  },
)

await liveProbe(
  "ME-01: the eval-site admin's own session demoting the last active admin is refused by the trigger (rolled back)",
  `uid uuid; org uuid; n int;`,
  `${SITE}
  SELECT id INTO uid FROM auth.users WHERE email = 'eval-site-admin@sopstart.com';
  UPDATE public.organisation_members SET role = 'supervisor' WHERE organisation_id = org AND role = 'admin' AND status = 'active' AND user_id <> uid;
  GET DIAGNOSTICS n = ROW_COUNT;
  res := res || jsonb_build_object('other_admins_demoted', n);
  SELECT count(*) INTO n FROM public.organisation_members WHERE organisation_id = org AND role = 'admin' AND status = 'active';
  res := res || jsonb_build_object('active_admins', n);
  BEGIN
    ${asUser('uid', 'org', 'admin')}
    EXECUTE format('UPDATE public.organisation_members SET role = %L WHERE organisation_id = %L AND user_id = %L', 'worker', org, uid);
    ${asPostgres}
    res := res || jsonb_build_object('demote', 'allowed');
  EXCEPTION WHEN OTHERS THEN
    res := res || jsonb_build_object('demote', SQLSTATE, 'msg', SQLERRM);
  END;
  ${asPostgres}
  BEGIN
    UPDATE public.organisation_members SET status = 'suspended' WHERE organisation_id = org AND user_id = uid;
    res := res || jsonb_build_object('service_suspend', 'allowed');
  EXCEPTION WHEN OTHERS THEN
    res := res || jsonb_build_object('service_suspend', SQLSTATE);
  END;`,
  (r) => ({
    ok: Number(r.active_admins) === 1 && r.demote === 'P0001' && r.msg === 'last active admin' && r.service_suspend === 'P0001',
    detail: JSON.stringify(r),
  }),
)

// The race: committed rows in a scratch organisation, two connections, then cleanup.
{
  const label = 'ME-01: two concurrent last-admin suspensions in a scratch organisation leave one active admin (one refused)'
  let scratch = null
  try {
    const rows = await managementSql(`WITH o AS (INSERT INTO public.organisations (name) VALUES ('phase64b race probe (temporary)') RETURNING id)
      INSERT INTO public.organisation_members (organisation_id, user_id, role, created_at)
      SELECT o.id, u.id, 'admin', '2000-01-01T00:00:00Z' FROM o, auth.users u
       WHERE u.email IN ('eval-site-admin@sopstart.com', 'eval-site-worker2@sopstart.com')
      RETURNING id, organisation_id`)
    scratch = rows?.[0]?.organisation_id ?? null
    if (!scratch || rows.length !== 2) throw new Error(`setup made ${rows?.length ?? 0} admin rows`)
    const suspend = (id) =>
      managementSql(`DO $race$ BEGIN
        UPDATE public.organisation_members SET status = 'suspended', status_changed_at = now() WHERE id = '${id}';
        PERFORM pg_sleep(2);
      END $race$`).then(() => 'ok', (e) => e.apiMessage || e.message)
    const t0 = Date.now()
    const outcomes = await Promise.all([suspend(rows[0].id), suspend(rows[1].id)])
    const ms = Date.now() - t0
    const [after] = await managementSql(`SELECT count(*) FILTER (WHERE status = 'active') AS active, count(*) AS total
      FROM public.organisation_members WHERE organisation_id = '${scratch}'`)
    const refused = outcomes.filter((o) => o !== 'ok' && o.includes('last active admin')).length
    const ok = Number(after.active) === 1 && outcomes.filter((o) => o === 'ok').length === 1 && refused === 1
    const detail = JSON.stringify({ active: after.active, total: after.total, wall_ms: ms, overlapped: ms < 4000, outcomes: outcomes.map((o) => (o === 'ok' ? 'ok' : o.includes('last active admin') ? 'refused: last active admin' : o.slice(0, 160))) })
    if (ok) pass(label, detail)
    else fail(label, detail)
  } catch (e) {
    fail(label, `ERROR: ${e.apiMessage || e.message}`)
  } finally {
    if (scratch) {
      try {
        await managementSql(`DELETE FROM public.organisation_members WHERE organisation_id = '${scratch}';
          DELETE FROM public.organisations WHERE id = '${scratch}';`)
        const [left] = await managementSql(`SELECT (SELECT count(*) FROM public.organisations WHERE id = '${scratch}') AS orgs,
          (SELECT count(*) FROM public.organisation_members WHERE organisation_id = '${scratch}') AS members`)
        if (Number(left.orgs) === 0 && Number(left.members) === 0) pass('ME-01 race cleanup: scratch organisation and its rows deleted')
        else fail('ME-01 race cleanup', JSON.stringify(left))
      } catch (e) {
        fail('ME-01 race cleanup', `ERROR (delete organisation ${scratch} by hand): ${e.apiMessage || e.message}`)
      }
    }
  }
}

// -- ME-03 ------------------------------------------------------------------------------------
await assertSql(
  'ME-03: both junction read policies carry the organisation predicate outside the own-row / role OR',
  `SELECT tablename, qual FROM pg_policies WHERE schemaname = 'public'
     AND policyname IN ('member_departments_self_read','users_sub_trades_self_read') ORDER BY tablename`,
  (rows) => {
    const by = Object.fromEntries((rows ?? []).map((r) => [r.tablename, r.qual]))
    const ok = (rows ?? []).length === 2 &&
      has(by.member_departments, 'd.organisation_id = current_organisation_id()', 'member_id = auth.uid()', 'current_user_role()') &&
      has(by.users_sub_trades, 'm.organisation_id = current_organisation_id()', 'user_id = auth.uid()', 'current_user_role()') &&
      by.member_departments.startsWith('((EXISTS') && by.users_sub_trades.startsWith('((EXISTS')
    return { ok, detail: JSON.stringify(by) }
  },
)
try {
  const r = await junctionProbe()
  const ok = r.found === true && Number(r.md_seen) === Number(r.md_site) && Number(r.md_foreign_seen) === 0 &&
    Number(r.st_seen) === Number(r.st_site) && Number(r.st_foreign_seen) === 0
  ;(ok ? pass : fail)('ME-03: the eval-site admin reads exactly the site\'s member_departments and users_sub_trades rows (rolled back)', JSON.stringify(r))
} catch (e) {
  fail('ME-03: junction probe', `ERROR: ${e.apiMessage || e.message}`)
}

// -- LO-04 ------------------------------------------------------------------------------------
await assertSql(
  'LO-04: sop_observation_refs_in_org exists only as (p_sop_id, p_worker_id), and the insert policy calls it so',
  `SELECT (SELECT json_agg(pg_get_function_identity_arguments(oid)) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'sop_observation_refs_in_org') AS sigs,
          (SELECT with_check FROM pg_policies WHERE tablename = 'sop_observations' AND policyname = 'sop_observations_insert_recorder') AS chk`,
  (rows) => {
    const r = rows?.[0] ?? {}
    const sigs = r.sigs ?? []
    return {
      ok: sigs.length === 1 && sigs[0] === 'p_sop_id uuid, p_worker_id uuid' &&
        has(r.chk, 'sop_observation_refs_in_org(sop_id, observed_worker_id)', 'current_organisation_id()', 'is_assessor_override'),
      detail: JSON.stringify({ sigs }),
    }
  },
)
await liveProbe(
  "LO-04: as the eval-site admin the check is true for a site SOP and active site member, false for another organisation's SOP (rolled back)",
  `uid uuid; org uuid; own_sop uuid; foreign_sop uuid; worker uuid; a boolean; b boolean;`,
  `${SITE}
  SELECT id INTO uid FROM auth.users WHERE email = 'eval-site-admin@sopstart.com';
  SELECT id INTO own_sop FROM public.sops WHERE organisation_id = org LIMIT 1;
  SELECT id INTO foreign_sop FROM public.sops WHERE organisation_id <> org LIMIT 1;
  SELECT user_id INTO worker FROM public.organisation_members WHERE organisation_id = org AND status = 'active' LIMIT 1;
  ${asUser('uid', 'org', 'admin')}
  EXECUTE 'SELECT public.sop_observation_refs_in_org($1, $2), public.sop_observation_refs_in_org($3, $2)' INTO a, b USING own_sop, worker, foreign_sop;
  ${asPostgres}
  res := res || jsonb_build_object('own', a, 'foreign', b, 'has_foreign_sop', foreign_sop IS NOT NULL);`,
  (r) => ({ ok: r.own === true && (r.has_foreign_sop ? r.foreign === false : true), detail: JSON.stringify(r) }),
)

console.log('')
console.log("[3/4] Issuing NOTIFY pgrst, 'reload schema' via Management API ...")
try {
  await managementSql("NOTIFY pgrst, 'reload schema'")
  pass('NOTIFY pgrst reload schema issued')
} catch (e) {
  fail('NOTIFY pgrst reload schema', e.message)
}

console.log('')
console.log('[4/4] Summary')
if (allPassed) {
  console.log('=== ALL POST-APPLY ASSERTIONS PASSED ===')
  process.exit(0)
} else {
  console.error('=== ONE OR MORE ASSERTIONS FAILED === (roll back with --rollback if the cause is the migration)')
  process.exit(1)
}
