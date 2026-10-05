// Idempotently ensures the deployed-site eval accounts (+ Phase 51 eval-site
// org) exist. Run: node scripts/eval-fixtures.mjs   (reads .env.local; safe to re-run)
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '') }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
export const EVAL_ORG_ID = 'bd2c2b88-b26e-46ca-a6b4-a89161a98aea' // "SOPstart" (ex-Potenco), see memory project_prod_org_merge
export const EVAL_USERS = { admin: 'eval-admin@sopstart.com', worker: 'eval-worker@sopstart.com' }
// Phase 51 (51-07): a third fixture, eval-site-admin, is admin of its OWN org
// "SOPstart Eval Site" — the site-editor eval resets the org's site before
// every run (the empty state only shows with no layout), and doing that in
// the real SOPstart org would delete Simon's actual site map once he draws one.
export const EVAL_SITE_ORG_NAME = 'SOPstart Eval Site'
export const EVAL_SITE_ADMIN_EMAIL = 'eval-site-admin@sopstart.com'
export const EVAL_SITE_SOP_TITLE = 'Eval site fixture SOP'
export const EVAL_SITE_DEPARTMENT = 'Forming'
// Phase 52 (52-01): a worker fixture in the SAME eval-site org, plus a
// PUBLISHED (not draft) SOP assigned to it -- the plant home only pins
// published SOPs (worker Dexie sync filters status === 'published'), unlike
// the Phase 51 draft fixture above which only needed to exist for linking.
export const EVAL_SITE_WORKER_EMAIL = 'eval-site-worker@sopstart.com'
// Phase 57 (57-01, D-06): a supervisor in the same eval-site org -- the supervisor Office card eval.
export const EVAL_SITE_SUPERVISOR_EMAIL = 'eval-site-supervisor@sopstart.com'
export const EVAL_PLANT_SOP_TITLE = 'Eval plant fixture SOP'
// Phase 55 (55-01): a published, UNASSIGNED, machine-less SOP whose step 2 asks for a
// photo -- the walk eval completes it, so it must never be the plant fixture SOP.
export const EVAL_WALK_SOP_TITLE = 'Eval walk fixture SOP'
// Phase 56 (56-01): the converter's known-answer SOP -- published, UNASSIGNED, machine-less.
export const EVAL_CONVERT_SOP_TITLE = 'Eval convert fixture SOP'

const { data: list } = await sb.auth.admin.listUsers({ perPage: 500 })
for (const [role, email] of Object.entries(EVAL_USERS)) {
  let user = list.users.find(u => u.email === email)
  // CR-01 (41-REVIEW): never touch a real account that happens to own this email —
  // only an account this script created (eval_fixture metadata) may be (re)granted a role.
  if (user && user.user_metadata?.eval_fixture !== true) throw new Error(`${email} exists but is not an eval fixture — refusing to change its membership`)
  if (!user) { const { data, error } = await sb.auth.admin.createUser({ email, email_confirm: true, user_metadata: { eval_fixture: true } }); if (error) throw error; user = data.user; console.log('created', email) }
  const { error } = await sb.from('organisation_members').upsert({ organisation_id: EVAL_ORG_ID, user_id: user.id, role }, { onConflict: 'organisation_id,user_id' })
  if (error) throw error
  console.log(`${email} → ${role} of SOPstart (${user.id})`)
}

// --- Phase 51: eval-only site-editor org, admin, department, fixture SOP ---
let siteOrg
{
  const { data, error } = await sb.from('organisations').select('id').eq('name', EVAL_SITE_ORG_NAME).maybeSingle()
  if (error) throw error
  siteOrg = data
}
if (!siteOrg) {
  const { data, error } = await sb.from('organisations').insert({ name: EVAL_SITE_ORG_NAME }).select('id').single()
  if (error) throw error
  siteOrg = data
  console.log('created org', EVAL_SITE_ORG_NAME, siteOrg.id)
}
if (siteOrg.id === EVAL_ORG_ID) throw new Error('eval-site org id collides with the real SOPstart org — refusing to proceed')

let siteAdmin = list.users.find(u => u.email === EVAL_SITE_ADMIN_EMAIL)
if (siteAdmin && siteAdmin.user_metadata?.eval_fixture !== true) throw new Error(`${EVAL_SITE_ADMIN_EMAIL} exists but is not an eval fixture — refusing to change its membership`)
if (!siteAdmin) {
  const { data, error } = await sb.auth.admin.createUser({ email: EVAL_SITE_ADMIN_EMAIL, email_confirm: true, user_metadata: { eval_fixture: true } })
  if (error) throw error
  siteAdmin = data.user
  console.log('created', EVAL_SITE_ADMIN_EMAIL)
}
{
  const { error } = await sb.from('organisation_members').upsert({ organisation_id: siteOrg.id, user_id: siteAdmin.id, role: 'admin' }, { onConflict: 'organisation_id,user_id' })
  if (error) throw error
  console.log(`${EVAL_SITE_ADMIN_EMAIL} → admin of ${EVAL_SITE_ORG_NAME} (${siteAdmin.id})`)
}

let dept
{
  const { data, error } = await sb.from('departments').select('id').eq('organisation_id', siteOrg.id).eq('name', EVAL_SITE_DEPARTMENT).maybeSingle()
  if (error) throw error
  dept = data
}
if (!dept) {
  const { data, error } = await sb.from('departments').insert({ organisation_id: siteOrg.id, name: EVAL_SITE_DEPARTMENT, code: 'EVF' }).select('id').single()
  if (error) throw error
  dept = data
  console.log('created department', EVAL_SITE_DEPARTMENT, dept.id)
}

let sop
{
  const { data, error } = await sb.from('sops').select('id').eq('organisation_id', siteOrg.id).eq('title', EVAL_SITE_SOP_TITLE).maybeSingle()
  if (error) throw error
  sop = data
}
if (!sop) {
  const { data, error } = await sb
    .from('sops')
    .insert({
      organisation_id: siteOrg.id,
      title: EVAL_SITE_SOP_TITLE,
      source_file_name: EVAL_SITE_SOP_TITLE,
      source_file_type: 'docx',
      source_file_path: '',
      uploaded_by: siteAdmin.id,
      status: 'draft',
      source_type: 'blank',
    })
    .select('id')
    .single()
  if (error) throw error
  sop = data
  console.log('created fixture SOP', EVAL_SITE_SOP_TITLE, sop.id)
}

// --- Phase 52 (52-01): eval-site worker + a PUBLISHED assigned fixture SOP ---
let siteWorker = list.users.find(u => u.email === EVAL_SITE_WORKER_EMAIL)
if (siteWorker && siteWorker.user_metadata?.eval_fixture !== true) throw new Error(`${EVAL_SITE_WORKER_EMAIL} exists but is not an eval fixture — refusing to change its membership`)
if (!siteWorker) {
  const { data, error } = await sb.auth.admin.createUser({ email: EVAL_SITE_WORKER_EMAIL, email_confirm: true, user_metadata: { eval_fixture: true } })
  if (error) throw error
  siteWorker = data.user
  console.log('created', EVAL_SITE_WORKER_EMAIL)
}
{
  const { error } = await sb.from('organisation_members').upsert({ organisation_id: siteOrg.id, user_id: siteWorker.id, role: 'worker' }, { onConflict: 'organisation_id,user_id' })
  if (error) throw error
  console.log(`${EVAL_SITE_WORKER_EMAIL} → worker of ${EVAL_SITE_ORG_NAME} (${siteWorker.id})`)
}

// --- Phase 57 (57-01, D-06): eval-site supervisor (same org, never the real SOPstart org) ---
let siteSupervisor = list.users.find(u => u.email === EVAL_SITE_SUPERVISOR_EMAIL)
if (siteSupervisor && siteSupervisor.user_metadata?.eval_fixture !== true) throw new Error(`${EVAL_SITE_SUPERVISOR_EMAIL} exists but is not an eval fixture — refusing to change its membership`)
if (!siteSupervisor) {
  const { data, error } = await sb.auth.admin.createUser({ email: EVAL_SITE_SUPERVISOR_EMAIL, email_confirm: true, user_metadata: { eval_fixture: true } })
  if (error) throw error
  siteSupervisor = data.user
  console.log('created', EVAL_SITE_SUPERVISOR_EMAIL)
}
{
  const { error } = await sb.from('organisation_members').upsert({ organisation_id: siteOrg.id, user_id: siteSupervisor.id, role: 'supervisor' }, { onConflict: 'organisation_id,user_id' })
  if (error) throw error
  console.log(`${EVAL_SITE_SUPERVISOR_EMAIL} → supervisor of ${EVAL_SITE_ORG_NAME} (${siteSupervisor.id})`)
}

let plantSop
{
  const { data, error } = await sb.from('sops').select('id, status').eq('organisation_id', siteOrg.id).eq('title', EVAL_PLANT_SOP_TITLE).maybeSingle()
  if (error) throw error
  plantSop = data
}
if (!plantSop) {
  const { data, error } = await sb
    .from('sops')
    .insert({
      organisation_id: siteOrg.id,
      title: EVAL_PLANT_SOP_TITLE,
      source_file_name: EVAL_PLANT_SOP_TITLE,
      source_file_type: 'docx',
      source_file_path: '',
      uploaded_by: siteAdmin.id,
      status: 'published',
      published_at: new Date().toISOString(),
      version: 1,
      source_type: 'blank',
    })
    .select('id, status')
    .single()
  if (error) throw error
  plantSop = data
  console.log('created fixture SOP', EVAL_PLANT_SOP_TITLE, plantSop.id)
} else if (plantSop.status !== 'published') {
  const { error } = await sb.from('sops').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', plantSop.id)
  if (error) throw error
  console.log('published fixture SOP', EVAL_PLANT_SOP_TITLE, plantSop.id)
}

let plantSection
{
  const { data, error } = await sb.from('sop_sections').select('id').eq('sop_id', plantSop.id).limit(1).maybeSingle()
  if (error) throw error
  plantSection = data
}
if (!plantSection) {
  const { data, error } = await sb
    .from('sop_sections')
    .insert({ sop_id: plantSop.id, section_type: 'procedure', title: 'Procedure', sort_order: 0, approved: true })
    .select('id')
    .single()
  if (error) throw error
  plantSection = data
  console.log('created fixture section', plantSection.id)

  const { error: stepErr } = await sb
    .from('sop_steps')
    .insert({ section_id: plantSection.id, step_number: 1, text: 'Check the press guard is closed before starting.', time_estimate_minutes: 5 })
  if (stepErr) throw stepErr
}

{
  const { error } = await sb
    .from('sop_assignments')
    .upsert(
      { organisation_id: siteOrg.id, sop_id: plantSop.id, assignment_type: 'individual', user_id: siteWorker.id, assigned_by: siteAdmin.id },
      { onConflict: 'sop_id,assignment_type,user_id' }
    )
  if (error) throw error
  console.log(`assigned ${EVAL_PLANT_SOP_TITLE} → ${EVAL_SITE_WORKER_EMAIL}`)
}

// --- Phase 55 (55-01): dedicated walk fixture ---
// Published, assigned to NOBODY and linked to NO machine: an assigned, never-done SOP
// would join the plant-home Now card and pins (CLAUDE.md 2026-09-29 shared-fixture
// learning). Step 2 asks for a photo so the walk eval can take one.
let walkSop
{
  const { data, error } = await sb.from('sops').select('id, status').eq('organisation_id', siteOrg.id).eq('title', EVAL_WALK_SOP_TITLE).maybeSingle()
  if (error) throw error
  walkSop = data
}
if (!walkSop) {
  const { data, error } = await sb
    .from('sops')
    .insert({
      organisation_id: siteOrg.id,
      title: EVAL_WALK_SOP_TITLE,
      source_file_name: EVAL_WALK_SOP_TITLE,
      source_file_type: 'docx',
      source_file_path: '',
      uploaded_by: siteAdmin.id,
      status: 'published',
      published_at: new Date().toISOString(),
      version: 1,
      source_type: 'blank',
    })
    .select('id, status')
    .single()
  if (error) throw error
  walkSop = data
  console.log('created fixture SOP', EVAL_WALK_SOP_TITLE, walkSop.id)
} else if (walkSop.status !== 'published') {
  const { error } = await sb.from('sops').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', walkSop.id)
  if (error) throw error
  console.log('published fixture SOP', EVAL_WALK_SOP_TITLE, walkSop.id)
}

let walkSection
{
  const { data, error } = await sb.from('sop_sections').select('id').eq('sop_id', walkSop.id).order('sort_order').limit(1).maybeSingle()
  if (error) throw error
  walkSection = data
}
if (!walkSection) {
  const { data, error } = await sb
    .from('sop_sections')
    .insert({ sop_id: walkSop.id, section_type: 'procedure', title: 'Procedure', sort_order: 0, approved: true })
    .select('id')
    .single()
  if (error) throw error
  walkSection = data
  console.log('created walk fixture section', walkSection.id)
}

for (const step of [
  { step_number: 1, text: 'Check the guard is closed.', photo_required: false },
  { step_number: 2, text: 'Photograph the closed guard.', photo_required: true },
]) {
  const { data: existing, error } = await sb.from('sop_steps').select('id').eq('section_id', walkSection.id).eq('step_number', step.step_number).maybeSingle()
  if (error) throw error
  const { error: writeErr } = existing
    ? await sb.from('sop_steps').update({ text: step.text, photo_required: step.photo_required }).eq('id', existing.id)
    : await sb.from('sop_steps').insert({ section_id: walkSection.id, ...step, time_estimate_minutes: 1 })
  if (writeErr) throw writeErr
}
console.log(`walk fixture ${EVAL_WALK_SOP_TITLE} → ${walkSop.id}`)

// --- Phase 56 (56-01): converter known-answer fixture ---
// Published, assigned to NOBODY and linked to NO machine (CLAUDE.md 2026-09-29 shared-fixture
// learning). Known answer: hazard 4 (2 cards + Warning + Caution), ppe 1 holding both items,
// step 2 (one asks for a photo), check 1. The Warning hazard sorts before 'Isolate the press.'
// and the Caution hazard before 'Photograph the isolation lock.'
let convertSop
{
  const { data, error } = await sb.from('sops').select('id, status').eq('organisation_id', siteOrg.id).eq('title', EVAL_CONVERT_SOP_TITLE).maybeSingle()
  if (error) throw error
  convertSop = data
}
if (!convertSop) {
  const { data, error } = await sb
    .from('sops')
    .insert({
      organisation_id: siteOrg.id,
      title: EVAL_CONVERT_SOP_TITLE,
      source_file_name: EVAL_CONVERT_SOP_TITLE,
      source_file_type: 'docx',
      source_file_path: '',
      uploaded_by: siteAdmin.id,
      status: 'published',
      published_at: new Date().toISOString(),
      version: 1,
      source_type: 'blank',
    })
    .select('id, status')
    .single()
  if (error) throw error
  convertSop = data
  console.log('created fixture SOP', EVAL_CONVERT_SOP_TITLE, convertSop.id)
} else if (convertSop.status !== 'published') {
  const { error } = await sb.from('sops').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', convertSop.id)
  if (error) throw error
  console.log('published fixture SOP', EVAL_CONVERT_SOP_TITLE, convertSop.id)
}

const layout = (content) => ({ root: { props: {} }, content })
const convertSections = [
  {
    sort_order: 0, section_type: 'hazards', title: 'Hazards',
    content: 'Pinch point at the rollers.\nHot surface on the oven door.',
    layout_data: layout([
      { type: 'HazardCardBlock', props: { id: 'evh1', title: 'Hazard', body: 'Pinch point at the rollers.', severity: 'warning' } },
      { type: 'HazardCardBlock', props: { id: 'evh2', title: 'Hazard', body: 'Hot surface on the oven door.', severity: 'warning' } },
    ]),
  },
  {
    sort_order: 1, section_type: 'ppe', title: 'PPE',
    content: 'Safety glasses\nCut-resistant gloves',
    layout_data: layout([
      { type: 'PPECardBlock', props: { id: 'evp1', title: 'PPE Required', items: ['Safety glasses', 'Cut-resistant gloves'] } },
    ]),
  },
  {
    sort_order: 2, section_type: 'procedure', title: 'Procedure', content: null,
    layout_data: layout([
      { type: 'StepBlock', props: { id: 'evs1', number: 1, text: 'Isolate the press.' } },
      { type: 'CalloutBlock', props: { id: 'evw1', title: 'Warning', body: 'Stored energy in the hydraulic line.' } },
      { type: 'CalloutBlock', props: { id: 'evt1', title: 'Tip', body: 'Use your own lock.' } },
      { type: 'StepWithPhotosBlock', props: { id: 'evs2', number: 2, text: 'Photograph the isolation lock.', photos: [], layout: 'single' } },
      { type: 'CalloutBlock', props: { id: 'evc1', title: 'Caution', body: 'Do not reach past the guard.' } },
      { type: 'MeasurementBlock', props: { id: 'evm1', label: 'Hydraulic pressure', unit: 'bar', tolerance: { min: 0, max: 5 }, voiceEnabled: false } },
    ]),
  },
]
let convertProcedureSectionId
for (const sec of convertSections) {
  const { data: existing, error } = await sb.from('sop_sections').select('id').eq('sop_id', convertSop.id).eq('sort_order', sec.sort_order).limit(1).maybeSingle()
  if (error) throw error
  const row = { ...sec, approved: true, layout_version: 1 }
  let id = existing?.id
  if (existing) {
    const { error: upErr } = await sb.from('sop_sections').update(row).eq('id', existing.id)
    if (upErr) throw upErr
  } else {
    const { data, error: inErr } = await sb.from('sop_sections').insert({ sop_id: convertSop.id, ...row }).select('id').single()
    if (inErr) throw inErr
    id = data.id
  }
  if (sec.section_type === 'procedure') convertProcedureSectionId = id
}
for (const step of [
  { step_number: 1, text: 'Isolate the press.', warning: 'Stored energy in the hydraulic line.', tip: 'Use your own lock.', caution: null, photo_required: false },
  { step_number: 2, text: 'Photograph the isolation lock.', warning: null, tip: null, caution: 'Do not reach past the guard.', photo_required: true },
]) {
  const { data: existing, error } = await sb.from('sop_steps').select('id').eq('section_id', convertProcedureSectionId).eq('step_number', step.step_number).maybeSingle()
  if (error) throw error
  const { error: writeErr } = existing
    ? await sb.from('sop_steps').update(step).eq('id', existing.id)
    : await sb.from('sop_steps').insert({ section_id: convertProcedureSectionId, ...step, time_estimate_minutes: 1 })
  if (writeErr) throw writeErr
}
console.log(`convert fixture ${EVAL_CONVERT_SOP_TITLE} → ${convertSop.id}`)

// --- Phase 58 (58-03): focus-screen fixtures, ALL in the eval-site org (siteOrg is already
// refused above if it collides with the real org). Idempotent: select by name (+ version for
// lineage members), insert only when missing, update only when a value differs, so a second
// run changes nothing. The sop_focus_steps tick trigger (00071) clears a tick on any text/kind/
// tip/photo/image change, so a step is only written when it differs from the spec.
const FOCUS = {}
const focusSopPatch = (s) => ({
  status: s.status,
  version: s.version ?? 1,
  parent_sop_id: s.parentId ?? null,
  objective: s.objective ?? null,
  allow_forward_jump: s.allowJump ?? false,
  source_file_type: s.sourceFileType ?? 'docx',
})
async function ensureFocusSop(title, s) {
  const patch = focusSopPatch(s)
  let q = sb.from('sops').select('id, status, objective, allow_forward_jump, parent_sop_id, superseded_by').eq('organisation_id', siteOrg.id).eq('title', title).eq('version', patch.version)
  q = patch.parent_sop_id ? q.eq('parent_sop_id', patch.parent_sop_id) : q.is('parent_sop_id', null)
  const { data: existing, error } = await q.maybeSingle()
  if (error) throw error
  if (!existing) {
    const { data, error: inErr } = await sb
      .from('sops')
      .insert({
        organisation_id: siteOrg.id,
        title,
        source_file_name: title,
        source_file_path: '',
        uploaded_by: siteAdmin.id,
        source_type: 'blank',
        published_at: patch.status === 'published' ? new Date().toISOString() : null,
        ...patch,
      })
      .select('id')
      .single()
    if (inErr) throw inErr
    console.log('created fixture SOP', title, 'v' + patch.version, data.id)
    return data.id
  }
  const drift = existing.status !== patch.status || existing.objective !== patch.objective || existing.allow_forward_jump !== patch.allow_forward_jump || existing.superseded_by !== null
  if (drift) {
    const { error: upErr } = await sb
      .from('sops')
      .update({
        status: patch.status,
        objective: patch.objective,
        allow_forward_jump: patch.allow_forward_jump,
        superseded_by: null,
        ...(patch.status === 'published' ? { published_at: new Date().toISOString() } : {}),
      })
      .eq('id', existing.id)
    if (upErr) throw upErr
    console.log('reset fixture SOP', title, 'v' + patch.version, existing.id)
  }
  return existing.id
}
async function ensureFocusSection(sopId) {
  const { data, error } = await sb.from('sop_sections').select('id').eq('sop_id', sopId).order('sort_order').limit(1).maybeSingle()
  if (error) throw error
  if (data) return data.id
  const { data: made, error: inErr } = await sb
    .from('sop_sections')
    .insert({ sop_id: sopId, section_type: 'procedure', title: 'Procedure', sort_order: 0, approved: true })
    .select('id')
    .single()
  if (inErr) throw inErr
  return made.id
}
// specs: [{ key, kind, text, tip?, photo?, ticked? }] -- source_key is 'new:eval-<key>'
async function ensureFocusSteps(sopId, sectionId, specs) {
  const ids = {}
  for (const [i, sp] of specs.entries()) {
    const source_key = 'new:eval-' + sp.key
    const want = { kind: sp.kind, text: sp.text, tip: sp.tip ?? null, photo_required: sp.photo ?? false, sort_order: i }
    const { data: ex, error } = await sb
      .from('sop_focus_steps')
      .select('id, kind, text, tip, photo_required, sort_order, verified_by_admin_id')
      .eq('section_id', sectionId)
      .eq('source_key', source_key)
      .maybeSingle()
    if (error) throw error
    const tick = sp.ticked ? { verified_by_admin_id: siteAdmin.id, verified_at: new Date().toISOString() } : { verified_by_admin_id: null, verified_at: null }
    if (!ex) {
      const { data, error: inErr } = await sb
        .from('sop_focus_steps')
        .insert({ organisation_id: siteOrg.id, sop_id: sopId, section_id: sectionId, source_key, ...want, ...tick })
        .select('id')
        .single()
      if (inErr) throw inErr
      ids[sp.key] = data.id
      continue
    }
    ids[sp.key] = ex.id
    const content = Object.keys(want).some((k) => ex[k] !== want[k])
    const tickDrift = Boolean(ex.verified_by_admin_id) !== Boolean(sp.ticked)
    if (content || tickDrift) {
      // content first (the trigger clears the tick), tick second (the tick action itself is left alone)
      if (content) {
        const { error: upErr } = await sb.from('sop_focus_steps').update(want).eq('id', ex.id)
        if (upErr) throw upErr
      }
      const { error: tErr } = await sb.from('sop_focus_steps').update(tick).eq('id', ex.id)
      if (tErr) throw tErr
    }
  }
  return ids
}
async function ensureFinding(sopId, stepId, description, severity, kind) {
  const { data: ex, error } = await sb.from('sop_ai_findings').select('id, cleared_at, step_id').eq('sop_id', sopId).eq('description', description).maybeSingle()
  if (error) throw error
  if (!ex) {
    const { error: inErr } = await sb.from('sop_ai_findings').insert({ organisation_id: siteOrg.id, sop_id: sopId, job: 'A', kind, severity, step_id: stepId, description })
    if (inErr) throw inErr
  } else if (ex.cleared_at !== null || ex.step_id !== stepId) {
    const { error: upErr } = await sb.from('sop_ai_findings').update({ cleared_at: null, cleared_by: null, step_id: stepId }).eq('id', ex.id)
    if (upErr) throw upErr
  }
}
async function ensureParseJob(sopId, job) {
  const { data: ex, error } = await sb.from('parse_jobs').select('id, status, error_message, input_type, file_type, current_stage').eq('sop_id', sopId).limit(1).maybeSingle()
  if (error) throw error
  const row = { status: job.status, error_message: job.error ?? null, input_type: job.inputType, file_type: job.fileType, current_stage: job.stage ?? null }
  if (!ex) {
    const { error: inErr } = await sb
      .from('parse_jobs')
      .insert({ organisation_id: siteOrg.id, sop_id: sopId, file_path: '', started_at: new Date(Date.now() - (job.ageMs ?? 0)).toISOString(), ...row })
    if (inErr) throw inErr
  } else if (Object.keys(row).some((k) => ex[k] !== row[k])) {
    const { error: upErr } = await sb.from('parse_jobs').update(row).eq('id', ex.id)
    if (upErr) throw upErr
  }
}

// walk fixture: the converted-rows shape (hazard, ppe, step, photo step, check), only when none exist yet
{
  const { count, error } = await sb.from('sop_focus_steps').select('id', { count: 'exact', head: true }).eq('sop_id', walkSop.id)
  if (error) throw error
  if (!count) {
    await ensureFocusSteps(walkSop.id, walkSection.id, [
      { key: 'walk-hazard', kind: 'hazard', text: 'Stored energy in the hydraulic line.' },
      { key: 'walk-ppe', kind: 'ppe', text: 'Safety glasses' },
      { key: 'walk-step1', kind: 'step', text: 'Check the guard is closed.' },
      { key: 'walk-step2', kind: 'step', text: 'Photograph the closed guard.', photo: true },
      { key: 'walk-check', kind: 'check', text: 'The guard is latched.' },
    ])
    console.log('created walk fixture focus steps')
  }
  FOCUS['EVAL walk focus steps'] = walkSop.id
}

const FOUR = (ticked) => [
  { key: 'a', kind: 'step', text: 'Isolate the press.', ticked: ticked[0] },
  { key: 'b', kind: 'step', text: 'Fit your own lock.', tip: 'Use a red lock.', ticked: ticked[1] },
  { key: 'c', kind: 'step', text: 'Photograph the lock.', photo: true, ticked: ticked[2] },
  { key: 'd', kind: 'check', text: 'The press cannot start.', ticked: ticked[3] },
]

// EVAL focus jump: published, forward jump allowed
{
  const id = await ensureFocusSop('EVAL focus jump', { status: 'published', allowJump: true })
  const sec = await ensureFocusSection(id)
  await ensureFocusSteps(id, sec, [
    { key: 'j-hazard', kind: 'hazard', text: 'Pinch point at the rollers.', ticked: true },
    { key: 'j-photo', kind: 'step', text: 'Photograph the guard.', photo: true, ticked: true },
    { key: 'j-1', kind: 'step', text: 'Close the guard.', ticked: true },
    { key: 'j-2', kind: 'step', text: 'Start the press.', ticked: true },
  ])
  FOCUS['EVAL focus jump'] = id
}

// EVAL focus draft: draft, four steps (two ticked), one open step-level and one open SOP-level finding
{
  const id = await ensureFocusSop('EVAL focus draft', { status: 'draft', objective: 'Isolate and lock out the press.' })
  const sec = await ensureFocusSection(id)
  const ids = await ensureFocusSteps(id, sec, FOUR([true, true, false, false]))
  await ensureFinding(id, ids.c, 'EVAL focus finding: the photo step has no instruction on what to show.', 'warning', 'omission')
  await ensureFinding(id, null, 'EVAL focus finding: no emergency stop step is mentioned anywhere.', 'critical', 'omission')
  FOCUS['EVAL focus draft'] = id
}

// EVAL focus ready: draft, every step ticked, no open finding
{
  const id = await ensureFocusSop('EVAL focus ready', { status: 'draft', objective: 'Close the guard.' })
  const sec = await ensureFocusSection(id)
  await ensureFocusSteps(id, sec, FOUR([true, true, true, true]).slice(0, 3))
  const { error } = await sb.from('sop_ai_findings').delete().eq('sop_id', id)
  if (error) throw error
  FOCUS['EVAL focus ready'] = id
}

// EVAL focus blank: draft, no sections
{
  const id = await ensureFocusSop('EVAL focus blank', { status: 'draft' })
  const { error } = await sb.from('sop_sections').delete().eq('sop_id', id)
  if (error) throw error
  FOCUS['EVAL focus blank'] = id
}

// EVAL focus lineage: v2 published root, v3 published child, v4 draft child
{
  const root = await ensureFocusSop('EVAL focus lineage', { status: 'published', version: 2 })
  const v3 = await ensureFocusSop('EVAL focus lineage', { status: 'published', version: 3, parentId: root })
  const v4 = await ensureFocusSop('EVAL focus lineage', { status: 'draft', version: 4, parentId: root })
  for (const [id, key] of [[root, 'l2'], [v3, 'l3'], [v4, 'l4']]) {
    const sec = await ensureFocusSection(id)
    await ensureFocusSteps(id, sec, [
      { key: key + '-1', kind: 'step', text: 'Close the guard (' + key + ').', ticked: true },
      { key: key + '-2', kind: 'step', text: 'Start the press (' + key + ').', ticked: true },
    ])
  }
  FOCUS['EVAL focus lineage'] = root + ' v3=' + v3 + ' v4=' + v4
}

// EVAL focus publish: published v1 the eval forks, ticks and publishes; later lineage members are removed each run
{
  const id = await ensureFocusSop('EVAL focus publish', { status: 'published' })
  const { error } = await sb.from('sops').delete().eq('organisation_id', siteOrg.id).eq('parent_sop_id', id)
  if (error) throw error
  const sec = await ensureFocusSection(id)
  await ensureFocusSteps(id, sec, [
    { key: 'p-1', kind: 'step', text: 'Close the guard.', ticked: true },
    { key: 'p-2', kind: 'step', text: 'Start the press.', ticked: true },
  ])
  FOCUS['EVAL focus publish'] = id
}

// parsing (document + video) and failed-parse states
{
  const doc = await ensureFocusSop('EVAL focus parsing', { status: 'parsing' })
  await ensureParseJob(doc, { status: 'processing', inputType: 'upload', fileType: 'docx', stage: 'structuring', ageMs: 60_000 })
  FOCUS['EVAL focus parsing'] = doc
  const vid = await ensureFocusSop('EVAL focus parsing video', { status: 'parsing', sourceFileType: 'video' })
  await ensureParseJob(vid, { status: 'processing', inputType: 'video_file', fileType: 'video', stage: 'drafting', ageMs: 60_000 })
  FOCUS['EVAL focus parsing video'] = vid
  const bad = await ensureFocusSop('EVAL focus parse failed', { status: 'parsing' })
  await ensureParseJob(bad, { status: 'failed', inputType: 'upload', fileType: 'docx', error: 'We could not read this file. It may be password protected.' })
  FOCUS['EVAL focus parse failed'] = bad
}
for (const [name, id] of Object.entries(FOCUS)) console.log('present:', name, '->', id)

console.log(`SOPstart Eval Site → org=${siteOrg.id} admin=${siteAdmin.id} department=${dept.id} sop=${sop.id} worker=${siteWorker.id} plantSop=${plantSop.id} walkSop=${walkSop.id} convertSop=${convertSop.id}`)
