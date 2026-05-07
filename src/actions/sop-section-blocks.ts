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
import type { SopSectionBlock, PinMode } from '@/types/sop'
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
