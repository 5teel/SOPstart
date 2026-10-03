/**
 * Phase 56 / Plan 56-04 -- live RLS / trigger / cascade matrix for migrations
 * 00069 and 00070, in throwaway organisations.
 *
 * Gated by PHASE56_LIVE=1 so a quick `npm run test` never mints a session
 * (CLAUDE.md 2026-09-28: live probes share one Supabase OTP budget). Exactly
 * two sessions are minted in beforeAll (adminA, workerA). Run ONCE.
 *
 * Decisions written by the probe stay in the ledger forever (append-only, by
 * design); their summary is `probe`.
 *
 * Denied PostgREST writes can be silent zero-row denies, so every denial
 * re-reads the row with the service client instead of trusting the response.
 *
 * Registration: playwright.config.ts `phase56` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function loadEnv(): void {
  try {
    const envText = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8')
    for (const line of envText.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
    }
  } catch {
    // env already populated by the shell
  }
}
loadEnv()
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

const noSession = { auth: { autoRefreshToken: false, persistSession: false } }
const svc = (): SupabaseClient => createClient(SUPABASE_URL!, SERVICE_KEY!, noSession)

async function mintAccessToken(admin: SupabaseClient, email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error || !data?.properties?.hashed_token) throw new Error(`generateLink failed: ${error?.message}`)
  const anon = createClient(SUPABASE_URL!, ANON_KEY!, noSession)
  const { data: vd, error: ve } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' })
  if (ve || !vd.session) throw new Error(`verifyOtp failed: ${ve?.message}`)
  return vd.session.access_token
}

function asUser(accessToken: string): SupabaseClient {
  return createClient(SUPABASE_URL!, ANON_KEY!, {
    ...noSession,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}

const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const machineCode = () => Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('')

const orgIds: string[] = []
const userIds: string[] = []

async function ephemeralOrg(admin: SupabaseClient, label: string): Promise<string> {
  const { data, error } = await admin.from('organisations').insert({ name: `Phase56 ${label} ${Date.now()}` }).select('id').single()
  if (error || !data) throw new Error(`org insert failed: ${error?.message}`)
  orgIds.push(data.id)
  return data.id
}

async function ephemeralMember(admin: SupabaseClient, orgId: string, role: 'admin' | 'worker') {
  const email = `p56-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-phase56-test.invalid`
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (error || !data?.user) throw new Error(`createUser failed: ${error?.message}`)
  userIds.push(data.user.id)
  const { error: me } = await admin.from('organisation_members').insert({ organisation_id: orgId, user_id: data.user.id, role })
  if (me) throw new Error(`member insert failed: ${me.message}`)
  return { userId: data.user.id, email }
}

async function ephemeralSop(admin: SupabaseClient, orgId: string, uploader: string): Promise<string> {
  const { data, error } = await admin
    .from('sops')
    .insert({
      organisation_id: orgId,
      title: 'Phase56 schema probe SOP',
      status: 'published',
      version: 1,
      uploaded_by: uploader,
      source_file_path: 'phase56-probe/probe.docx',
      source_file_type: 'docx',
      source_file_name: 'probe.docx',
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`sop insert failed: ${error?.message}`)
  return data.id
}

async function ephemeralSection(admin: SupabaseClient, sopId: string): Promise<string> {
  const { data, error } = await admin
    .from('sop_sections')
    .insert({ sop_id: sopId, section_type: 'procedure', title: 'Phase56 probe section', sort_order: 10, approved: false })
    .select('id')
    .single()
  if (error || !data) throw new Error(`section insert failed: ${error?.message}`)
  return data.id
}

async function placementOf(admin: SupabaseClient, sopId: string): Promise<string | undefined> {
  const { data } = await admin.from('sops').select('placement').eq('id', sopId).maybeSingle()
  return data?.placement
}

const fx = {} as {
  admin: SupabaseClient
  orgA: string
  orgB: string
  adminA: { userId: string; client: SupabaseClient }
  workerA: { userId: string; client: SupabaseClient }
  sopA: string
  sopB: string
  sectionA: string
  sectionB: string
  layoutA: string
  machineA: string
  stdB: string
}

test.describe.configure({ mode: 'serial' })

test.describe('Phase 56 schema -- live runtime matrix (00069 + 00070)', () => {
  test.skip(process.env.PHASE56_LIVE !== '1' || !SERVICE_KEY, 'live DB probe -- run with PHASE56_LIVE=1')

  test.beforeAll(async () => {
    test.setTimeout(120_000)
    const admin = svc()
    fx.admin = admin
    fx.orgA = await ephemeralOrg(admin, 'A')
    fx.orgB = await ephemeralOrg(admin, 'B')
    const a = await ephemeralMember(admin, fx.orgA, 'admin')
    const w = await ephemeralMember(admin, fx.orgA, 'worker')
    // Two OTP spends in total: one session per role.
    const adminToken = await mintAccessToken(admin, a.email)
    const workerToken = await mintAccessToken(admin, w.email)
    fx.adminA = { userId: a.userId, client: asUser(adminToken) }
    fx.workerA = { userId: w.userId, client: asUser(workerToken) }

    fx.sopA = await ephemeralSop(admin, fx.orgA, a.userId)
    fx.sopB = await ephemeralSop(admin, fx.orgB, a.userId)
    fx.sectionA = await ephemeralSection(admin, fx.sopA)
    fx.sectionB = await ephemeralSection(admin, fx.sopB)

    const { data: layout, error: le } = await admin.from('site_layouts').insert({ organisation_id: fx.orgA, name: 'Probe site' }).select('id').single()
    if (le || !layout) throw new Error(`layout insert failed: ${le?.message}`)
    fx.layoutA = layout.id
    const { data: machine, error: me } = await admin
      .from('site_machines')
      .insert({
        site_layout_id: fx.layoutA,
        organisation_id: fx.orgA,
        name: 'Probe machine',
        polygon: [[0, 0], [1, 0], [1, 1]],
        code: machineCode(),
      })
      .select('id')
      .single()
    if (me || !machine) throw new Error(`machine insert failed: ${me?.message}`)
    fx.machineA = machine.id

    const { data: std, error: se } = await admin.from('standards').insert({ organisation_id: fx.orgB, name: 'PROBE B' }).select('id').single()
    if (se || !std) throw new Error(`org B standard insert failed: ${se?.message}`)
    fx.stdB = std.id
  })

  test.afterAll(async () => {
    if (!SERVICE_KEY) return
    const admin = svc()
    for (const id of orgIds) await admin.from('organisations').delete().eq('id', id)
    for (const id of userIds) await admin.auth.admin.deleteUser(id).catch(() => {})
  })

  test('1. placement follows sop_machines: admin insert/delete, machine cascade, SOP delete', async () => {
    const { admin, adminA, sopA, machineA, orgA } = fx
    expect(await placementOf(admin, sopA)).toBe('site')

    const ins = await adminA.client.from('sop_machines').insert({ sop_id: sopA, machine_id: machineA, organisation_id: orgA })
    expect(ins.error, ins.error?.message).toBeNull()
    expect(await placementOf(admin, sopA)).toBe('machine')

    const del = await adminA.client.from('sop_machines').delete().eq('sop_id', sopA).eq('machine_id', machineA)
    expect(del.error, del.error?.message).toBeNull()
    expect(await placementOf(admin, sopA)).toBe('site')

    // machine delete cascades the link -> placement flips back to site
    const relink = await admin.from('sop_machines').insert({ sop_id: sopA, machine_id: machineA, organisation_id: orgA })
    expect(relink.error, relink.error?.message).toBeNull()
    expect(await placementOf(admin, sopA)).toBe('machine')
    const delMachine = await admin.from('site_machines').delete().eq('id', machineA)
    expect(delMachine.error, delMachine.error?.message).toBeNull()
    expect(await placementOf(admin, sopA)).toBe('site')

    // a SOP that still has a machine link can be deleted (cascade + trigger, no error)
    const { data: m2, error: me } = await admin
      .from('site_machines')
      .insert({ site_layout_id: fx.layoutA, organisation_id: orgA, name: 'Probe machine 2', polygon: [[0, 0], [1, 0], [1, 1]], code: machineCode() })
      .select('id')
      .single()
    expect(me, me?.message).toBeNull()
    const sopTmp = await ephemeralSop(admin, orgA, adminA.userId)
    const l2 = await admin.from('sop_machines').insert({ sop_id: sopTmp, machine_id: m2!.id, organisation_id: orgA })
    expect(l2.error, l2.error?.message).toBeNull()
    expect(await placementOf(admin, sopTmp)).toBe('machine')
    const delSop = await admin.from('sops').delete().eq('id', sopTmp)
    expect(delSop.error, delSop.error?.message).toBeNull()
    const { data: gone } = await admin.from('sops').select('id').eq('id', sopTmp).maybeSingle()
    expect(gone).toBeNull()
  })

  test('2. standards scoping, attachments and cascades', async () => {
    const { admin, adminA, workerA, orgA, orgB, sopA, sopB, sectionA, stdB } = fx

    // admin writes
    const insA = await adminA.client.from('standards').insert({ organisation_id: orgA, name: 'PROBE A' }).select('id').single()
    expect(insA.error, insA.error?.message).toBeNull()
    const stdA = insA.data!.id as string

    // worker reads, cannot write
    const wRead = await workerA.client.from('standards').select('id, name').eq('id', stdA)
    expect(wRead.error).toBeNull()
    expect(wRead.data).toHaveLength(1)
    const wIns = await workerA.client.from('standards').insert({ organisation_id: orgA, name: 'PROBE W' })
    expect(wIns.error, 'worker insert must be denied').not.toBeNull()
    const { data: wRow } = await admin.from('standards').select('id').eq('organisation_id', orgA).eq('name', 'PROBE W')
    expect(wRow).toHaveLength(0)
    // worker rename/delete are silent zero-row denies
    await workerA.client.from('standards').update({ name: 'HACKED' }).eq('id', stdA)
    await workerA.client.from('standards').delete().eq('id', stdA)
    const { data: stdAAfter } = await admin.from('standards').select('name').eq('id', stdA).single()
    expect(stdAAfter?.name).toBe('PROBE A')

    // admin rename + delete
    const insR = await adminA.client.from('standards').insert({ organisation_id: orgA, name: 'PROBE R' }).select('id').single()
    expect(insR.error, insR.error?.message).toBeNull()
    const stdR = insR.data!.id as string
    const ren = await adminA.client.from('standards').update({ name: 'PROBE R2' }).eq('id', stdR)
    expect(ren.error, ren.error?.message).toBeNull()
    const { data: renamed } = await admin.from('standards').select('name').eq('id', stdR).single()
    expect(renamed?.name).toBe('PROBE R2')
    const delR = await adminA.client.from('standards').delete().eq('id', stdR)
    expect(delR.error, delR.error?.message).toBeNull()
    const { data: rGone } = await admin.from('standards').select('id').eq('id', stdR).maybeSingle()
    expect(rGone).toBeNull()

    // cross-org: admin A cannot see org B's standard
    const seeB = await adminA.client.from('standards').select('id').eq('id', stdB)
    expect(seeB.data ?? []).toHaveLength(0)

    // adminA cannot attach org B's standard to org A's SOP
    const crossStd = await adminA.client.from('standard_attachments').insert({ organisation_id: orgA, standard_id: stdB, sop_id: sopA })
    expect(crossStd.error, 'attach foreign standard must be denied').not.toBeNull()
    // adminA cannot attach PROBE A to org B's SOP, under either organisation_id
    const crossSopA = await adminA.client.from('standard_attachments').insert({ organisation_id: orgA, standard_id: stdA, sop_id: sopB })
    expect(crossSopA.error, 'attach to foreign SOP (own org id) must be denied').not.toBeNull()
    const crossSopB = await adminA.client.from('standard_attachments').insert({ organisation_id: orgB, standard_id: stdA, sop_id: sopB })
    expect(crossSopB.error, 'attach to foreign SOP (foreign org id) must be denied').not.toBeNull()
    const { data: leaked } = await admin.from('standard_attachments').select('id').in('standard_id', [stdA, stdB])
    expect(leaked).toHaveLength(0)

    // adminA attaches PROBE A to org A's section; worker can read it
    const att = await adminA.client.from('standard_attachments').insert({ organisation_id: orgA, standard_id: stdA, section_id: sectionA })
    expect(att.error, att.error?.message).toBeNull()
    const wAtt = await workerA.client.from('standard_attachments').select('id').eq('standard_id', stdA)
    expect(wAtt.data).toHaveLength(1)
    // worker cannot attach
    const wAttach = await workerA.client.from('standard_attachments').insert({ organisation_id: orgA, standard_id: stdA, sop_id: sopA })
    expect(wAttach.error, 'worker attach must be denied').not.toBeNull()

    // deleting the standard removes its attachment
    const insC = await adminA.client.from('standards').insert({ organisation_id: orgA, name: 'PROBE C' }).select('id').single()
    expect(insC.error, insC.error?.message).toBeNull()
    const stdC = insC.data!.id as string
    const attC = await adminA.client.from('standard_attachments').insert({ organisation_id: orgA, standard_id: stdC, section_id: sectionA })
    expect(attC.error, attC.error?.message).toBeNull()
    const delC = await adminA.client.from('standards').delete().eq('id', stdC)
    expect(delC.error, delC.error?.message).toBeNull()
    const { data: cAtt } = await admin.from('standard_attachments').select('id').eq('standard_id', stdC)
    expect(cAtt).toHaveLength(0)

    // deleting a section removes its attachments
    const section2 = await ephemeralSection(admin, sopA)
    const att2 = await adminA.client.from('standard_attachments').insert({ organisation_id: orgA, standard_id: stdA, section_id: section2 })
    expect(att2.error, att2.error?.message).toBeNull()
    const delSec = await admin.from('sop_sections').delete().eq('id', section2)
    expect(delSec.error, delSec.error?.message).toBeNull()
    const { data: secAtt } = await admin.from('standard_attachments').select('id').eq('section_id', section2)
    expect(secAtt).toHaveLength(0)
  })

  test('3. focus steps: same-org read, cross-org invisible', async () => {
    const { admin, adminA, workerA, orgA, orgB, sopA, sopB, sectionA, sectionB } = fx
    const base = { run_id: crypto.randomUUID(), kind: 'step', text: 'probe', sort_order: 1, source_key: 'probe' }
    const a = await admin.from('sop_focus_steps').insert({ ...base, organisation_id: orgA, sop_id: sopA, section_id: sectionA }).select('id').single()
    expect(a.error, a.error?.message).toBeNull()
    const b = await admin.from('sop_focus_steps').insert({ ...base, organisation_id: orgB, sop_id: sopB, section_id: sectionB }).select('id').single()
    expect(b.error, b.error?.message).toBeNull()

    const wRead = await workerA.client.from('sop_focus_steps').select('id').eq('id', a.data!.id)
    expect(wRead.error).toBeNull()
    expect(wRead.data).toHaveLength(1)
    const crossRead = await adminA.client.from('sop_focus_steps').select('id').eq('id', b.data!.id)
    expect(crossRead.data ?? []).toHaveLength(0)
    // no write policy: a session insert is denied
    const wIns = await adminA.client.from('sop_focus_steps').insert({ ...base, source_key: 'probe2', organisation_id: orgA, sop_id: sopA, section_id: sectionA })
    expect(wIns.error, 'session insert into sop_focus_steps must be denied').not.toBeNull()
  })

  test('4. ledger: read scope, no session insert, append-only, agent name CHECK', async () => {
    const { admin, adminA, workerA, orgA, sopA } = fx
    const row = {
      organisation_id: orgA,
      kind: 'approve',
      actor_kind: 'person',
      actor_id: adminA.userId,
      subject_kind: 'sop',
      subject_id: sopA,
      sop_id: sopA,
      summary: 'probe',
    }
    const ins = await admin.from('decisions').insert(row).select('id').single()
    expect(ins.error, ins.error?.message).toBeNull()
    const id = ins.data!.id as string

    const aRead = await adminA.client.from('decisions').select('id').eq('id', id)
    expect(aRead.error).toBeNull()
    expect(aRead.data).toHaveLength(1)
    const wRead = await workerA.client.from('decisions').select('id').eq('organisation_id', orgA)
    expect(wRead.data ?? []).toHaveLength(0)

    const aIns = await adminA.client.from('decisions').insert({ ...row, summary: 'probe forged by admin' })
    expect(aIns.error, 'admin session insert must be denied').not.toBeNull()
    const wIns = await workerA.client.from('decisions').insert({ ...row, summary: 'probe forged by worker' })
    expect(wIns.error, 'worker session insert must be denied').not.toBeNull()
    const { data: forged } = await admin.from('decisions').select('id').eq('organisation_id', orgA).like('summary', 'probe forged%')
    expect(forged).toHaveLength(0)

    const upd = await admin.from('decisions').update({ summary: 'probe changed' }).eq('id', id)
    expect(upd.error, 'service_role update must be refused').not.toBeNull()
    const del = await admin.from('decisions').delete().eq('id', id)
    expect(del.error, 'service_role delete must be refused').not.toBeNull()
    const { data: after } = await admin.from('decisions').select('summary, kind').eq('id', id).single()
    expect(after).toEqual({ summary: 'probe', kind: 'approve' })

    const unnamed = await admin.from('decisions').insert({ ...row, actor_kind: 'agent', actor_id: null, actor_name: null })
    expect(unnamed.error?.code).toBe('23514')
    const named = await admin.from('decisions').insert({ ...row, actor_kind: 'agent', actor_id: null, actor_name: 'SOPstart assistant' })
    expect(named.error, named.error?.message).toBeNull()
  })

  test('5. orphan block-update RPC is not callable by an admin session', async () => {
    const dummy = '00000000-0000-0000-0000-000000000000'
    for (const fn of ['accept_block_update', 'decline_block_update']) {
      const { data, error } = await fx.adminA.client.rpc(fn, { p_sop_section_block_id: dummy, p_new_version_id: dummy, p_note: null })
      expect(error, `${fn} must fail with a permission error`).not.toBeNull()
      expect(data).toBeNull()
      expect(`${error?.code} ${error?.message}`).toMatch(/42501|permission denied|not found|PGRST202/i)
    }
  })
})
