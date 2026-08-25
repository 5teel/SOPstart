/**
 * sop_section_blocks junction insert core — plain module, deliberately NOT
 * 'use server'.
 *
 * Phase 46 CR-01: the old addBlockToSection server action accepted a
 * `serviceRole: true` flag FROM THE WIRE and skipped all auth when it was
 * set — a network-reachable, unauthenticated, cross-tenant write bypass
 * (every export of a 'use server' module is a POST-reachable RPC endpoint,
 * and the action's ID ships in the client bundle via WizardClient/ReuseTier
 * imports). The trust flag must never arrive over the wire.
 *
 * Split:
 *   - insertSectionBlockJunction(supabase, input) — the shared insert body
 *     (snapshot validation, kind check, sort_order, insert). Caller supplies
 *     the client, so the AUTH DECISION lives with the caller, not a wire flag.
 *   - addBlockToSectionAsService(input) — server-only parser entry point.
 *     Uses the service-role client directly. Reachable only by importing
 *     this module from server code — it has no server-action endpoint ID.
 *     The parser pipeline owns the org-scope invariant (block + section both
 *     belong to the SOP being parsed).
 *
 * The user-facing entry point stays in src/actions/sop-section-blocks.ts and
 * ALWAYS runs requireSopEditAccess before delegating here.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { BlockContentSchema } from '@/lib/validators/blocks'
import type { BlockContent } from '@/lib/validators/blocks'
import type { SopSectionBlock, PinMode } from '@/types/sop'

export interface InsertSectionBlockJunctionInput {
  sopSectionId: string
  block: { id: string; kind_slug: string }
  currentVersion: { id: string; content: unknown }
  pinMode: PinMode
  /** JSONB provenance stamp — parser-supplied; interactive callers pass null. */
  blockProvenance?: unknown
}

/**
 * Shared insert body. RLS applies (or not) according to the client the
 * caller hands in — session client for user paths, admin client for the
 * parser. No auth is performed here.
 */
export async function insertSectionBlockJunction(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  input: InsertSectionBlockJunctionInput
): Promise<{ junction: SopSectionBlock } | { error: string }> {
  const { sopSectionId, block, currentVersion, pinMode, blockProvenance } = input

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
    return { error: 'Block kind/content mismatch' }
  }

  // Compute next sort_order = (current max for this section) + 1
  const { data: maxRow, error: maxErr } = await supabase
    .from('sop_section_blocks')
    .select('sort_order')
    .eq('sop_section_id', sopSectionId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (maxErr) {
    console.error('[insertSectionBlockJunction] sort_order lookup error', maxErr)
    return { error: maxErr.message }
  }
  const nextSort = (maxRow?.sort_order ?? 0) + 1

  const { data: junctionRow, error: insErr } = await supabase
    .from('sop_section_blocks')
    .insert({
      sop_section_id: sopSectionId,
      block_id: block.id,
      pinned_version_id: currentVersion.id,
      pin_mode: pinMode,
      snapshot_content: snapshotContent as unknown as object,
      sort_order: nextSort,
      update_available: false,
      block_provenance: blockProvenance ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .select('*')
    .single()

  if (insErr || !junctionRow) {
    console.error('[insertSectionBlockJunction] insert error', insErr)
    return { error: insErr?.message ?? 'Failed to add block to section' }
  }

  return { junction: junctionRow as unknown as SopSectionBlock }
}

export interface AddBlockToSectionAsServiceInput {
  sopSectionId: string
  blockId: string
  pinMode?: PinMode
  blockProvenance?: unknown
}

/**
 * Server-only parser entry point (Plan 21-05 invocation path, relocated
 * here by Phase 46 CR-01). No session exists in the parse-job worker, so
 * the block + version are fetched via the service-role client. The caller
 * (parser pipeline) owns the org-scope check by passing block + section ids
 * that both belong to the SOP being parsed.
 */
export async function addBlockToSectionAsService(
  input: AddBlockToSectionAsServiceInput
): Promise<{ junction: SopSectionBlock } | { error: string }> {
  const supabase = createAdminClient()

  const { data: blockRow, error: bErr } = await supabase
    .from('blocks')
    .select('id, kind_slug, current_version_id')
    .eq('id', input.blockId)
    .maybeSingle()
  if (bErr || !blockRow) return { error: bErr?.message ?? 'Block not found' }
  const versionId = (blockRow as { current_version_id: string | null }).current_version_id
  if (!versionId) return { error: 'Block has no current version' }

  const { data: versionRow, error: vErr } = await supabase
    .from('block_versions')
    .select('id, content')
    .eq('id', versionId)
    .maybeSingle()
  if (vErr || !versionRow) return { error: vErr?.message ?? 'Block version not found' }

  return insertSectionBlockJunction(supabase, {
    sopSectionId: input.sopSectionId,
    block: blockRow as { id: string; kind_slug: string },
    currentVersion: versionRow as { id: string; content: unknown },
    pinMode: input.pinMode ?? 'pinned',
    blockProvenance: input.blockProvenance ?? null,
  })
}
