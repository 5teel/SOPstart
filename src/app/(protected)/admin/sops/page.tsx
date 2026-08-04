import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionContext } from '@/lib/auth/session-context'

import { getTeamMembersWithEmails } from '@/actions/auth'
import { listGovernanceQueue, type GovernanceRow } from '@/actions/governance'
import type { GovernanceFlag } from '@/lib/governance/classify'
import { GovernanceQueueRow } from '@/components/admin/governance/GovernanceQueueRow'
import { listOrgTree } from '@/actions/org-model'
import { ensureSopCollections, listGrants, type GrantRow } from '@/actions/grants'
import { WiringPatchBayShell } from '@/components/admin/wiring/WiringPatchBayShell'
import type { WiringCollection, WiringNewSop, WiringSop } from '@/components/admin/wiring/WiringPatchBay'
import type { SopStatus } from '@/types/sop'
import { categoryLabel } from '@/lib/sop-categories'
import { SopMillerBrowser, type MillerSop } from '@/components/admin/SopMillerBrowser'

export const metadata: Metadata = {
  title: 'Manage SOPs',
}

// Sketch 004 variant A — ONE rail: All · Drafts · Published · Needs attention
// · Access, with the rare filters (Parse issues · Owned by me) folded behind
// a native <details> menu. The rail is the page's only control tier.
// The tab counts must add up to All. They did not: a SOP mid-pipeline is
// neither a draft nor published, so `uploading`/`parsing` rows were reachable
// only through the FILTER dropdown and All read 30 while Drafts + Published
// read 28. Two rows were effectively invisible — including one that had been
// stuck in `parsing` for 29 days. `still_working` is rendered only when the
// count is non-zero, so a healthy org sees three tabs as before.
const STATUS_TABS: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Drafts', value: 'draft' },
  { label: 'Published', value: 'published' },
  { label: 'Still working', value: 'failed' },
]

/**
 * A SOP that has been `uploading` or `parsing` for longer than this is not
 * working, it is wedged — the pipeline's own worst case is ~2 minutes for
 * video. Surfacing it as a flag is what makes the zombie rows actionable
 * rather than merely present.
 */
const STUCK_AFTER_MS = 60 * 60 * 1000

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

/**
 * A SOP created by upload has no title of its own, so the row falls back to the
 * source filename — which printed "Plenum chamber change procedure.pdf" and
 * "test-sop-page.webp" as if they were titles. Dropping the extension stops the
 * list reading like a file browser. The row also italicises these, because an
 * untitled SOP is a thing to fix, not a naming style.
 */
function stripExtension(name: string | null | undefined): string {
  if (!name) return 'Untitled SOP'
  return name.replace(/\.[a-z0-9]{2,5}$/i, '') || name
}

/** `simonscott86@gmail.com` is 21 characters of noise on every row. */
function shortOwner(label: string | null): string {
  if (!label) return ''
  return label.includes('@') ? label.split('@')[0] : label
}

/**
 * Compact relative age. The list had no date at all, so there was nothing to
 * scan by and no way to tell a SOP touched this morning from one abandoned in
 * April. Rendered server-side only, so no hydration concern.
 */
function relativeDay(iso: string | null | undefined): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return '1d'
  if (days < 30) return `${days}d`
  if (days < 365) return `${Math.floor(days / 30)}mo`
  return `${Math.floor(days / 365)}y`
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
    sopDeptsResult,
    deptNamesResult,
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
    // Department per row. 14 of 30 SOPs carry a department and NONE of it was
    // visible here — "who is this for" is the first question an admin asks of
    // a library, and the answer was only reachable by opening each SOP. Two
    // small org-scoped reads (RLS-scoped, no filter needed), run alongside
    // everything else rather than as a waterfall ([2026-07-13]).
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
  for (const r of ((sopDeptsResult?.data ?? []) as Array<{ sop_id: string; department_id: string }>)) {
    const name = deptNameById[r.department_id]
    if (name) (deptsBySop[r.sop_id] ??= []).push(name)
  }

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
  const scopeDepartments = Object.entries(deptCounts)
    .map(([id, count]) => ({ id, name: deptNameById[id], count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

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
  const sopsByCollection: Record<string, WiringSop[]> = {}
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

  // Sketch 005 variant C — Miller columns. The scope column replaces the tab
  // rail: an item here is a scope, not a tab, and its count describes the whole
  // library rather than the current view. Scope changes are Links (the URL
  // carries scope, and changing it SHOULD refetch); selecting a SOP is client
  // state inside SopMillerBrowser, because that is the hot path.
  const scopeActive = !isAttentionView && !isAccessView
  const scopeLabel = ownerOnly
    ? 'Owned by me'
    : departmentFilter
      ? (deptNameById[departmentFilter] ?? 'Department')
      : collectionFilter
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
      departments: deptsBySop[sop.id] ?? [],
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

  const scopeItems = STATUS_TABS
    .filter((t) => t.value !== 'failed' || railCounts.failed > 0)
    .map((t) => ({
      key: t.value,
      label: t.label,
      count: railCounts[t.value as keyof typeof railCounts],
      href: t.value === 'all' ? '/admin/sops' : `/admin/sops?status=${t.value}`,
      on: scopeActive && !ownerOnly && !departmentFilter && activeStatus === t.value,
      tone: t.value === 'failed' ? 'bad' : 'plain',
    }))

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 lg:px-8 lg:py-10">
        {/* The two full-width sub-surfaces lost the tab rail that used to carry
            them, so each gets an explicit way back to the library. */}
        {(isAccessView || isAttentionView) && (
          <Link
            href="/admin/sops"
            className="mono mb-4 inline-block text-[11px] uppercase tracking-wider text-[var(--ink-500)] hover:text-[var(--ink-900)]"
          >
            ← Back to the SOP library
          </Link>
        )}

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
        {filterIds !== null && !departmentFilter && (
          <div className="flex items-center justify-between mb-4 px-4 py-3 rounded-xl border border-[var(--accent-step)]/40 bg-[var(--accent-step)]/10">
            <span className="mono text-[11px] uppercase tracking-wider text-[var(--ink-700)]">
              Open in library ({(sops ?? []).length})
            </span>
            <Link href="/admin/sops" className="mono text-[11px] uppercase tracking-wider text-[var(--ink-500)] underline">
              Clear filter
            </Link>
          </div>
        )}

        {/* Sketch 005 variant C — three altitudes across, not stacked.
            LEFT (server): scope. MIDDLE + RIGHT (client): list and detail.
            The draft-triage strip is gone: "Drafts 23" in the scope column is
            the same information doing navigational work, and the banner was a
            second copy of it. */}
        {/* Below lg the scope column becomes a horizontal strip — three
            columns do not fit on a phone, and a hidden scope is worse than a
            scrolling one. Outside the row flex so it stacks above it. */}
        <div className="mb-4 flex gap-1 overflow-x-auto border-b border-[var(--ink-100)] pb-1 lg:hidden">
          {scopeItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="tab flex-shrink-0"
              data-active={item.on ? 'true' : undefined}
            >
              {item.label}
              <span className="mono ml-1 text-[11px] text-[var(--ink-400)]">{item.count}</span>
            </Link>
          ))}
          <Link href="/admin/sops?view=attention" className="tab flex-shrink-0">
            Needs attention
            {flaggedRows.length > 0 && (
              <span className="mono ml-1 text-[11px] font-bold text-red-600">{flaggedRows.length}</span>
            )}
          </Link>
          <Link href="/admin/sops?view=access" className="tab flex-shrink-0">Access</Link>
        </div>

        <div className="flex gap-5">
          {/* ── Scope column ────────────────────────────────────── */}
          <nav
            aria-label="Scope"
            data-testid="miller-scope"
            className="hidden w-[150px] flex-shrink-0 lg:block"
          >
            <p className="mono mb-1.5 text-[10px] uppercase tracking-wider text-[var(--ink-400)]">Library</p>
            <ul className="mb-4">
              {scopeItems.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    data-active={item.on ? 'true' : undefined}
                    className={`flex items-center gap-2 rounded px-2 py-1.5 text-[13px] ${
                      item.on
                        ? 'bg-[var(--ink-900)] font-semibold text-white'
                        : 'text-[var(--ink-700)] hover:bg-[var(--paper-2)]'
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <span
                      className={`mono text-[11px] ${
                        item.on
                          ? 'text-white/70'
                          : item.tone === 'bad'
                            ? 'text-red-600'
                            : 'text-[var(--ink-400)]'
                      }`}
                    >
                      {item.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            {scopeDepartments.length > 0 && (
              <>
                <p className="mono mb-1.5 text-[10px] uppercase tracking-wider text-[var(--ink-400)]">
                  By department
                </p>
                <ul className="mb-4">
                  {scopeDepartments.map((d) => {
                    const on = departmentFilter === d.id
                    return (
                      <li key={d.id}>
                        <Link
                          href={`/admin/sops?departments=${d.id}`}
                          data-active={on ? 'true' : undefined}
                          className={`flex items-center gap-2 rounded px-2 py-1.5 text-[13px] ${
                            on
                              ? 'bg-[var(--ink-900)] font-semibold text-white'
                              : 'text-[var(--ink-700)] hover:bg-[var(--paper-2)]'
                          }`}
                        >
                          <span className="min-w-0 flex-1 truncate" title={d.name}>{d.name}</span>
                          <span className={`mono text-[11px] ${on ? 'text-white/70' : 'text-[var(--ink-400)]'}`}>
                            {d.count}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                  {/* Not a filter — a finding. Over half the library has no
                      department, which means nobody can be assigned it. */}
                  {railCounts.all - sopIdsWithDept.size > 0 && (
                    <li className="flex items-center gap-2 px-2 py-1.5 text-[13px] text-[var(--ink-400)]">
                      <span className="min-w-0 flex-1 truncate">No department</span>
                      <span className="mono text-[11px]">{railCounts.all - sopIdsWithDept.size}</span>
                    </li>
                  )}
                </ul>
              </>
            )}

            <div className="border-t border-[var(--ink-100)] pt-2">
              <Link
                href="/admin/sops?view=attention"
                className="flex items-center gap-2 rounded px-2 py-1.5 text-[13px] text-[var(--ink-700)] hover:bg-[var(--paper-2)]"
              >
                <span className="min-w-0 flex-1 truncate">Needs attention</span>
                {flaggedRows.length > 0 && (
                  <span className="mono text-[11px] font-bold text-red-600">{flaggedRows.length}</span>
                )}
              </Link>
              <Link
                href="/admin/sops?view=access"
                className="block rounded px-2 py-1.5 text-[13px] text-[var(--ink-700)] hover:bg-[var(--paper-2)]"
              >
                Access map
              </Link>
              <Link
                href={ownerOnly ? '/admin/sops' : '/admin/sops?owner=me'}
                data-active={ownerOnly ? 'true' : undefined}
                className={`block rounded px-2 py-1.5 text-[13px] ${
                  ownerOnly
                    ? 'bg-[var(--ink-900)] font-semibold text-white'
                    : 'text-[var(--ink-700)] hover:bg-[var(--paper-2)]'
                }`}
              >
                {ownerOnly ? 'Owned by me ✕' : 'Owned by me'}
              </Link>
            </div>
          </nav>

          {/* ── List + detail ───────────────────────────────────── */}
          <SopMillerBrowser scopeLabel={scopeLabel} sops={millerSops} />
        </div>
          </>
        )}
    </div>
  )
}
