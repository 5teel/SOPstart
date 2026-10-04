#!/usr/bin/env node
/**
 * reconcile-decisions.mjs -- Phase 56 / A-08. READ-ONLY report.
 *
 * recordDecision() is fail-soft: the primary write has already happened, so a
 * ledger failure is logged and swallowed. This lists decision-table rows created
 * since the ledger went live that have no live `decisions` row to match. Search
 * Railway logs for the tag `[recordDecision] FAILED` to see why.
 *
 * Matching is HEURISTIC: a source row counts as logged when a live decision of an
 * expected kind exists for the same organisation, by the same person, within 120
 * seconds, about the same subject or SOP. ai_field_proposals has no resolved-at
 * column, so it is matched on subject only (created since the cutoff). Expect a few false positives
 * (rows written by service paths with a different actor), never a write.
 *
 * Usage: node scripts/reconcile-decisions.mjs [--since <iso>]
 * Requires (.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_ACCESS_TOKEN.
 * Exits 0 always.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
try {
  for (const line of readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
} catch (e) {
  console.error('Could not read .env.local:', e.message)
  process.exit(0)
}

const ref = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!ref || !token) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_ACCESS_TOKEN must be set in .env.local')
  process.exit(0)
}

const i = process.argv.indexOf('--since')
const sinceArg = i > -1 ? process.argv[i + 1] : null
if (sinceArg && Number.isNaN(Date.parse(sinceArg))) {
  console.error('--since needs an ISO timestamp')
  process.exit(0)
}

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query }),
  })
  const body = await r.json()
  if (!r.ok) throw new Error(`Management API ${r.status}: ${JSON.stringify(body)}`)
  return body
}

// One row per source write: where, when, who, which SOP / subject, which kinds would log it.
const SOURCES = `
  select 'sop_approvals' src, id, organisation_id org, created_at at, approver_user_id actor, sop_id, sop_id subj,
         array['approve','reject'] kinds, null::boolean timed from public.sop_approvals
  union all select 'sop_completion_signatures', id, organisation_id, signed_at, roster_user_id, null, completion_id,
         array['sign_off','countersign'], null from public.sop_completion_signatures
  union all select 'sop_observations', id, organisation_id, created_at, observed_by, sop_id, observed_worker_id,
         array['observation'], null from public.sop_observations
  union all select 'sop_review_events', id, organisation_id, created_at, reviewed_by, sop_id, sop_id,
         array['review'], null from public.sop_review_events
  union all select 'sop_block_update_decisions', d.id, s.organisation_id, d.decided_at, d.decided_by, s.id, d.sop_section_block_id,
         array['approve','reject'], null
         from public.sop_block_update_decisions d
         join public.sop_section_blocks b on b.id = d.sop_section_block_id
         join public.sop_sections sec on sec.id = b.sop_section_id
         join public.sops s on s.id = sec.sop_id
  union all select 'completion_sign_offs', id, organisation_id, created_at, supervisor_id, null, completion_id,
         array['sign_off','reject'], null from public.completion_sign_offs
  union all select 'sop_assignments', id, organisation_id, created_at, assigned_by, sop_id, id,
         array['assign'], null from public.sop_assignments
         where not (assignment_type::text = 'individual' and user_id = assigned_by)
  union all select 'sop_review_cadences', null, organisation_id, updated_at, updated_by, null, null,
         array['cadence_change'], null from public.sop_review_cadences
  union all select 'ai_field_proposals', id, organisation_id, created_at, null, null, id,
         array['approve','reject'], false from public.ai_field_proposals where status <> 'pending'
`

async function main() {
  const [{ since }] = await sql(
    sinceArg
      ? `select '${new Date(sinceArg).toISOString()}'::timestamptz as since`
      : `select coalesce(min(created_at), now()) as since from public.decisions where source = 'live'`,
  )
  console.log(`Ledger reconcile -- source rows since ${since} with no live decision (heuristic)`)
  console.log('Search Railway logs for "[recordDecision] FAILED" for the cause.\n')

  const rows = await sql(`
    with src as (${SOURCES})
    select src.src as "table", src.id::text as row_id, src.at, src.kinds
    from src
    where src.at >= '${since}'::timestamptz
    and not exists (
      select 1 from public.decisions d
      where d.source = 'live'
        and d.organisation_id = src.org
        and d.kind = any (src.kinds)
        and (src.actor is null or d.actor_id = src.actor)
        and (d.subject_id = src.subj or (src.sop_id is not null and d.sop_id = src.sop_id))
        and (src.timed is false or abs(extract(epoch from (d.created_at - src.at))) <= 120)
    )
    order by src.at desc
  `)

  if (rows.length) console.table(rows.map((r) => ({ table: r.table, row_id: r.row_id, at: r.at, expected: r.kinds })))
  console.log(`\nUnmatched source rows: ${rows.length}`)
}

main().catch((e) => {
  console.error('reconcile failed:', e.message)
  console.log('\nUnmatched source rows: unknown (query failed)')
})
