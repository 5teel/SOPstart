'use server'

/**
 * Phase 26.5 Plan 07 — admin-only agent-layer server actions (D-09/D-10).
 *
 * Reads sop_agent_metadata / block_agent_metadata for the builder's agentview
 * panel, plus the proposal approve/decline actions that back Plan 08's
 * dashboard. All org-scoped from the JWT — never from client input.
 *
 * requireAdmin() mirrors src/actions/departments.ts's shape but decodes the
 * JWT via parseJwtPayload (NOT atob — CLAUDE.md 2026-06-26: atob breaks on
 * non-ASCII claim bytes; departments.ts's raw atob is a legacy instance of
 * the pre-fix pattern, not the target to imitate).
 *
 * Every export here is async ('use server' files may only export async
 * functions — CLAUDE.md 2026-06-27); approveProposalAction/declineProposalAction
 * are thin wrappers delegating to the org-self-enforced lifecycle functions in
 * src/lib/ai-fields/agent-proposals.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { parseJwtPayload } from '@/lib/supabase/jwt'
import { approveProposal, declineProposal } from '@/lib/ai-fields/agent-proposals'
import type { Database } from '@/types/database.types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AdminCtx = {
  supabase: SupabaseClient<Database>
  user: { id: string }
  role: string
  organisationId: string | null
}

async function requireAdmin(): Promise<AdminCtx | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: { session } } = await supabase.auth.getSession()
  const claims = session?.access_token ? parseJwtPayload(session.access_token) : {}
  const role = (claims['user_role'] as string | undefined) ?? ''
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { error: 'Admin access required' }
  }
  const organisationId = (claims['organisation_id'] as string | undefined) ?? null
  return { supabase, user: { id: user.id }, role, organisationId }
}

// ---------------------------------------------------------------------------
// View types (read-only shapes for the builder panel — D-10)
// ---------------------------------------------------------------------------

export type SopAgentMetadataView = {
  summary: string | null
  tags: string[]
  entities: unknown
  assessment: string
  links: unknown
  hasEmbedding: boolean
  lastSynthesisStatus: string | null
  lastSynthesisError: string | null
  regeneratedAt: string | null
}

/** One row per block, keyed by junctionId (sop_section_blocks.id — D-02). */
export type BlockAgentMetadataView = {
  junctionId: string
  tags: string[]
  entities: unknown
  hasEmbedding: boolean
  regeneratedAt: string | null
}

export type AgentDashboardData = {
  pendingProposals: Array<{
    id: string
    sopId: string | null
    kind: string
    description: string
    evidence: unknown
    createdAt: string
  }>
  recentMemory: Array<{
    id: string
    sopId: string | null
    scope: string
    observation: string
    signalSource: string | null
    createdAt: string
  }>
}

// ---------------------------------------------------------------------------
// 1. getSopAgentMetadata — SOP-level read (D-09)
// ---------------------------------------------------------------------------

export async function getSopAgentMetadata(
  sopId: string
): Promise<{ data: SopAgentMetadataView | null } | { error: string }> {
  if (!sopId) return { error: 'sopId required' }
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.organisationId) return { error: 'No organisation' }

  const { data, error } = await ctx.supabase
    .from('sop_agent_metadata')
    .select('*')
    .eq('sop_id', sopId)
    .eq('organisation_id', ctx.organisationId)
    .maybeSingle()

  if (error) {
    console.error('[getSopAgentMetadata] error', error)
    return { error: error.message }
  }
  if (!data) return { data: null }

  return {
    data: {
      summary: data.summary,
      tags: data.tags ?? [],
      entities: data.entities,
      assessment: data.assessment,
      links: data.links,
      hasEmbedding: !!data.embedding,
      lastSynthesisStatus: data.last_synthesis_status,
      lastSynthesisError: data.last_synthesis_error,
      regeneratedAt: data.regenerated_at,
    },
  }
}

// ---------------------------------------------------------------------------
// 2. getBlockAgentMetadata — per-block read, keyed by junction id (D-02)
// ---------------------------------------------------------------------------

export async function getBlockAgentMetadata(
  sopId: string
): Promise<{ data: BlockAgentMetadataView[] } | { error: string }> {
  if (!sopId) return { error: 'sopId required' }
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.organisationId) return { error: 'No organisation' }

  const { data, error } = await ctx.supabase
    .from('block_agent_metadata')
    .select('*')
    .eq('sop_id', sopId)
    .eq('organisation_id', ctx.organisationId)

  if (error) {
    console.error('[getBlockAgentMetadata] error', error)
    return { error: error.message }
  }

  return {
    data: (data ?? []).map((row) => ({
      junctionId: row.block_id,
      tags: row.tags ?? [],
      entities: row.entities,
      hasEmbedding: !!row.embedding,
      regeneratedAt: row.regenerated_at,
    })),
  }
}

// ---------------------------------------------------------------------------
// 3. getAgentDashboardData — pending proposals + recent memory (Plan 08)
// ---------------------------------------------------------------------------

export async function getAgentDashboardData(): Promise<
  { data: AgentDashboardData } | { error: string }
> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.organisationId) return { error: 'No organisation' }

  const { data: proposals, error: pErr } = await ctx.supabase
    .from('agent_learning_proposals')
    .select('*')
    .eq('organisation_id', ctx.organisationId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(50)
  if (pErr) {
    console.error('[getAgentDashboardData] proposals error', pErr)
    return { error: pErr.message }
  }

  const { data: memory, error: mErr } = await ctx.supabase
    .from('agent_memory')
    .select('*')
    .eq('organisation_id', ctx.organisationId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (mErr) {
    console.error('[getAgentDashboardData] memory error', mErr)
    return { error: mErr.message }
  }

  return {
    data: {
      pendingProposals: (proposals ?? []).map((r) => ({
        id: r.id,
        sopId: r.sop_id,
        kind: r.kind,
        description: r.description,
        evidence: r.evidence,
        createdAt: r.created_at,
      })),
      recentMemory: (memory ?? []).map((r) => ({
        id: r.id,
        sopId: r.sop_id,
        scope: r.scope,
        observation: r.observation,
        signalSource: r.signal_source,
        createdAt: r.created_at,
      })),
    },
  }
}

// ---------------------------------------------------------------------------
// 4/5. approveProposalAction / declineProposalAction — admin-gated wrappers
// delegating to the org-self-enforced lifecycle functions (D-07/D-10).
// ---------------------------------------------------------------------------

export async function approveProposalAction(
  proposalId: string
): Promise<{ success: true } | { error: string }> {
  if (!proposalId) return { error: 'proposalId required' }
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.organisationId) return { error: 'No organisation' }

  try {
    await approveProposal(ctx.organisationId, proposalId)
    return { success: true }
  } catch (e) {
    console.error('[approveProposalAction] error', e)
    return { error: e instanceof Error ? e.message : 'Failed to approve proposal' }
  }
}

export async function declineProposalAction(
  proposalId: string
): Promise<{ success: true } | { error: string }> {
  if (!proposalId) return { error: 'proposalId required' }
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.organisationId) return { error: 'No organisation' }

  try {
    await declineProposal(ctx.organisationId, proposalId)
    return { success: true }
  } catch (e) {
    console.error('[declineProposalAction] error', e)
    return { error: e instanceof Error ? e.message : 'Failed to decline proposal' }
  }
}
