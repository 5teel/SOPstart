#!/usr/bin/env node
/**
 * probe-decisions-immutable.mjs
 *
 * Phase 56 (DEC-03, Pitfall 4): attempts UPDATE, DELETE and TRUNCATE against an
 * EXISTING decision row, as the table owner and as service_role, and requires
 * every attempt to be refused. A zero-row UPDATE would pass vacuously, so the
 * probe picks a real row first and re-reads it afterwards.
 *
 * The whole probe is ONE Management-API statement that always ends in a raise
 * (PROBE_OK or PROBE_FAIL), so it rolls back and can never lose or change a
 * row, even if a trigger were missing (T-56-01). The report travels in the
 * exception message.
 *
 * Usage: node scripts/probe-decisions-immutable.mjs   (exit 0 = all refused)
 * Also importable: probeDecisionsImmutable(managementSql) -> { ok, lines }
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ponytail: owner-role statement; service_role half runs in the same DO block
// via set local role. If the Management role cannot switch, the report says so.
export const PROBE_SQL = `
do $$
declare
  v_id uuid;
  v_summary text; v_created timestamptz; v_kind text;
  v_summary2 text; v_created2 timestamptz; v_kind2 text;
  v_msg text;
  v_report text := '';
  v_bad boolean := false;
  v_sr_ok boolean := true;
begin
  select id, summary, created_at, kind into v_id, v_summary, v_created, v_kind
  from public.decisions order by created_at asc, id asc limit 1;
  if v_id is null then raise exception 'no decision row to probe'; end if;
  v_report := v_report || format('probing decision %s', v_id) || E'\\n';

  -- owner: UPDATE
  begin
    update public.decisions set summary = summary where id = v_id;
    v_msg := null;
  exception when others then v_msg := sqlerrm; end;
  v_report := v_report || format('owner UPDATE: %s', coalesce(v_msg, 'NOT REFUSED')) || E'\\n';
  if v_msg is null or position('append-only' in v_msg) = 0 then v_bad := true; end if;

  -- owner: DELETE
  begin
    delete from public.decisions where id = v_id;
    v_msg := null;
  exception when others then v_msg := sqlerrm; end;
  v_report := v_report || format('owner DELETE: %s', coalesce(v_msg, 'NOT REFUSED')) || E'\\n';
  if v_msg is null or position('append-only' in v_msg) = 0 then v_bad := true; end if;

  -- owner: TRUNCATE
  begin
    truncate public.decisions;
    v_msg := null;
  exception when others then v_msg := sqlerrm; end;
  v_report := v_report || format('owner TRUNCATE: %s', coalesce(v_msg, 'NOT REFUSED')) || E'\\n';
  if v_msg is null or position('append-only' in v_msg) = 0 then v_bad := true; end if;

  -- service_role: UPDATE / DELETE / TRUNCATE (any error counts as refused)
  begin
    set local role service_role;
  exception when others then
    v_sr_ok := false;
    v_report := v_report || format('service_role: cannot switch role (%s)', sqlerrm) || E'\\n';
  end;
  if v_sr_ok then
    begin
      update public.decisions set summary = summary where id = v_id;
      v_msg := null;
    exception when others then v_msg := sqlerrm; end;
    v_report := v_report || format('service_role UPDATE: %s', coalesce(v_msg, 'NOT REFUSED')) || E'\\n';
    if v_msg is null then v_bad := true; end if;

    begin
      delete from public.decisions where id = v_id;
      v_msg := null;
    exception when others then v_msg := sqlerrm; end;
    v_report := v_report || format('service_role DELETE: %s', coalesce(v_msg, 'NOT REFUSED')) || E'\\n';
    if v_msg is null then v_bad := true; end if;

    begin
      truncate public.decisions;
      v_msg := null;
    exception when others then v_msg := sqlerrm; end;
    v_report := v_report || format('service_role TRUNCATE: %s', coalesce(v_msg, 'NOT REFUSED')) || E'\\n';
    if v_msg is null then v_bad := true; end if;

    reset role;
  end if;

  select summary, created_at, kind into v_summary2, v_created2, v_kind2
  from public.decisions where id = v_id;
  if v_summary2 is distinct from v_summary or v_created2 is distinct from v_created
     or v_kind2 is distinct from v_kind then
    v_bad := true;
    v_report := v_report || 'row CHANGED or missing after the attempts' || E'\\n';
  else
    v_report := v_report || 'row unchanged after the attempts' || E'\\n';
  end if;

  if not v_sr_ok then
    raise exception 'PROBE_NOROLE %', v_report;
  elsif v_bad then
    raise exception 'PROBE_FAIL %', v_report;
  else
    raise exception 'PROBE_OK %', v_report;
  end if;
end;
$$;
`

/** @returns {{ status: 'ok'|'fail'|'norole'|'error', lines: string[] }} */
export async function probeDecisionsImmutable(managementSql) {
  let msg = ''
  try {
    await managementSql(PROBE_SQL)
    return { status: 'error', lines: ['probe statement completed without its final raise'] }
  } catch (e) {
    msg = e.message || String(e)
  }
  const m = msg.match(/PROBE_(OK|FAIL|NOROLE) ([\s\S]*?)(?:\\n"|"\}|$)/)
  if (!m) return { status: 'error', lines: [msg] }
  const lines = m[2].split(/\\n|\n/).map((s) => s.trim()).filter(Boolean)
  return { status: m[1].toLowerCase(), lines }
}

// ---------------------------------------------------------------------------
// Standalone
// ---------------------------------------------------------------------------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
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
  const ref = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!ref || !token) {
    console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_ACCESS_TOKEN required')
    process.exit(1)
  }
  async function managementSql(sql) {
    const resp = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query: sql }),
    })
    const body = await resp.json()
    if (!resp.ok) throw new Error(`Management API error ${resp.status}: ${JSON.stringify(body)}`)
    return body
  }
  const { status, lines } = await probeDecisionsImmutable(managementSql)
  for (const l of lines) console.log(`  ${l}`)
  console.log(`probe: ${status.toUpperCase()}`)
  process.exit(status === 'ok' ? 0 : 1)
}
