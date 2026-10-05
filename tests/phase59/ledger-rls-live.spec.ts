/**
 * Phase 59 / 59-02 -- ledger RLS live probe. Requirement DEC-02; decision A-04.
 *
 * 00073 widens the kind check only; this proves the read scope did not move: a
 * worker and a supervisor read zero decision rows, an admin reads only its own
 * organisation, and no authenticated session can write. Uses the eval-site org's
 * fixture accounts (never the real SOPstart org) and needs rows to exist there
 * (decision-kinds-live writes them).
 *
 * Self-skips unless PHASE59_LIVE=1: live probes share one Supabase OTP budget
 * (CLAUDE.md 2026-09-28) -- three sessions are minted once; run it ONCE.
 * Registration: playwright.config.ts `phase59`.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
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
const LIVE = process.env.PHASE59_LIVE === '1' && !!SUPABASE_URL && !!SERVICE_KEY && !!ANON_KEY

const noSession = { auth: { autoRefreshToken: false, persistSession: false } }

async function sessionClient(admin: SupabaseClient, email: string): Promise<SupabaseClient> {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error || !data?.properties?.hashed_token) throw new Error(`generateLink failed: ${error?.message}`)
  const anon = createClient(SUPABASE_URL!, ANON_KEY!, noSession)
  const { data: vd, error: ve } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' })
  if (ve || !vd.session) throw new Error(`verifyOtp failed: ${ve?.message}`)
  return createClient(SUPABASE_URL!, ANON_KEY!, { ...noSession, global: { headers: { Authorization: `Bearer ${vd.session.access_token}` } } })
}

test.describe('ledger rls live (A-04)', () => {
  test.skip(!LIVE, 'set PHASE59_LIVE=1 to run the live ledger probe once')

  let svc: SupabaseClient
  let siteOrgId: string
  let worker: SupabaseClient
  let supervisor: SupabaseClient
  let admin: SupabaseClient

  test.beforeAll(async () => {
    svc = createClient(SUPABASE_URL!, SERVICE_KEY!, noSession)
    const { data: org, error } = await svc.from('organisations').select('id').eq('name', EVAL_SITE_ORG_NAME).maybeSingle()
    if (error || !org) throw new Error(`"${EVAL_SITE_ORG_NAME}" org not found: ${error?.message ?? 'run node scripts/eval-fixtures.mjs'}`)
    siteOrgId = org.id
    expect(siteOrgId).not.toBe(REAL_SOPSTART_ORG_ID)
    worker = await sessionClient(svc, EVAL_USERS.siteWorker)
    supervisor = await sessionClient(svc, EVAL_USERS.siteSupervisor)
    admin = await sessionClient(svc, EVAL_USERS.siteAdmin)
  })

  test('the ledger has rows to probe (service view)', async () => {
    const { count, error } = await svc.from('decisions').select('id', { count: 'exact', head: true }).eq('organisation_id', siteOrgId)
    expect(error).toBeNull()
    expect(count ?? 0, 'run PHASE56_LIVE=1 decision-kinds-live first').toBeGreaterThan(0)
  })

  test('a worker session reads 0 decision rows', async () => {
    const { data, error } = await worker.from('decisions').select('id').limit(5)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  test('a supervisor session reads 0 decision rows (no SELECT widening)', async () => {
    const { data, error } = await supervisor.from('decisions').select('id').limit(5)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  test('an admin session reads its own org only, never a foreign org', async () => {
    const { data, error } = await admin.from('decisions').select('id, organisation_id').limit(200)
    expect(error).toBeNull()
    expect((data ?? []).length).toBeGreaterThan(0)
    for (const r of data ?? []) {
      expect(r.organisation_id).toBe(siteOrgId)
      expect(r.organisation_id).not.toBe(REAL_SOPSTART_ORG_ID)
    }
  })

  test('no authenticated role can insert, update or delete a decision row', async () => {
    const { error: insErr } = await admin.from('decisions').insert({
      organisation_id: siteOrgId,
      kind: 'role_change',
      actor_kind: 'person',
      actor_id: '00000000-0000-4000-8000-000000000000',
      subject_kind: 'member',
      summary: 'probe forged decision',
    })
    expect(insErr, 'an authenticated insert must be refused').not.toBeNull()

    const { data: row } = await svc.from('decisions').select('id, summary').eq('organisation_id', siteOrgId).limit(1).single()
    expect(row).not.toBeNull()
    await admin.from('decisions').update({ summary: 'tampered' }).eq('id', row!.id)
    await admin.from('decisions').delete().eq('id', row!.id)
    const { data: after } = await svc.from('decisions').select('summary').eq('id', row!.id).single()
    expect(after?.summary).toBe(row!.summary)

    const { count } = await svc
      .from('decisions')
      .select('id', { count: 'exact', head: true })
      .eq('organisation_id', siteOrgId)
      .eq('summary', 'probe forged decision')
    expect(count ?? 0).toBe(0)
  })
})
