'use server'

/**
 * Phase 58 (58-04, FOC-02, WRK-04) -- the focus editor's server surface over
 * sop_focus_steps: step and section edits, the per-step tick, the objective, the
 * jump-ahead flag and step images.
 *
 * sop_focus_steps has no authenticated write policy (00069/00071), so every write
 * here is a service-role write and THIS file is the only org gate. Rules:
 *  - The SOP is resolved by the guard (requireSopEditAccess or, for the decisions
 *    only an admin may make, requireAdminContext + a session-org step lookup).
 *    No schema takes an organisation, user or agent field (CLAUDE.md 2026-09-30).
 *  - Every write is filtered by the SESSION organisation and the resolved SOP,
 *    never by a value read off a fetched row (CLAUDE.md 2026-07-28).
 *  - Content changes are draft-only (editableSop): a published SOP changes through
 *    the next version's draft, a SOP still parsing is owned by the parser.
 *  - Ticking and untick are decisions: each writes one ledger row AFTER the write.
 *
 * Async exports only (CLAUDE.md 2026-06-27).
 */
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { requireAdminContext, requireSopEditAccess } from '@/lib/auth/guards'
import { recordDecision } from '@/lib/decisions/record'
import { loadFocusSop, type FocusSop } from '@/lib/sop/focus-read'
import { editableSop } from '@/lib/sop/editable'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'

const uuid = z.string().uuid()
const KINDS = ['hazard', 'ppe', 'step', 'check'] as const
type Kind = (typeof KINDS)[number]
const BAD = 'Invalid input'

type Fail = { error: string }
type Ok = { ok: true }

const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? BAD

/** Give every row in `orderedIds` sort_order = position + 1; only rows that differ are written. */
async function renumber(
  organisationId: string,
  sopId: string,
  orderedIds: string[],
  current: Map<string, number>
): Promise<string | null> {
  const admin = createAdminClient()
  const writes = orderedIds.flatMap((id, i) =>
    current.get(id) === i + 1
      ? []
      : [
          admin
            .from('sop_focus_steps')
            .update({ sort_order: i + 1 })
            .eq('id', id)
            .eq('organisation_id', organisationId)
            .eq('sop_id', sopId),
        ]
  )
  const results = await Promise.all(writes)
  const failed = results.find((r) => r.error)
  return failed?.error ? failed.error.message : null
}

/** The steps of one section in walk order, as id -> current sort_order plus the ordered ids. */
async function sectionSteps(organisationId: string, sopId: string, sectionId: string) {
  const { data, error } = await createAdminClient()
    .from('sop_focus_steps')
    .select('id, sort_order')
    .eq('organisation_id', organisationId)
    .eq('sop_id', sopId)
    .eq('section_id', sectionId)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })
  if (error) return { error: error.message } as Fail
  const rows = (data ?? []) as Array<{ id: string; sort_order: number }>
  return { ids: rows.map((r) => r.id), current: new Map(rows.map((r) => [r.id, r.sort_order])) }
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getFocusSop(sopId: string): Promise<{ focus: FocusSop } | Fail> {
  const id = uuid.safeParse(sopId)
  if (!id.success) return { error: 'Invalid SOP id' }
  const ctx = await requireSopEditAccess({ sopId: id.data })
  if ('error' in ctx) return { error: ctx.error }
  const focus = await loadFocusSop(ctx.supabase as unknown as SupabaseClient, ctx.sopId)
  if (!focus) return { error: 'SOP not found in your organisation.' }
  return { focus }
}

// ---------------------------------------------------------------------------
// Step and section edits (drafts only)
// ---------------------------------------------------------------------------

const updateStepSchema = z.object({
  stepId: uuid,
  patch: z
    .object({
      text: z.string().trim().min(1, 'A step needs some words').max(2000, 'Keep a step under 2000 characters').optional(),
      kind: z.enum(KINDS).optional(),
      tip: z.string().trim().max(1000, 'Keep a tip under 1000 characters').nullable().optional(),
      photoRequired: z.boolean().optional(),
    })
    .strict(),
})

export async function updateFocusStep(input: {
  stepId: string
  patch: { text?: string; kind?: Kind; tip?: string | null; photoRequired?: boolean }
}): Promise<Ok | Fail> {
  const parsed = updateStepSchema.safeParse(input)
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  const { stepId, patch } = parsed.data

  const ctx = await requireSopEditAccess({ stepId })
  if ('error' in ctx) return { error: ctx.error }
  const open = await editableSop(ctx.organisationId, ctx.sopId)
  if ('error' in open) return open

  const row: Record<string, unknown> = {}
  if (patch.text !== undefined) row.text = patch.text
  if (patch.kind !== undefined) row.kind = patch.kind
  if (patch.tip !== undefined) row.tip = patch.tip === null || patch.tip === '' ? null : patch.tip
  if (patch.photoRequired !== undefined) row.photo_required = patch.photoRequired
  if (Object.keys(row).length === 0) return { ok: true }

  const { data, error } = await createAdminClient()
    .from('sop_focus_steps')
    .update(row)
    .eq('id', stepId)
    .eq('organisation_id', ctx.organisationId)
    .eq('sop_id', ctx.sopId)
    .select('id')
  if (error) {
    console.error('[updateFocusStep] update error', error)
    return { error: error.message }
  }
  if (!data || data.length === 0) return { error: 'Step not found.' }
  return { ok: true }
}

const addStepSchema = z.object({
  sectionId: uuid,
  afterStepId: uuid.optional(),
  kind: z.enum(KINDS).optional(),
})

export async function addFocusStep(input: {
  sectionId: string
  afterStepId?: string
  kind?: Kind
}): Promise<{ stepId: string } | Fail> {
  const parsed = addStepSchema.safeParse(input)
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  const { sectionId, afterStepId, kind } = parsed.data

  const ctx = await requireSopEditAccess({ sectionId })
  if ('error' in ctx) return { error: ctx.error }
  const open = await editableSop(ctx.organisationId, ctx.sopId)
  if ('error' in open) return open

  const siblings = await sectionSteps(ctx.organisationId, ctx.sopId, sectionId)
  if ('error' in siblings) return siblings
  let at = siblings.ids.length
  if (afterStepId) {
    const i = siblings.ids.indexOf(afterStepId)
    if (i === -1) return { error: 'Step not found in this section.' }
    at = i + 1
  }

  const { data, error } = await createAdminClient()
    .from('sop_focus_steps')
    .insert({
      organisation_id: ctx.organisationId,
      sop_id: ctx.sopId,
      section_id: sectionId,
      kind: kind ?? 'step',
      text: '',
      sort_order: at + 1,
    })
    .select('id')
    .single()
  if (error || !data) {
    console.error('[addFocusStep] insert error', error)
    return { error: error?.message ?? 'Could not add the step.' }
  }
  const stepId = (data as { id: string }).id

  // Steps after the new one move down a place.
  const final = [...siblings.ids]
  final.splice(at, 0, stepId)
  const current = new Map(siblings.current)
  current.set(stepId, at + 1)
  const failed = await renumber(ctx.organisationId, ctx.sopId, final, current)
  if (failed) return { error: failed }
  return { stepId }
}

export async function deleteFocusStep(input: { stepId: string }): Promise<Ok | Fail> {
  const parsed = z.object({ stepId: uuid }).safeParse(input)
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  const { stepId } = parsed.data

  const ctx = await requireSopEditAccess({ stepId })
  if ('error' in ctx) return { error: ctx.error }
  const open = await editableSop(ctx.organisationId, ctx.sopId)
  if ('error' in open) return open

  const { error } = await createAdminClient()
    .from('sop_focus_steps')
    .delete()
    .eq('id', stepId)
    .eq('organisation_id', ctx.organisationId)
    .eq('sop_id', ctx.sopId)
  if (error) {
    console.error('[deleteFocusStep] delete error', error)
    return { error: error.message }
  }
  return { ok: true }
}

export async function moveFocusStep(input: { stepId: string; direction: 'up' | 'down' }): Promise<Ok | Fail> {
  const parsed = z.object({ stepId: uuid, direction: z.enum(['up', 'down']) }).safeParse(input)
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  const { stepId, direction } = parsed.data

  const ctx = await requireSopEditAccess({ stepId })
  if ('error' in ctx) return { error: ctx.error }
  const open = await editableSop(ctx.organisationId, ctx.sopId)
  if ('error' in open) return open

  const { data: step } = await createAdminClient()
    .from('sop_focus_steps')
    .select('section_id')
    .eq('id', stepId)
    .eq('organisation_id', ctx.organisationId)
    .eq('sop_id', ctx.sopId)
    .maybeSingle()
  if (!step) return { error: 'Step not found.' }

  const siblings = await sectionSteps(ctx.organisationId, ctx.sopId, (step as { section_id: string }).section_id)
  if ('error' in siblings) return siblings
  const i = siblings.ids.indexOf(stepId)
  const j = direction === 'up' ? i - 1 : i + 1
  if (i === -1 || j < 0 || j >= siblings.ids.length) return { ok: true }

  const final = [...siblings.ids]
  ;[final[i], final[j]] = [final[j], final[i]]
  const failed = await renumber(ctx.organisationId, ctx.sopId, final, siblings.current)
  return failed ? { error: failed } : { ok: true }
}

export async function deleteFocusSection(input: { sectionId: string }): Promise<Ok | Fail> {
  const parsed = z.object({ sectionId: uuid }).safeParse(input)
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  const { sectionId } = parsed.data

  const ctx = await requireSopEditAccess({ sectionId })
  if ('error' in ctx) return { error: ctx.error }
  const open = await editableSop(ctx.organisationId, ctx.sopId)
  if ('error' in open) return open

  // sop_sections carries no organisation column; the guard already proved the SOP
  // is in the session organisation, so the write is pinned to that SOP. Its steps,
  // standard attachments and findings go with it through the foreign keys.
  const { error } = await createAdminClient()
    .from('sop_sections')
    .delete()
    .eq('id', sectionId)
    .eq('sop_id', ctx.sopId)
  if (error) {
    console.error('[deleteFocusSection] delete error', error)
    return { error: error.message }
  }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// The tick (admin / safety manager only; a decision, so one ledger row each)
// ---------------------------------------------------------------------------

async function stepSopId(organisationId: string, stepId: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .from('sop_focus_steps')
    .select('sop_id')
    .eq('id', stepId)
    .eq('organisation_id', organisationId)
    .maybeSingle()
  return (data as { sop_id: string } | null)?.sop_id ?? null
}

export async function tickFocusStep(input: { stepId: string }): Promise<Ok | Fail> {
  const parsed = z.object({ stepId: uuid }).safeParse(input)
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  const { stepId } = parsed.data

  const ctx = await requireAdminContext()
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.organisationId) return { error: 'No organisation found' }
  const sopId = await stepSopId(ctx.organisationId, stepId)
  if (!sopId) return { error: 'Step not found.' }
  const open = await editableSop(ctx.organisationId, sopId)
  if ('error' in open) return open

  const { data, error } = await createAdminClient()
    .from('sop_focus_steps')
    .update({ verified_by_admin_id: ctx.user.id, verified_at: new Date().toISOString(), needs_recheck: false })
    .eq('id', stepId)
    .eq('organisation_id', ctx.organisationId)
    .eq('sop_id', sopId)
    .select('id')
  if (error) {
    console.error('[tickFocusStep] update error', error)
    return { error: error.message }
  }
  if (!data || data.length === 0) return { error: 'Step not found.' }

  await recordDecision({
    kind: 'verify',
    subject: { kind: 'focus_step', id: stepId },
    sopId,
    summary: 'Checked a step before publishing',
  })
  return { ok: true }
}

export async function untickFocusStep(input: { stepId: string }): Promise<Ok | Fail> {
  const parsed = z.object({ stepId: uuid }).safeParse(input)
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  const { stepId } = parsed.data

  const ctx = await requireAdminContext()
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.organisationId) return { error: 'No organisation found' }
  const sopId = await stepSopId(ctx.organisationId, stepId)
  if (!sopId) return { error: 'Step not found.' }
  const open = await editableSop(ctx.organisationId, sopId)
  if ('error' in open) return open

  const { data, error } = await createAdminClient()
    .from('sop_focus_steps')
    .update({ verified_by_admin_id: null, verified_at: null })
    .eq('id', stepId)
    .eq('organisation_id', ctx.organisationId)
    .eq('sop_id', sopId)
    .select('id')
  if (error) {
    console.error('[untickFocusStep] update error', error)
    return { error: error.message }
  }
  if (!data || data.length === 0) return { error: 'Step not found.' }

  await recordDecision({
    kind: 'verify_withdrawn',
    subject: { kind: 'focus_step', id: stepId },
    sopId,
    summary: 'Took back a step check',
  })
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Objective and jump-ahead (drafts only; the flag travels with the next version)
// ---------------------------------------------------------------------------

const objectiveSchema = z.object({
  sopId: uuid,
  objective: z.string().trim().max(500, 'Keep the objective under 500 characters'),
})

export async function setSopObjective(input: { sopId: string; objective: string }): Promise<Ok | Fail> {
  const parsed = objectiveSchema.safeParse(input)
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const ctx = await requireSopEditAccess({ sopId: parsed.data.sopId })
  if ('error' in ctx) return { error: ctx.error }
  const open = await editableSop(ctx.organisationId, ctx.sopId)
  if ('error' in open) return open

  const { error } = await createAdminClient()
    .from('sops')
    .update({ objective: parsed.data.objective === '' ? null : parsed.data.objective })
    .eq('id', ctx.sopId)
    .eq('organisation_id', ctx.organisationId)
  if (error) {
    console.error('[setSopObjective] update error', error)
    return { error: error.message }
  }
  return { ok: true }
}

export async function setAllowForwardJump(input: { sopId: string; allow: boolean }): Promise<Ok | Fail> {
  const parsed = z.object({ sopId: uuid, allow: z.boolean() }).safeParse(input)
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const ctx = await requireAdminContext()
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.organisationId) return { error: 'No organisation found' }
  const open = await editableSop(ctx.organisationId, parsed.data.sopId)
  if ('error' in open) return open

  const { error } = await createAdminClient()
    .from('sops')
    .update({ allow_forward_jump: parsed.data.allow })
    .eq('id', parsed.data.sopId)
    .eq('organisation_id', ctx.organisationId)
  if (error) {
    console.error('[setAllowForwardJump] update error', error)
    return { error: error.message }
  }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Step images (D-03): upload to a server-chosen path, attach, remove
// ---------------------------------------------------------------------------

const IMAGE_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png)$/i
const BUCKET = 'sop-images'

export async function getStepImageUploadUrl(input: {
  stepId: string
  contentType: 'image/jpeg' | 'image/png'
}): Promise<{ uploadUrl: string; storagePath: string } | Fail> {
  const parsed = z.object({ stepId: uuid, contentType: z.enum(['image/jpeg', 'image/png']) }).safeParse(input)
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  const { stepId, contentType } = parsed.data

  const ctx = await requireSopEditAccess({ stepId })
  if ('error' in ctx) return { error: ctx.error }
  const open = await editableSop(ctx.organisationId, ctx.sopId)
  if ('error' in open) return open

  const storagePath = `${ctx.organisationId}/${ctx.sopId}/steps/${stepId}/${randomUUID()}.${contentType === 'image/png' ? 'png' : 'jpg'}`
  const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUploadUrl(storagePath)
  if (error || !data) {
    console.error('[getStepImageUploadUrl] error', error)
    return { error: 'Failed to generate upload URL.' }
  }
  return { uploadUrl: data.signedUrl, storagePath }
}

export async function attachStepImage(input: { stepId: string; storagePath: string }): Promise<Ok | Fail> {
  const parsed = z.object({ stepId: uuid, storagePath: z.string().max(300) }).safeParse(input)
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  const { stepId, storagePath } = parsed.data

  const ctx = await requireSopEditAccess({ stepId })
  if ('error' in ctx) return { error: ctx.error }
  const open = await editableSop(ctx.organisationId, ctx.sopId)
  if ('error' in open) return open

  // The only path this step may hold is one this server handed out: session org,
  // resolved SOP, this step, a UUID file name, jpg or png.
  const dir = `${ctx.organisationId}/${ctx.sopId}/steps/${stepId}`
  const file = storagePath.startsWith(`${dir}/`) ? storagePath.slice(dir.length + 1) : ''
  if (!IMAGE_FILE.test(file)) return { error: 'That photo path is not valid.' }

  const admin = createAdminClient()
  const { data: listed } = await admin.storage.from(BUCKET).list(dir, { search: file })
  if (!(listed ?? []).some((o) => o.name === file)) return { error: 'The photo did not finish uploading.' }

  const { data: step } = await admin
    .from('sop_focus_steps')
    .select('image_paths, section_id')
    .eq('id', stepId)
    .eq('organisation_id', ctx.organisationId)
    .eq('sop_id', ctx.sopId)
    .maybeSingle()
  if (!step) return { error: 'Step not found.' }
  const { image_paths, section_id } = step as { image_paths: string[]; section_id: string }
  if (image_paths.includes(storagePath)) return { ok: true }

  // The image row first: a step's image_paths only ever holds a path that exists
  // as a sop_images row for this SOP (56 A-06).
  const { data: imgRow, error: imgErr } = await admin
    .from('sop_images')
    .insert({
      sop_id: ctx.sopId,
      section_id,
      storage_path: storagePath,
      content_type: file.endsWith('.png') ? 'image/png' : 'image/jpeg',
      sort_order: image_paths.length,
    })
    .select('id')
    .single()
  if (imgErr || !imgRow) {
    console.error('[attachStepImage] image row error', imgErr)
    return { error: imgErr?.message ?? 'Could not save the photo.' }
  }

  const { error } = await admin
    .from('sop_focus_steps')
    .update({ image_paths: [...image_paths, storagePath] })
    .eq('id', stepId)
    .eq('organisation_id', ctx.organisationId)
    .eq('sop_id', ctx.sopId)
  if (error) {
    console.error('[attachStepImage] step update error', error)
    await admin.from('sop_images').delete().eq('id', (imgRow as { id: string }).id).eq('sop_id', ctx.sopId)
    return { error: error.message }
  }
  return { ok: true }
}

export async function removeStepImage(input: { stepId: string; storagePath: string }): Promise<Ok | Fail> {
  const parsed = z.object({ stepId: uuid, storagePath: z.string().max(300) }).safeParse(input)
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  const { stepId, storagePath } = parsed.data

  const ctx = await requireSopEditAccess({ stepId })
  if ('error' in ctx) return { error: ctx.error }
  const open = await editableSop(ctx.organisationId, ctx.sopId)
  if ('error' in open) return open

  const admin = createAdminClient()
  const { data: step } = await admin
    .from('sop_focus_steps')
    .select('image_paths')
    .eq('id', stepId)
    .eq('organisation_id', ctx.organisationId)
    .eq('sop_id', ctx.sopId)
    .maybeSingle()
  if (!step) return { error: 'Step not found.' }
  const paths = (step as { image_paths: string[] }).image_paths
  if (!paths.includes(storagePath)) return { error: 'That photo is not on this step.' }

  const { data: marked } = await admin
    .from('sop_image_annotations')
    .select('sop_image_id')
    .eq('organisation_id', ctx.organisationId)
    .eq('baked_storage_path', storagePath)
    .maybeSingle()

  const { error } = await admin
    .from('sop_focus_steps')
    .update({ image_paths: paths.filter((p) => p !== storagePath) })
    .eq('id', stepId)
    .eq('organisation_id', ctx.organisationId)
    .eq('sop_id', ctx.sopId)
  if (error) {
    console.error('[removeStepImage] step update error', error)
    return { error: error.message }
  }

  // The file and its image row go only when this editor uploaded them for this
  // step; a path the parser or another step still points at is just unlinked.
  if (storagePath.startsWith(`${ctx.organisationId}/${ctx.sopId}/steps/${stepId}/`)) {
    await admin.from('sop_images').delete().eq('sop_id', ctx.sopId).eq('storage_path', storagePath)
    await admin.storage.from(BUCKET).remove([storagePath])
  }
  // An annotated photo takes its marks with it: the original goes too (its image row
  // cascades the annotation) when this editor uploaded it, else only the marks go.
  const markedImageId = (marked as { sop_image_id: string } | null)?.sop_image_id
  if (markedImageId) {
    const { data: orig } = await admin.from('sop_images').select('storage_path').eq('id', markedImageId).eq('sop_id', ctx.sopId).maybeSingle()
    const origPath = (orig as { storage_path: string } | null)?.storage_path
    if (origPath?.startsWith(`${ctx.organisationId}/${ctx.sopId}/steps/${stepId}/`)) {
      await admin.from('sop_images').delete().eq('id', markedImageId).eq('sop_id', ctx.sopId)
      await admin.storage.from(BUCKET).remove([origPath])
    } else {
      await admin.from('sop_image_annotations').delete().eq('sop_image_id', markedImageId).eq('organisation_id', ctx.organisationId)
    }
  }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Annotation (D-03, optional wave 58-17): marks on a step photo, baked into the image
// ---------------------------------------------------------------------------

const ink = z.string().max(40)
const pts = z.array(z.number()).max(4000)
const sid = z.string().max(40)
const px = z.number().min(-20000).max(20000)
// Element-count and size caps keep one save from carrying an unbounded scene (T-58-26).
const sceneSchema = z.object({
  schemaVersion: z.literal(1),
  width: z.number().int().min(1).max(8000),
  height: z.number().int().min(1).max(8000),
  shapes: z
    .array(
      z.discriminatedUnion('type', [
        z.object({ id: sid, type: z.literal('Arrow'), points: pts, stroke: ink, strokeWidth: px, pointerLength: px, pointerWidth: px, tension: px }),
        z.object({ id: sid, type: z.literal('Rect'), x: px, y: px, width: px, height: px, stroke: ink, strokeWidth: px, dash: pts.optional() }),
        z.object({ id: sid, type: z.literal('Ellipse'), x: px, y: px, radiusX: px, radiusY: px, stroke: ink, strokeWidth: px }),
        z.object({ id: sid, type: z.literal('Text'), x: px, y: px, text: z.string().max(300), fontSize: px, fontFamily: ink, fill: ink }),
        z.object({
          id: sid,
          type: z.literal('Label'),
          x: px,
          y: px,
          number: z.number().int().min(0).max(1000),
          tag: z.object({ fill: ink, cornerRadius: px, pointerDirection: ink, pointerWidth: px, pointerHeight: px }),
          text: z.object({ text: z.string().max(300), fontSize: px, fontFamily: ink, fill: ink, padding: px }),
        }),
        z.object({
          id: sid,
          type: z.literal('Line'),
          points: pts,
          stroke: ink,
          strokeWidth: px,
          tension: px,
          lineCap: z.enum(['round', 'butt', 'square']),
          lineJoin: z.enum(['round', 'bevel', 'miter']),
        }),
      ])
    )
    .max(200),
})
const SCENE_MAX_BYTES = 150_000

/** The photo's marks and untouched original when the displayed photo is a baked one; null for a plain photo. */
export async function getStepAnnotation(input: { stepId: string; storagePath: string }): Promise<
  { annotation: { originalPath: string; originalUrl: string; scene: unknown } | null } | Fail
> {
  const parsed = z.object({ stepId: uuid, storagePath: z.string().max(300) }).safeParse(input)
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  const { stepId, storagePath } = parsed.data

  const ctx = await requireSopEditAccess({ stepId })
  if ('error' in ctx) return { error: ctx.error }

  const admin = createAdminClient()
  const { data: step } = await admin
    .from('sop_focus_steps')
    .select('image_paths')
    .eq('id', stepId)
    .eq('organisation_id', ctx.organisationId)
    .eq('sop_id', ctx.sopId)
    .maybeSingle()
  if (!step || !(step as { image_paths: string[] }).image_paths.includes(storagePath)) return { error: 'That photo is not on this step.' }

  const { data: ann } = await admin
    .from('sop_image_annotations')
    .select('sop_image_id, scene')
    .eq('organisation_id', ctx.organisationId)
    .eq('baked_storage_path', storagePath)
    .maybeSingle()
  if (!ann) return { annotation: null }
  const { data: orig } = await admin
    .from('sop_images')
    .select('storage_path')
    .eq('id', (ann as { sop_image_id: string }).sop_image_id)
    .eq('sop_id', ctx.sopId)
    .maybeSingle()
  const originalPath = (orig as { storage_path: string } | null)?.storage_path
  if (!originalPath) return { annotation: null }
  const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(originalPath, 3600)
  if (!signed) return { annotation: null }
  return { annotation: { originalPath, originalUrl: signed.signedUrl, scene: (ann as { scene: unknown }).scene } }
}

/**
 * Swap a step photo for its baked, marked-up copy and keep the marks for later edits.
 * `originalPath` must already be on this step (or be the original behind a baked photo
 * that is); `bakedPath` must be a fresh upload this server handed out for this step.
 */
export async function saveAnnotatedStepImage(input: {
  stepId: string
  originalPath: string
  bakedPath: string
  scene: unknown
}): Promise<Ok | Fail> {
  const parsed = z
    .object({ stepId: uuid, originalPath: z.string().max(300), bakedPath: z.string().max(300), scene: sceneSchema })
    .safeParse(input)
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  const { stepId, originalPath, bakedPath, scene } = parsed.data
  if (JSON.stringify(scene).length > SCENE_MAX_BYTES) return { error: 'There are too many marks on this photo.' }

  const ctx = await requireSopEditAccess({ stepId })
  if ('error' in ctx) return { error: ctx.error }
  const open = await editableSop(ctx.organisationId, ctx.sopId)
  if ('error' in open) return open

  const dir = `${ctx.organisationId}/${ctx.sopId}/steps/${stepId}`
  const file = bakedPath.startsWith(`${dir}/`) ? bakedPath.slice(dir.length + 1) : ''
  if (!IMAGE_FILE.test(file) || bakedPath === originalPath) return { error: 'That photo path is not valid.' }

  const admin = createAdminClient()
  const { data: listed } = await admin.storage.from(BUCKET).list(dir, { search: file })
  if (!(listed ?? []).some((o) => o.name === file)) return { error: 'The photo did not finish uploading.' }

  const { data: step } = await admin
    .from('sop_focus_steps')
    .select('image_paths, section_id')
    .eq('id', stepId)
    .eq('organisation_id', ctx.organisationId)
    .eq('sop_id', ctx.sopId)
    .maybeSingle()
  if (!step) return { error: 'Step not found.' }
  const { image_paths, section_id } = step as { image_paths: string[]; section_id: string }

  const { data: orig } = await admin.from('sop_images').select('id').eq('sop_id', ctx.sopId).eq('storage_path', originalPath).limit(1).maybeSingle()
  if (!orig) return { error: 'That photo is not on this step.' }
  const originalId = (orig as { id: string }).id
  const { data: priorRow } = await admin
    .from('sop_image_annotations')
    .select('id, baked_storage_path')
    .eq('organisation_id', ctx.organisationId)
    .eq('sop_image_id', originalId)
    .limit(1)
    .maybeSingle()
  const prior = priorRow as { id: string; baked_storage_path: string | null } | null
  const oldBaked = prior?.baked_storage_path ?? null
  // The path on the step right now: the earlier baked copy when there is one, else the original.
  const current = oldBaked && image_paths.includes(oldBaked) ? oldBaked : originalPath
  if (!image_paths.includes(current)) return { error: 'That photo is not on this step.' }

  const { data: bakedRow, error: bakedErr } = await admin
    .from('sop_images')
    .insert({ sop_id: ctx.sopId, section_id, storage_path: bakedPath, content_type: 'image/jpeg', sort_order: image_paths.indexOf(current) })
    .select('id')
    .single()
  if (bakedErr || !bakedRow) {
    console.error('[saveAnnotatedStepImage] image row error', bakedErr)
    return { error: bakedErr?.message ?? 'Could not save the photo.' }
  }
  const bakedId = (bakedRow as { id: string }).id
  const undoImage = () => admin.from('sop_images').delete().eq('id', bakedId).eq('sop_id', ctx.sopId)

  const now = new Date().toISOString()
  const fields = { scene, natural_width: scene.width, natural_height: scene.height, baked_storage_path: bakedPath, baked_at: now }
  const annotationWrite = prior
    ? await admin.from('sop_image_annotations').update({ ...fields, updated_at: now }).eq('id', prior.id).eq('organisation_id', ctx.organisationId)
    : await admin.from('sop_image_annotations').insert({ organisation_id: ctx.organisationId, sop_image_id: originalId, ...fields })
  if (annotationWrite.error) {
    console.error('[saveAnnotatedStepImage] annotation error', annotationWrite.error)
    await undoImage()
    return { error: annotationWrite.error.message }
  }

  const { error } = await admin
    .from('sop_focus_steps')
    .update({ image_paths: image_paths.map((p) => (p === current ? bakedPath : p)) })
    .eq('id', stepId)
    .eq('organisation_id', ctx.organisationId)
    .eq('sop_id', ctx.sopId)
  if (error) {
    console.error('[saveAnnotatedStepImage] step update error', error)
    await undoImage()
    if (!prior) await admin.from('sop_image_annotations').delete().eq('sop_image_id', originalId).eq('organisation_id', ctx.organisationId)
    return { error: error.message }
  }

  // The earlier baked copy is no longer on the step: its row and file go.
  if (oldBaked && oldBaked !== bakedPath && oldBaked.startsWith(`${dir}/`)) {
    await admin.from('sop_images').delete().eq('sop_id', ctx.sopId).eq('storage_path', oldBaked)
    await admin.storage.from(BUCKET).remove([oldBaked])
  }
  return { ok: true }
}
