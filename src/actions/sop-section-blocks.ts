'use server'

/**
 * Phase 13 plan 03 — sop_section_blocks junction CRUD.
 *
 * SB-BLOCK-04: snapshot_content frozen on add. Workers read from junction.snapshot_content
 * only — never join block_versions at read time. SOPs render the snapshot forever even
 * when the source block is later edited, archived, or deleted.
 *
 * SB-BLOCK-05: pin_mode toggle (pinned default). Switching modes does not modify
 * snapshot_content; the follow-latest update path lives in plan 13-04.
 *
 * Junction reorder uses reorder_sop_section_blocks RPC (migration 00023.5) — atomic
 * multi-row UPDATE via single plpgsql call (no Promise.all of UPDATEs).
 *
 * Puck-item linkage contract: addBlockToSection RETURNS the new junction id; the
 * caller (BlockPicker / wizard submit) is responsible for stamping
 * `props.junctionId = junction.id` onto the matching Puck item in the section's
 * layout_data. This keeps layout_data writes localised to existing
 * updateSectionLayout flow and lets 13-04's UpdateAvailableBadge map junctions
 * → rendered Puck items.
 */

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { BlockContentSchema } from '@/lib/validators/blocks'
import type { BlockContent } from '@/lib/validators/blocks'
import type {
  SopSectionBlock,
  SopSectionBlockWithUpdate,
  BlockVersion,
  PinMode,
} from '@/types/sop'
import { getBlock } from '@/actions/blocks'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AdminCtx = {
  supabase: Awaited<ReturnType<typeof createClient>>
  user: { id: string }
  role: string
  organisationId: string | null
}

async function requireAdmin(): Promise<AdminCtx | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const {
    data: { session },
  } = await supabase.auth.getSession()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jwtClaims: Record<string, any> = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))
    : {}
  const role: string = jwtClaims['user_role'] ?? ''
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { error: 'Admin access required' }
  }
  const organisationId: string | null = jwtClaims['organisation_id'] ?? null
  return { supabase, user: { id: user.id }, role, organisationId }
}

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const AddBlockToSectionInput = z.object({
  sopSectionId: z.string().uuid(),
  blockId: z.string().uuid(),
  pinMode: z.enum(['pinned', 'follow_latest']).default('pinned'),
  /**
   * Optional Puck item id (from layout_data.content[].props.id) — purely
   * informational; addBlockToSection itself does NOT mutate layout_data,
   * the caller stamps `props.junctionId` onto the matching item using the
   * returned junction id. See file-level JSDoc for the contract.
   */
  puckItemId: z.string().optional(),
})

// ---------------------------------------------------------------------------
// 1. addBlockToSection — snapshot-on-add (SB-BLOCK-04)
// ---------------------------------------------------------------------------

export async function addBlockToSection(
  input: z.input<typeof AddBlockToSectionInput>
): Promise<{ junction: SopSectionBlock } | { error: string }> {
  const parsed = AddBlockToSectionInput.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const data = parsed.data

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { supabase } = ctx

  // Fetch the block + current version. RLS-scoped: returns null on cross-org or missing.
  // T-13-03-01: prevents adding cross-org or unauthorised blocks via guessed UUID.
  const fetched = await getBlock(data.blockId)
  if (!fetched) return { error: 'Block not found or not accessible' }
  const { block, currentVersion } = fetched

  // Defence-in-depth: validate the snapshot content via Zod even though
  // createBlock already validated when it was written. T-13-03-02 mitigation
  // (someone could theoretically have inserted via service_role outside the
  // action layer with malformed content).
  let snapshotContent: BlockContent
  try {
    snapshotContent = BlockContentSchema.parse(currentVersion.content) as BlockContent
  } catch {
    return { error: 'Block content failed validation; cannot snapshot' }
  }

  // Verify the block's kind_slug matches the BlockContent discriminator (sanity check).
  if (snapshotContent.kind !== block.kind_slug) {
    // Soft check: BlockContentSchema.kind is the discriminator; block.kind_slug
    // is the indexed FK. They should always agree. If not, refuse to snapshot.
    return { error: 'Block kind/content mismatch' }
  }

  // Compute next sort_order = (current max for this section) + 1
  const { data: maxRow, error: maxErr } = await supabase
    .from('sop_section_blocks')
    .select('sort_order')
    .eq('sop_section_id', data.sopSectionId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (maxErr) {
    console.error('[addBlockToSection] sort_order lookup error', maxErr)
    return { error: maxErr.message }
  }
  const nextSort = (maxRow?.sort_order ?? 0) + 1

  // Insert junction row.
  const { data: junctionRow, error: insErr } = await supabase
    .from('sop_section_blocks')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({
      sop_section_id: data.sopSectionId,
      block_id: block.id,
      pinned_version_id: currentVersion.id,
      pin_mode: data.pinMode,
      snapshot_content: snapshotContent as unknown as object,
      sort_order: nextSort,
      update_available: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .select('*')
    .single()

  if (insErr || !junctionRow) {
    console.error('[addBlockToSection] insert error', insErr)
    return { error: insErr?.message ?? 'Failed to add block to section' }
  }

  return { junction: junctionRow as unknown as SopSectionBlock }
}

// ---------------------------------------------------------------------------
// 2. removeBlockFromSection
// ---------------------------------------------------------------------------

export async function removeBlockFromSection(
  junctionId: string
): Promise<{ success: true } | { error: string }> {
  if (!junctionId) return { error: 'junctionId required' }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { supabase } = ctx

  // RLS-scoped delete; the source block in the library is unaffected.
  const { error } = await supabase
    .from('sop_section_blocks')
    .delete()
    .eq('id', junctionId)
  if (error) {
    console.error('[removeBlockFromSection] delete error', error)
    return { error: error.message }
  }
  return { success: true }
}

// ---------------------------------------------------------------------------
// 3. setPinMode — SB-BLOCK-05 toggle
// ---------------------------------------------------------------------------

export async function setPinMode(
  junctionId: string,
  mode: PinMode
): Promise<{ junction: SopSectionBlock } | { error: string }> {
  if (!junctionId) return { error: 'junctionId required' }
  if (mode !== 'pinned' && mode !== 'follow_latest') {
    return { error: 'Invalid pin mode' }
  }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { supabase } = ctx

  // Update only pin_mode + clear update_available. snapshot_content and
  // pinned_version_id remain untouched — the follow-latest update path
  // lives in plan 13-04.
  const { data, error } = await supabase
    .from('sop_section_blocks')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({
      pin_mode: mode,
      update_available: false,
      updated_at: new Date().toISOString(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .eq('id', junctionId)
    .select('*')
    .single()

  if (error || !data) {
    console.error('[setPinMode] update error', error)
    return { error: error?.message ?? 'Failed to update pin mode' }
  }
  return { junction: data as unknown as SopSectionBlock }
}

// ---------------------------------------------------------------------------
// 4. listSectionBlocks
// ---------------------------------------------------------------------------

export async function listSectionBlocks(
  sopSectionId: string
): Promise<SopSectionBlock[]> {
  if (!sopSectionId) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sop_section_blocks')
    .select('*')
    .eq('sop_section_id', sopSectionId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[listSectionBlocks] error', error)
    return []
  }
  return (data ?? []) as unknown as SopSectionBlock[]
}

// ---------------------------------------------------------------------------
// 5. reorderSectionBlocks — atomic via reorder_sop_section_blocks RPC
// ---------------------------------------------------------------------------

const ReorderSectionBlocksInput = z.object({
  sopSectionId: z.string().uuid(),
  orderedJunctionIds: z.array(z.string().uuid()).min(1),
})

export async function reorderSectionBlocks(
  input: z.input<typeof ReorderSectionBlocksInput>
): Promise<{ success: true } | { error: string }> {
  const parsed = ReorderSectionBlocksInput.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { supabase } = ctx

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('reorder_sop_section_blocks', {
    p_sop_section_id: parsed.data.sopSectionId,
    p_ordered_junction_ids: parsed.data.orderedJunctionIds,
  })
  if (error) {
    console.error('[reorderSectionBlocks] rpc error', error)
    return { error: `Reorder failed: ${error.message}` }
  }
  return { success: true }
}

// ---------------------------------------------------------------------------
// 6. acceptBlockUpdate — Phase 13 plan 13-04
// Routes through migration 00025's accept_block_update RPC, then flips
// the parent SOP from published → draft so workers don't see the new
// content until admin re-publishes (SB-BLOCK-06 publish gate integration).
// ---------------------------------------------------------------------------

const AcceptBlockUpdateInput = z.object({
  sopSectionBlockId: z.string().uuid(),
  newVersionId: z.string().uuid(),
  note: z.string().max(500).optional(),
})

export async function acceptBlockUpdate(
  input: z.input<typeof AcceptBlockUpdateInput>
): Promise<{ success: true; sopReturnedToDraft: boolean } | { error: string }> {
  const parsed = AcceptBlockUpdateInput.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const data = parsed.data

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { supabase } = ctx

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: rpcErr } = await (supabase as any).rpc('accept_block_update', {
    p_sop_section_block_id: data.sopSectionBlockId,
    p_new_version_id: data.newVersionId,
    p_note: data.note ?? null,
  })
  if (rpcErr) {
    console.error('[acceptBlockUpdate] rpc error', rpcErr)
    return { error: `Accept failed: ${rpcErr.message}` }
  }

  // Publish-gate integration: walk the junction → section → SOP, and if the
  // SOP is currently 'published', flip it to 'draft' so workers don't see
  // the new content until admin re-publishes.
  let sopReturnedToDraft = false
  try {
    const { data: junctionRow, error: jErr } = await supabase
      .from('sop_section_blocks')
      .select('sop_section_id')
      .eq('id', data.sopSectionBlockId)
      .maybeSingle()
    if (!jErr && junctionRow) {
      const sopSectionId = (junctionRow as { sop_section_id: string }).sop_section_id
      const { data: sectionRow, error: sErr } = await supabase
        .from('sop_sections')
        .select('sop_id')
        .eq('id', sopSectionId)
        .maybeSingle()
      if (!sErr && sectionRow) {
        const sopId = (sectionRow as { sop_id: string }).sop_id
        const { data: updated, error: uErr } = await supabase
          .from('sops')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update({ status: 'draft' } as any)
          .eq('id', sopId)
          .eq('status', 'published')
          .select('id')
        if (!uErr && Array.isArray(updated) && updated.length > 0) {
          sopReturnedToDraft = true
        }
      }
    }
  } catch (e) {
    // Non-fatal: the snapshot was already updated by the RPC, the publish-gate
    // flip is a follow-up. Surface a console warning but report success.
    console.warn('[acceptBlockUpdate] publish-gate flip failed (non-fatal)', e)
  }

  return { success: true, sopReturnedToDraft }
}

// ---------------------------------------------------------------------------
// 7. declineBlockUpdate — Phase 13 plan 13-04
// Wraps decline_block_update RPC. No SOP status change.
// ---------------------------------------------------------------------------

const DeclineBlockUpdateInput = z.object({
  sopSectionBlockId: z.string().uuid(),
  newVersionId: z.string().uuid(),
  note: z.string().max(500).optional(),
})

export async function declineBlockUpdate(
  input: z.input<typeof DeclineBlockUpdateInput>
): Promise<{ success: true } | { error: string }> {
  const parsed = DeclineBlockUpdateInput.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const data = parsed.data

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { supabase } = ctx

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('decline_block_update', {
    p_sop_section_block_id: data.sopSectionBlockId,
    p_new_version_id: data.newVersionId,
    p_note: data.note ?? null,
  })
  if (error) {
    console.error('[declineBlockUpdate] rpc error', error)
    return { error: `Decline failed: ${error.message}` }
  }
  return { success: true }
}

// ---------------------------------------------------------------------------
// 8. listSectionBlocksWithUpdates — Phase 13 plan 13-04
// Returns junction rows for a section, hydrated with `latestVersion` for any
// row whose update_available=true so the builder can render UpdateAvailableBadge
// + BlockUpdateReviewModal without an extra round-trip per row.
// ---------------------------------------------------------------------------

export async function listSectionBlocksWithUpdates(
  sopSectionId: string
): Promise<SopSectionBlockWithUpdate[]> {
  if (!sopSectionId) return []
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('sop_section_blocks')
    .select('*')
    .eq('sop_section_id', sopSectionId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[listSectionBlocksWithUpdates] junction list error', error)
    return []
  }
  const rows = (data ?? []) as unknown as SopSectionBlock[]
  if (rows.length === 0) return []

  // Collect block_ids that need a head-version lookup (only those with
  // update_available=true — others render fine without latestVersion).
  const blocksNeedingLatest = Array.from(
    new Set(rows.filter((r) => r.update_available).map((r) => r.block_id))
  )

  if (blocksNeedingLatest.length === 0) {
    return rows.map((r) => ({ ...r, latestVersion: null }))
  }

  // Fetch the head version for each block_id. blocks.current_version_id points
  // at the latest row in block_versions.
  const { data: blocksRows, error: bErr } = await supabase
    .from('blocks')
    .select('id, current_version_id')
    .in('id', blocksNeedingLatest)
  if (bErr || !blocksRows) {
    console.warn('[listSectionBlocksWithUpdates] blocks lookup error', bErr)
    return rows.map((r) => ({ ...r, latestVersion: null }))
  }

  const blockIdToCurrentVersionId = new Map<string, string | null>()
  for (const b of blocksRows as Array<{ id: string; current_version_id: string | null }>) {
    blockIdToCurrentVersionId.set(b.id, b.current_version_id ?? null)
  }
  const versionIds = Array.from(blockIdToCurrentVersionId.values()).filter(
    (v): v is string => typeof v === 'string'
  )

  let versionsById = new Map<string, BlockVersion>()
  if (versionIds.length > 0) {
    const { data: versions, error: vErr } = await supabase
      .from('block_versions')
      .select('*')
      .in('id', versionIds)
    if (vErr || !versions) {
      console.warn('[listSectionBlocksWithUpdates] versions lookup error', vErr)
    } else {
      versionsById = new Map(
        (versions as unknown as BlockVersion[]).map((v) => [v.id, v])
      )
    }
  }

  return rows.map((r) => {
    if (!r.update_available) return { ...r, latestVersion: null }
    const versionId = blockIdToCurrentVersionId.get(r.block_id) ?? null
    const latest = versionId ? versionsById.get(versionId) ?? null : null
    return { ...r, latestVersion: latest }
  })
}
