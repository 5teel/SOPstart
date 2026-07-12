/**
 * One-time backfill: assign owner_user_id + review_due_at to existing sops
 * rows that predate the Phase 28 ownership/review columns (D28-01/D28-03).
 * Idempotent — only touches rows missing a value, per-row conditional patch,
 * never null-clobbers an already-populated column (2026-07-05 learning).
 *
 * owner  = uploaded_by if that user is still an active org member,
 *          else the org's earliest (created_at asc) admin/safety_manager.
 * review_due_at = GREATEST(published_at, updated_at) + cadence months
 *          (cadence resolved from sop_review_cadences[category] ->
 *           sop_review_cadences['default'] -> 12; org has no cadence rows
 *           yet this plan, so every SOP backfills at the 12-month default —
 *           correct and desirable per D28-03, many will land already-overdue).
 *
 * Run: node scripts/backfill-owner-review.mjs
 */
import fs from 'node:fs'

for (const f of ['.env', '.env.local']) {
  if (!fs.existsSync(f)) continue
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=')
    if (i > 0 && !process.env[line.slice(0, i).trim()]) {
      process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
    }
  }
}

async function main() {
  const { createClient } = await import('@supabase/supabase-js')
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  const { data: sops, error: sopsErr } = await admin
    .from('sops')
    .select('id, organisation_id, category, uploaded_by, owner_user_id, review_due_at, published_at, updated_at')
  if (sopsErr) throw new Error(`fetch sops failed: ${sopsErr.message}`)

  // Per-org membership + cadence lookups are cached so N sops in the same org
  // cost one query each, not N queries.
  const membersByOrg = new Map()
  async function getOrgMembers(orgId) {
    if (membersByOrg.has(orgId)) return membersByOrg.get(orgId)
    const { data } = await admin
      .from('organisation_members')
      .select('user_id, role, created_at')
      .eq('organisation_id', orgId)
      .order('created_at', { ascending: true })
    membersByOrg.set(orgId, data ?? [])
    return data ?? []
  }

  const cadencesByOrg = new Map()
  async function getOrgCadences(orgId) {
    if (cadencesByOrg.has(orgId)) return cadencesByOrg.get(orgId)
    const { data } = await admin
      .from('sop_review_cadences')
      .select('category, months')
      .eq('organisation_id', orgId)
    const map = new Map((data ?? []).map((r) => [r.category, r.months]))
    cadencesByOrg.set(orgId, map)
    return map
  }

  function resolveCadenceMonths(category, orgCadences) {
    if (category && orgCadences.has(category)) return orgCadences.get(category)
    if (orgCadences.has('default')) return orgCadences.get('default')
    return 12
  }

  let touched = 0
  let skipped = 0

  for (const sop of sops ?? []) {
    const patch = {}

    if (!sop.owner_user_id) {
      const members = await getOrgMembers(sop.organisation_id)
      const uploaderIsActive = members.some((m) => m.user_id === sop.uploaded_by)
      const owner = uploaderIsActive
        ? sop.uploaded_by
        : members.find((m) => m.role === 'admin' || m.role === 'safety_manager')?.user_id ?? null
      if (owner) patch.owner_user_id = owner
    }

    if (!sop.review_due_at) {
      const orgCadences = await getOrgCadences(sop.organisation_id)
      const cadenceMonths = resolveCadenceMonths(sop.category, orgCadences)
      const dueAt = new Date(Math.max(
        new Date(sop.published_at ?? sop.updated_at).getTime(),
        new Date(sop.updated_at).getTime(),
      ))
      dueAt.setMonth(dueAt.getMonth() + cadenceMonths)
      patch.review_due_at = dueAt.toISOString()
    }

    if (Object.keys(patch).length === 0) {
      console.log(`[backfill] ${sop.id} skip (already populated)`)
      skipped++
      continue
    }

    const { error } = await admin.from('sops').update(patch).eq('id', sop.id)
    if (error) {
      console.error(`[backfill] ${sop.id} FAILED:`, error.message)
      continue
    }
    console.log(`[backfill] ${sop.id} set {${Object.keys(patch).join(', ')}}`)
    touched++
  }

  console.log(`Done — ${touched} sops updated, ${skipped} already populated (of ${sops?.length ?? 0} total).`)
}

main().catch((e) => { console.error('FAILED:', e); process.exit(1) })
