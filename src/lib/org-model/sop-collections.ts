/**
 * Phase 32 CR-02 (code-review fix) — the RUNTIME sop_collections write path.
 *
 * Migration 00047 Steps A/B backfilled collections + sop_collections for SOPs
 * that existed at migration time, but no runtime path ever inserted
 * sop_collections for SOPs created afterwards — leaving every new SOP
 * permanently unreachable by the whole grant system (same class as the
 * [2026-07-07] "route inserts sections without layout_data" learning:
 * a mandatory companion write missing from the insert path).
 *
 * ensureSopCollectionsForOrg mirrors 00047 Steps A/B for ONE SOP:
 *   A. ensure a collection named after sops.category exists for the org
 *   B. ensure the (sop_id, collection_id) junction row exists
 *
 * Callers (both self-enforce org scope BEFORE calling — the admin client
 * bypasses RLS, CLAUDE.md 2026-06-15):
 *   - performPublish() (src/lib/governance/publish-core.ts) — every publish path
 *   - ensureSopCollections() server action (src/actions/grants.ts) — the
 *     access-view wire-up page, which needs the collection ids client-side
 *
 * Plain module (no 'use server') — a sync-free async helper importable by
 * both API-route code and server actions ([2026-06-27] 'use server' files
 * may export only async server actions).
 *
 * Phase 40 DAT-01 (RESEARCH open question 2 — RESOLVED): existing
 * `collections` rows are left in place; they are never renamed or merged.
 * Collections carry admin-customised colour/sort and are wired into the
 * Phase 33 grant surface, so renaming them risks that wiring for no
 * user-visible gain. This function reads `category_slug` and names NEW
 * collections with the vocabulary LABEL (via `categoryLabel`) — where an
 * existing collection is already named e.g. "Safety" and the vocabulary
 * label is "Safety", the select-then-insert below matches by name and the
 * SOP joins the collection it would have joined anyway. Collections named
 * after a free-text value with no vocabulary equivalent simply stop gaining
 * new members.
 */

import { categoryLabel } from '@/lib/sop-categories'

export type EnsureSopCollectionsResult = { collectionIds: string[] } | { error: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ensureSopCollectionsForOrg(admin: any, orgId: string, sopId: string): Promise<EnsureSopCollectionsResult> {
  const { data: sopRow, error: sopErr } = await admin
    .from('sops')
    .select('id, organisation_id, category_slug')
    .eq('id', sopId)
    .maybeSingle()
  if (sopErr) return { error: sopErr.message }
  if (!sopRow) return { error: 'SOP not found' }
  if (sopRow.organisation_id !== orgId) return { error: 'SOP belongs to another organisation' }

  const { data: existingRows, error: existingErr } = await admin
    .from('sop_collections')
    .select('collection_id')
    .eq('sop_id', sopId)
  if (existingErr) return { error: existingErr.message }
  const collectionIds = new Set(((existingRows ?? []) as Array<{ collection_id: string }>).map(r => r.collection_id))

  const category = categoryLabel((sopRow.category_slug as string | null) ?? null)
  if (!category) {
    // No category and no collection rows — the SOP stays outside the grant
    // system (materializeSopAccessForOrg preserves its legacy sop_departments
    // rows, see grants.ts CR-02 guard). Callers surface this to the admin.
    return { collectionIds: [...collectionIds] }
  }

  // Step A (00047 mirror): one collection per distinct category per org.
  // Select-then-insert rather than upsert so an admin-customized colour/sort
  // is never clobbered; 23505 race falls back to a re-read.
  let collectionId: string | null = null
  const { data: collRow, error: collReadErr } = await admin
    .from('collections')
    .select('id')
    .eq('organisation_id', orgId)
    .eq('name', category)
    .maybeSingle()
  if (collReadErr) return { error: collReadErr.message }
  if (collRow) {
    collectionId = collRow.id as string
  } else {
    const { data: inserted, error: insErr } = await admin
      .from('collections')
      .insert({ organisation_id: orgId, name: category, colour: '#3b82f6', sort: 0 })
      .select('id')
      .single()
    if (insErr) {
      if ((insErr as { code?: string }).code === '23505') {
        const { data: raced } = await admin
          .from('collections')
          .select('id')
          .eq('organisation_id', orgId)
          .eq('name', category)
          .maybeSingle()
        collectionId = (raced?.id as string | undefined) ?? null
      }
      if (!collectionId) return { error: insErr.message }
    } else {
      collectionId = inserted.id as string
    }
  }

  // Step B (00047 mirror): the SOP joins its category's collection.
  if (collectionId && !collectionIds.has(collectionId)) {
    const { error: junErr } = await admin
      .from('sop_collections')
      .upsert({ sop_id: sopId, collection_id: collectionId }, { onConflict: 'sop_id,collection_id', ignoreDuplicates: true })
    if (junErr) return { error: junErr.message }
    collectionIds.add(collectionId)
  }

  return { collectionIds: [...collectionIds] }
}
