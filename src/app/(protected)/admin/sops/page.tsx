import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionContext } from '@/lib/auth/session-context'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { getTeamMembersWithEmails } from '@/actions/auth'
import { listGovernanceQueue, type GovernanceRow } from '@/actions/governance'
import type { GovernanceFlag } from '@/lib/governance/classify'
import { GovernanceQueueRow } from '@/components/admin/governance/GovernanceQueueRow'
import { listOrgTree } from '@/actions/org-model'
import { ensureSopCollections, listGrants, type GrantRow } from '@/actions/grants'
import { WiringPatchBayShell } from '@/components/admin/wiring/WiringPatchBayShell'
import type { WiringCollection, WiringNewSop, WiringSop } from '@/components/admin/wiring/WiringPatchBay'
import type { SopStatus } from '@/types/sop'

export const metadata: Metadata = {
  title: 'Manage SOPs',
}

// Sketch 004 variant A — ONE rail: All · Drafts · Published · Needs attention
// · Access, with the rare filters (Parse issues · Owned by me) folded behind
// a native <details> menu. The rail is the page's only control tier.
const STATUS_TABS: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Drafts', value: 'draft' },
  { label: 'Published', value: 'published' },
]

// UX-06 one-line rows: ONE flag chip per row, worst-first. Styling mirrors
// GovernanceQueueRow's FLAG_STYLE/FLAG_LABEL (that file is 'use client', so
// its consts can't be imported into this server component — kept in sync by
// the phase30 list-rows spec).
const FLAG_PRIORITY: GovernanceFlag[] = ['overdue', 'due_soon', 'awaiting_approval', 'unowned', 'stale_role']

const FLAG_STYLE: Record<GovernanceFlag, string> = {
  overdue: 'bg-red-500/20 text-red-600',
  due_soon: 'bg-amber-500/20 text-amber-700',
  unowned: 'bg-[var(--paper-2)] text-[var(--ink-500)]',
  stale_role: 'bg-[var(--paper-2)] text-[var(--ink-500)]',
  awaiting_approval: 'bg-[var(--accent-signoff)]/20 text-[var(--accent-signoff)]',
}

const FLAG_LABEL: Record<GovernanceFlag, string> = {
  overdue: 'Overdue',
  due_soon: 'Due soon',
  unowned: 'No owner',
  stale_role: 'Owner role gone',
  awaiting_approval: 'Awaiting approval',
}

// Plain-language group blurbs for the attention view (sketch 004: the queue
// is grouped by problem, worst first — no chip row).
const FLAG_DESC: Record<GovernanceFlag, string> = {
  overdue: 'past their review date',
  due_soon: 'review due within 30 days',
  unowned: 'nobody is responsible for keeping these current',
  stale_role: 'the owning role was deleted from Team',
  awaiting_approval: 'waiting on an approval step',
}

// Sentinel non-existent id: forces a zero-row `.in('id', …)` result without
// special-casing an empty-array argument (Postgres/PostgREST edge case).
const NO_MATCH_ID = '00000000-0000-0000-0000-000000000000'

export default async function SopsLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string
    owner?: string
    view?: string
    filter?: string
    departments?: string
    collection?: string
    sop?: string
  }>
}) {
  const { supabase, userId, role } = await getSessionContext()
  if (!userId) redirect('/login')

  if (!role || !['admin', 'safety_manager'].includes(role)) {
    redirect('/dashboard')
  }

  const params = await searchParams
  const activeStatus = params.status ?? 'all'
  const ownerOnly = params.owner === 'me'

  // UX-03: the governance queue folds in as the "Needs attention" view
  // (?view=attention), reusing GovernanceQueueRow verbatim — approveStep +
  // isCallerNextApprover gating lives in the row.
  // D-09: ?view=access is a third fold — the D-hybrid wiring surface.
  const isAttentionView = params.view === 'attention'
  const isAccessView = params.view === 'access'
  // Legacy ?filter= deep-links (old header chips / governance shim) are
  // accepted but ignored — the attention view is now grouped by flag, so
  // every flag is always visible.

  // SC-4 viz-as-library-filter: ?departments=<id> / ?collection=<id> only
  // apply to the plain library list (never inside the access view itself).
  const departmentFilter = !isAccessView ? params.departments : undefined
  const collectionFilter = !isAccessView ? params.collection : undefined

  // Resolve the filter's matching SOP id set server-side, under the session
  // RLS client — a cross-org id yields an empty read (T-32-09-02), and the
  // final `sops` read is further bounded by its own org-scoped RLS regardless.
  // sop_departments/sop_collections/collections are not yet in the
  // auto-generated database.types.ts — `(supabase as any)` cast matches the
  // established pattern (departments.ts, org-model.ts, governance.ts).
  let filterIds: string[] | null = null
  if (departmentFilter) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).from('sop_departments').select('sop_id').eq('department_id', departmentFilter)
    filterIds = ((data ?? []) as Array<{ sop_id: string }>).map((r) => r.sop_id)
  } else if (collectionFilter) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).from('sop_collections').select('sop_id').eq('collection_id', collectionFilter)
    filterIds = ((data ?? []) as Array<{ sop_id: string }>).map((r) => r.sop_id)
  }

  const SOP_SELECT = 'id, title, sop_number, category_slug, status, source_file_name, source_type, created_at, updated_at, published_at, all_departments, overall_confidence, parse_notes, owner_user_id, review_due_at'

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
    query = query.eq('owner_user_id', userId)
  }

  if (filterIds !== null) {
    query = query.in('id', filterIds.length > 0 ? filterIds : [NO_MATCH_ID])
  }

  // CR-01/CR-02: grants target COLLECTIONS, never SOP ids. For a pinned
  // ?sop= (post-publish wire-up CTA), resolve — and if the SOP only has a
  // category, create — its collection(s) BEFORE the collections list below is
  // read, so a just-created category collection renders in the right column.
  // ensureSopCollections self-enforces admin + org scope server-side.
  let ensuredCollectionIds: string[] = []
  if (isAccessView && params.sop) {
    const ensured = await ensureSopCollections(params.sop)
    if (!('error' in ensured)) ensuredCollectionIds = ensured.collectionIds
  }

  // One org-scoped governance read powers the header chips (GQ-04), the
  // needs-attention view, and the per-row flag chips — the same call the old
  // header widget made on this page, so cost is unchanged (server component).
  // Independent reads run concurrently, not as a waterfall ([2026-07-13]).
  // The access view additionally needs the org tree + grants + collections
  // (WiringPatchBay's props); the plain library never needs them.
  const [
    { data: sops },
    govResult,
    teamResult,
    treeResult,
    grantsResult,
    collectionsResult,
    newSopResult,
    memberDeptsResult,
    statusCountsResult,
  ] = await Promise.all([
    isAccessView ? Promise.resolve({ data: null }) : query,
    listGovernanceQueue(),
    getTeamMembersWithEmails(),
    isAccessView ? listOrgTree() : Promise.resolve(null),
    isAccessView ? listGrants() : Promise.resolve(null),
    isAccessView
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('collections').select('id, name, colour').order('sort', { ascending: true })
      : Promise.resolve({ data: null }),
    isAccessView && params.sop
      ? supabase.from('sops').select('id, title').eq('id', params.sop).maybeSingle()
      : Promise.resolve({ data: null }),
    // WR-03: dept-level grants reach workers via the Phase 25 member_departments
    // junction, not only role_members — without it the blast-radius banner
    // reads "Visible to 0 people" for any org that hasn't adopted job roles.
    // Foreign-org rows (if any leak through RLS) are ignored downstream: the
    // patch bay only indexes department ids present in the caller's own tree.
    isAccessView
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('member_departments').select('member_id, department_id')
      : Promise.resolve({ data: null }),
    // Rail counts (sketch 004): one cheap org-scoped status read, independent
    // of whatever filter the main query applies.
    supabase.from('sops').select('id, status'),
  ])
  const govRows: GovernanceRow[] = 'success' in govResult && govResult.success ? govResult.rows : []
  const flaggedRows = govRows.filter((r) => r.flags.length > 0)

  const allStatuses = ((statusCountsResult?.data ?? []) as Array<{ status: string }>).map((r) => r.status)
  const railCounts = {
    all: allStatuses.length,
    draft: allStatuses.filter((s) => s === 'draft').length,
    published: allStatuses.filter((s) => s === 'published').length,
    failed: allStatuses.filter((s) => s === 'uploading' || s === 'parsing').length,
  }

  // Access-view data assembly (WiringPatchBay props). collections' sopCount
  // is a second, dependent read (needs collection ids first) — a single fast
  // count query, not a violation of the independent-reads rule above.
  let orgTree: Exclude<Awaited<ReturnType<typeof listOrgTree>>, { error: string }> | null = null
  let grantsList: GrantRow[] = []
  let collections: WiringCollection[] = []
  let sopsByCollection: Record<string, WiringSop[]> = {}
  let newSop: WiringNewSop | null = null
  const deptMembers: Record<string, string[]> = {}
  if (isAccessView) {
    for (const r of ((memberDeptsResult?.data ?? []) as Array<{ member_id: string; department_id: string }>)) {
      ;(deptMembers[r.department_id] ??= []).push(r.member_id)
    }
    if (treeResult && !('error' in treeResult)) orgTree = treeResult
    if (grantsResult && !('error' in grantsResult)) grantsList = grantsResult.grants

    // SC-2 (33-08): ONE .in('collection_id', ids) join read on
    // sop_collections->sops per collection, replacing the old count-only
    // read — same dependent-await shape (collIds needs the collections read
    // above first), no new serial await added.
    const collRows = ((collectionsResult?.data ?? []) as Array<{ id: string; name: string; colour: string }>)
    const collIds = collRows.map((c) => c.id)
    type SopCollJoinRow = { collection_id: string; sops: { id: string; title: string | null; status: string } | null }
    const { data: sopCollRows } = collIds.length > 0
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('sop_collections').select('collection_id, sops(id, title, status)').in('collection_id', collIds)
      : { data: [] as SopCollJoinRow[] }
    const countByCollection: Record<string, number> = {}
    for (const r of (sopCollRows ?? []) as SopCollJoinRow[]) {
      if (!r.sops) continue
      countByCollection[r.collection_id] = (countByCollection[r.collection_id] ?? 0) + 1
      ;(sopsByCollection[r.collection_id] ??= []).push({ id: r.sops.id, title: r.sops.title ?? 'Untitled SOP', status: r.sops.status })
    }
    collections = collRows.map((c) => ({ id: c.id, name: c.name, colour: c.colour, sopCount: countByCollection[c.id] ?? 0 }))

    const newSopRow = newSopResult?.data as { id: string; title: string | null } | null
    if (newSopRow) newSop = { id: newSopRow.id, title: newSopRow.title ?? 'Untitled SOP', collectionIds: ensuredCollectionIds }
  }

  // UX-06: ONE flag chip per library row, worst flag first.
  const rowFlag: Record<string, GovernanceFlag | undefined> = {}
  for (const r of flaggedRows) {
    rowFlag[r.id] = FLAG_PRIORITY.find((f) => r.flags.includes(f))
  }

  // Attention view groups: each flagged SOP appears once, under its WORST
  // flag, in priority order (sketch 004: grouped queue replaces the chip row).
  const attentionGroups = FLAG_PRIORITY
    .map((flag) => ({ flag, rows: flaggedRows.filter((r) => rowFlag[r.id] === flag) }))
    .filter((g) => g.rows.length > 0)

  // Owner display labels (email/role), reusing the existing team fetcher — no new member query.
  const ownerLabelById: Record<string, string> = {}
  if (!('error' in teamResult)) {
    for (const m of teamResult.members) {
      ownerLabelById[m.user_id] = m.email ?? `${m.role} (${m.user_id.slice(0, 8)})`
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 lg:px-8 lg:py-10">
        {/* Sketch 004 variant A — ONE rail. No page header (the app header
            already says Manage SOPs and carries Create New SOP), no section
            nav, no chip row: this tab rail is the page's only control tier. */}
        <div className="flex gap-1 border-b border-[var(--ink-100)] mb-6 overflow-x-auto items-center">
          {STATUS_TABS.map(tab => {
            const isActive = !isAttentionView && !isAccessView && !ownerOnly && activeStatus === tab.value
            return (
              <Link
                key={tab.value}
                href={tab.value === 'all' ? '/admin/sops' : `/admin/sops?status=${tab.value}`}
                className="tab"
                data-active={isActive ? 'true' : undefined}
              >
                {tab.label}
                <span className="mono text-[11px] text-[var(--ink-400)] ml-1">
                  {railCounts[tab.value as keyof typeof railCounts]}
                </span>
              </Link>
            )
          })}
          <Link
            href="/admin/sops?view=attention"
            className="tab"
            data-active={isAttentionView ? 'true' : undefined}
          >
            Needs attention
            {flaggedRows.length > 0 && (
              <span className="mono text-[11px] text-red-600 font-bold ml-1">{flaggedRows.length}</span>
            )}
          </Link>
          <Link
            href="/admin/sops?view=access"
            className="tab"
            data-active={isAccessView ? 'true' : undefined}
          >
            Access
          </Link>
          <div className="flex-1" />
          {/* Rare filters — native details menu, no client JS. */}
          <details className="relative flex-shrink-0">
            <summary className="tab cursor-pointer list-none select-none text-[var(--ink-400)]"
              data-active={ownerOnly || activeStatus === 'failed' ? 'true' : undefined}
            >
              {ownerOnly ? 'Owned by me' : activeStatus === 'failed' ? 'Parse issues' : 'Filter'} ▾
            </summary>
            <div className="absolute right-0 top-full mt-1 w-44 rounded-md border border-[var(--ink-200)] bg-white shadow-lg z-30 py-1">
              <Link href="/admin/sops?owner=me" className="block px-3 py-2 text-sm text-[var(--ink-900)] hover:bg-[var(--paper-2)]">
                Owned by me
              </Link>
              <Link href="/admin/sops?status=failed" className="block px-3 py-2 text-sm text-[var(--ink-900)] hover:bg-[var(--paper-2)]">
                Parse issues
                {railCounts.failed > 0 && <span className="mono text-[11px] text-[var(--ink-400)] ml-1">{railCounts.failed}</span>}
              </Link>
              {(ownerOnly || activeStatus === 'failed') && (
                <Link href="/admin/sops" className="block px-3 py-2 text-sm text-[var(--ink-500)] hover:bg-[var(--paper-2)] border-t border-[var(--ink-100)]">
                  Clear filter
                </Link>
              )}
            </div>
          </details>
        </div>

        {isAccessView ? (
          <>
            {/* D-09: the D-hybrid wiring surface — org tree x collections x
                grants. A pinned ?sop= id (post-publish CTA, D-12a) lands NEW
                · UNWIRED for organic wire-up (D-12b). */}
            {!orgTree ? (
              <div className="blueprint-frame text-center py-12">
                <p className="mono text-[11px] text-red-600 uppercase tracking-wider mb-2">ERROR</p>
                <p className="text-sm text-[var(--ink-500)]">
                  {treeResult && 'error' in treeResult ? treeResult.error : 'Could not load the org model'}
                </p>
              </div>
            ) : (
              <WiringPatchBayShell tree={orgTree} collections={collections} sopsByCollection={sopsByCollection} grants={grantsList} newSop={newSop} deptMembers={deptMembers} />
            )}
          </>
        ) : isAttentionView ? (
          <>
            {/* Sketch 004: grouped worst-first queue — every flagged SOP
                appears once, under its worst flag. No chip row. */}
            {'error' in govResult && (
              <div className="blueprint-frame text-center py-12">
                <p className="mono text-[11px] text-red-600 uppercase tracking-wider mb-2">ERROR</p>
                <p className="text-sm text-[var(--ink-500)]">{govResult.error}</p>
              </div>
            )}

            {'success' in govResult && attentionGroups.length === 0 && (
              <div className="blueprint-frame text-center py-12">
                <p className="mono text-[11px] text-[var(--ink-500)] uppercase tracking-wider mb-2">CLEAR</p>
                <p className="text-lg font-semibold text-[var(--ink-900)] mb-1">Nothing needs attention</p>
                <p className="text-sm text-[var(--ink-500)]">Every SOP is owned, current, and correctly assigned.</p>
              </div>
            )}

            {attentionGroups.map(({ flag, rows }) => (
              <section key={flag} className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`mono text-[11px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${FLAG_STYLE[flag]}`}>
                    {FLAG_LABEL[flag]} · {rows.length}
                  </span>
                  <span className="h-px flex-1 bg-[var(--ink-100)]" />
                  <span className="text-xs text-[var(--ink-500)]">{FLAG_DESC[flag]}</span>
                </div>
                <ul className="space-y-2">
                  {rows.map((row) => (
                    <GovernanceQueueRow key={row.id} row={row} />
                  ))}
                </ul>
              </section>
            ))}
          </>
        ) : (
          <>
        {/* SC-4 viz-as-library-filter: server-filtered result banner, with a
            count and a way back to the unfiltered list. */}
        {filterIds !== null && (
          <div className="flex items-center justify-between mb-4 px-4 py-3 rounded-xl border border-[var(--accent-step)]/40 bg-[var(--accent-step)]/10">
            <span className="mono text-[11px] uppercase tracking-wider text-[var(--ink-700)]">
              Open in library ({(sops ?? []).length})
            </span>
            <Link href="/admin/sops" className="mono text-[11px] uppercase tracking-wider text-[var(--ink-500)] underline">
              Clear filter
            </Link>
          </div>
        )}

        {/* Draft triage strip — surfaced on the All tab so review work is never invisible */}
        {activeStatus === 'all' && (sops ?? []).some((s: { status: string }) => s.status === 'draft') && (
          <Link
            href="/admin/sops?status=draft"
            className="flex items-center justify-between mb-4 px-4 py-3 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 transition-colors"
          >
            <span className="text-sm font-medium text-amber-800">
              {(sops ?? []).filter((s: { status: string }) => s.status === 'draft').length} draft
              {(sops ?? []).filter((s: { status: string }) => s.status === 'draft').length === 1 ? '' : 's'} waiting for review
            </span>
            <span className="mono text-[11px] uppercase tracking-wider text-amber-700">Review worst-first →</span>
          </Link>
        )}

        {/* SOP list — UX-06 one-line rows: title · status chip · one flag chip
            · owner. Click opens the builder; the per-SOP actions live in the
            builder's labelled action menu (30-07, decision #2). */}
        {!sops || sops.length === 0 ? (
          <div className="blueprint-frame text-center py-12">
            <p className="mono text-[11px] text-[var(--ink-500)] uppercase tracking-wider mb-2">
              EMPTY
            </p>
            <p className="text-lg font-semibold text-[var(--ink-900)] mb-1">No SOPs yet</p>
            <p className="text-sm text-[var(--ink-500)]">
              Use Create New SOP in the header — upload a doc, talk it through, describe it, or start blank.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {sops.map((sop: any) => {
              const flag = rowFlag[sop.id]
              return (
                <li key={sop.id}>
                  <Link
                    href={`/admin/sops/builder/${sop.id}`}
                    className="blueprint-frame flex items-center gap-3 hover:shadow-[0_0_0_1px_var(--ink-900)] transition-shadow"
                  >
                    <p className="flex-1 min-w-0 text-base font-semibold text-[var(--ink-900)] truncate">
                      {sop.title ?? sop.source_file_name}
                    </p>
                    <StatusBadge status={sop.status as SopStatus} />
                    {flag && (
                      <span className={`mono text-[11px] px-1.5 py-0.5 rounded flex-shrink-0 ${FLAG_STYLE[flag]}`}>
                        {FLAG_LABEL[flag]}
                      </span>
                    )}
                    <span className="mono text-[11px] text-[var(--ink-500)] flex-shrink-0">
                      {sop.owner_user_id ? (ownerLabelById[sop.owner_user_id] ?? 'No owner') : 'No owner'}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
          </>
        )}
    </div>
  )
}
