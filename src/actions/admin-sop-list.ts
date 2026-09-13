'use server'

/**
 * Phase 41 Plan 02 — `listAdminSopRows`, extracted from
 * `src/app/(protected)/admin/sops/page.tsx` (:137-458): every filter branch,
 * the draft-triage ordering, the department/collection id resolution, the
 * rail counts, the scope-department counts and the `MillerSop[]` row
 * mapping. This is the data half of the status/drafts/published admin lens
 * (D-03) — the access-view assembly (org tree/grants/collections) is plan
 * 41-03's `listAdminAccessData`, and the attention-view grouping is plan
 * 41-04's lens; neither is returned from here.
 *
 * `/admin/sops`'s page-level `redirect('/dashboard')` for non-admins goes
 * away once `/sops` is reachable by every role (RESEARCH Pitfall 4) — this
 * action is the ONLY gate in front of this data from that point on, so
 * `requireAdminContext()` is the first statement and every read uses the
 * session RLS client (`ctx.supabase`) — no service-role client is used here.
 */

import { requireAdminContext } from '@/lib/auth/guards'
import { getTeamMembersWithEmails } from '@/actions/auth'
import { listGovernanceQueue, type GovernanceRow } from '@/actions/governance'
import type { GovernanceFlag } from '@/lib/governance/classify'
import { categoryLabel } from '@/lib/sop-categories'
import type { SopStatus, Department } from '@/types/sop'
import {
  STATUS_TABS,
  STUCK_AFTER_MS,
  NO_MATCH_ID,
  stripExtension,
  shortOwner,
  relativeDay,
  type MillerSop,
  type AdminScopeDepartment,
  type AdminSopListResult,
} from '@/lib/sop-list/admin-rows'
import { FLAG_PRIORITY, FLAG_LABEL, FLAG_STYLE } from '@/lib/governance/flag-display'

const SOP_SELECT = 'id, title, sop_number, category_slug, status, source_file_name, source_type, created_at, updated_at, published_at, all_departments, overall_confidence, parse_notes, owner_user_id, review_due_at'

export async function listAdminSopRows(params: {
  status?: string
  owner?: string
  departments?: string
  collection?: string
}): Promise<AdminSopListResult | { error: string }> {
  const ctx = await requireAdminContext()
  if ('error' in ctx) return { error: ctx.error }
  const { supabase, user } = ctx

  const activeStatus = params.status ?? 'all'
  const ownerOnly = params.owner === 'me'

  // Resolve the filter's matching SOP id set under the session RLS client —
  // a cross-org id yields an empty read (T-32-09-02), and the final `sops`
  // read is further bounded by its own org-scoped RLS regardless.
  // sop_departments/sop_collections are not yet in the auto-generated
  // database.types.ts — `(supabase as any)` cast matches the established
  // pattern (departments.ts, org-model.ts, governance.ts).
  let filterIds: string[] | null = null
  if (params.departments === 'none') {
    // The SOPs nobody can be assigned. This is the scope you go to in order
    // to FIX the gap, so it has to be selectable — the detail pane assigns a
    // department inline, and a row leaves this scope the moment you do.
    const [{ data: allRows }, { data: taggedRows }] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('sops').select('id, all_departments'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('sop_departments').select('sop_id'),
    ])
    const tagged = new Set(((taggedRows ?? []) as Array<{ sop_id: string }>).map((r) => r.sop_id))
    // all_departments = true is an AUDIENCE, and it produces no junction rows —
    // so "has no sop_departments rows" is NOT the same as "nobody can be
    // assigned this". Without the second clause a SOP you just set to Everyone
    // stays in this list forever and the fix looks like it did nothing.
    filterIds = ((allRows ?? []) as Array<{ id: string; all_departments: boolean | null }>)
      .filter((r) => !tagged.has(r.id) && !r.all_departments)
      .map((r) => r.id)
  } else if (params.departments) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).from('sop_departments').select('sop_id').eq('department_id', params.departments)
    filterIds = ((data ?? []) as Array<{ sop_id: string }>).map((r) => r.sop_id)
  } else if (params.collection) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).from('sop_collections').select('sop_id').eq('collection_id', params.collection)
    filterIds = ((data ?? []) as Array<{ sop_id: string }>).map((r) => r.sop_id)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('sops')
    .select(SOP_SELECT)
    .order('created_at', { ascending: false })

  if (activeStatus === 'draft') {
    // Triage ordering: worst parses first (lowest confidence, unparsed on top).
    query = supabase
      .from('sops')
      .select(SOP_SELECT)
      .eq('status', 'draft')
      .order('overall_confidence', { ascending: true, nullsFirst: true })
  } else if (activeStatus !== 'all' && activeStatus !== 'failed') {
    query = query.eq('status', activeStatus as SopStatus)
  } else if (activeStatus === 'failed') {
    query = query.in('status', ['uploading', 'parsing'])
  }

  // OWN-04/D28-08: "Owned by me" filter — a chip on the existing library, not a new page.
  if (ownerOnly) {
    query = query.eq('owner_user_id', user.id)
  }

  if (filterIds !== null) {
    query = query.in('id', filterIds.length > 0 ? filterIds : [NO_MATCH_ID])
  }

  // One org-scoped governance read powers the "Needs attention" scope badge
  // and the per-row flag chips — independent reads run concurrently, not as
  // a waterfall ([2026-07-13]).
  const [
    { data: sops },
    govResult,
    teamResult,
    statusCountsResult,
    sopDeptsResult,
    deptNamesResult,
  ] = await Promise.all([
    query,
    listGovernanceQueue(),
    getTeamMembersWithEmails(),
    // Rail counts (sketch 004): one cheap org-scoped status read, independent
    // of whatever filter the main query applies.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('sops').select('id, status, all_departments'),
    // Department per row — two small org-scoped reads (RLS-scoped, no filter
    // needed), run alongside everything else rather than as a waterfall.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('sop_departments').select('sop_id, department_id'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('departments').select('id, name'),
  ])

  const govRows: GovernanceRow[] = 'success' in govResult && govResult.success ? govResult.rows : []
  const flaggedRows = govRows.filter((r) => r.flags.length > 0)

  // Department names per SOP, for the row chip.
  const deptNameById: Record<string, string> = {}
  for (const d of ((deptNamesResult?.data ?? []) as Array<{ id: string; name: string }>)) {
    deptNameById[d.id] = d.name
  }
  const deptsBySop: Record<string, string[]> = {}
  const deptIdsBySop: Record<string, string[]> = {}
  for (const r of ((sopDeptsResult?.data ?? []) as Array<{ sop_id: string; department_id: string }>)) {
    const name = deptNameById[r.department_id]
    if (!name) continue
    ;(deptsBySop[r.sop_id] ??= []).push(name)
    ;(deptIdsBySop[r.sop_id] ??= []).push(r.department_id)
  }

  // The picker in the detail pane needs the full department list, not just the
  // ones already in use — you assign a department that ISN'T set yet.
  const allDepartments = ((deptNamesResult?.data ?? []) as Array<{ id: string; name: string }>)
    .map((d) => ({ ...d }) as unknown as Department)
    .sort((a, b) => a.name.localeCompare(b.name))

  // Department counts for the scope column. sop_departments is org-scoped by
  // RLS and unfiltered here, so it counts the whole library regardless of what
  // the main query is currently showing — a scope count that moved with the
  // scope would be useless for choosing the next one.
  const deptCounts: Record<string, number> = {}
  const sopIdsWithDept = new Set<string>()
  for (const r of ((sopDeptsResult?.data ?? []) as Array<{ sop_id: string; department_id: string }>)) {
    if (!deptNameById[r.department_id]) continue
    deptCounts[r.department_id] = (deptCounts[r.department_id] ?? 0) + 1
    sopIdsWithDept.add(r.sop_id)
  }
  const scopeDepartments: AdminScopeDepartment[] = Object.entries(deptCounts)
    .map(([id, count]) => ({ id, name: deptNameById[id], count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  // "No department" means NO AUDIENCE AT ALL — nobody can be assigned this.
  // all_departments = true is an audience and writes no junction rows, so a
  // SOP set to Everyone must not be counted here (or it never leaves the
  // scope after you fix it, and the fix looks broken).
  const statusRows = (statusCountsResult?.data ?? []) as Array<{
    id: string
    status: string
    all_departments: boolean | null
  }>
  const noAudienceCount = statusRows.filter(
    (r) => !sopIdsWithDept.has(r.id) && !r.all_departments
  ).length

  const allStatuses = statusRows.map((r) => r.status)
  const railCounts = {
    all: allStatuses.length,
    draft: allStatuses.filter((s) => s === 'draft').length,
    published: allStatuses.filter((s) => s === 'published').length,
    failed: allStatuses.filter((s) => s === 'uploading' || s === 'parsing').length,
  }

  // UX-06: ONE flag chip per library row, worst flag first.
  const rowFlag: Record<string, GovernanceFlag | undefined> = {}
  for (const r of flaggedRows) {
    rowFlag[r.id] = FLAG_PRIORITY.find((f) => r.flags.includes(f))
  }

  // Owner display labels (email/role), reusing the existing team fetcher — no new member query.
  const ownerLabelById: Record<string, string> = {}
  if (!('error' in teamResult)) {
    for (const m of teamResult.members) {
      ownerLabelById[m.user_id] = m.email ?? `${m.role} (${m.user_id.slice(0, 8)})`
    }
  }

  const scopeLabel = ownerOnly
    ? 'Owned by me'
    : params.departments === 'none'
      ? 'No department'
      : params.departments
        ? (deptNameById[params.departments] ?? 'Department')
        : params.collection
          ? 'Collection'
          : (STATUS_TABS.find((t) => t.value === activeStatus)?.label ?? 'All')

  // Everything the list and detail panes need, resolved here so clicking a row
  // costs nothing — the detail column reads from this, it does not fetch.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const millerSops: MillerSop[] = ((sops ?? []) as any[]).map((sop: any) => {
    const flag = rowFlag[sop.id]
    const owner = sop.owner_user_id ? ownerLabelById[sop.owner_user_id] : null
    const inFlight = sop.status === 'uploading' || sop.status === 'parsing'
    return {
      id: sop.id,
      title: sop.title ?? null,
      displayTitle: sop.title ?? stripExtension(sop.source_file_name),
      untitled: !sop.title,
      status: sop.status,
      categoryLabel: categoryLabel(sop.category_slug ?? null),
      categorySlug: sop.category_slug ?? null,
      departments: deptsBySop[sop.id] ?? [],
      departmentIds: deptIdsBySop[sop.id] ?? [],
      allDepartments: Boolean(sop.all_departments),
      // The `unowned` flag already says "No owner" — don't say it twice.
      ownerLabel: flag === 'unowned' ? null : shortOwner(owner),
      age: relativeDay(sop.updated_at ?? sop.created_at),
      updatedAt: sop.updated_at ?? sop.created_at ?? null,
      flagLabel: flag ? FLAG_LABEL[flag] : null,
      flagStyle: flag ? FLAG_STYLE[flag] : null,
      stuck: inFlight && Date.now() - new Date(sop.created_at).getTime() > STUCK_AFTER_MS,
      confidence: typeof sop.overall_confidence === 'number' ? sop.overall_confidence : null,
    }
  })

  return {
    sops: millerSops,
    departments: allDepartments,
    railCounts,
    scopeDepartments,
    noAudienceCount,
    flaggedCount: flaggedRows.length,
    scopeLabel,
    filtered: filterIds !== null,
  }
}
