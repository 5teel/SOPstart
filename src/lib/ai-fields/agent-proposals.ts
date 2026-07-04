/**
 * Phase 26.5 D-07/D-08 — proposal lifecycle (create/approve/decline) + free
 * append-only memory writes.
 *
 * NOT a 'use server' file — this is a plain lib module so Plan 26.5-07's
 * server actions can stay thin async wrappers (CLAUDE.md 2026-06-27:
 * 'use server' files may only export async functions; pure/sync helpers
 * must live elsewhere).
 *
 * Mirrors src/lib/ai-fields/approval.ts's injectable AdminInsertFn seam
 * (unit-testable without a live DB) but agent_learning_proposals rows are
 * ALWAYS pending — there is no low-stake auto-apply tier for learning
 * proposals (D-07/D-10: every proposal is admin-reviewed).
 *
 * agent_learning_proposals / agent_memory have NO authenticated write policy
 * (migration 00040) — every write here uses createAdminClient() and
 * self-enforces organisation_id explicitly (CLAUDE.md 2026-06-15/2026-06-26).
 */
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database.types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Structured evidence backing a proposal — the memory rows / signal counts
 * that justify raising it (D-07). */
export type EvidenceRow = {
  source: 'completions' | 'reviewer' | 'verify' | 'voice' | string
  memoryIds?: string[]
  count?: number
  detail?: string
}

/** Injectable insert seam (mirrors approval.ts's AdminInsertFn) — enables
 * unit testing createLearningProposal without a live DB. */
export type AgentAdminInsertFn = (row: {
  organisation_id: string
  sop_id: string
  kind: string
  description: string
  evidence: EvidenceRow[]
  status: 'pending'
}) => Promise<string>

// Default production implementation — service-role client. Tests inject a
// fake AgentAdminInsertFn as the 4th argument to createLearningProposal.
const defaultAgentAdminInsert: AgentAdminInsertFn = async (row) => {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('agent_learning_proposals')
    .insert({
      organisation_id: row.organisation_id,
      sop_id: row.sop_id,
      kind: row.kind,
      description: row.description,
      evidence: row.evidence as unknown as Json,
      status: row.status,
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`[agent-layer] proposal insert failed: ${error?.message ?? 'unknown'}`)
  }
  return data.id as string
}

// ---------------------------------------------------------------------------
// createLearningProposal — always-pending, evidence-carrying (D-07)
// ---------------------------------------------------------------------------

/**
 * Insert a new evidence-backed learning proposal. Always pending — there is
 * no auto-apply path for agent-layer proposals; every one is admin-reviewed
 * via approveProposal/declineProposal (D-07/D-10).
 */
export async function createLearningProposal(
  organisationId: string,
  sopId: string,
  proposal: { kind: string; description: string; evidence: EvidenceRow[] },
  adminInsert: AgentAdminInsertFn = defaultAgentAdminInsert,
): Promise<string> {
  return adminInsert({
    organisation_id: organisationId,
    sop_id: sopId,
    kind: proposal.kind,
    description: proposal.description,
    evidence: proposal.evidence,
    status: 'pending',
  })
}

// ---------------------------------------------------------------------------
// approveProposal / declineProposal — org-scoped status flip (D-07/D-10)
// ---------------------------------------------------------------------------

/**
 * Mark a proposal 'applied'. Org-scoped on the write (.eq('organisation_id', ...))
 * because createAdminClient() bypasses RLS — a safety_manager in another org
 * must never be able to mutate this row (CLAUDE.md 2026-06-15/2026-06-26).
 *
 * D-13: this phase is infra-only. Approving a proposal records the admin's
 * decision; it does NOT itself edit SOP content. A future flagship plan
 * would translate an 'applied' proposal into an actual field write.
 */
export async function approveProposal(organisationId: string, proposalId: string): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('agent_learning_proposals')
    .update({ status: 'applied', reviewed_at: new Date().toISOString() })
    .eq('id', proposalId)
    .eq('organisation_id', organisationId)
  if (error) {
    throw new Error(`[agent-layer] approveProposal failed: ${error.message}`)
  }
}

/** Mark a proposal 'rejected'. Org-scoped on the write — see approveProposal. */
export async function declineProposal(organisationId: string, proposalId: string): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('agent_learning_proposals')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
    .eq('id', proposalId)
    .eq('organisation_id', organisationId)
  if (error) {
    throw new Error(`[agent-layer] declineProposal failed: ${error.message}`)
  }
}

// ---------------------------------------------------------------------------
// appendMemory — free append-only write, no approval gate (D-08)
// ---------------------------------------------------------------------------

/**
 * Append an observation to agent_memory. Free — no status/approval field,
 * no gate (D-08). organisation_id is set explicitly (self-enforced —
 * createAdminClient() bypasses RLS, CLAUDE.md 2026-06-15).
 */
export async function appendMemory(
  organisationId: string,
  entry: {
    sopId?: string | null
    scope: 'sop' | 'org'
    observation: string
    signalSource?: string
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin.from('agent_memory').insert({
    organisation_id: organisationId,
    sop_id: entry.sopId ?? null,
    scope: entry.scope,
    observation: entry.observation,
    signal_source: entry.signalSource ?? null,
    metadata: (entry.metadata ?? {}) as Json,
  })
  if (error) {
    throw new Error(`[agent-layer] appendMemory failed: ${error.message}`)
  }
}
