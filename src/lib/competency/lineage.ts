// ------------------------------------------------------------
// resolveLineage — CMP-03 lineage resolver (RESEARCH Pitfall 1).
//
// Plain module, deliberately NOT inside src/actions/ (Phase 36 review
// WR-07): every async export of a 'use server' file is registered as a
// POST-invokable server-action endpoint for any authenticated client.
// resolveLineage takes its DB client as a parameter, so exposing it was a
// gratuitous free endpoint one refactor away from the 2026-07-05
// parameter-trusting service-role hole. An async function in a plain
// module builds fine; src/actions/competency.ts imports it.
//
// `sop_completions` / `sop_observations` are keyed to a SPECIFIC sop row,
// not a lineage root, so a worker who trained on a since-superseded version
// reads as `not_started` unless evidence queries are widened across the
// whole version lineage. Lineage is flat, one level deep (a version's
// `parent_sop_id` always points at the ORIGINAL row) — never a recursive
// walker, mirrors getVersionHistory's `.or('parent_sop_id.eq.X,id.eq.X')`
// shape, batched across every required SOP's root in one query.
//
// Currency is never derived from `superseded_by` (cloneSopAsDraft/
// performPublish do not set it — RESEARCH Pitfall 3) — it comes from the
// monotonic `version` integer across the lineage's PUBLISHED members.
// ------------------------------------------------------------

export interface LineageInputSop {
  id: string
  version: number | null
  parent_sop_id: string | null
  refresher_interval_months: number | null
}

export interface LineageResult {
  allSopIds: string[]
  canonicalBySopId: Map<string, string>
  currentVersionBySopId: Map<string, number | null>
  refresherIntervalBySopId: Map<string, number | null>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveLineage(requiredSops: LineageInputSop[], client: any, orgId: string | null): Promise<LineageResult> {
  const currentVersionBySopId = new Map(requiredSops.map(s => [s.id, s.version]))
  const refresherIntervalBySopId = new Map(requiredSops.map(s => [s.id, s.refresher_interval_months]))

  if (requiredSops.length === 0) {
    return { allSopIds: [], canonicalBySopId: new Map(), currentVersionBySopId, refresherIntervalBySopId }
  }

  const roots = Array.from(new Set(requiredSops.map(s => s.parent_sop_id ?? s.id)))
  let query = client.from('sops').select('id, parent_sop_id, version, status, refresher_interval_months').or(`parent_sop_id.in.(${roots.join(',')}),id.in.(${roots.join(',')})`)
  if (orgId) query = query.eq('organisation_id', orgId)
  const { data: lineageRows } = await query
  const members = (lineageRows ?? []) as Array<{
    id: string
    parent_sop_id: string | null
    version: number | null
    status: string
    refresher_interval_months: number | null
  }>

  // Root -> required sop, preferring the HIGHEST version when two required
  // rows share a root (a lingering superseded-version junction — RESEARCH
  // Open Question 3), so evidence is never double-counted across columns.
  const requiredByRoot = new Map<string, LineageInputSop>()
  for (const s of requiredSops) {
    const root = s.parent_sop_id ?? s.id
    const existing = requiredByRoot.get(root)
    if (!existing || (s.version ?? 0) > (existing.version ?? 0)) requiredByRoot.set(root, s)
  }

  // CR-01: currency comes from the lineage MEMBERS themselves — the highest
  // PUBLISHED version per root — never from the input rows alone. In the
  // CSV-export path the input rows are the SOPs of the completions in the
  // export cut, which can all be superseded; trusting them reported
  // on_current_version=yes for workers trained on a superseded version (and
  // took refresher_due_date's interval from the stale row). Drafts are
  // excluded so a cloned-but-unpublished v+1 draft never marks every worker
  // outdated against an unshipped version. This also hardens the
  // matrix/record paths against the stale-junction case above.
  const currentByRoot = new Map<string, { version: number | null; interval: number | null }>()
  for (const m of members) {
    if (m.status !== 'published') continue
    const root = m.parent_sop_id ?? m.id
    const prev = currentByRoot.get(root)
    if (!prev || (m.version ?? 0) > (prev.version ?? 0)) {
      currentByRoot.set(root, { version: m.version, interval: m.refresher_interval_months })
    }
  }
  for (const s of requiredSops) {
    const current = currentByRoot.get(s.parent_sop_id ?? s.id)
    if (current) {
      currentVersionBySopId.set(s.id, current.version)
      refresherIntervalBySopId.set(s.id, current.interval)
    }
    // No published member (e.g. the org-scoped lineage query filtered
    // everything out) → keep the input row's own values seeded above.
  }

  const canonicalBySopId = new Map<string, string>()
  const allSopIdSet = new Set<string>()
  for (const member of members) {
    const root = member.parent_sop_id ?? member.id
    const required = requiredByRoot.get(root)
    if (!required) continue
    canonicalBySopId.set(member.id, required.id)
    allSopIdSet.add(member.id)
  }
  // Always include the required sops themselves even if the lineage query
  // (org-scoped) somehow missed a row.
  for (const s of requiredSops) {
    canonicalBySopId.set(s.id, requiredByRoot.get(s.parent_sop_id ?? s.id)?.id ?? s.id)
    allSopIdSet.add(s.id)
  }

  return { allSopIds: Array.from(allSopIdSet), canonicalBySopId, currentVersionBySopId, refresherIntervalBySopId }
}
