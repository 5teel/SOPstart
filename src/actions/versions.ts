'use server'

/**
 * Phase 58 -- SOP-04 (D-11, D-14, D-18): forking the next version and listing a
 * lineage's versions.
 *
 * Async exports only (a sync export of a server-action module breaks `next build`).
 * Every read is filtered by the SESSION organisation and every copied row is
 * stamped with it; nothing is derived from the fetched row's own org
 * (CLAUDE.md 2026-07-28). The census in tests/phase58/fork-draft.spec.ts fails
 * when a table that references public.sops(id) is neither copied here nor
 * allow-listed with a reason (CLAUDE.md 2026-07-29).
 */
import { randomUUID } from 'node:crypto'
import { requireAdminContext } from '@/lib/auth/guards'
import { recordDecision } from '@/lib/decisions/record'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeNextVersionLineage } from '@/lib/builder/version-lineage'
import { latestPublished, lineageRoot, type LineageRow } from '@/lib/sop/lineage-current'

type Done = PromiseLike<{ error: { message: string } | null }>

async function must(p: Done, what: string): Promise<void> {
  const { error } = await p
  if (error) throw new Error(`Failed to copy ${what}: ${error.message}`)
}

/**
 * Edit a published SOP = edit a draft of the next version. Reuses the lineage's
 * open draft; otherwise inserts the next-version row and copies everything keyed
 * on the SOP. Called from a button only, never on mount (it writes).
 */
// `logged` is absent when an open draft is reused: nothing was written, so nothing is recorded.
export async function forkDraft({ sopId }: { sopId: string }): Promise<{ draftId: string; logged?: boolean } | { error: string }> {
  const ctx = await requireAdminContext()
  if ('error' in ctx) return ctx
  const orgId = ctx.organisationId
  if (!orgId) return { error: 'No organisation found' }

  const admin = createAdminClient()
  // Tables added after the generated types are untyped, same as the other actions.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  const { data: source } = await admin
    .from('sops')
    .select('*')
    .eq('id', sopId)
    .eq('organisation_id', orgId)
    .maybeSingle()
  if (!source) return { error: 'SOP not found.' }
  if (source.status === 'draft') return { draftId: source.id }

  const root = lineageRoot(source)
  const { data: lineageData } = await admin
    .from('sops')
    .select('id, version, parent_sop_id, status')
    .eq('organisation_id', orgId)
    .or(`id.eq.${root},parent_sop_id.eq.${root}`)
  const lineage = (lineageData ?? []) as LineageRow[]
  const openDraft = lineage
    .filter((r) => r.status === 'draft')
    .sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0]
  if (openDraft) return { draftId: openDraft.id }

  const maxVersion = Math.max(source.version ?? 1, ...lineage.map((r) => r.version ?? 0))
  const { newVersion, newParentId } = computeNextVersionLineage({
    id: source.id,
    version: maxVersion,
    parent_sop_id: source.parent_sop_id,
  })

  // placement is trigger-synced from sop_machines; superseded_by is never written.
  // Columns the hand-maintained types do not carry (review WR-01); the column
  // census in tests/phase58/fork-draft.spec.ts fails when a sops column is
  // neither copied here nor on its skip-list.
  const extra = source as unknown as {
    source_type: string | null
    all_departments: boolean | null
    all_departments_pre_override: boolean | null
  }
  const { data: created, error: insertError } = await db
    .from('sops')
    .insert({
      organisation_id: orgId,
      title: source.title,
      status: 'draft',
      version: newVersion,
      parent_sop_id: newParentId,
      uploaded_by: ctx.user.id,
      source_file_name: source.source_file_name,
      source_file_type: source.source_file_type,
      source_file_path: source.source_file_path,
      source_type: extra.source_type,
      is_ocr: source.is_ocr,
      overall_confidence: source.overall_confidence,
      parse_notes: source.parse_notes,
      pipeline_run_id: source.pipeline_run_id,
      all_departments: extra.all_departments,
      all_departments_pre_override: extra.all_departments_pre_override,
      category: source.category,
      category_slug: source.category_slug ?? null,
      category_tag: source.category_tag,
      department: source.department,
      sop_number: source.sop_number,
      author: source.author,
      revision_date: source.revision_date,
      owner_user_id: source.owner_user_id,
      refresher_interval_months: source.refresher_interval_months ?? null,
      required_certifications: source.required_certifications,
      applicable_equipment: source.applicable_equipment,
      related_sops: source.related_sops,
      flow_graph: source.flow_graph,
      allow_forward_jump: source.allow_forward_jump,
    })
    .select('id')
    .single()
  if (insertError || !created) {
    console.error('forkDraft: sops insert error', insertError)
    return { error: 'Failed to create the new version.' }
  }
  const newId: string = created.id

  try {
    // Ids are generated up front so every old -> new map is built by array index,
    // never by sort_order or step_number (CLAUDE.md 2026-06-26).
    const { data: secData, error: secErr } = await admin
      .from('sop_sections')
      .select('id, section_kind_id, sort_order, layout_data, layout_version, title, content, section_type, confidence, approved')
      .eq('sop_id', source.id)
      .order('sort_order', { ascending: true })
    if (secErr) throw new Error(`Failed to read sections: ${secErr.message}`)
    const sections = secData ?? []
    const sectionIds = sections.map(() => randomUUID())
    const sectionMap = new Map(sections.map((s, i) => [s.id, sectionIds[i]]))
    if (sections.length) {
      await must(
        admin.from('sop_sections').insert(
          sections.map((s, i) => ({
            id: sectionIds[i],
            sop_id: newId,
            section_kind_id: s.section_kind_id,
            sort_order: s.sort_order,
            layout_data: s.layout_data,
            layout_version: s.layout_version,
            title: s.title,
            content: s.content,
            section_type: s.section_type,
            confidence: s.confidence,
            approved: s.approved,
          }))
        ),
        'sop_sections'
      )
    }

    // Focus steps: new ids, remapped sections, and the tick carried -- the BEFORE
    // UPDATE trigger clears it the moment that step is edited (A2); an insert
    // does not fire it.
    const { data: stepData, error: stepErr } = await db
      .from('sop_focus_steps')
      .select('id, section_id, kind, text, tip, photo_required, image_paths, required_tools, time_estimate_minutes, sort_order, source_key, run_id, verified_by_admin_id, verified_at, needs_recheck')
      .eq('organisation_id', orgId)
      .eq('sop_id', source.id)
      .order('sort_order', { ascending: true })
    if (stepErr) throw new Error(`Failed to read steps: ${stepErr.message}`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const steps = (stepData ?? []) as any[]
    const stepIds = steps.map(() => randomUUID())
    const stepMap = new Map<string, string>(steps.map((s, i) => [s.id as string, stepIds[i]]))
    if (steps.length) {
      await must(
        db.from('sop_focus_steps').insert(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          steps.map((s: any, i: number) => ({
            id: stepIds[i],
            organisation_id: orgId,
            sop_id: newId,
            section_id: sectionMap.get(s.section_id),
            kind: s.kind,
            text: s.text,
            tip: s.tip,
            photo_required: s.photo_required,
            image_paths: s.image_paths,
            required_tools: s.required_tools,
            time_estimate_minutes: s.time_estimate_minutes,
            sort_order: s.sort_order,
            source_key: s.source_key,
            run_id: s.run_id,
            verified_by_admin_id: s.verified_by_admin_id,
            verified_at: s.verified_at,
            needs_recheck: s.needs_recheck,
          }))
        ),
        'sop_focus_steps'
      )
    }

    // Images are shared storage objects: copy the row, same path, no re-upload.
    // step_id stays null -- it points at the retired sop_steps table; the step's
    // own image_paths (copied above) carry the attachment.
    const { data: imgData, error: imgErr } = await admin
      .from('sop_images')
      .select('id, section_id, storage_path, content_type, alt_text, sort_order')
      .eq('sop_id', source.id)
    if (imgErr) throw new Error(`Failed to read images: ${imgErr.message}`)
    const images = imgData ?? []
    const imageIds = images.map(() => randomUUID())
    const imageMap = new Map(images.map((im, i) => [im.id, imageIds[i]]))
    if (images.length) {
      await must(
        admin.from('sop_images').insert(
          images.map((im, i) => ({
            id: imageIds[i],
            sop_id: newId,
            section_id: im.section_id ? (sectionMap.get(im.section_id) ?? null) : null,
            step_id: null,
            storage_path: im.storage_path,
            content_type: im.content_type,
            alt_text: im.alt_text,
            sort_order: im.sort_order,
          }))
        ),
        'sop_images'
      )

      // The marks on an annotated photo (keyed on the image row, review WR-02), so
      // "Annotate" on the draft reopens the original with its scene instead of
      // baking marks over marks.
      const { data: anns, error: annErr } = await db
        .from('sop_image_annotations')
        .select('sop_image_id, scene, natural_width, natural_height, baked_storage_path, baked_at')
        .eq('organisation_id', orgId)
        .in('sop_image_id', images.map((im) => im.id))
      if (annErr) throw new Error(`Failed to read annotations: ${annErr.message}`)
      if (anns?.length) {
        await must(
          db.from('sop_image_annotations').insert(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            anns.map((a: any) => ({ ...a, organisation_id: orgId, sop_image_id: imageMap.get(a.sop_image_id) }))
          ),
          'sop_image_annotations'
        )
      }
    }

    // Standards at all three levels, ids remapped.
    const sopKeys = [source.id]
    const secKeys = sections.map((s) => s.id)
    const stepKeys = steps.map((s) => s.id as string)
    const attachCols = 'standard_id, sop_id, section_id, focus_step_id, created_by'
    const [onSop, onSec, onStep] = await Promise.all([
      db.from('standard_attachments').select(attachCols).eq('organisation_id', orgId).in('sop_id', sopKeys),
      secKeys.length
        ? db.from('standard_attachments').select(attachCols).eq('organisation_id', orgId).in('section_id', secKeys)
        : { data: [], error: null },
      stepKeys.length
        ? db.from('standard_attachments').select(attachCols).eq('organisation_id', orgId).in('focus_step_id', stepKeys)
        : { data: [], error: null },
    ])
    for (const r of [onSop, onSec, onStep]) {
      if (r.error) throw new Error(`Failed to read standards: ${r.error.message}`)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attachments = [...(onSop.data ?? []), ...(onSec.data ?? []), ...(onStep.data ?? [])].map((a: any) => ({
      organisation_id: orgId,
      standard_id: a.standard_id,
      created_by: a.created_by,
      sop_id: a.sop_id ? newId : null,
      section_id: a.section_id ? (sectionMap.get(a.section_id) ?? null) : null,
      focus_step_id: a.focus_step_id ? (stepMap.get(a.focus_step_id) ?? null) : null,
    }))
    if (attachments.length) await must(db.from('standard_attachments').insert(attachments), 'standard_attachments')

    // Machine links (placement follows by trigger), departments, sub-trades,
    // collections, per-SOP access grants and their materialised people.
    const { data: machines } = await db.from('sop_machines').select('machine_id').eq('organisation_id', orgId).eq('sop_id', source.id)
    if (machines?.length) {
      await must(
        db.from('sop_machines').insert(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          machines.map((m: any) => ({ sop_id: newId, machine_id: m.machine_id, organisation_id: orgId }))
        ),
        'sop_machines'
      )
    }
    const { data: depts } = await db.from('sop_departments').select('department_id').eq('sop_id', source.id)
    if (depts?.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await must(db.from('sop_departments').insert(depts.map((d: any) => ({ sop_id: newId, department_id: d.department_id }))), 'sop_departments')
    }
    const { data: trades } = await db.from('sops_sub_trades').select('sub_trade_id').eq('sop_id', source.id)
    if (trades?.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await must(db.from('sops_sub_trades').insert(trades.map((t: any) => ({ sop_id: newId, sub_trade_id: t.sub_trade_id }))), 'sops_sub_trades')
    }
    const { data: colls } = await db.from('sop_collections').select('collection_id').eq('sop_id', source.id)
    if (colls?.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await must(db.from('sop_collections').insert(colls.map((c: any) => ({ sop_id: newId, collection_id: c.collection_id }))), 'sop_collections')
    }
    const { data: grants } = await db
      .from('access_grants')
      .select('subject_type, subject_id, granted_by')
      .eq('organisation_id', orgId)
      .eq('sop_id', source.id)
    if (grants?.length) {
      await must(
        db.from('access_grants').insert(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          grants.map((g: any) => ({ organisation_id: orgId, sop_id: newId, collection_id: null, subject_type: g.subject_type, subject_id: g.subject_id, granted_by: g.granted_by }))
        ),
        'access_grants'
      )
    }
    const { data: people } = await db.from('sop_access_people').select('member_id').eq('sop_id', source.id)
    if (people?.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await must(db.from('sop_access_people').insert(people.map((p: any) => ({ sop_id: newId, member_id: p.member_id }))), 'sop_access_people')
    }

  } catch (err) {
    console.error('forkDraft: copy failed, removing the partial draft', err)
    // CASCADE removes everything copied so far.
    await admin.from('sops').delete().eq('id', newId).eq('organisation_id', orgId)
    return { error: err instanceof Error ? err.message : 'Failed to create the new version.' }
  }

  const rec = await recordDecision({
    kind: 'sop_version',
    subject: { kind: 'sop', id: newId },
    sopId: newId,
    summary: 'Started a draft of the next version',
    details: { from_sop_id: source.id, version: newVersion },
  })
  return { draftId: newId, logged: rec.ok }
}

export type LineageVersion = {
  id: string
  version: number
  status: string
  updated_at: string
  state: 'live' | 'draft' | 'superseded'
}

/** The versions of one SOP, newest first, for the editor rail (D-14). */
export async function listLineageVersions({ sopId }: { sopId: string }): Promise<{ versions: LineageVersion[] } | { error: string }> {
  const ctx = await requireAdminContext()
  if ('error' in ctx) return ctx
  if (!ctx.organisationId) return { error: 'No organisation found' }

  const admin = createAdminClient()
  const { data: source } = await admin
    .from('sops')
    .select('id, parent_sop_id')
    .eq('id', sopId)
    .eq('organisation_id', ctx.organisationId)
    .maybeSingle()
  if (!source) return { error: 'SOP not found.' }

  const root = lineageRoot(source)
  const { data } = await admin
    .from('sops')
    .select('id, version, parent_sop_id, status, updated_at')
    .eq('organisation_id', ctx.organisationId)
    .or(`id.eq.${root},parent_sop_id.eq.${root}`)
  const rows = data ?? []
  const live = new Set(latestPublished(rows).map((r) => r.id))
  const versions = rows
    .map((r): LineageVersion => ({
      id: r.id,
      version: r.version ?? 0,
      status: r.status,
      updated_at: r.updated_at,
      state: live.has(r.id) ? 'live' : r.status === 'published' ? 'superseded' : 'draft',
    }))
    .sort((a, b) => b.version - a.version)
  return { versions }
}
