/**
 * UAT seed for Phase 35 training matrix — creates OBVIOUSLY-FAKE, easily
 * removable sample data so the matrix/record/CSV/profile surfaces can be
 * eyeballed on sopstart.com.
 *
 * Everything is tagged for one-shot removal by scripts/uat-seed-cleanup.mjs:
 *  - fake workers: emails end in @uat-seed.test (password: UatSeed!2026)
 *  - department: code UATSEED
 *  - completions: content_hash 'uat-seed'
 *  - observations/sign-offs: keyed to the fake worker ids
 *
 * Run:      node scripts/uat-seed-competency.mjs
 * Cleanup:  node scripts/uat-seed-cleanup.mjs
 */
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

for (const f of ['.env', '.env.local']) {
  if (!fs.existsSync(f)) continue
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=')
    if (i > 0 && !process.env[line.slice(0, i).trim()]) {
      process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
    }
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const ADMIN_EMAIL = 'simonscott86@gmail.com'
const PASSWORD = 'UatSeed!2026'
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()

async function findUserByEmail(email) {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const hit = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (hit) return hit
    if (data.users.length < 1000) return null
  }
}

async function main() {
  // 1. Resolve org from the real admin account
  const adminUser = await findUserByEmail(ADMIN_EMAIL)
  if (!adminUser) throw new Error(`Admin user ${ADMIN_EMAIL} not found`)
  const { data: member, error: mErr } = await admin.from('organisation_members')
    .select('organisation_id').eq('user_id', adminUser.id).single()
  if (mErr) throw mErr
  const orgId = member.organisation_id
  console.log(`Org: ${orgId}`)

  // 2. Pick up to 4 published SOPs to act as "required" SOPs
  const { data: sops, error: sErr } = await admin.from('sops')
    .select('id, title, version').eq('organisation_id', orgId).eq('status', 'published').limit(4)
  if (sErr) throw sErr
  if (!sops?.length) throw new Error('No published SOPs in org — publish at least one first')
  console.log(`SOPs: ${sops.map(s => s.title).join(' | ')}`)

  // 3. Department (reuse if a previous run created it)
  let dept
  const { data: existingDept } = await admin.from('departments')
    .select('id').eq('organisation_id', orgId).eq('code', 'UATSEED').maybeSingle()
  if (existingDept) {
    dept = existingDept
  } else {
    const { data, error: dErr } = await admin.from('departments')
      .insert({ organisation_id: orgId, name: 'UAT Seed Dept', code: 'UATSEED', colour: '#f59e0b' })
      .select('id').single()
    if (dErr) throw dErr
    dept = data
  }
  console.log(`Department: ${dept.id}`)

  // 4. Fake workers — each maps to a distinct competency state
  const personas = [
    { email: 'wiremu.kahu@uat-seed.test', plan: 'nothing' },              // Not started
    { email: 'aroha.ngata@uat-seed.test', plan: 'completion' },           // Read (awaiting sign-off)
    { email: 'mike.tamati@uat-seed.test', plan: 'completion+obs' },       // Supervised
    { email: 'sarah.puke@uat-seed.test', plan: 'completion+signoff' },    // Competent
    { email: 'dean.harris@uat-seed.test', plan: 'signoff-then-reset' },   // Read + needs-support flag
    { email: 'tom.aiken@uat-seed.test', plan: 'obs-only-then-reset' },    // Not started + flag (WR-04 floor)
  ]

  const workers = []
  for (const p of personas) {
    const existing = await findUserByEmail(p.email)
    if (existing) { workers.push({ ...p, id: existing.id }); continue }
    const { data, error } = await admin.auth.admin.createUser({
      email: p.email, password: PASSWORD, email_confirm: true,
    })
    if (error) throw error
    workers.push({ ...p, id: data.user.id })
  }
  console.log(`Workers: ${workers.length}`)

  // 5. Org membership (role worker) + department assignment
  for (const w of workers) {
    const { error } = await admin.from('organisation_members')
      .upsert({ organisation_id: orgId, user_id: w.id, role: 'worker' }, { onConflict: 'organisation_id,user_id' })
    if (error) throw error
    const { error: e2 } = await admin.from('member_departments')
      .upsert({ member_id: w.id, department_id: dept.id, assigned_by: adminUser.id }, { onConflict: 'member_id,department_id' })
    if (e2) throw e2
  }

  // 6. Required SOPs for the department
  for (const s of sops) {
    const { error } = await admin.from('sop_departments')
      .upsert({ sop_id: s.id, department_id: dept.id }, { onConflict: 'sop_id,department_id' })
    if (error) throw error
  }

  // 6b. Org-model role placement so workers appear in Chart/Columns views
  // (listOrgTree renders people from roles + role_members, not member_departments).
  // Cleanup: cascades via department delete (roles) + user delete (role_members).
  let role
  const { data: existingRole } = await admin.from('roles')
    .select('id').eq('department_id', dept.id).eq('name', 'UAT Operator').maybeSingle()
  if (existingRole) {
    role = existingRole
  } else {
    const { data, error } = await admin.from('roles')
      .insert({ organisation_id: orgId, department_id: dept.id, name: 'UAT Operator', budgeted_count: personas.length })
      .select('id').single()
    if (error) throw error
    role = data
  }
  for (const w of workers) {
    const { error } = await admin.from('role_members')
      .upsert({ role_id: role.id, member_id: w.id, assigned_by: adminUser.id }, { onConflict: 'role_id,member_id' })
    if (error) throw error
  }
  console.log(`Role: UAT Operator (${workers.length} placed)`)

  // 7. Evidence per persona, spread across the seeded SOPs
  // Idempotency guard: evidence inserts are append-only — skip on re-run.
  const { count: seededCount } = await admin.from('sop_completions')
    .select('id', { count: 'exact', head: true }).eq('content_hash', 'uat-seed')
  if (seededCount && seededCount > 0) {
    console.log(`Evidence already seeded (${seededCount} completions) — skipping.`)
    console.log('\nSeed complete (re-run).')
    return
  }
  const completion = async (workerId, sop, when, status = 'pending_sign_off') => {
    const id = randomUUID()
    const { error } = await admin.from('sop_completions').insert({
      id, organisation_id: orgId, sop_id: sop.id, worker_id: workerId,
      sop_version: sop.version ?? 1, content_hash: 'uat-seed', status,
      step_data: { uat_seed: true }, submitted_at: when, created_at: when,
    })
    if (error) throw error
    return id
  }
  const signOff = async (completionId, when) => {
    const { error } = await admin.from('completion_sign_offs').insert({
      organisation_id: orgId, completion_id: completionId, supervisor_id: adminUser.id,
      decision: 'approved', reason: 'uat-seed', created_at: when,
    })
    if (error) throw error
  }
  const observe = async (workerId, sop, verdict, when) => {
    const { error } = await admin.from('sop_observations').insert({
      organisation_id: orgId, sop_id: sop.id, sop_version: sop.version ?? 1,
      observed_worker_id: workerId, observed_by: adminUser.id,
      verdict, note: 'uat-seed', created_at: when,
    })
    if (error) throw error
  }

  for (const [wi, w] of workers.entries()) {
    // First SOP gets the persona's headline plan (the states listed below).
    const sop0 = sops[0]
    switch (w.plan) {
      case 'nothing':
        break
      case 'completion':
        await completion(w.id, sop0, daysAgo(20))
        break
      case 'completion+obs':
        await completion(w.id, sop0, daysAgo(25))
        await observe(w.id, sop0, 'performed_to_sop', daysAgo(18))
        break
      case 'completion+signoff': {
        const cid = await completion(w.id, sop0, daysAgo(30), 'signed_off')
        await signOff(cid, daysAgo(28))
        break
      }
      case 'signoff-then-reset': {
        const cid = await completion(w.id, sop0, daysAgo(40), 'signed_off')
        await signOff(cid, daysAgo(38))
        await observe(w.id, sop0, 'needs_support', daysAgo(5))
        break
      }
      case 'obs-only-then-reset':
        await observe(w.id, sop0, 'performed_to_sop', daysAgo(15))
        await observe(w.id, sop0, 'needs_support', daysAgo(3))
        break
    }
    // Later SOPs: plain completion for every other worker so the wider grid
    // shows a mix of Read and Not started, not one uniform column.
    for (const [i, sop] of sops.slice(1).entries()) {
      if ((wi + i) % 2 === 0) await completion(w.id, sop, daysAgo(14 - i))
    }
  }

  console.log('\nSeed complete.')
  console.log(`Department "UAT Seed Dept" with ${workers.length} fake workers across ${sops.length} SOPs.`)
  console.log(`Worker login for profile test: aroha.ngata@uat-seed.test / ${PASSWORD}`)
  console.log('Expected first-SOP states: Wiremu=Not started, Aroha=Read, Mike=Supervised, Sarah=Competent, Dean=Read+flag, Tom=Not started+flag')
  console.log('\nCleanup later: node scripts/uat-seed-cleanup.mjs')
}

main().catch(e => { console.error(e); process.exit(1) })
