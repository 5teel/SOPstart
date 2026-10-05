/**
 * Turns a SOP's freshly inserted sections + step rows into focus steps
 * (Phase 58, D-19). Every on-ramp (upload, AI prompt, video, restructure)
 * calls this after it has inserted sop_sections / sop_steps / sop_images and
 * BEFORE it marks the parse job completed.
 *
 * Plain module: the caller hands in its service-role client and the session
 * organisation. Native steps get a 'new:' source_key so the converter script
 * (which only touches keys it can regenerate) never overwrites them (D-23).
 * Writes only; it never removes a row.
 */
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { checkGate, convertSop } from '@/lib/sop/convert'
import type { Section } from '@/lib/sop/sections'

const SECTION_SELECT = '*, section_kind:section_kinds!section_kind_id ( * ), sop_steps ( * ), sop_images ( * )'
const CHUNK = 500

export const FOCUS_WRITE_FAILED = "We couldn't turn this into steps."

export async function writeFocusStepsForSop(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, any, any>,
  { organisationId, sopId }: { organisationId: string; sopId: string },
): Promise<{ count: number } | { error: string }> {
  // sop_sections / sop_images carry no organisation_id: pin the SOP to the org once, up front.
  const { data: sop } = await admin
    .from('sops')
    .select('id')
    .eq('id', sopId)
    .eq('organisation_id', organisationId)
    .maybeSingle()
  if (!sop) return { error: FOCUS_WRITE_FAILED }

  const [secs, imgs] = await Promise.all([
    admin
      .from('sop_sections')
      .select(SECTION_SELECT)
      .eq('sop_id', sopId)
      .order('sort_order'),
    admin.from('sop_images').select('storage_path').eq('sop_id', sopId),
  ])
  if (secs.error || imgs.error) return { error: FOCUS_WRITE_FAILED }

  const c = convertSop({
    sopId,
    sections: (secs.data ?? []) as unknown as Section[],
    sopImagePaths: (imgs.data ?? []).map((i: { storage_path: string }) => i.storage_path),
  })
  // A hazard/PPE loss or an empty result is never written quietly (T-58-15).
  if (!checkGate(c.before, c.after, c.steps).ok || c.steps.length === 0) {
    return { error: FOCUS_WRITE_FAILED }
  }

  const rows = c.steps.map((d) => ({
    organisation_id: organisationId,
    sop_id: sopId,
    section_id: d.sectionId,
    kind: d.kind,
    text: d.text,
    tip: d.tip,
    photo_required: d.photoRequired,
    image_paths: d.imagePaths,
    required_tools: d.requiredTools,
    time_estimate_minutes: d.timeEstimateMinutes,
    sort_order: d.sortOrder,
    source_key: `new:${randomUUID()}`,
    run_id: null,
  }))
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await admin.from('sop_focus_steps').insert(rows.slice(i, i + CHUNK))
    if (error) return { error: FOCUS_WRITE_FAILED }
  }
  return { count: rows.length }
}
