/**
 * Multi-area library fixture (Phase 63 / 63-01).
 *
 * The SOP-first home groups published SOPs into areas: a machine's department
 * (Forming, via EVAL Press), each other department, and "Site-wide" for a SOP
 * with neither. Upsert-only, idempotent, never deletes, and refuses the real
 * SOPstart org (T-63-01). Each row is guarded on its OWN marker -- the
 * `new:eval-area-` step prefix -- never on "any rows exist" (CLAUDE.md 2026-10-05).
 *
 * Shared-org rule (CLAUDE.md 2026-09-29): these rows live in the eval-site org
 * every sibling eval reads, so they carry an `EVAL area` title prefix, are owned
 * by the org admin (no "No owner" inbox row) and no sibling asserts a total.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { EVAL_SITE_ORG_NAME } from './session'
import { REAL_SOPSTART_ORG_ID } from './plant-fixture'

export const EVAL_AREA_SOPS = {
  packing: 'EVAL area Packing pallet wrap',
  lab: 'EVAL area Lab sample check',
  site: 'EVAL area Site-wide evacuation',
} as const

const EVAL_AREA_DEPARTMENTS = { packing: 'EVAL Area Packing', lab: 'EVAL Area Lab' } as const
const DEPT_CODES = { packing: 'EVAPK', lab: 'EVALB' } as const
const STEP_MARKER = 'new:eval-area-'

/** The area names the home groups these under, in the order the library lists them. */
export const EVAL_AREA_NAMES = ['Forming', 'EVAL Area Packing', 'EVAL Area Lab', 'Site-wide'] as const

export interface LibraryFixture {
  siteOrgId: string
  sopIds: { packing: string; lab: string; site: string }
  departmentIds: { packing: string; lab: string }
  areaNames: typeof EVAL_AREA_NAMES
}

export async function ensureLibraryAreas(db: SupabaseClient): Promise<LibraryFixture> {
  const { data: org, error: orgErr } = await db.from('organisations').select('id').eq('name', EVAL_SITE_ORG_NAME).maybeSingle()
  if (orgErr) throw new Error(`org lookup failed: ${orgErr.message}`)
  if (!org) throw new Error(`"${EVAL_SITE_ORG_NAME}" org not found -- run node scripts/eval-fixtures.mjs`)
  const siteOrgId = org.id as string
  if (siteOrgId === REAL_SOPSTART_ORG_ID) throw new Error('refusing to run -- resolved org id equals the real SOPstart org')

  const { data: admin, error: adminErr } = await db
    .from('organisation_members')
    .select('user_id')
    .eq('organisation_id', siteOrgId)
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()
  if (adminErr || !admin) throw new Error(`eval-site admin not found: ${adminErr?.message ?? 'none'}`)
  const adminId = admin.user_id as string

  async function ensureDepartment(name: string, code: string): Promise<string> {
    const { data: found, error } = await db.from('departments').select('id').eq('organisation_id', siteOrgId).eq('name', name).maybeSingle()
    if (error) throw new Error(`department lookup failed: ${error.message}`)
    if (found) return found.id as string
    const { data: created, error: insErr } = await db.from('departments').insert({ organisation_id: siteOrgId, name, code }).select('id').single()
    if (insErr || !created) throw new Error(`department insert failed: ${insErr?.message}`)
    return created.id as string
  }

  async function ensureSop(title: string, extra: Record<string, unknown>): Promise<string> {
    const { data: found, error } = await db
      .from('sops')
      .select('id, status')
      .eq('organisation_id', siteOrgId)
      .eq('title', title)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(`sop lookup failed: ${error.message}`)
    if (found) {
      if (found.status !== 'published') {
        const { error: upErr } = await db.from('sops').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', found.id)
        if (upErr) throw new Error(`sop publish failed: ${upErr.message}`)
      }
      return found.id as string
    }
    const { data: created, error: insErr } = await db
      .from('sops')
      .insert({
        organisation_id: siteOrgId,
        title,
        source_file_name: title,
        source_file_type: 'docx',
        source_file_path: '',
        uploaded_by: adminId,
        owner_user_id: adminId,
        source_type: 'blank',
        status: 'published',
        published_at: new Date().toISOString(),
        version: 1,
        placement: 'site',
        ...extra,
      })
      .select('id')
      .single()
    if (insErr || !created) throw new Error(`sop insert failed: ${insErr?.message}`)
    return created.id as string
  }

  async function ensureSteps(sopId: string, slug: string): Promise<void> {
    const { data: have, error } = await db
      .from('sop_focus_steps')
      .select('id')
      .eq('sop_id', sopId)
      .like('source_key', `${STEP_MARKER}%`)
      .limit(1)
    if (error) throw new Error(`step lookup failed: ${error.message}`)
    if (have && have.length > 0) return
    const { data: sec, error: secErr } = await db
      .from('sop_sections')
      .insert({ sop_id: sopId, section_type: 'procedure', title: 'Procedure', sort_order: 0, approved: true })
      .select('id')
      .single()
    if (secErr || !sec) throw new Error(`section insert failed: ${secErr?.message}`)
    const steps = [
      { kind: 'hazard', text: 'Moving equipment nearby.' },
      { kind: 'ppe', text: 'Gloves and safety glasses.' },
      { kind: 'step', text: 'Do the job as the SOP says.' },
      { kind: 'check', text: 'Area is left clean and safe.' },
    ]
    for (const [i, st] of steps.entries()) {
      // source_key is unique per section; the marker prefix is this fixture's own guard.
      const { error: stepErr } = await db.from('sop_focus_steps').insert({
        organisation_id: siteOrgId,
        sop_id: sopId,
        section_id: sec.id,
        source_key: `${STEP_MARKER}${slug}-${st.kind}`,
        kind: st.kind,
        text: st.text,
        sort_order: i,
        time_estimate_minutes: 2,
        verified_by_admin_id: adminId,
        verified_at: new Date().toISOString(),
      })
      if (stepErr) throw new Error(`step insert failed: ${stepErr.message}`)
    }
  }

  const departmentIds = {
    packing: await ensureDepartment(EVAL_AREA_DEPARTMENTS.packing, DEPT_CODES.packing),
    lab: await ensureDepartment(EVAL_AREA_DEPARTMENTS.lab, DEPT_CODES.lab),
  }
  const sopIds = {
    packing: await ensureSop(EVAL_AREA_SOPS.packing, {}),
    lab: await ensureSop(EVAL_AREA_SOPS.lab, { category_slug: 'quality' }),
    site: await ensureSop(EVAL_AREA_SOPS.site, { category_slug: 'emergency' }),
  }
  for (const [slug, id] of Object.entries(sopIds)) await ensureSteps(id, slug)

  // Tag packing and lab to their department; the site-wide SOP stays untagged and machine-less.
  for (const [slug, deptId] of Object.entries(departmentIds)) {
    const { error } = await db
      .from('sop_departments')
      .upsert({ sop_id: sopIds[slug as 'packing' | 'lab'], department_id: deptId }, { onConflict: 'sop_id,department_id' })
    if (error) throw new Error(`sop_departments upsert failed: ${error.message}`)
  }

  return { siteOrgId, sopIds, departmentIds, areaNames: EVAL_AREA_NAMES }
}
