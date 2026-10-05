/**
 * Phase 58 -- one read of a SOP as the focus screen needs it (page + getFocusSop).
 *
 * Plain module: no directive. The caller passes its own (session) client, so RLS
 * decides what is visible; nothing here uses the service role. Steps are read
 * straight from sop_focus_steps (D-01), with no mapping layer.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { FocusKind } from '@/lib/sop/focus'

const SIGNED_TTL_SEC = 3600

export interface FocusSopMeta {
  id: string
  title: string | null
  version: number
  status: 'uploading' | 'parsing' | 'draft' | 'published'
  parent_sop_id: string | null
  objective: string | null
  allow_forward_jump: boolean
  placement: 'machine' | 'site'
  source_type: string | null
  source_file_path: string | null
}

export interface FocusSection {
  id: string
  title: string
  sort_order: number
}

export interface FocusStepRow {
  id: string
  section_id: string
  kind: FocusKind
  text: string
  tip: string | null
  photo_required: boolean
  image_paths: string[]
  /** Signed URLs, same order as image_paths (an unsignable path is dropped from both views' urls). */
  image_urls: Array<{ path: string; url: string }>
  required_tools: string[] | null
  time_estimate_minutes: number | null
  sort_order: number
  verified_by_admin_id: string | null
  verified_at: string | null
  needs_recheck: boolean
}

export interface FocusStandard {
  id: string
  name: string
}

export interface FocusSop {
  sop: FocusSopMeta
  sections: FocusSection[]
  steps: FocusStepRow[]
  /** Names of standards per target, keyed by sop id / section id / step id. */
  standards: { sop: FocusStandard[]; sections: Record<string, FocusStandard[]>; steps: Record<string, FocusStandard[]> }
  machines: Array<{ id: string; name: string; department: string | null }>
  totalMinutes: number
}

type Err = { message: string } | null

export async function loadFocusSop(client: SupabaseClient, sopId: string): Promise<FocusSop | null> {
  const db = client
  const { data: sop } = await db
    .from('sops')
    .select('id, title, version, status, parent_sop_id, objective, allow_forward_jump, placement, source_type, source_file_path, organisation_id')
    .eq('id', sopId)
    .maybeSingle()
  if (!sop) return null
  const orgId = (sop as { organisation_id: string }).organisation_id

  const [secRes, stepRes, stdRes, attRes, macRes] = await Promise.all([
    db.from('sop_sections').select('id, title, sort_order').eq('sop_id', sopId).order('sort_order', { ascending: true }),
    db
      .from('sop_focus_steps')
      .select(
        'id, section_id, kind, text, tip, photo_required, image_paths, required_tools, time_estimate_minutes, sort_order, verified_by_admin_id, verified_at, needs_recheck'
      )
      .eq('sop_id', sopId)
      .order('sort_order', { ascending: true }),
    db.from('standards').select('id, name').eq('organisation_id', orgId),
    db.from('standard_attachments').select('standard_id, sop_id, section_id, focus_step_id').eq('organisation_id', orgId),
    db.from('sop_machines').select('machine_id').eq('sop_id', sopId),
  ])
  for (const r of [secRes, stepRes, stdRes, attRes, macRes] as Array<{ error: Err }>) {
    if (r.error) throw new Error(r.error.message)
  }

  const sections = (secRes.data ?? []) as FocusSection[]
  const rawSteps = (stepRes.data ?? []) as Array<Omit<FocusStepRow, 'image_urls'>>

  // Group by section order first, then step order, so the editor and the walk agree.
  const sectionRank = new Map(sections.map((s, i) => [s.id, i]))
  rawSteps.sort(
    (a, b) =>
      (sectionRank.get(a.section_id) ?? 0) - (sectionRank.get(b.section_id) ?? 0) || a.sort_order - b.sort_order
  )

  // One batched signing call for every image on every step.
  const allPaths = [...new Set(rawSteps.flatMap((s) => s.image_paths ?? []))]
  const signed = new Map<string, string>()
  if (allPaths.length > 0) {
    const { data } = await db.storage.from('sop-images').createSignedUrls(allPaths, SIGNED_TTL_SEC)
    for (const row of (data ?? []) as Array<{ path: string | null; signedUrl: string | null }>) {
      if (row.path && row.signedUrl) signed.set(row.path, row.signedUrl)
    }
  }
  const steps: FocusStepRow[] = rawSteps.map((s) => ({
    ...s,
    image_paths: s.image_paths ?? [],
    image_urls: (s.image_paths ?? []).flatMap((p) => (signed.has(p) ? [{ path: p, url: signed.get(p)! }] : [])),
  }))

  const names = new Map(((stdRes.data ?? []) as FocusStandard[]).map((s) => [s.id, s]))
  const stepIds = new Set(steps.map((s) => s.id))
  const sectionIds = new Set(sections.map((s) => s.id))
  const standards: FocusSop['standards'] = { sop: [], sections: {}, steps: {} }
  const push = (map: Record<string, FocusStandard[]>, key: string, std: FocusStandard) => {
    ;(map[key] ??= []).push(std)
  }
  for (const a of (attRes.data ?? []) as Array<{
    standard_id: string
    sop_id: string | null
    section_id: string | null
    focus_step_id: string | null
  }>) {
    const std = names.get(a.standard_id)
    if (!std) continue
    if (a.sop_id === sopId) standards.sop.push(std)
    else if (a.section_id && sectionIds.has(a.section_id)) push(standards.sections, a.section_id, std)
    else if (a.focus_step_id && stepIds.has(a.focus_step_id)) push(standards.steps, a.focus_step_id, std)
  }

  const machineIds = ((macRes.data ?? []) as Array<{ machine_id: string }>).map((m) => m.machine_id)
  let machines: FocusSop['machines'] = []
  if (machineIds.length > 0) {
    const { data } = await db
      .from('site_machines')
      .select('id, name, departments ( name )')
      .in('id', machineIds)
      .eq('organisation_id', orgId)
    machines = ((data ?? []) as unknown as Array<{ id: string; name: string; departments: { name: string } | null }>).map((m) => ({
      id: m.id,
      name: m.name,
      department: m.departments?.name ?? null,
    }))
  }

  const totalMinutes = steps.reduce((sum, s) => sum + (Number(s.time_estimate_minutes) || 0), 0)

  const { organisation_id: _org, ...meta } = sop as FocusSopMeta & { organisation_id: string }
  void _org
  return { sop: meta, sections, steps, standards, machines, totalMinutes }
}
