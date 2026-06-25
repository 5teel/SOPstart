'use server'

/**
 * Phase 23 Plan 23-04 — AI field write server actions (AFL-AI-02).
 *
 * Exports:
 *   applyAiWrite(rawInput)      — validates + routes through gateWrite (single write path)
 *   acceptProposal(proposalId)  — admin applies a pending proposal to the field
 *   rejectProposal(proposalId)  — admin discards a pending proposal
 *
 * Security invariants:
 *   - applyAiWrite calls gateWrite() and NEVER calls descriptor.write() directly (T-23-04-02)
 *   - acceptProposal/rejectProposal are admin-only + org-scoped (T-23-04-04)
 *   - acceptProposal validates sop_version still matches before applying (T-23-04-03 stale guard)
 *   - All writes via createAdminClient() — ai_field_proposals has no authenticated write policy
 *     (CLAUDE.md 2026-06-15 pattern)
 *
 * Sources:
 *   - 23-04-PLAN.md Task 2
 *   - 23-PATTERNS.md § ai-fields.ts (lines 361–384) + § Admin-Only Role Guard (lines 630–639)
 *   - src/actions/completions.ts — analog: auth pattern, admin client, {success}|{error} shape
 *   - 23-RESEARCH.md § Open Questions #3 (router.refresh after write; server component re-fetch)
 *   - 23-RESEARCH.md § Security threat "Stale AI proposal applied after re-publish" (T-23-04-03)
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AiWriteRequestSchema, AcceptProposalSchema, RejectProposalSchema } from '@/lib/validators/ai-fields'
import { gateWrite } from '@/lib/ai-fields/approval'
import { getField } from '@/lib/ai-fields/registry'
import type { WriteResult } from '@/lib/ai-fields/registry'
import { parseJwtPayload } from '@/lib/supabase/jwt'

// ────────────────────────────────────────────────────────────────────────────
// applyAiWrite
// The SINGLE write path for the AI field layer. Routes through gateWrite.
// Called by POST /api/ai-fields/write (D-04 v5.0 agent entrypoint).
// ────────────────────────────────────────────────────────────────────────────

export async function applyAiWrite(
  rawInput: unknown,
): Promise<{ success: true; result: WriteResult } | { success: false; error: string }> {
  // ── 1. Validate input ──────────────────────────────────────────────────────
  const parsed = AiWriteRequestSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const { fieldId, context, newValue } = parsed.data

  // ── 2. Auth + org claim ────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: { session } } = await supabase.auth.getSession()
  const jwtClaims = session?.access_token
    ? parseJwtPayload(session.access_token)
    : {}
  const organisationId: string | null = jwtClaims['organisation_id'] ?? null
  if (!organisationId) return { success: false, error: 'No organisation found' }

  // Override context.organisationId with the JWT-derived value (never trust client).
  // Also override sopIsPublished from the DB — never trust client-supplied value (CR-01).
  // The write route enriches sopIsPublished as an optimisation, but a direct action call
  // can pass sopIsPublished:false to force auto-apply on any low-stake field regardless of
  // actual SOP status. The action is the security boundary.
  let serverSopIsPublished: boolean | undefined = undefined
  if (context.sopId) {
    const admin = createAdminClient()
    const { data: sopRow } = await admin
      .from('sops')
      .select('status')
      .eq('id', context.sopId)
      .eq('organisation_id', organisationId)
      .single()
    if (sopRow) {
      serverSopIsPublished = sopRow.status === 'published'
    }
    // If sopRow is null (SOP not found / cross-org), leave sopIsPublished undefined —
    // gateWrite's A6 fail-safe treats undefined-on-SOP-scoped as high-stake.
  }
  const safeContext = { ...context, organisationId, sopIsPublished: serverSopIsPublished }

  // ── 3. Registry lookup (allow-list gate — T-23-04-05) ─────────────────────
  const descriptor = getField(fieldId)
  if (!descriptor) {
    return { success: false, error: `Unknown field: ${fieldId}` }
  }

  // ── 4. Fetch current value for diff (stored in the proposal row) ───────────
  let currentValue: unknown = null
  try {
    currentValue = await descriptor.read(safeContext)
  } catch {
    // Non-fatal — proceed with null current value
    currentValue = null
  }

  // ── 5. Route through gateWrite — NEVER call descriptor.write() directly ────
  // (T-23-04-02: applyAiWrite is the only write path; routes is write-only via this fn)
  try {
    const result = await gateWrite(descriptor, safeContext, newValue, currentValue)
    return { success: true, result }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Write failed'
    return { success: false, error: message }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// acceptProposal
// Admin applies a pending proposal to the field by calling descriptor.write().
// Validates sop_version staleness before applying (T-23-04-03).
// ────────────────────────────────────────────────────────────────────────────

export async function acceptProposal(
  proposalId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  // ── 1. Validate proposalId ────────────────────────────────────────────────
  const parsed = AcceptProposalSchema.safeParse({ proposalId })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid proposalId' }
  }

  // ── 2. Auth + admin role guard ────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: { session } } = await supabase.auth.getSession()
  const jwtClaims = session?.access_token
    ? parseJwtPayload(session.access_token)
    : {}
  const role: string | undefined = jwtClaims['user_role']
  const organisationId: string | null = jwtClaims['organisation_id'] ?? null

  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { success: false, error: 'You need admin access to accept proposals.' }
  }
  if (!organisationId) return { success: false, error: 'No organisation found' }

  // ── 3. Load the proposal (admin client + org-scope self-check — T-23-04-04) ─
  const admin = createAdminClient()
  const { data: proposal, error: fetchError } = await admin
    .from('ai_field_proposals')
    .select('*')
    .eq('id', proposalId)
    .eq('organisation_id', organisationId)
    .eq('status', 'pending')
    .single()

  if (fetchError || !proposal) {
    return { success: false, error: 'Proposal not found or already resolved.' }
  }

  // ── 4. Registry lookup ────────────────────────────────────────────────────
  const descriptor = getField(proposal.field_id as string)
  if (!descriptor) {
    return { success: false, error: `Unknown field: ${proposal.field_id}` }
  }

  // ── 5. Stale-proposal guard (T-23-04-03) ─────────────────────────────────
  // If the proposal stored a sop_version, verify the current SOP version still matches.
  // An admin could re-publish between proposal creation and acceptance — reject stale proposals.
  if (proposal.sop_version !== null && proposal.context) {
    const ctx = proposal.context as Record<string, unknown>
    const sopId = ctx['sopId'] as string | undefined
    if (sopId) {
      const { data: currentSop } = await admin
        .from('sops')
        .select('version, status')
        .eq('id', sopId)
        .eq('organisation_id', organisationId)
        .single()

      if (currentSop && currentSop.version !== proposal.sop_version) {
        // SOP was re-published at a new version after this proposal was created → stale
        return {
          success: false,
          error: 'This proposal is stale — the SOP has been updated since it was created. Please re-review.',
        }
      }
    }
  }

  // ── 6. Apply the write through descriptor.write() ─────────────────────────
  // This is the ONLY place descriptor.write() is called directly (acceptProposal apply path).
  if (!descriptor.write) {
    return { success: false, error: `Field '${descriptor.id}' does not support writes.` }
  }

  const ctx = proposal.context as Record<string, unknown>
  const fieldContext = {
    organisationId,
    sopId: ctx['sopId'] as string | undefined,
    sectionId: ctx['sectionId'] as string | undefined,
    stepId: ctx['stepId'] as string | undefined,
    memberId: ctx['memberId'] as string | undefined,
  }

  try {
    await descriptor.write(fieldContext, proposal.proposed_value)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Write failed'
    return { success: false, error: message }
  }

  // ── 7. Update proposal status → 'applied' (admin client, org-scoped) ──────
  await admin
    .from('ai_field_proposals')
    .update({ status: 'applied' })
    .eq('id', proposalId)
    .eq('organisation_id', organisationId)

  // ── 8. Revalidate the relevant path ───────────────────────────────────────
  // Revalidate the SOP builder + admin SOPs list. More granular revalidation
  // would require the sopId from context — revalidate the admin SOPs root for now.
  const sopId = (proposal.context as Record<string, unknown>)['sopId'] as string | undefined
  if (sopId) {
    revalidatePath(`/admin/sops/${sopId}`)
    revalidatePath(`/admin/sops/builder/${sopId}`)
  }
  revalidatePath('/admin/sops')

  return { success: true }
}

// ────────────────────────────────────────────────────────────────────────────
// rejectProposal
// Admin discards a pending proposal (sets status → 'rejected').
// ────────────────────────────────────────────────────────────────────────────

export async function rejectProposal(
  proposalId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  // ── 1. Validate proposalId ────────────────────────────────────────────────
  const parsed = RejectProposalSchema.safeParse({ proposalId })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid proposalId' }
  }

  // ── 2. Auth + admin role guard ────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: { session } } = await supabase.auth.getSession()
  const jwtClaims = session?.access_token
    ? parseJwtPayload(session.access_token)
    : {}
  const role: string | undefined = jwtClaims['user_role']
  const organisationId: string | null = jwtClaims['organisation_id'] ?? null

  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { success: false, error: 'You need admin access to reject proposals.' }
  }
  if (!organisationId) return { success: false, error: 'No organisation found' }

  // ── 3. Update proposal status → 'rejected' (admin client + org-scope) ─────
  // ai_field_proposals has no authenticated write policy (CLAUDE.md 2026-06-15)
  const admin = createAdminClient()
  const { data: rejected, error } = await admin
    .from('ai_field_proposals')
    .update({ status: 'rejected' })
    .eq('id', proposalId)
    .eq('organisation_id', organisationId)
    .eq('status', 'pending')
    .select('id')

  if (error) {
    return { success: false, error: 'Failed to reject proposal.' }
  }
  // WR-06: detect 0-rows-updated — proposal was phantom or already resolved
  if (!rejected || rejected.length === 0) {
    return { success: false, error: 'Proposal not found or already resolved.' }
  }
  // ── 4. Revalidate ─────────────────────────────────────────────────────────
  revalidatePath('/admin/sops')

  return { success: true }
}
