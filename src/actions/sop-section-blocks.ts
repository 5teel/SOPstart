'use server'

/**
 * sop_section_blocks junction — what remains after the content library was
 * removed (Phase 55).
 *
 * The junction rows themselves stay: they carry snapshot_content (frozen
 * when the parser creates a block, SB-BLOCK-04), block_provenance and the
 * per-block verify state that the publish gate reads. The parser writes them
 * through src/lib/builder/section-blocks-core.ts (not a server action).
 *
 * This module only reads a section's junction rows (builder editor), and
 * owns the pre-publish verify chip + gate status.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAdminContext, type AdminContext } from '@/lib/auth/guards'
import { findingsFor } from '@/lib/builder/block-findings'
import { recordDecision } from '@/lib/decisions/record'
import { getPublishGateStatus as getStepGateStatus } from '@/actions/publish-gate'
import type { SopSectionBlock } from '@/types/sop'

// CAP-02 scope boundary: verifyBlock/unverifyBlock stay on requireAdmin()
// (= requireAdminContext()) — verify-blocks is the pre-publish gate (publish
// authority, not edit authority). Do NOT swap these to requireSopEditAccess —
// that would let a SOP owner unverify/re-verify blocks, which the phase 46
// capability work deliberately does not grant.
async function requireAdmin() {
  return requireAdminContext()
}

// ---------------------------------------------------------------------------
// 1. listSectionBlocks — RLS-scoped read of a section's junction rows
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
// 2. verifyBlock / unverifyBlock — Phase 21 plan 21-01 (SCP-VERIFY-01/03)
//
// Pre-publish per-block verify checklist (Spike 004). Each block in a draft
// SOP must carry a verified_by_admin_id before the publish button unlocks
// (gate enforced in Wave 4). Re-editing a block content row clears its own
// verified_by_admin_id automatically via DB trigger
// clear_block_verification_on_content_change (migration 00032).
//
// RLS owns the org-scope check — the row will simply not be visible / not be
// updatable from another org. The action layer adds a defence-in-depth role
// check so workers can't poke the verify column even within their own org.
// ---------------------------------------------------------------------------

// Phase 56: the SOP for a ledger row is resolved here from the junction's own
// section, with the caller's RLS-scoped client -- never from a client parameter.
async function resolveSopId(
  supabase: AdminContext['supabase'],
  sopSectionId: string | null | undefined,
): Promise<string | null> {
  if (!sopSectionId) return null
  const { data } = await supabase.from('sop_sections').select('sop_id').eq('id', sopSectionId).maybeSingle()
  return (data?.sop_id as string | undefined) ?? null
}

export async function verifyBlock(
  blockId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!blockId) return { ok: false, error: 'blockId required' }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  const { supabase, user, organisationId } = ctx

  const { data: rows, error } = await supabase
    .from('sop_section_blocks')
    .update({
      verified_by_admin_id: user.id,
      verified_at: new Date().toISOString(),
    })
    .eq('id', blockId)
    .select('id, sop_section_id')

  if (error) {
    console.error('[verifyBlock] update error', error)
    return { ok: false, error: error.message }
  }
  if (rows && rows.length > 0) {
    const sopId = await resolveSopId(supabase, rows[0].sop_section_id)
    const flags = await findingsFor(sopId, organisationId, blockId)
    const n = flags.length
    await recordDecision({
      kind: n > 0 ? 'ai_finding_cleared' : 'verify',
      subject: { kind: 'section_block', id: blockId },
      sopId,
      summary:
        n > 0
          ? `Checked a section and cleared ${n} AI finding${n === 1 ? '' : 's'}`
          : 'Checked a section before publishing',
      details: n > 0 ? { junction_id: blockId, flags } : { junction_id: blockId },
    })
  }
  return { ok: true }
}

export async function unverifyBlock(
  blockId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!blockId) return { ok: false, error: 'blockId required' }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  const { supabase } = ctx

  const { data: rows, error } = await supabase
    .from('sop_section_blocks')
    .update({
      verified_by_admin_id: null,
      verified_at: null,
    })
    .eq('id', blockId)
    .select('id, sop_section_id')

  if (error) {
    console.error('[unverifyBlock] update error', error)
    return { ok: false, error: error.message }
  }
  if (rows && rows.length > 0) {
    await recordDecision({
      kind: 'verify_withdrawn',
      subject: { kind: 'section_block', id: blockId },
      sopId: await resolveSopId(supabase, rows[0].sop_section_id),
      summary: 'Un-checked a section',
      details: { junction_id: blockId },
    })
  }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// 3. getPublishGateStatus -- Phase 21 plan 21-04, re-keyed in Phase 58 (D-16).
//
// Kept only so the old builder's chip keeps agreeing with the server until the
// builder is deleted. It answers from src/actions/publish-gate.ts, the same
// three counts as assertPublishGates; there is no bypass any more.
// ---------------------------------------------------------------------------

export type PublishGateStatus = {
  ready: boolean
  unverified_count: number
  total: number
  /** Always false: nothing is excluded from the gate any more. */
  bypassed: boolean
}

export async function getPublishGateStatus(
  sopId: string
): Promise<PublishGateStatus | { error: string }> {
  const status = await getStepGateStatus(sopId)
  if ('error' in status) return status
  return { ready: status.ready, unverified_count: status.unchecked, total: status.total, bypassed: false }
}
