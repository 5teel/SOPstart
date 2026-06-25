/**
 * Phase 23 (Plan 23-02) — AI field registration barrel.
 *
 * BACKEND/SERVER-ONLY: Import this file as a side-effect to populate the
 * field registry before handling any request.
 *
 *   import '@/lib/ai-fields/registrations'
 *
 * This is the single barrel that imports/executes all field registrations
 * (RESEARCH.md Pitfall 3 / A4: registry populated at module load).
 *
 * Field → D-02 stake tier mapping:
 *
 * | Field ID              | Stake | Tier (D-02)                                    |
 * |-----------------------|-------|------------------------------------------------|
 * | sop.title             | low   | Draft/title — auto-applied immediately          |
 * | sop.section.title     | high  | Published SOP content — routes to proposal      |
 *
 * WRITE RULE (CLAUDE.md 2026-06-15 + RESEARCH anti-pattern):
 * Each write() descriptor calls an existing @/actions/ server action.
 * It NEVER calls createClient() / createAdminClient() directly — business
 * rules and org-scoping live in the action, not the descriptor.
 */

import { registerField } from '@/lib/ai-fields/registry'
import { updateSopTitle } from '@/actions/sops'
import { updateSectionTitle } from '@/actions/sections'
import type { WriteResult } from '@/lib/ai-fields/registry'
import type { FieldContext } from '@/lib/validators/ai-fields'
import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// sop.title — LOW stake (D-02: draft/title tier)
// ---------------------------------------------------------------------------

registerField<string>({
  id: 'sop.title',
  label: 'SOP Title',
  stakeLevel: 'low',

  /**
   * Read the current title of the SOP identified by context.sopId.
   * Uses the session client so RLS org-scoping applies.
   */
  read: async (ctx: FieldContext): Promise<string> => {
    if (!ctx.sopId) {
      throw new Error('sop.title.read: context.sopId is required')
    }
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('sops')
      .select('title')
      .eq('id', ctx.sopId)
      .eq('organisation_id', ctx.organisationId)
      .single()
    if (error || !data) {
      throw new Error(`sop.title.read: SOP not found (${ctx.sopId})`)
    }
    return (data.title as string | null) ?? ''
  },

  /**
   * Write (update) the SOP title via the existing updateSopTitle server action.
   * stakeLevel:'low' — auto-applied immediately; no proposal record created.
   */
  write: async (ctx: FieldContext, newValue: string): Promise<WriteResult> => {
    if (!ctx.sopId) {
      throw new Error('sop.title.write: context.sopId is required')
    }
    const result = await updateSopTitle(ctx.sopId, newValue)
    if ('error' in result) {
      throw new Error(`sop.title.write failed: ${result.error}`)
    }
    return { outcome: 'applied', value: newValue }
  },
})

// ---------------------------------------------------------------------------
// sop.section.title — HIGH stake (D-02: published SOP content tier)
// ---------------------------------------------------------------------------

registerField<string>({
  id: 'sop.section.title',
  label: 'Section Title',
  stakeLevel: 'high',

  /**
   * Read the current title of the section identified by context.sectionId.
   * Uses the session client so RLS org-scoping applies.
   */
  read: async (ctx: FieldContext): Promise<string> => {
    if (!ctx.sectionId) {
      throw new Error('sop.section.title.read: context.sectionId is required')
    }
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('sop_sections')
      .select('title')
      .eq('id', ctx.sectionId)
      .single()
    if (error || !data) {
      throw new Error(`sop.section.title.read: section not found (${ctx.sectionId})`)
    }
    return (data.title as string | null) ?? ''
  },

  /**
   * Write (update) the section title via the existing updateSectionTitle server action.
   * stakeLevel:'high' — routed to pending proposal by the approval gate in Plan 23-04.
   * The write() descriptor itself executes the update; the approval gate (gateWrite)
   * in approval.ts decides whether to call write() directly or create a proposal first.
   */
  write: async (ctx: FieldContext, newValue: string): Promise<WriteResult> => {
    if (!ctx.sectionId) {
      throw new Error('sop.section.title.write: context.sectionId is required')
    }
    const result = await updateSectionTitle(ctx.sectionId, newValue)
    if ('error' in result) {
      throw new Error(`sop.section.title.write failed: ${result.error}`)
    }
    return { outcome: 'applied', value: newValue }
  },
})
