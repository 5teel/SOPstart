/**
 * Phase 60 / 60-02 -- live RLS probe for requests, notifications and objectives.
 * Decisions: D-01, D-07, D-10. Threats: T-60-04..T-60-07.
 *
 * Proves, per role, who reads which rows and that no authenticated session can
 * insert, delete or rewrite anything -- except a person marking their own
 * notification read. Seeds rows in the eval-site org only (never the real org;
 * the real-org admin is used ONLY as the foreign-org reader) and deletes them in
 * afterAll. The five new ledger kinds are proven accepted by decision-kinds-live
 * (PHASE56_LIVE) and by the applier's check-definition assertion.
 *
 * Self-skips unless PHASE60_LIVE=1: live probes share one Supabase OTP budget
 * (CLAUDE.md 2026-09-28) -- four sessions are minted once; run it ONCE.
 * Registration: playwright.config.ts `phase60`.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { EVAL_SITE_ORG_NAME, EVAL_USERS } from '../evals/lib/session'
import { REAL_SOPSTART_ORG_ID } from '../evals/lib/plant-fixture'

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
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const LIVE = process.env.PHASE60_LIVE === '1' && !!SUPABASE_URL && !!SERVICE_KEY && !!ANON_KEY

const noSession = { auth: { autoRefreshToken: false, persistSession: false } }

interface Who {
  db: SupabaseClient
  id: string
}

async function sessionClient(svc: SupabaseClient, email: string): Promise<Who> {
  const { data, error } = await svc.auth.admin.generateLink({ type: 'magiclink', email })
  if (error || !data?.properties?.hashed_token) throw new Error(`generateLink failed: ${error?.message}`)
  const anon = createClient(SUPABASE_URL!, ANON_KEY!, noSession)
  const { data: vd, error: ve } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' })
  if (ve || !vd.session) throw new Error(`verifyOtp failed: ${ve?.message}`)
  return {
    id: vd.session.user.id,
    db: createClient(SUPABASE_URL!, ANON_KEY!, { ...noSession, global: { headers: { Authorization: `Bearer ${vd.session.access_token}` } } }),
  }
}

test.describe('requests / notifications / objectives rls live (60-02)', () => {
  test.skip(!LIVE, 'set PHASE60_LIVE=1 to run the live probe once')

  let svc: SupabaseClient
  let org: string
  let worker: Who
  let supervisor: Who
  let admin: Who
  let foreign: Who

  const reqIds: Record<'rWorkerOpen' | 'rSupOpen' | 'rTargetsWorker' | 'rAnswered' | 'rRoleWorker', string> = {
    rWorkerOpen: '', rSupOpen: '', rTargetsWorker: '', rAnswered: '', rRoleWorker: '',
  }
  let nWorker = ''
  let nSupervisor = ''
  let objId = ''
  const allReqIds = () => Object.values(reqIds)

  async function visible(who: Who, table: string, ids: string[]): Promise<string[]> {
    const { data, error } = await who.db.from(table).select('id').in('id', ids)
    expect(error).toBeNull()
    return (data ?? []).map((r: { id: string }) => r.id)
  }

  test.beforeAll(async () => {
    svc = createClient(SUPABASE_URL!, SERVICE_KEY!, noSession)
    const { data: o, error } = await svc.from('organisations').select('id').eq('name', EVAL_SITE_ORG_NAME).maybeSingle()
    if (error || !o) throw new Error(`"${EVAL_SITE_ORG_NAME}" org not found: ${error?.message ?? 'run node scripts/eval-fixtures.mjs'}`)
    org = o.id
    expect(org).not.toBe(REAL_SOPSTART_ORG_ID)

    worker = await sessionClient(svc, EVAL_USERS.siteWorker)
    supervisor = await sessionClient(svc, EVAL_USERS.siteSupervisor)
    admin = await sessionClient(svc, EVAL_USERS.siteAdmin)
    foreign = await sessionClient(svc, EVAL_USERS.admin)

    const base = { organisation_id: org }
    const now = new Date().toISOString()
    const seed = async (row: Record<string, unknown>) => {
      const { data, error: e } = await svc.from('requests').insert({ ...base, note: 'phase60 probe', ...row }).select('id').single()
      if (e) throw new Error(`seed request failed: ${e.message}`)
      return data.id as string
    }
    reqIds.rWorkerOpen = await seed({ kind: 'change_sop', subject_type: 'site', raised_by_user: worker.id })
    reqIds.rSupOpen = await seed({ kind: 'change_sop', subject_type: 'site', raised_by_user: supervisor.id })
    reqIds.rTargetsWorker = await seed({
      kind: 'do_sop', subject_type: 'sop', subject_id: randomUUID(), raised_by_user: admin.id,
      target_user_id: worker.id, state: 'accepted', answered_by: admin.id, decided_at: now,
    })
    reqIds.rAnswered = await seed({
      kind: 'change_sop', subject_type: 'site', raised_by_user: worker.id,
      state: 'declined', answered_by: randomUUID(), decided_at: now,
    })
    reqIds.rRoleWorker = await seed({
      kind: 'do_sop', subject_type: 'sop', subject_id: randomUUID(), raised_by_user: admin.id, target_role: 'worker',
    })

    const seedN = async (userId: string) => {
      const { data, error: e } = await svc
        .from('notifications')
        .insert({ ...base, user_id: userId, kind: 'asked', title: 'phase60 probe', place: '/sops', subject_type: 'sop', subject_id: randomUUID(), dedupe_key: `probe-${randomUUID()}` })
        .select('id')
        .single()
      if (e) throw new Error(`seed notification failed: ${e.message}`)
      return data.id as string
    }
    nWorker = await seedN(worker.id)
    nSupervisor = await seedN(supervisor.id)

    const { data: ob, error: oe } = await svc
      .from('objectives')
      .insert({ ...base, subject_type: 'machine', subject_id: randomUUID(), text: 'phase60 probe objective', set_by_user: admin.id })
      .select('id')
      .single()
    if (oe) throw new Error(`seed objective failed: ${oe.message}`)
    objId = ob.id
  })

  test.afterAll(async () => {
    if (!svc) return
    await svc.from('requests').delete().in('id', allReqIds().filter(Boolean))
    await svc.from('notifications').delete().in('id', [nWorker, nSupervisor].filter(Boolean))
    if (objId) await svc.from('objectives').delete().eq('id', objId)
  })

  test('requests: a worker reads own, targeted and role-targeted rows and none of another person\'s', async () => {
    const got = await visible(worker, 'requests', allReqIds())
    expect(got.sort()).toEqual([reqIds.rWorkerOpen, reqIds.rTargetsWorker, reqIds.rRoleWorker, reqIds.rAnswered].sort())
    expect(got).not.toContain(reqIds.rSupOpen)
  })

  test('requests: a supervisor reads the open rows of the org, not answered rows they did not answer', async () => {
    const got = await visible(supervisor, 'requests', allReqIds())
    expect(got.sort()).toEqual([reqIds.rWorkerOpen, reqIds.rSupOpen, reqIds.rRoleWorker].sort())
    expect(got).not.toContain(reqIds.rTargetsWorker)
    expect(got).not.toContain(reqIds.rAnswered)
  })

  test('requests: an admin reads the open rows plus the row they raised and answered, not a stranger\'s answered row', async () => {
    const got = await visible(admin, 'requests', allReqIds())
    expect(got.sort()).toEqual([reqIds.rWorkerOpen, reqIds.rSupOpen, reqIds.rTargetsWorker, reqIds.rRoleWorker].sort())
    expect(got).not.toContain(reqIds.rAnswered)
  })

  test('requests: no authenticated role can insert, update or delete', async () => {
    for (const who of [worker, supervisor, admin]) {
      const ins = await who.db.from('requests').insert({
        organisation_id: org, kind: 'change_sop', subject_type: 'site', raised_by_user: who.id, note: 'forged',
      })
      expect(ins.error, 'an authenticated insert must be refused').not.toBeNull()
      // no UPDATE / DELETE policy: a silent zero-row deny, so re-read with the service client
      await who.db.from('requests').update({ note: 'tampered', state: 'accepted' }).eq('id', reqIds.rWorkerOpen)
      await who.db.from('requests').delete().eq('id', reqIds.rWorkerOpen)
    }
    const { data } = await svc.from('requests').select('note, state').eq('id', reqIds.rWorkerOpen).single()
    expect(data).toEqual({ note: 'phase60 probe', state: 'open' })
    const { count } = await svc.from('requests').select('id', { count: 'exact', head: true }).eq('note', 'forged')
    expect(count).toBe(0)
  })

  test('requests: a foreign-org admin reads zero eval-site rows', async () => {
    expect(await visible(foreign, 'requests', allReqIds())).toEqual([])
  })

  test('notifications: each person reads only their own row', async () => {
    expect(await visible(worker, 'notifications', [nWorker, nSupervisor])).toEqual([nWorker])
    expect(await visible(supervisor, 'notifications', [nWorker, nSupervisor])).toEqual([nSupervisor])
    expect(await visible(admin, 'notifications', [nWorker, nSupervisor])).toEqual([])
    expect(await visible(foreign, 'notifications', [nWorker, nSupervisor])).toEqual([])
  })

  test('notifications: read_at can be set on an own row; title, place and another person\'s row cannot be changed; no insert', async () => {
    const ok = await worker.db.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', nWorker).select('id, read_at')
    expect(ok.error).toBeNull()
    expect(ok.data).toHaveLength(1)
    expect(ok.data![0].read_at).not.toBeNull()

    const t = await worker.db.from('notifications').update({ title: 'rewritten' }).eq('id', nWorker)
    expect(t.error, 'title must be refused by the column grant').not.toBeNull()
    const p = await worker.db.from('notifications').update({ place: 'https://elsewhere.example' }).eq('id', nWorker)
    expect(p.error, 'place must be refused by the column grant').not.toBeNull()

    // another person's row: RLS filters it out, so zero rows change
    const other = await worker.db.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', nSupervisor).select('id')
    expect(other.data ?? []).toHaveLength(0)
    const { data: after } = await svc.from('notifications').select('id, title, place, read_at').in('id', [nWorker, nSupervisor])
    const byId = Object.fromEntries((after ?? []).map((r) => [r.id, r]))
    expect(byId[nWorker].title).toBe('phase60 probe')
    expect(byId[nWorker].place).toBe('/sops')
    expect(byId[nSupervisor].read_at).toBeNull()

    const ins = await worker.db.from('notifications').insert({
      organisation_id: org, user_id: worker.id, kind: 'asked', title: 'forged', place: '/sops', subject_type: 'sop', subject_id: randomUUID(), dedupe_key: `forged-${randomUUID()}`,
    })
    expect(ins.error, 'an authenticated insert must be refused').not.toBeNull()
    const del = await worker.db.from('notifications').delete().eq('id', nWorker)
    expect(del.error ?? null).toBeNull()
    const { count } = await svc.from('notifications').select('id', { count: 'exact', head: true }).eq('id', nWorker)
    expect(count).toBe(1)
  })

  test('objectives: every eval-site member reads; no authenticated write; a foreign org reads zero', async () => {
    for (const who of [worker, supervisor, admin]) expect(await visible(who, 'objectives', [objId])).toEqual([objId])
    expect(await visible(foreign, 'objectives', [objId])).toEqual([])

    for (const who of [worker, supervisor, admin]) {
      const ins = await who.db.from('objectives').insert({
        organisation_id: org, subject_type: 'machine', subject_id: randomUUID(), text: 'forged', set_by_user: who.id,
      })
      expect(ins.error, 'an authenticated insert must be refused').not.toBeNull()
      await who.db.from('objectives').update({ text: 'tampered' }).eq('id', objId)
      await who.db.from('objectives').delete().eq('id', objId)
    }
    const { data } = await svc.from('objectives').select('text').eq('id', objId).single()
    expect(data?.text).toBe('phase60 probe objective')
    const { count } = await svc.from('objectives').select('id', { count: 'exact', head: true }).eq('text', 'forged')
    expect(count).toBe(0)
  })

  test('ledger: a worker and a supervisor still read zero decisions (59 A-04)', async () => {
    for (const who of [worker, supervisor]) {
      const { data, error } = await who.db.from('decisions').select('id').limit(5)
      expect(error).toBeNull()
      expect(data ?? []).toHaveLength(0)
    }
  })
})
