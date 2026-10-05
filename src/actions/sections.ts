'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSopEditAccess } from '@/lib/auth/guards'
import { editableSop } from '@/lib/sop/editable'
import type { SectionKind, SopSection } from '@/types/sop'

/**
 * Fetch all section_kinds visible to the current user (globals + own-org).
 * RLS in migration 00019 enforces the scoping — this action is a thin wrapper.
 */
export async function listSectionKinds(): Promise<SectionKind[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('section_kinds')
    .select('*')
    .order('render_priority', { ascending: true })
    .order('display_name', { ascending: true })

  if (error) {
    console.error('[listSectionKinds] supabase error', error)
    throw new Error('Failed to load section kinds')
  }
  return (data ?? []) as unknown as SectionKind[]
}

const CreateSectionInput = z.object({
  sopId: z.string().uuid(),
  sectionKindId: z.string().uuid(),
  title: z.string().min(1).max(120),
  content: z.string().max(10_000).nullable().optional(),
})

export type CreateSectionInputType = z.infer<typeof CreateSectionInput>

export async function createSection(
  input: CreateSectionInputType
): Promise<SopSection> {
  const parsed = CreateSectionInput.parse(input)

  const ctx = await requireSopEditAccess({ sopId: parsed.sopId })
  if ('error' in ctx) throw new Error(ctx.error)
  const open = await editableSop(ctx.organisationId, ctx.sopId)
  if ('error' in open) throw new Error(open.error)
  const supabase = await createClient()

  // Fetch the kind (RLS-scoped) to get its slug for section_type and to
  // verify the kind is visible to the caller. This also prevents an attacker
  // from forging a sectionKindId that points at another org's custom kind.
  const { data: kind, error: kindErr } = await supabase
    .from('section_kinds')
    .select('id, slug, display_name')
    .eq('id', parsed.sectionKindId)
    .single()
  if (kindErr || !kind) {
    throw new Error('Unknown section kind: ' + parsed.sectionKindId)
  }

  // Compute next sort_order (append to end of SOP's existing sections).
  // Gap-of-10 keeps space for future manual reordering.
  const { data: existing, error: existingErr } = await supabase
    .from('sop_sections')
    .select('sort_order')
    .eq('sop_id', parsed.sopId)
    .order('sort_order', { ascending: false })
    .limit(1)
  if (existingErr) {
    console.error('[createSection] sort_order lookup error', existingErr)
    throw new Error('Failed to compute section sort order')
  }
  const nextOrder =
    existing && existing.length > 0 ? (existing[0].sort_order ?? 0) + 10 : 10

  // For canonical kinds, section_type mirrors the slug (keeps legacy
  // consumers happy). For 'custom', we store 'custom' as section_type and
  // rely on section_kind_id + title for render resolution.
  const insertPayload = {
    sop_id: parsed.sopId,
    section_type: kind.slug,
    section_kind_id: kind.id,
    title: parsed.title,
    content: parsed.content ?? null,
    sort_order: nextOrder,
    approved: false,
  }

  const { data: inserted, error: insErr } = await supabase
    .from('sop_sections')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(insertPayload as any)
    .select('*')
    .single()
  if (insErr || !inserted) {
    console.error('[createSection] insert error', insErr)
    throw new Error('Failed to create section')
  }
  return inserted as unknown as SopSection
}

// --- Phase 12 additions: reorderSections + updateSectionLayout ---
// reorderSections calls the `reorder_sections` RPC (migration 00020) — atomic
// multi-row UPDATE via a single plpgsql call. The function is NOT SECURITY
// DEFINER so RLS on sop_sections applies to the caller (defence-in-depth with
// the explicit admin role check below).

const ReorderSectionsInput = z.object({
  sopId: z.string().uuid(),
  orderedSectionIds: z.array(z.string().uuid()).min(1),
})

export async function reorderSections(
  input: z.infer<typeof ReorderSectionsInput>
): Promise<{ success: true } | { error: string }> {
  const parsed = ReorderSectionsInput.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const ctx = await requireSopEditAccess({ sopId: parsed.data.sopId })
  if ('error' in ctx) return ctx
  const open = await editableSop(ctx.organisationId, ctx.sopId)
  if ('error' in open) return open
  const { supabase } = ctx

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('reorder_sections', {
    p_sop_id: parsed.data.sopId,
    p_ordered_section_ids: parsed.data.orderedSectionIds,
  })
  if (error) {
    console.error('[reorderSections] rpc error', error)
    return { error: `Reorder failed: ${error.message}` }
  }
  return { success: true }
}

/**
 * Phase 23 AFL-AI-03 — High-stake section title update.
 * Used by the 'sop.section.title' AI field descriptor (stakeLevel:'high' when published).
 * Validates admin role + org-scoping. Uses admin client for published SOPs
 * (session client may miss superseded rows — RESEARCH Pitfall 5).
 */
export async function updateSectionTitle(
  sectionId: string,
  newTitle: string,
): Promise<{ success: true } | { error: string }> {
  if (!newTitle || typeof newTitle !== 'string' || !newTitle.trim()) {
    return { error: 'Section title must be a non-empty string.' }
  }

  const ctx = await requireSopEditAccess({ sectionId })
  if ('error' in ctx) return ctx
  const open = await editableSop(ctx.organisationId, ctx.sopId)
  if ('error' in open) return open

  // Use admin client to handle published/superseded SOPs (RESEARCH Pitfall 5).
  // requireSopEditAccess already self-enforced org-scope + edit authorization.
  const admin = createAdminClient()

  const { error: updateError } = await admin
    .from('sop_sections')
    .update({ title: newTitle.trim(), updated_at: new Date().toISOString() })
    .eq('id', sectionId)

  if (updateError) return { error: updateError.message }
  return { success: true }
}
