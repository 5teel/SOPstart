/**
 * Phase 58 / Plan 58-03 -- live RLS + trigger proof for migration 00071
 * (sop_walks, sop_ai_findings, the sop_focus_steps tick trigger).
 *
 * Gated by PHASE58_LIVE=1 (CLAUDE.md 2026-09-28: live probes share one Supabase
 * OTP budget). Three sessions are minted in beforeAll (admin, worker, peer
 * worker). Run ONCE. Everything runs in throwaway organisations that are deleted
 * afterwards, so no customer row is touched.
 *
 * Denied PostgREST writes can be silent zero-row denies, so every denial
 * re-reads the row with the service client instead of trusting the response.
 *
 * Registration: playwright.config.ts `phase58` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function loadEnv(): void {
  for (const f of ['.env.local', '.env']) {
    try {
      for (const line of fs.readFileSync(path.join(process.cwd(), f), 'utf8').split(/\r?\n/)) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
      }
    } catch {
      // env already populated by the shell
    }
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

const asUser = (token: string): SupabaseClient =>
  createClient(SUPABASE_URL!, ANON_KEY!, { ...noSession, global: { headers: { Authorization: `Bearer ${token}` } } })

const orgIds: string[] = []
const userIds: string[] = []

async function ephemeralOrg(admin: SupabaseClient, label: string): Promise<string> {
  const { data, error } = await admin.from('organisations').insert({ name: `Phase58 ${label} ${Date.now()}` }).select('id').single()
  if (error || !data) throw new Error(`org insert failed: ${error?.message}`)
  orgIds.push(data.id)
  return data.id
}

async function ephemeralMember(admin: SupabaseClient, orgId: string, role: 'admin' | 'worker') {
  const email = `p58-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-phase58-test.invalid`
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
      title: 'Phase58 rls probe SOP',
      status: 'published',
      version: 1,
      uploaded_by: uploader,
      source_file_path: 'phase58-probe/probe.docx',
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
    .insert({ sop_id: sopId, section_type: 'procedure', title: 'Phase58 probe section', sort_order: 10, approved: false })
    .select('id')
    .single()
  if (error || !data) throw new Error(`section insert failed: ${error?.message}`)
  return data.id
}

const fx = {} as {
  admin: SupabaseClient
  orgA: string
  orgB: string
  adminA: { userId: string; client: SupabaseClient }
  workerA: { userId: string; client: SupabaseClient }
  peerA: { userId: string }
  sopA: string
  sopB: string
  sectionA: string
  walkA: string
  walkPeer: string
  walkB: string
}

const stepRow = async (id: string) => {
  const { data, error } = await fx.admin
    .from('sop_focus_steps')
    .select('text, sort_order, verified_by_admin_id, verified_at, needs_recheck')
    .eq('id', id)
    .single()
  expect(error, error?.message).toBeNull()
  return data!
}

async function tickedStep(text: string): Promise<string> {
  const { data, error } = await fx.admin
    .from('sop_focus_steps')
    .insert({
      organisation_id: fx.orgA,
      sop_id: fx.sopA,
      section_id: fx.sectionA,
      kind: 'step',
      text,
      sort_order: 1,
      verified_by_admin_id: fx.adminA.userId,
      verified_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`step insert failed: ${error?.message}`)
  return data.id
}

test.describe.configure({ mode: 'serial' })

test.describe('Phase 58 schema -- live RLS and trigger matrix (00071)', () => {
  test.skip(process.env.PHASE58_LIVE !== '1' || !SERVICE_KEY, 'live DB probe -- run with PHASE58_LIVE=1')

  test.beforeAll(async () => {
    test.setTimeout(120_000)
    const admin = svc()
    fx.admin = admin
    fx.orgA = await ephemeralOrg(admin, 'A')
    fx.orgB = await ephemeralOrg(admin, 'B')
    const a = await ephemeralMember(admin, fx.orgA, 'admin')
    const w = await ephemeralMember(admin, fx.orgA, 'worker')
    const p = await ephemeralMember(admin, fx.orgA, 'worker')
    const b = await ephemeralMember(admin, fx.orgB, 'worker')
    // Two OTP spends in total: one session per acting role (admin, worker).
    fx.adminA = { userId: a.userId, client: asUser(await mintAccessToken(admin, a.email)) }
    fx.workerA = { userId: w.userId, client: asUser(await mintAccessToken(admin, w.email)) }
    fx.peerA = { userId: p.userId }

    fx.sopA = await ephemeralSop(admin, fx.orgA, a.userId)
    fx.sopB = await ephemeralSop(admin, fx.orgB, a.userId)
    fx.sectionA = await ephemeralSection(admin, fx.sopA)

    const walk = async (org: string, sop: string, worker: string) => {
      const { data, error } = await admin
        .from('sop_walks')
        .insert({ organisation_id: org, sop_id: sop, sop_version: 1, worker_id: worker })
        .select('id')
        .single()
      if (error || !data) throw new Error(`walk insert failed: ${error?.message}`)
      return data.id as string
    }
    fx.walkA = await walk(fx.orgA, fx.sopA, w.userId)
    fx.walkPeer = await walk(fx.orgA, fx.sopA, p.userId)
    fx.walkB = await walk(fx.orgB, fx.sopB, b.userId)

    // one open finding per SOP-level and step-level shape, org A
    const { error: fe } = await admin.from('sop_ai_findings').insert({
      organisation_id: fx.orgA,
      sop_id: fx.sopA,
      job: 'A',
      kind: 'omission',
      severity: 'warning',
      description: 'Phase58 probe finding',
    })
    if (fe) throw new Error(`finding insert failed: ${fe.message}`)
  })

  test.afterAll(async () => {
    if (!SERVICE_KEY) return
    const admin = svc()
    for (const id of orgIds) await admin.from('organisations').delete().eq('id', id)
    for (const id of userIds) await admin.auth.admin.deleteUser(id).catch(() => {})
  })

  test('1. worker reads only their own walk (not a same-org peer, not another org)', async () => {
    const { data, error } = await fx.workerA.client.from('sop_walks').select('id')
    expect(error, error?.message).toBeNull()
    expect((data ?? []).map((r) => r.id)).toEqual([fx.walkA])
  })

  test('2. no authenticated write reaches sop_walks, not even the worker\'s own row (00072); the service role can', async () => {
    // 00072 dropped the insert and update policies (review CR-01): the server gate in
    // src/actions/walk.ts is the only writer, through the service client.
    const own = await fx.workerA.client
      .from('sop_walks')
      .insert({ organisation_id: fx.orgA, sop_id: fx.sopB, sop_version: 1, worker_id: fx.workerA.userId })
    expect(own.error).not.toBeNull()
    const peer = await fx.workerA.client
      .from('sop_walks')
      .insert({ organisation_id: fx.orgA, sop_id: fx.sopA, sop_version: 1, worker_id: fx.peerA.userId, status: 'submitted' })
    expect(peer.error).not.toBeNull()
    // an UPDATE is a silent zero-row deny: re-read with the service client. A forged
    // done map on the worker's OWN row is exactly the bypass 00072 closes.
    await fx.workerA.client.from('sop_walks').update({ done: { forged: 'x' }, status: 'submitted' }).eq('id', fx.walkA)
    const { data: ownRow } = await fx.admin.from('sop_walks').select('status, done').eq('id', fx.walkA).single()
    expect(ownRow?.status).toBe('in_progress')
    expect(ownRow?.done).toEqual({})
    await fx.workerA.client.from('sop_walks').update({ status: 'abandoned' }).eq('id', fx.walkPeer)
    const { data } = await fx.admin.from('sop_walks').select('status').eq('id', fx.walkPeer).single()
    expect(data?.status).toBe('in_progress')
    // the action's channel (service role, self-scoped by org + worker) still writes
    const viaAction = await fx.admin
      .from('sop_walks')
      .update({ done: { ok: 'y' } })
      .eq('id', fx.walkA)
      .eq('organisation_id', fx.orgA)
      .eq('worker_id', fx.workerA.userId)
      .select('done')
      .single()
    expect(viaAction.error, viaAction.error?.message).toBeNull()
    expect(viaAction.data?.done).toEqual({ ok: 'y' })
  })

  test('3. one in_progress walk per worker and SOP', async () => {
    const dup = await fx.admin
      .from('sop_walks')
      .insert({ organisation_id: fx.orgA, sop_id: fx.sopA, sop_version: 1, worker_id: fx.workerA.userId })
    expect(dup.error?.code).toBe('23505')
  })

  test('4. a worker reads zero AI findings, an admin reads the org\'s', async () => {
    const w = await fx.workerA.client.from('sop_ai_findings').select('id')
    expect(w.error, w.error?.message).toBeNull()
    expect(w.data ?? []).toHaveLength(0)
    const a = await fx.adminA.client.from('sop_ai_findings').select('id, description').eq('sop_id', fx.sopA)
    expect(a.error, a.error?.message).toBeNull()
    expect((a.data ?? []).map((r) => r.description)).toEqual(['Phase58 probe finding'])
  })

  test('5. no authenticated write reaches sop_focus_steps or sop_ai_findings, even for an admin', async () => {
    const ins = await fx.adminA.client.from('sop_focus_steps').insert({
      organisation_id: fx.orgA,
      sop_id: fx.sopA,
      section_id: fx.sectionA,
      kind: 'step',
      text: 'Phase58 forged step',
      sort_order: 99,
    })
    expect(ins.error).not.toBeNull()
    const { count } = await fx.admin.from('sop_focus_steps').select('id', { count: 'exact', head: true }).eq('text', 'Phase58 forged step')
    expect(count).toBe(0)

    const f = await fx.adminA.client.from('sop_ai_findings').update({ cleared_at: new Date().toISOString() }).eq('sop_id', fx.sopA)
    void f
    const { data } = await fx.admin.from('sop_ai_findings').select('cleared_at').eq('sop_id', fx.sopA)
    expect((data ?? []).every((r) => r.cleared_at === null)).toBe(true)
  })

  test('6. a text edit on a ticked step clears the tick and raises needs_recheck', async () => {
    const id = await tickedStep('Phase58 ticked step')
    expect((await stepRow(id)).verified_by_admin_id).toBe(fx.adminA.userId)
    const { error } = await fx.admin.from('sop_focus_steps').update({ text: 'Phase58 ticked step, edited' }).eq('id', id)
    expect(error, error?.message).toBeNull()
    const row = await stepRow(id)
    expect(row.verified_by_admin_id).toBeNull()
    expect(row.verified_at).toBeNull()
    expect(row.needs_recheck).toBe(true)
  })

  test('7. a reorder leaves the tick; re-ticking lowers needs_recheck', async () => {
    const id = await tickedStep('Phase58 reorder step')
    const { error } = await fx.admin.from('sop_focus_steps').update({ sort_order: 7 }).eq('id', id)
    expect(error, error?.message).toBeNull()
    const row = await stepRow(id)
    expect(row.verified_by_admin_id).toBe(fx.adminA.userId)
    expect(row.needs_recheck).toBe(false)

    // edit (clears, raises recheck), then tick again in a separate update
    await fx.admin.from('sop_focus_steps').update({ text: 'Phase58 reorder step v2' }).eq('id', id)
    expect((await stepRow(id)).needs_recheck).toBe(true)
    await fx.admin
      .from('sop_focus_steps')
      .update({ verified_by_admin_id: fx.adminA.userId, verified_at: new Date().toISOString() })
      .eq('id', id)
    const ticked = await stepRow(id)
    expect(ticked.verified_by_admin_id).toBe(fx.adminA.userId)
    expect(ticked.needs_recheck).toBe(false)
  })

  test('8. an edit to an unticked step leaves needs_recheck false', async () => {
    const { data, error } = await fx.admin
      .from('sop_focus_steps')
      .insert({ organisation_id: fx.orgA, sop_id: fx.sopA, section_id: fx.sectionA, kind: 'step', text: 'Phase58 plain step', sort_order: 2 })
      .select('id')
      .single()
    expect(error, error?.message).toBeNull()
    await fx.admin.from('sop_focus_steps').update({ text: 'Phase58 plain step, edited' }).eq('id', data!.id)
    const row = await stepRow(data!.id)
    expect(row.needs_recheck).toBe(false)
    expect(row.verified_by_admin_id).toBeNull()
  })
})
