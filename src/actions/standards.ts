'use server'

/**
 * Phase 56 (56-06, D-12, SOP-02) -- the org's standards list and where each
 * standard is attached (the whole SOP, a section, or a single converted step).
 *
 * requireAdminContext() runs first in every export. The organisation comes from
 * the session only; no export accepts one. Every query filters by it, and the
 * standard and the target are both checked in the org before an attachment is
 * written (T-56-04). The session client carries the admin write RLS policies
 * (00069), so no service-role client is used. Managing a label is not a
 * decision, so nothing is written to the ledger.
 *
 * Async exports only (CLAUDE.md 2026-06-27). The tables are not all in
 * database.types.ts yet, so the client is used through an untyped view, as
 * site.ts does.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAdminContext } from '@/lib/auth/guards'
import {
  createStandardSchema,
  removeStandardSchema,
  renameStandardSchema,
  setStandardAttachmentSchema,
  type StandardRow,
  type StandardsPanel,
} from '@/lib/validators/standards'
import { z } from 'zod'

const DUPLICATE = 'A standard with that name already exists'

export async function listStandards(): Promise<{ standards: StandardRow[] } | { error: string }> {
  const ctx = await requireAdminContext()
  if ('error' in ctx) return { error: ctx.error }
  const orgId = ctx.organisationId
  if (!orgId) return { error: 'No organisation' }
  const db = ctx.supabase as unknown as SupabaseClient

  const { data: rows, error } = await db
    .from('standards')
    .select('id, name')
    .eq('organisation_id', orgId)
  if (error) {
    console.error('[listStandards] standards error', error)
    return { error: error.message }
  }
  const { data: uses, error: usesErr } = await db
    .from('standard_attachments')
    .select('standard_id')
    .eq('organisation_id', orgId)
  if (usesErr) {
    console.error('[listStandards] attachments error', usesErr)
    return { error: usesErr.message }
  }
  const counts = new Map<string, number>()
  for (const u of (uses ?? []) as Array<{ standard_id: string }>) {
    counts.set(u.standard_id, (counts.get(u.standard_id) ?? 0) + 1)
  }
  const standards = ((rows ?? []) as Array<{ id: string; name: string }>)
    .map((r) => ({ id: r.id, name: r.name, uses: counts.get(r.id) ?? 0 }))
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
  return { standards }
}

export async function createStandard(
  input: { name: string }
): Promise<{ standard: { id: string; name: string } } | { error: string }> {
  const ctx = await requireAdminContext()
  if ('error' in ctx) return { error: ctx.error }
  const orgId = ctx.organisationId
  if (!orgId) return { error: 'No organisation' }
  const db = ctx.supabase as unknown as SupabaseClient

  const parsed = createStandardSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const { data, error } = await db
    .from('standards')
    .insert({ organisation_id: orgId, name: parsed.data.name, created_by: ctx.user.id })
    .select('id, name')
    .single()
  if (error) {
    if (error.code === '23505') return { error: DUPLICATE }
    console.error('[createStandard] insert error', error)
    return { error: error.message }
  }
  return { standard: data as { id: string; name: string } }
}

export async function renameStandard(
  input: { standardId: string; name: string }
): Promise<{ standard: { id: string; name: string } } | { error: string }> {
  const ctx = await requireAdminContext()
  if ('error' in ctx) return { error: ctx.error }
  const orgId = ctx.organisationId
  if (!orgId) return { error: 'No organisation' }
  const db = ctx.supabase as unknown as SupabaseClient

  const parsed = renameStandardSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const { data, error } = await db
    .from('standards')
    .update({ name: parsed.data.name, updated_at: new Date().toISOString() })
    .eq('id', parsed.data.standardId)
    .eq('organisation_id', orgId)
    .select('id, name')
  if (error) {
    if (error.code === '23505') return { error: DUPLICATE }
    console.error('[renameStandard] update error', error)
    return { error: error.message }
  }
  const row = ((data ?? []) as Array<{ id: string; name: string }>)[0]
  if (!row) return { error: 'Standard not found' }
  return { standard: row }
}

export async function removeStandard(
  input: { standardId: string }
): Promise<{ removed: true; detached: number } | { error: string }> {
  const ctx = await requireAdminContext()
  if ('error' in ctx) return { error: ctx.error }
  const orgId = ctx.organisationId
  if (!orgId) return { error: 'No organisation' }
  const db = ctx.supabase as unknown as SupabaseClient

  const parsed = removeStandardSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const { standardId } = parsed.data

  const { count, error: countErr } = await db
    .from('standard_attachments')
    .select('id', { count: 'exact', head: true })
    .eq('standard_id', standardId)
    .eq('organisation_id', orgId)
  if (countErr) {
    console.error('[removeStandard] count error', countErr)
    return { error: countErr.message }
  }

  // Attachments go with the standard (composite FK, on delete cascade).
  const { data, error } = await db
    .from('standards')
    .delete()
    .eq('id', standardId)
    .eq('organisation_id', orgId)
    .select('id')
  if (error) {
    console.error('[removeStandard] delete error', error)
    return { error: error.message }
  }
  if (((data ?? []) as unknown[]).length === 0) return { error: 'Standard not found' }
  return { removed: true, detached: count ?? 0 }
}

export async function getSopStandardsPanel(sopId: string): Promise<StandardsPanel | { error: string }> {
  const ctx = await requireAdminContext()
  if ('error' in ctx) return { error: ctx.error }
  const orgId = ctx.organisationId
  if (!orgId) return { error: 'No organisation' }
  const db = ctx.supabase as unknown as SupabaseClient

  if (!z.string().uuid().safeParse(sopId).success) return { error: 'Invalid SOP id' }

  const { data: sopRow, error: sopErr } = await db
    .from('sops')
    .select('id')
    .eq('id', sopId)
    .eq('organisation_id', orgId)
    .maybeSingle()
  if (sopErr) {
    console.error('[getSopStandardsPanel] sop lookup error', sopErr)
    return { error: sopErr.message }
  }
  if (!sopRow) return { error: 'SOP not found in your organisation' }

  const { data: stdRows, error: stdErr } = await db
    .from('standards')
    .select('id, name')
    .eq('organisation_id', orgId)
  if (stdErr) {
    console.error('[getSopStandardsPanel] standards error', stdErr)
    return { error: stdErr.message }
  }

  // Sections are scoped through the SOP, which was just checked in the org.
  const { data: secRows, error: secErr } = await db
    .from('sop_sections')
    .select('id, title')
    .eq('sop_id', sopId)
    .order('sort_order', { ascending: true })
  if (secErr) {
    console.error('[getSopStandardsPanel] sections error', secErr)
    return { error: secErr.message }
  }
  const { data: stepRows, error: stepErr } = await db
    .from('sop_focus_steps')
    .select('id, section_id, kind, text')
    .eq('sop_id', sopId)
    .eq('organisation_id', orgId)
    .order('sort_order', { ascending: true })
  if (stepErr) {
    console.error('[getSopStandardsPanel] steps error', stepErr)
    return { error: stepErr.message }
  }

  const sections = (secRows ?? []) as Array<{ id: string; title: string }>
  const steps = (stepRows ?? []) as Array<{ id: string; section_id: string; kind: string; text: string }>

  const { data: attRows, error: attErr } = await db
    .from('standard_attachments')
    .select('standard_id, sop_id, section_id, focus_step_id')
    .eq('organisation_id', orgId)
    .or(
      [
        `sop_id.eq.${sopId}`,
        sections.length > 0 ? `section_id.in.(${sections.map((s) => s.id).join(',')})` : null,
        steps.length > 0 ? `focus_step_id.in.(${steps.map((s) => s.id).join(',')})` : null,
      ]
        .filter(Boolean)
        .join(',')
    )
  if (attErr) {
    console.error('[getSopStandardsPanel] attachments error', attErr)
    return { error: attErr.message }
  }

  const bySop: string[] = []
  const bySection = new Map<string, string[]>()
  const byStep = new Map<string, string[]>()
  const push = (m: Map<string, string[]>, k: string, v: string) => m.set(k, [...(m.get(k) ?? []), v])
  for (const a of (attRows ?? []) as Array<{
    standard_id: string
    sop_id: string | null
    section_id: string | null
    focus_step_id: string | null
  }>) {
    if (a.sop_id) bySop.push(a.standard_id)
    else if (a.section_id) push(bySection, a.section_id, a.standard_id)
    else if (a.focus_step_id) push(byStep, a.focus_step_id, a.standard_id)
  }

  return {
    standards: ((stdRows ?? []) as Array<{ id: string; name: string }>).sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    ),
    sopAttached: bySop,
    sections: sections.map((sec) => ({
      id: sec.id,
      title: sec.title,
      attached: bySection.get(sec.id) ?? [],
      steps: steps
        .filter((st) => st.section_id === sec.id)
        .map((st) => ({ id: st.id, kind: st.kind, text: st.text, attached: byStep.get(st.id) ?? [] })),
    })),
  }
}

export async function setStandardAttachment(
  input: { standardId: string; target: { kind: 'sop' | 'section' | 'step'; id: string }; attached: boolean }
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireAdminContext()
  if ('error' in ctx) return { error: ctx.error }
  const orgId = ctx.organisationId
  if (!orgId) return { error: 'No organisation' }
  const db = ctx.supabase as unknown as SupabaseClient

  const parsed = setStandardAttachmentSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const { standardId, target, attached } = parsed.data

  const { data: stdRow, error: stdErr } = await db
    .from('standards')
    .select('id')
    .eq('id', standardId)
    .eq('organisation_id', orgId)
    .maybeSingle()
  if (stdErr) {
    console.error('[setStandardAttachment] standard lookup error', stdErr)
    return { error: stdErr.message }
  }
  if (!stdRow) return { error: 'Standard not found' }

  // The target must be in the session org, whichever level it is.
  let sopIdToCheck: string | null = null
  if (target.kind === 'sop') {
    sopIdToCheck = target.id
  } else if (target.kind === 'section') {
    const { data: sec, error: secErr } = await db
      .from('sop_sections')
      .select('sop_id')
      .eq('id', target.id)
      .maybeSingle()
    if (secErr) {
      console.error('[setStandardAttachment] section lookup error', secErr)
      return { error: secErr.message }
    }
    if (!sec) return { error: 'Section not found in your organisation' }
    sopIdToCheck = (sec as { sop_id: string }).sop_id
  }
  if (sopIdToCheck) {
    const { data: sopRow, error: sopErr } = await db
      .from('sops')
      .select('id')
      .eq('id', sopIdToCheck)
      .eq('organisation_id', orgId)
      .maybeSingle()
    if (sopErr) {
      console.error('[setStandardAttachment] sop lookup error', sopErr)
      return { error: sopErr.message }
    }
    if (!sopRow) return { error: 'Not found in your organisation' }
  } else {
    const { data: stepRow, error: stepErr } = await db
      .from('sop_focus_steps')
      .select('id')
      .eq('id', target.id)
      .eq('organisation_id', orgId)
      .maybeSingle()
    if (stepErr) {
      console.error('[setStandardAttachment] step lookup error', stepErr)
      return { error: stepErr.message }
    }
    if (!stepRow) return { error: 'Step not found in your organisation' }
  }

  const column = target.kind === 'sop' ? 'sop_id' : target.kind === 'section' ? 'section_id' : 'focus_step_id'

  if (attached) {
    const { error } = await db.from('standard_attachments').insert({
      organisation_id: orgId,
      standard_id: standardId,
      [column]: target.id,
      created_by: ctx.user.id,
    })
    // Already attached is the state the admin asked for.
    if (error && error.code !== '23505') {
      console.error('[setStandardAttachment] insert error', error)
      return { error: error.message }
    }
    return { ok: true }
  }

  const { error } = await db
    .from('standard_attachments')
    .delete()
    .eq('standard_id', standardId)
    .eq(column, target.id)
    .eq('organisation_id', orgId)
  if (error) {
    console.error('[setStandardAttachment] delete error', error)
    return { error: error.message }
  }
  return { ok: true }
}
