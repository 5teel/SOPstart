'use server'

/**
 * Phase 41 Plan 03 — `listAdminAccessData`, extracted from
 * `src/app/(protected)/admin/sops/page.tsx` (`isAccessView` branch, roughly
 * :141-382): the org tree, access grants, collections, per-collection SOP
 * drill-down, department-membership index and pinned `?sop=` new-SOP row
 * that feed `WiringPatchBayShell`. This is the heaviest of the three lenses
 * (SUR-02) — the access/wiring patch bay becomes a lens on `/sops` fed by
 * this one action.
 *
 * `/admin/sops`'s page-level `redirect('/dashboard')` for non-admins goes
 * away once `/sops` is reachable by every role (RESEARCH Pitfall 4) — this
 * action is the ONLY gate in front of the org model / grants / collections
 * from that point on, so `requireAdminContext()` is the first statement,
 * before both the first `.from(` and the `ensureSopCollections` call. Every
 * read uses the session RLS client (`ctx.supabase`) — no service-role client
 * is used here (`ensureSopCollections`/`listOrgTree`/`listGrants` each
 * re-guard independently inside their own modules).
 *
 * This action deliberately takes NO `departments`/`collection` parameter:
 * the Phase 33 library filters apply only to the plain SOP list and are
 * inert under the access view (`page.tsx` `!isAccessView` guard) — do not
 * add them back here.
 */

import { requireAdminContext } from '@/lib/auth/guards'
import { listOrgTree } from '@/actions/org-model'
import { ensureSopCollections, listGrants, type GrantRow } from '@/actions/grants'
import type { OrgTree } from '@/types/org-model'
import type { WiringCollection, WiringNewSop, WiringSop } from '@/components/admin/wiring/WiringPatchBay'

export interface AdminAccessData {
  tree: OrgTree
  collections: WiringCollection[]
  sopsByCollection: Record<string, WiringSop[]>
  grants: GrantRow[]
  newSop: WiringNewSop | null
  deptMembers: Record<string, string[]>
}

export async function listAdminAccessData(params: { sop?: string }): Promise<AdminAccessData | { error: string }> {
  const ctx = await requireAdminContext()
  if ('error' in ctx) return { error: ctx.error }
  const { supabase } = ctx

  // CR-01/CR-02: grants target COLLECTIONS, never SOP ids. For a pinned
  // ?sop= (post-publish wire-up CTA), resolve — and if the SOP only has a
  // category, create — its collection(s) BEFORE the collections list below
  // is read, so a just-created category collection renders in the right
  // column. ensureSopCollections self-enforces admin + org scope
  // server-side; on failure keep ensuredCollectionIds empty and continue
  // rather than aborting the whole lens.
  let ensuredCollectionIds: string[] = []
  if (params.sop) {
    const ensured = await ensureSopCollections(params.sop)
    if (!('error' in ensured)) ensuredCollectionIds = ensured.collectionIds
  }

  // Independent reads run concurrently, not as a waterfall ([2026-07-13]).
  const [treeResult, grantsResult, collectionsResult, newSopResult, memberDeptsResult] = await Promise.all([
    listOrgTree(),
    listGrants(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('collections').select('id, name, colour').order('sort', { ascending: true }),
    params.sop
      ? supabase.from('sops').select('id, title').eq('id', params.sop).maybeSingle()
      : Promise.resolve({ data: null }),
    // WR-03: dept-level grants reach workers via the Phase 25
    // member_departments junction, not only role_members. Foreign-org rows
    // (if any leak through RLS) are ignored downstream: the patch bay only
    // indexes department ids present in the caller's own tree.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('member_departments').select('member_id, department_id'),
  ])

  if ('error' in treeResult) return { error: treeResult.error }
  const tree: OrgTree = treeResult

  const grants: GrantRow[] = 'error' in grantsResult ? [] : grantsResult.grants

  const deptMembers: Record<string, string[]> = {}
  for (const r of ((memberDeptsResult?.data ?? []) as Array<{ member_id: string; department_id: string }>)) {
    ;(deptMembers[r.department_id] ??= []).push(r.member_id)
  }

  // SC-2 (33-08): ONE .in('collection_id', ids) join read on
  // sop_collections->sops per collection — not one read per collection.
  const collRows = ((collectionsResult?.data ?? []) as Array<{ id: string; name: string; colour: string }>)
  const collIds = collRows.map((c) => c.id)
  type SopCollJoinRow = { collection_id: string; sops: { id: string; title: string | null; status: string } | null }
  const { data: sopCollRows } = collIds.length > 0
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('sop_collections').select('collection_id, sops(id, title, status)').in('collection_id', collIds)
    : { data: [] as SopCollJoinRow[] }

  const countByCollection: Record<string, number> = {}
  const sopsByCollection: Record<string, WiringSop[]> = {}
  for (const r of (sopCollRows ?? []) as SopCollJoinRow[]) {
    if (!r.sops) continue
    countByCollection[r.collection_id] = (countByCollection[r.collection_id] ?? 0) + 1
    ;(sopsByCollection[r.collection_id] ??= []).push({ id: r.sops.id, title: r.sops.title ?? 'Untitled SOP', status: r.sops.status })
  }
  const collections: WiringCollection[] = collRows.map((c) => ({ id: c.id, name: c.name, colour: c.colour, sopCount: countByCollection[c.id] ?? 0 }))

  const newSopRow = newSopResult?.data as { id: string; title: string | null } | null
  const newSop: WiringNewSop | null = newSopRow
    ? { id: newSopRow.id, title: newSopRow.title ?? 'Untitled SOP', collectionIds: ensuredCollectionIds }
    : null

  return { tree, collections, sopsByCollection, grants, newSop, deptMembers }
}
