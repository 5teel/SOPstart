#!/usr/bin/env node
/**
 * apply-phase66-migration.mjs -- Phase 66 / ADR-0028 applier. Modelled on apply-phase64-migration.mjs.
 *
 * Two migrations, applied in two steps so the live site never breaks:
 *   00086_mfa_recovery_codes.sql        additive (is_elevated(), recovery-code tables, kinds); before the app ships
 *   00087_elevated_writes_need_aal2.sql the policy sweep; only after the app with /verify is live
 * `supabase db push` applies whatever is pending locally, so the step is decided by which files exist.
 *
 * Usage:
 *   node scripts/apply-phase66-migration.mjs               migration list, db push, then assert
 *   node scripts/apply-phase66-migration.mjs --assert-only assertions only
 *   node scripts/apply-phase66-migration.mjs --audit       read-only: every policy that names a role
 *   node scripts/apply-phase66-migration.mjs --rollback    restore the pre-00087 policies
 *                                                          (scripts/apply-phase66-rollback.sql); 00086 stays
 * Requires (.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_ACCESS_TOKEN. Prints no key, token or JWT:
 * probe claims carry ids, role names and the aal only.
 */
import { existsSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SWEEP = path.join(ROOT, 'supabase/migrations/00087_elevated_writes_need_aal2.sql')
for (const line of readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
}
const REF = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
if (!REF || !process.env.SUPABASE_ACCESS_TOKEN) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_ACCESS_TOKEN must be set in .env.local')
  process.exit(1)
}

async function sql(query) {
  const resp = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` },
    body: JSON.stringify({ query }),
  })
  const body = await resp.json()
  if (!resp.ok) {
    const err = new Error(`Management API error ${resp.status}: ${JSON.stringify(body)}`)
    err.apiMessage = typeof body?.message === 'string' ? body.message : JSON.stringify(body)
    throw err
  }
  return body
}

/** A plpgsql block that always raises, so everything it did rolls back; `res` comes back in the error. */
async function probe(declare, body) {
  try {
    await sql(`DO $probe$ DECLARE res jsonb := '{}'::jsonb; ${declare} BEGIN ${body}
      RAISE EXCEPTION 'PROBE_RESULT:%:END_PROBE', res::text; END $probe$`)
  } catch (e) {
    const m = (e.apiMessage || e.message || '').match(/PROBE_RESULT:([\s\S]*?):END_PROBE/)
    if (m) return JSON.parse(m[1])
    throw e
  }
  throw new Error('probe did not raise its result exception')
}

const asUser = (role, aal) =>
  `PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uid::text, 'role', 'authenticated', 'organisation_id', org::text, 'user_role', '${role}', 'aal', '${aal}')::text, true);
   EXECUTE 'set local role authenticated';`
const asPostgres = `EXECUTE 'reset role'; PERFORM set_config('request.jwt.claims', '', true);`

const ROLE_POLICIES = `SELECT schemaname || '.' || tablename AS tbl, policyname, cmd,
    coalesce(qual, '') || ' ' || coalesce(with_check, '') AS expr
  FROM pg_policies
  WHERE coalesce(qual, '') || coalesce(with_check, '') ~ '(current_user_role|is_sop_sign_off_approver|om\\.role|is_elevated)'
  ORDER BY 1, 2`

const has = (f) => process.argv.includes(f)
let allPassed = true
const check = (label, ok, detail) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `\n        ${detail}` : ''}`)
  if (!ok) allPassed = false
}

console.log('=== Phase 66 applier (00086 MFA tables, 00087 elevated writes need aal2) ===')

if (has('--audit')) {
  const rows = await sql(ROLE_POLICIES)
  for (const r of rows) console.log(`${r.tbl} | ${r.policyname} | ${r.cmd}\n  ${r.expr.replace(/\s+/g, ' ')}`)
  console.log(`${rows.length} policies name a role`)
  process.exit(0)
}

if (has('--rollback')) {
  await sql(readFileSync(path.join(ROOT, 'scripts/apply-phase66-rollback.sql'), 'utf8'))
  const left = await sql(`SELECT count(*)::int AS n FROM pg_policies WHERE coalesce(qual,'') || coalesce(with_check,'') LIKE '%is_elevated%'`)
  console.log(left[0].n === 0 ? 'ROLLBACK OK: no policy uses is_elevated()' : `ROLLBACK INCOMPLETE: ${left[0].n} policies still use it`)
  console.log('Note: also mark 00087 reverted (npx supabase migration repair --status reverted 00087) and remove the file.')
  process.exit(left[0].n === 0 ? 0 : 1)
}

if (!has('--assert-only')) {
  console.log('[1/3] migration list, then db push')
  console.log(execSync('npx supabase migration list', { cwd: ROOT, env: process.env, encoding: 'utf8' }))
  execSync('npx supabase db push', { cwd: ROOT, stdio: 'inherit', env: process.env })
  await sql(`NOTIFY pgrst, 'reload schema'`)
}

console.log('[2/3] 00086 assertions')
{
  const [f] = await sql(`SELECT count(*)::int AS n FROM pg_proc WHERE oid = 'public.is_elevated()'::regprocedure`)
  check('public.is_elevated() exists', f.n === 1)
  const t = await sql(`SELECT c.relname, c.relrowsecurity AS rls,
      (SELECT count(*)::int FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policies,
      (SELECT count(*)::int FROM information_schema.role_table_grants g WHERE g.table_schema = 'public'
         AND g.table_name = c.relname AND g.grantee IN ('anon', 'authenticated')) AS grants
    FROM pg_class c WHERE c.oid IN ('public.mfa_recovery_codes'::regclass, 'public.mfa_recovery_attempts'::regclass)`)
  check('mfa_recovery_codes and mfa_recovery_attempts: RLS on, no policies, no anon/authenticated grants',
    t.length === 2 && t.every((r) => r.rls && r.policies === 0 && r.grants === 0), JSON.stringify(t))
  const [x] = await sql(`SELECT has_function_privilege('authenticated', 'public.mfa_recovery_attempt(uuid)', 'execute') AS auth,
      has_function_privilege('anon', 'public.mfa_recovery_attempt(uuid)', 'execute') AS anon,
      has_function_privilege('service_role', 'public.mfa_recovery_attempt(uuid)', 'execute') AS svc`)
  check('mfa_recovery_attempt(uuid) is service_role only', !x.auth && !x.anon && x.svc, JSON.stringify(x))
  const cap = await probe('uid uuid := gen_random_uuid(); ok boolean; i int; seq text := \'\';',
    `INSERT INTO auth.users (id, email, aud, role) VALUES (uid, 'phase66-probe-' || uid || '@sopstart.invalid', 'authenticated', 'authenticated');
     FOR i IN 1..6 LOOP ok := public.mfa_recovery_attempt(uid); seq := seq || CASE WHEN ok THEN 'y' ELSE 'n' END; END LOOP;
     UPDATE public.mfa_recovery_attempts SET window_start = now() - interval '16 minutes' WHERE user_id = uid;
     ok := public.mfa_recovery_attempt(uid); seq := seq || CASE WHEN ok THEN 'y' ELSE 'n' END;
     res := jsonb_build_object('seq', seq);`)
  check('attempt cap: 5 allowed, the 6th refused, a new window after 15 minutes', cap.seq === 'yyyyyny', cap.seq)
  const [k] = await sql(`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname = 'decisions_kind_check'`)
  const kinds = [...k.d.matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1])
  check('decisions_kind_check has 44 kinds incl. the five MFA kinds', kinds.length === 44 &&
    ['mfa_enrolled', 'mfa_removed', 'mfa_reset', 'recovery_codes_issued', 'recovery_code_used'].every((n) => kinds.includes(n)), `${kinds.length} kinds`)
  const [n] = await sql(`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname = 'notifications_kind_check'`)
  check('notifications_kind_check accepts signin_reset', n.d.includes("'signin_reset'"))
}

if (existsSync(SWEEP)) {
  console.log('[3/3] 00087 assertions (policy sweep + aal behaviour)')
  const rows = await sql(ROLE_POLICIES)
  const write = rows.filter((r) => r.cmd !== 'SELECT')
  const open = write.filter((r) => /'admin'|'safety_manager'|om\.role/.test(r.expr) && !r.expr.includes('is_elevated()'))
  check(`policy sweep: every write policy naming an elevated role needs is_elevated() (${write.length} write policies)`,
    open.length === 0, open.map((r) => `${r.tbl} ${r.policyname}`).join(', '))
  const approver = write.filter((r) => r.expr.includes('is_sop_sign_off_approver') && !/is_sop_sign_off_approver\([a-z_.]+\) AND \(NOT COALESCE/.test(r.expr))
  check('policy sweep: every write approver arm excludes aal1 elevated roles', approver.length === 0, approver.map((r) => r.policyname).join(', '))
  const raw = write.filter((r) => /current_user_role\(\)/.test(r.expr) && !r.expr.includes('is_elevated()'))
  check('policy sweep: no write policy left on plain current_user_role()', raw.length === 0, raw.map((r) => `${r.tbl} ${r.policyname}`).join(', '))

  const res = await probe('uid uuid; org uuid; n int; dep uuid;',
    `SELECT id INTO uid FROM auth.users WHERE email = 'eval-site-admin@sopstart.com';
     SELECT id INTO org FROM public.organisations WHERE name = 'SOPstart Eval Site';
     res := res || jsonb_build_object('found', uid IS NOT NULL AND org IS NOT NULL);
     ${asUser('admin', 'aal1')}
     res := res || jsonb_build_object('aal1_is_elevated', public.is_elevated());
     UPDATE public.sops SET updated_at = updated_at WHERE organisation_id = org; GET DIAGNOSTICS n = ROW_COUNT;
     res := res || jsonb_build_object('aal1_sops_updated', n);
     SELECT count(*) INTO n FROM public.sops WHERE organisation_id = org;
     res := res || jsonb_build_object('aal1_sops_read', n);
     BEGIN
       INSERT INTO public.departments (organisation_id, name, code) VALUES (org, 'phase66 probe aal1', 'P61');
       res := res || jsonb_build_object('aal1_insert', 'allowed');
     EXCEPTION WHEN insufficient_privilege THEN res := res || jsonb_build_object('aal1_insert', 'refused'); END;
     ${asPostgres}
     ${asUser('admin', 'aal2')}
     res := res || jsonb_build_object('aal2_is_elevated', public.is_elevated());
     UPDATE public.sops SET updated_at = updated_at WHERE organisation_id = org; GET DIAGNOSTICS n = ROW_COUNT;
     res := res || jsonb_build_object('aal2_sops_updated', n);
     INSERT INTO public.departments (organisation_id, name, code) VALUES (org, 'phase66 probe aal2', 'P62') RETURNING id INTO dep;
     res := res || jsonb_build_object('aal2_insert', dep IS NOT NULL);
     ${asPostgres}`)
  check('probe fixtures found (eval-site-admin, SOPstart Eval Site)', res.found === true)
  check('aal1 admin token: is_elevated() false, no SOP updated, department insert refused, SOPs still readable',
    res.aal1_is_elevated === false && res.aal1_sops_updated === 0 && res.aal1_insert === 'refused' && res.aal1_sops_read > 0, JSON.stringify(res))
  check('aal2 admin token: is_elevated() true, SOP update and department insert pass',
    res.aal2_is_elevated === true && res.aal2_sops_updated > 0 && res.aal2_insert === true, JSON.stringify(res))
} else {
  console.log('[3/3] skipped: 00087 is not in supabase/migrations yet (step 2 ships after the app)')
}

console.log(allPassed ? '=== ALL ASSERTIONS PASSED ===' : '=== ONE OR MORE ASSERTIONS FAILED ===')
process.exit(allPassed ? 0 : 1)
