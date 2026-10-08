/**
 * Phase 58 -- one read of a SOP as the focus screen needs it (page + getFocusSop).
 *
 * Plain module: no directive. The caller passes its own (session) client, so RLS
 * decides what is visible; nothing here uses the service role. Steps are read
 * straight from sop_focus_steps (D-01), with no mapping layer.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { FocusKind } from '@/lib/sop/focus'
import { userLabels } from '@/lib/members/labels'
import { setByWords, type ObjectiveView } from '@/lib/objectives/model'
import { lineageRoot } from '@/lib/sop/lineage-current'
import { assembleFocus, type AssembleAttachment } from '@/lib/sop/focus-assemble'

const SIGNED_TTL_SEC = 3600

/** The owner row in the editor's This SOP block; computed on the server for people who can edit. */
export interface EditorOwner {
  label: string | null
  canMarkReviewed: boolean
}

export interface FocusSopMeta {
  id: string
  title: string | null
  version: number
  status: 'uploading' | 'parsing' | 'draft' | 'published'
  parent_sop_id: string | null
  allow_forward_jump: boolean
  placement: 'machine' | 'site'
  source_type: string | null
  source_file_path: string | null
  category_slug: string | null
  owner_user_id: string | null
  review_due_at: string | null
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
  /** The SOP's objective, one row per lineage (A-01); null when none is set. */
  objective: ObjectiveView | null
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
    .select('id, title, version, status, parent_sop_id, allow_forward_jump, placement, source_type, source_file_path, category_slug, owner_user_id, review_due_at, organisation_id')
    .eq('id', sopId)
    .maybeSingle()
  if (!sop) return null
  const orgId = (sop as { organisation_id: string }).organisation_id

  const [secRes, stepRes, stdRes, attRes, macRes, objRes] = await Promise.all([
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
    db
      .from('objectives')
      .select('id, text, due_on, set_by_user, set_by_agent, set_at, confirmed_by')
      .eq('subject_type', 'sop')
      .eq('subject_id', lineageRoot(sop as { id: string; parent_sop_id: string | null }))
      .maybeSingle(),
  ])
  for (const r of [secRes, stepRes, stdRes, attRes, macRes, objRes] as Array<{ error: Err }>) {
    if (r.error) throw new Error(r.error.message)
  }

  // Ordering, standards grouping and minutes are shared with the home's Read view.
  const assembled = assembleFocus({
    sopId,
    sections: (secRes.data ?? []) as FocusSection[],
    steps: (stepRes.data ?? []) as Array<Omit<FocusStepRow, 'image_urls'>>,
    standards: (stdRes.data ?? []) as FocusStandard[],
    attachments: (attRes.data ?? []) as AssembleAttachment[],
  })
  const { sections, standards, totalMinutes } = assembled
  const rawSteps = assembled.steps

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

  const o =objRes.data as {
    id: string
    text: string
    due_on: string | null
    set_by_user: string | null
    set_by_agent: string | null
    set_at: string
    confirmed_by: string | null
  } | null
  const setter = o?.set_by_user ? (await userLabels([o.set_by_user])).get(o.set_by_user) : null
  // The SOP surfaces never show an email, so the viewer role is null here.
  const objective: ObjectiveView | null = o
    ? {
        id: o.id,
        subjectType: 'sop',
        subjectId: lineageRoot(sop as { id: string; parent_sop_id: string | null }),
        text: o.text,
        dueOn: o.due_on,
        setByLabel: o.set_by_user ? setByWords(setter, null) : null,
        setByAgent: o.set_by_agent,
        confirmed: o.confirmed_by !== null || o.set_by_user !== null,
        setAt: o.set_at,
      }
    : null

  const { organisation_id: _org, ...meta } = sop as FocusSopMeta & { organisation_id: string }
  void _org
  return { sop: meta, objective, sections, steps, standards, machines, totalMinutes }
}
