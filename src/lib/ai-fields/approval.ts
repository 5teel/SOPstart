/**
 * Phase 23 Plan 23-04 — Tiered approval gate (AFL-AI-02).
 *
 * BACKEND/SERVER-ONLY: This module is consumed by server actions and API routes.
 * Do NOT import from client components.
 *
 * gateWrite(descriptor, context, newValue, currentValue) — the SINGLE write path.
 * All write requests go through this function; descriptor.write() is NEVER called
 * directly from routes or external actions (T-23-04-02 mitigation).
 *
 * Tiered approval model (D-01/D-02):
 *   low-stake + draft SOP → auto-applied (calls descriptor.write())
 *   high-stake OR published SOP → pending_approval (inserts into ai_field_proposals)
 *   ambiguous SOP scope (sopId present, sopIsPublished undefined) → require approval (A6)
 *
 * Security:
 *   - ai_field_proposals has NO authenticated INSERT policy (CLAUDE.md 2026-06-15)
 *   - Writes use service-role client (createAdminClient) — org-scoping self-enforced
 *   - High-stake path NEVER calls descriptor.write() (T-23-04-01)
 *
 * Injectable seam (AdminInsertFn) makes this unit-testable without a real DB:
 *   - Production: omit the 5th arg (default uses createAdminClient)
 *   - Tests: pass a fake insert fn that returns a stable proposalId
 *
 * Sources:
 *   - 23-04-PLAN.md Task 1
 *   - 23-RESEARCH.md § Pattern 2 (lines 274–326)
 *   - 23-PATTERNS.md § approval.ts (lines 156–196)
 *   - 23-CONTEXT.md D-01/D-02/A6
 *   - CLAUDE.md 2026-06-15 (no-auth-policy table → createAdminClient + self-enforce)
 */

import { createAdminClient } from '@/lib/supabase/admin'
import type { FieldDescriptor, WriteResult } from '@/lib/ai-fields/registry'
import type { FieldContext } from '@/lib/validators/ai-fields'
import type { Json } from '@/types/database.types'

// ---------------------------------------------------------------------------
// Injectable seam type (enables unit testing without live DB)
// ---------------------------------------------------------------------------

/**
 * A function that inserts a proposal row and returns the new proposal ID.
 * The default implementation uses createAdminClient(); tests inject a fake.
 */
export type AdminInsertFn = (row: {
  organisation_id: string
  field_id: string
  field_label: string
  context: Record<string, unknown>
  current_value: unknown
  proposed_value: unknown
  status: 'pending'
  sop_version?: number | null
}) => Promise<string>

// Default production implementation — uses service-role client.
// NEVER called in tests; tests inject a fake AdminInsertFn as the 5th argument.
const defaultAdminInsert: AdminInsertFn = async (row) => {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ai_field_proposals')
    .insert({
      organisation_id: row.organisation_id,
      field_id: row.field_id,
      field_label: row.field_label,
      context: row.context as Json,
      current_value: row.current_value as Json | null,
      proposed_value: row.proposed_value as Json | null,
      status: row.status,
      sop_version: row.sop_version ?? null,
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`[approval] Failed to create proposal: ${error?.message ?? 'unknown'}`)
  }
  return data.id as string
}

// ---------------------------------------------------------------------------
// isHighStakeContext
// ---------------------------------------------------------------------------

/**
 * Determines whether the given descriptor + context combination is high-stake.
 *
 * Returns true when ANY of the following holds:
 *   (a) descriptor.stakeLevel === 'high'             — field registered as high-stake
 *   (b) context.sopIsPublished === true               — D-02: published SOP content always high-stake
 *   (c) context.sopId present AND sopIsPublished is   — A6 fail-safe: ambiguity → require approval
 *       undefined (not explicitly set to false)
 *
 * Returns false ONLY when stakeLevel is 'low' AND either no sopId is present
 * OR sopIsPublished is explicitly false (draft SOP).
 */
export function isHighStakeContext(
  descriptor: FieldDescriptor,
  context: FieldContext,
): boolean {
  // (a) Descriptor explicitly registered as high-stake
  if (descriptor.stakeLevel === 'high') return true

  // (b) Published SOP — everything on a published SOP is high-stake (D-02)
  if (context.sopIsPublished === true) return true

  // (c) A6 fail-safe: sopId is present but publish status is unknown (undefined)
  //     → treat as high-stake. Caller SHOULD set sopIsPublished from the DB
  //     (the write route does this). If it is explicitly false the SOP is a draft
  //     → safe to auto-apply.
  if (context.sopId !== undefined && context.sopIsPublished === undefined) {
    return true
  }

  return false
}

// ---------------------------------------------------------------------------
// gateWrite — the SINGLE write path (AFL-AI-02)
// ---------------------------------------------------------------------------

/**
 * Apply a proposed new value for a field, routing through the approval model.
 *
 * @param descriptor      FieldDescriptor from the registry (has .stakeLevel + .write)
 * @param context         FieldContext from the request (organisationId, sopId, sopIsPublished …)
 * @param newValue        The proposed new value from the AI / API caller
 * @param currentValue    The current value (fetched by the caller for diff; stored in proposal row)
 * @param adminInsert     Injectable seam — omit in production, pass fake in unit tests
 *
 * @returns WriteResult   {outcome:'applied'} | {outcome:'pending_approval', proposalId}
 */
export async function gateWrite(
  descriptor: FieldDescriptor,
  context: FieldContext,
  newValue: unknown,
  currentValue: unknown,
  adminInsert: AdminInsertFn = defaultAdminInsert,
): Promise<WriteResult> {
  const highStake = isHighStakeContext(descriptor, context)

  if (!highStake) {
    // ── Low-stake auto-apply path ──────────────────────────────────────────
    // MUST have a write function; callers should guard at registration time.
    if (!descriptor.write) {
      throw new Error(
        `[gateWrite] Field '${descriptor.id}' is missing descriptor.write() — cannot auto-apply`,
      )
    }
    // Call descriptor.write() exactly once — returns {outcome:'applied', value}
    return descriptor.write(context, newValue)
  }

  // ── High-stake: create pending proposal, NEVER call descriptor.write() ──
  // (T-23-04-01: the write spy test asserts write() is NOT called here)
  const proposalId = await adminInsert({
    organisation_id: context.organisationId,
    field_id: descriptor.id,
    field_label: descriptor.label,
    context: context as Record<string, unknown>,
    current_value: currentValue,
    proposed_value: newValue,
    status: 'pending',
    // sop_version: could be derived from context if available — left null for now;
    // acceptProposal validates staleness via sop_version check (T-23-04-03)
    sop_version: null,
  })

  return { outcome: 'pending_approval', proposalId }
}
