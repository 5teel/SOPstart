'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
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

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: { session } } = await supabase.auth.getSession()
  const jwtClaims = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))
    : {}
  const role = jwtClaims['user_role']
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { error: 'Admin access required' }
  }

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

const UpdateSectionLayoutInput = z.object({
  sectionId: z.string().uuid(),
  layoutData: z.unknown(),
  layoutVersion: z.number().int().min(1),
  clientUpdatedAt: z.number().int().min(0),
})

const MAX_LAYOUT_BYTES = 128 * 1024 // 128 KB hard cap per Research Open Question 3

export async function updateSectionLayout(
  input: z.infer<typeof UpdateSectionLayoutInput>
): Promise<{ success: true } | { error: string }> {
  const parsed = UpdateSectionLayoutInput.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  // 128 KB byte cap (T-12-04-01 mitigation)
  const serialized = JSON.stringify(parsed.data.layoutData)
  if (Buffer.byteLength(serialized, 'utf8') > MAX_LAYOUT_BYTES) {
    return { error: 'Layout exceeds 128 KB; reduce block count or content' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: { session } } = await supabase.auth.getSession()
  const jwtClaims = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))
    : {}
  const role = jwtClaims['user_role']
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { error: 'Admin access required' }
  }

  // LWW check (D-07): if server updated_at is newer than clientUpdatedAt,
  // signal server_newer so the caller (flushDraftLayouts) drops the local row.
  const { data: current, error: selErr } = await supabase
    .from('sop_sections')
    .select('updated_at')
    .eq('id', parsed.data.sectionId)
    .maybeSingle()
  if (selErr) {
    console.error('[updateSectionLayout] select error', selErr)
    return { error: selErr.message }
  }
  if (current?.updated_at) {
    const serverMs = new Date(current.updated_at as string).getTime()
    if (serverMs > parsed.data.clientUpdatedAt) {
      return { error: 'server_newer' }
    }
  }

  const { error: updErr } = await supabase
    .from('sop_sections')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({
      layout_data: parsed.data.layoutData as any,
      layout_version: parsed.data.layoutVersion,
      updated_at: new Date(parsed.data.clientUpdatedAt).toISOString(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .eq('id', parsed.data.sectionId)
  if (updErr) {
    console.error('[updateSectionLayout] update error', updErr)
    return { error: updErr.message }
  }
  return { success: true }
}
