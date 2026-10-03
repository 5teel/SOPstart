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
export const EVAL_PLANT_SOP_TITLE = 'Eval plant fixture SOP'
// Phase 55 (55-01): a published, UNASSIGNED, machine-less SOP whose step 2 asks for a
// photo -- the walk eval completes it, so it must never be the plant fixture SOP.
export const EVAL_WALK_SOP_TITLE = 'Eval walk fixture SOP'

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

console.log(`SOPstart Eval Site → org=${siteOrg.id} admin=${siteAdmin.id} department=${dept.id} sop=${sop.id} worker=${siteWorker.id} plantSop=${plantSop.id} walkSop=${walkSop.id}`)
