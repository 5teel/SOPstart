#!/usr/bin/env node
/**
 * apply-phase67-migration.mjs -- Phase 67 / ADR-0029 applier. Modelled on apply-phase66-migration.mjs.
 *
 *   00088_signin_codes.sql  additive (signin_codes, signin_code_try(), two ledger kinds)
 *
 * Usage:
 *   node scripts/apply-phase67-migration.mjs               migration list, db push, then assert
 *   node scripts/apply-phase67-migration.mjs --assert-only assertions only
 * Requires (.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_ACCESS_TOKEN. Prints no key or token.
 */
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
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

let allPassed = true
const check = (label, ok, detail) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `\n        ${detail}` : ''}`)
  if (!ok) allPassed = false
}

console.log('=== Phase 67 applier (00088 sign-in codes) ===')
if (!process.argv.includes('--assert-only')) {
  console.log('[1/2] migration list, then db push')
  console.log(execSync('npx supabase migration list', { cwd: ROOT, env: process.env, encoding: 'utf8' }))
  execSync('npx supabase db push', { cwd: ROOT, stdio: 'inherit', env: process.env })
  await sql(`NOTIFY pgrst, 'reload schema'`)
}

console.log('[2/2] assertions')
{
  const [t] = await sql(`SELECT c.relrowsecurity AS rls,
      (SELECT count(*)::int FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = 'signin_codes') AS policies,
      (SELECT count(*)::int FROM information_schema.role_table_grants g WHERE g.table_schema = 'public'
         AND g.table_name = 'signin_codes' AND g.grantee IN ('anon', 'authenticated')) AS grants
    FROM pg_class c WHERE c.oid = 'public.signin_codes'::regclass`)
  check('signin_codes: RLS on, no policies, no anon/authenticated grants', t.rls && t.policies === 0 && t.grants === 0, JSON.stringify(t))

  const [x] = await sql(`SELECT has_function_privilege('authenticated', 'public.signin_code_try(text, text)', 'execute') AS auth,
      has_function_privilege('anon', 'public.signin_code_try(text, text)', 'execute') AS anon,
      has_function_privilege('service_role', 'public.signin_code_try(text, text)', 'execute') AS svc`)
  check('signin_code_try(text, text) is service_role only', !x.auth && !x.anon && x.svc, JSON.stringify(x))

  // As the authenticated role, the table reads nothing and the function is refused.
  const asAuth = await probe('n int; refused boolean := false;',
    `EXECUTE 'set local role authenticated';
     BEGIN PERFORM count(*) FROM public.signin_codes; EXCEPTION WHEN insufficient_privilege THEN refused := true; END;
     res := jsonb_build_object('table_refused', refused); refused := false;
     BEGIN PERFORM public.signin_code_try('a@b.c', 'x'); EXCEPTION WHEN insufficient_privilege THEN refused := true; END;
     res := res || jsonb_build_object('fn_refused', refused);`)
  check('authenticated cannot read signin_codes or call signin_code_try', asAuth.table_refused && asAuth.fn_refused, JSON.stringify(asAuth))

  // Behaviour, rolled back: five wrong tries void a code; a good code works once; an expired one never;
  // a suspended person's code never; an unknown email is the same null.
  const b = await probe(`uid uuid := gen_random_uuid(); org uuid; e text; r jsonb; i int; seq text := '';`,
    `e := 'phase67-probe-' || uid || '@sopstart.invalid';
     INSERT INTO auth.users (id, email, aud, role) VALUES (uid, e, 'authenticated', 'authenticated');
     INSERT INTO public.organisations (name) VALUES ('phase67 probe ' || uid) RETURNING id INTO org;
     INSERT INTO public.organisation_members (organisation_id, user_id, role) VALUES (org, uid, 'worker');
     INSERT INTO public.signin_codes (organisation_id, user_id, code_hash, expires_at) VALUES (org, uid, 'good', now() + interval '30 minutes');
     FOR i IN 1..5 LOOP r := public.signin_code_try(e, 'wrong'); seq := seq || CASE WHEN r IS NULL THEN 'n' ELSE 'y' END; END LOOP;
     r := public.signin_code_try(e, 'good'); seq := seq || CASE WHEN r IS NULL THEN 'n' ELSE 'y' END;
     seq := seq || '|';
     INSERT INTO public.signin_codes (organisation_id, user_id, code_hash, expires_at) VALUES (org, uid, 'good2', now() + interval '30 minutes');
     r := public.signin_code_try(upper(e), 'good2'); seq := seq || CASE WHEN r ->> 'user_id' = uid::text THEN 'y' ELSE 'n' END;
     r := public.signin_code_try(e, 'good2'); seq := seq || CASE WHEN r IS NULL THEN 'n' ELSE 'y' END;
     seq := seq || '|';
     INSERT INTO public.signin_codes (organisation_id, user_id, code_hash, expires_at) VALUES (org, uid, 'old', now() - interval '1 minute');
     r := public.signin_code_try(e, 'old'); seq := seq || CASE WHEN r IS NULL THEN 'n' ELSE 'y' END;
     INSERT INTO public.signin_codes (organisation_id, user_id, code_hash, expires_at) VALUES (org, uid, 'susp', now() + interval '30 minutes');
     UPDATE public.organisation_members SET status = 'suspended' WHERE user_id = uid;
     r := public.signin_code_try(e, 'susp'); seq := seq || CASE WHEN r IS NULL THEN 'n' ELSE 'y' END;
     r := public.signin_code_try('nobody-' || uid || '@sopstart.invalid', 'good'); seq := seq || CASE WHEN r IS NULL THEN 'n' ELSE 'y' END;
     res := jsonb_build_object('seq', seq);`)
  check('5 wrong void the code | a good code works once (email case-insensitive) | expired, suspended and unknown are refused',
    b.seq === 'nnnnnn|yn|nnn', b.seq)

  const [k] = await sql(`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname = 'decisions_kind_check'`)
  const kinds = [...k.d.matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1])
  check('decisions_kind_check has 46 kinds incl. signin_code_issued and signin_code_used',
    kinds.length === 46 && kinds.includes('signin_code_issued') && kinds.includes('signin_code_used'), `${kinds.length} kinds`)
}

console.log(allPassed ? '\nALL PASSED' : '\nSOME CHECKS FAILED')
process.exit(allPassed ? 0 : 1)
