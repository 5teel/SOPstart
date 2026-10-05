/**
 * Phase 59 (A-09, F-05): the privileged half of the completion review read.
 * A plain module -- never a server action -- so the service-role client stays out of
 * src/actions (CLAUDE.md 2026-10-04). Callers hand it rows they already read through
 * the session client; it never looks a completion up by an id it was given.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSignedOffAssessor } from '@/lib/competency/assessor'

export type ReviewPhotoRow = { id: string; step_id: string; storage_path: string; content_type: string }
export type SignedReviewPhoto = { id: string; step_id: string; content_type: string; signed_url: string }

/**
 * Signs storage paths for the photo rows the caller got back from an RLS-scoped read.
 * Anything not under `<session org>/completions/` is dropped, so even a poisoned row
 * cannot make this sign another organisation's object.
 */
export async function signCompletionPhotos(
  photos: ReviewPhotoRow[],
  organisationId: string,
): Promise<SignedReviewPhoto[]> {
  const prefix = `${organisationId}/completions/`
  const own = photos.filter((p) => p.storage_path.startsWith(prefix) && !p.storage_path.includes('..'))
  if (own.length === 0) return []
  const storage = createAdminClient().storage.from('completion-photos')
  const signed = await Promise.all(
    own.map(async (p) => {
      const { data } = await storage.createSignedUrl(p.storage_path, 3600)
      return data?.signedUrl
        ? { id: p.id, step_id: p.step_id, content_type: p.content_type, signed_url: data.signedUrl }
        : null
    }),
  )
  return signed.filter((p): p is SignedReviewPhoto => p !== null)
}

export type ReviewStepKind = 'hazard' | 'ppe' | 'step' | 'check'
export type OrderedReviewStep = {
  id: string
  step_number: number
  text: string
  kind: ReviewStepKind
  sectionTitle: string | null
}

/**
 * Section order, then step order within the section, numbered sequentially (step_number
 * restarts in every section). Focus steps first (walks recorded after the Phase 58
 * cutover); the old step table only for keys that are not focus steps. Filtered by the
 * SESSION organisation, never a row's own.
 */
export async function orderedReviewSteps(
  supabase: SupabaseClient,
  args: { sopId: string; organisationId: string; stepData: Record<string, unknown> },
): Promise<OrderedReviewStep[]> {
  const { sopId, organisationId, stepData } = args
  const [{ data: sections }, { data: focusRows }] = await Promise.all([
    supabase
      .from('sop_sections')
      .select('id, sort_order, title, sop_steps ( id, step_number, text )')
      .eq('sop_id', sopId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('sop_focus_steps')
      .select('id, section_id, sort_order, text, kind')
      .eq('organisation_id', organisationId)
      .eq('sop_id', sopId)
      .order('sort_order', { ascending: true }),
  ])

  type RawSection = {
    id: string
    sort_order: number
    title: string | null
    sop_steps: { id: string; step_number: number; text: string }[] | null
  }
  const rawSections = (sections ?? []) as unknown as RawSection[]
  const sectionOrder = new Map(rawSections.map((sec) => [sec.id, sec.sort_order]))
  const sectionTitle = new Map(rawSections.map((sec) => [sec.id, sec.title]))

  const oldSteps = rawSections.flatMap((sec) =>
    [...(sec.sop_steps ?? [])]
      .sort((a, b) => a.step_number - b.step_number)
      .map((o) => ({ id: o.id, text: o.text, kind: 'step' as ReviewStepKind, sectionTitle: sec.title ?? null })),
  )
  const focusSteps = [
    ...((focusRows ?? []) as Array<{ id: string; section_id: string; sort_order: number; text: string; kind: ReviewStepKind }>),
  ]
    .sort((a, b) => (sectionOrder.get(a.section_id) ?? 0) - (sectionOrder.get(b.section_id) ?? 0) || a.sort_order - b.sort_order)
    .map((f) => ({ id: f.id, text: f.text, kind: f.kind, sectionTitle: sectionTitle.get(f.section_id) ?? null }))

  const keys = Object.keys(stepData ?? {})
  const focusIds = new Set(focusSteps.map((f) => f.id))
  const walkedOnFocusSteps = focusSteps.length > 0 && (keys.length === 0 || keys.some((k) => focusIds.has(k)))
  const ordered = walkedOnFocusSteps
    ? [...focusSteps, ...oldSteps.filter((o) => keys.includes(o.id) && !focusIds.has(o.id))]
    : oldSteps
  return ordered.map((st, i) => ({ ...st, step_number: i + 1 }))
}

/** Is `userId` a signed-off assessor on this SOP? Predicate read only; `organisationId` is the session org. */
export async function assessorFor(userId: string, sopId: string, organisationId: string): Promise<boolean> {
  return isSignedOffAssessor(userId, sopId, createAdminClient(), organisationId)
}
