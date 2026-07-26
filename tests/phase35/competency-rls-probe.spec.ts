/**
 * Phase 35 Plan 02 -- per-role runtime RLS probe matrix for the competency
 * surfaces. ACTIVATED during Phase 35 UAT (2026-07-26): the four probe
 * bodies below are real live-Supabase assertions run with real
 * magic-link-minted sessions against ephemeral throwaway orgs (mirrors
 * tests/phase34/observation-cross-org-isolation.spec.ts).
 *
 * Server actions (getTrainingMatrix / exportTrainingCsv /
 * getMyCompetencyStates) gate through getSessionContext(), which needs a
 * Next.js request scope — they cannot be invoked from a test harness
 * (Phase 32-05 learning). These probes therefore exercise the layer the
 * 2026-07-20 learning actually mandates: the RLS BRANCHES on the evidence
 * tables, one positive + negative probe per (role x own/other x
 * same/cross-org) combination. The action-level RECORDER_ROLES gates and
 * admin-client usage are pinned separately by source-contract specs in
 * tests/phase35/competency-actions.spec.ts.
 *
 *   1. supervisor, same-org -> observations org-branch ALLOWED (00054
 *      positive); completions session-read returns ZERO for unassigned
 *      workers — the exact silent-empty trap (34-10 class) that forces
 *      getTrainingMatrix onto createAdminClient (source-asserted inline).
 *   2. worker session -> peer completions AND peer observations both
 *      return zero rows (the 2026-07-20 org-wide disclosure-hole probe).
 *   3. admin, cross-org -> org-B departments / completions invisible.
 *   4. worker self-read -> own completions/observations readable,
 *      peer's return zero (positive self + negative peer).
 *
 * Registration: playwright.config.ts `phase35` project
 *   testDir: '.', testMatch: /tests\/phase35\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase35`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const ROOT = process.cwd()

function loadEnv(): void {
  try {
    const envText = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
    for (const line of envText.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
    }
  } catch {
    // env already populated by the shell / CI
  }
}

loadEnv()
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const LIVE_ENV_READY = !!(SUPABASE_URL && SERVICE_KEY && ANON_KEY)

function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function mintAccessToken(admin: SupabaseClient, email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error || !data?.properties?.hashed_token) throw new Error(`generateLink failed: ${error?.message}`)
  const anon = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: vd, error: ve } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' })
  if (ve || !vd.session) throw new Error(`verifyOtp failed: ${ve?.message}`)
  return vd.session.access_token
}

function asUserClient(accessToken: string): SupabaseClient {
  return createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}

const cleanupOrgIds: string[] = []
const cleanupUserIds: string[] = []

async function createEphemeralOrg(admin: SupabaseClient, namePrefix: string): Promise<string> {
  const { data, error } = await admin.from('organisations').insert({ name: `${namePrefix} ${Date.now()}` }).select('id').single()
  if (error || !data) throw new Error(`createEphemeralOrg failed: ${error?.message}`)
  cleanupOrgIds.push(data.id as string)
  return data.id as string
}

async function createEphemeralMember(
  admin: SupabaseClient,
  orgId: string,
  role: 'worker' | 'supervisor' | 'admin'
): Promise<{ userId: string; email: string }> {
  const email = `p35-rls-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-phase35-test.invalid`
  const { data: userResp, error } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (error || !userResp?.user) throw new Error(`createUser failed: ${error?.message}`)
  cleanupUserIds.push(userResp.user.id)
  const { error: memErr } = await admin.from('organisation_members').insert({ organisation_id: orgId, user_id: userResp.user.id, role })
  if (memErr) throw new Error(`organisation_members insert failed: ${memErr.message}`)
  return { userId: userResp.user.id, email }
}

async function createEphemeralDepartment(admin: SupabaseClient, orgId: string, name: string): Promise<string> {
  const code = `P35-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
  const { data, error } = await admin.from('departments').insert({ organisation_id: orgId, name, code }).select('id').single()
  if (error || !data) throw new Error(`createEphemeralDepartment failed: ${error?.message}`)
  return data.id as string
}

async function createEphemeralSop(admin: SupabaseClient, orgId: string, uploaderId: string): Promise<{ id: string; version: number }> {
  const { data, error } = await admin
    .from('sops')
    .insert({
      organisation_id: orgId,
      title: 'Phase35 RLS probe SOP',
      status: 'published',
      version: 1,
      uploaded_by: uploaderId,
      source_file_path: 'phase35-rls/probe.docx',
      source_file_type: 'docx',
      source_file_name: 'probe.docx',
    })
    .select('id, version')
    .single()
  if (error || !data) throw new Error(`createEphemeralSop failed: ${error?.message}`)
  return data as { id: string; version: number }
}

async function seedCompletion(admin: SupabaseClient, orgId: string, sop: { id: string; version: number }, workerId: string): Promise<string> {
  const id = randomUUID()
  const { error } = await admin.from('sop_completions').insert({
    id, organisation_id: orgId, sop_id: sop.id, worker_id: workerId,
    sop_version: sop.version, content_hash: 'p35-rls-probe', status: 'pending_sign_off',
    step_data: { probe: true }, submitted_at: new Date().toISOString(),
  })
  if (error) throw new Error(`seedCompletion failed: ${error.message}`)
  return id
}

async function seedObservation(admin: SupabaseClient, orgId: string, sop: { id: string; version: number }, workerId: string, observerId: string): Promise<void> {
  const { error } = await admin.from('sop_observations').insert({
    organisation_id: orgId, sop_id: sop.id, sop_version: sop.version,
    observed_worker_id: workerId, observed_by: observerId,
    verdict: 'performed_to_sop', note: 'p35-rls-probe',
  })
  if (error) throw new Error(`seedObservation failed: ${error.message}`)
}

test.afterAll(async () => {
  if (!LIVE_ENV_READY) return
  const admin = serviceClient()
  for (const orgId of cleanupOrgIds) {
    await admin.from('organisations').delete().eq('id', orgId)
  }
  for (const userId of cleanupUserIds) {
    await admin.auth.admin.deleteUser(userId).catch(() => {})
  }
})

// ---------------------------------------------------------------------------
// Probe 1 -- supervisor, same-org -> ALLOWED where RLS grants it (00054
// observations org branch), and the completions silent-empty trap is REAL
// (which is why getTrainingMatrix must use createAdminClient — 34-10 class).
// ---------------------------------------------------------------------------
test.describe('Probe 1 -- supervisor same-org matrix read', () => {
  test('supervisor reads same-org observations (00054 positive); session completions read is silently empty, admin-client compensation source-asserted', async () => {
    test.skip(!LIVE_ENV_READY, 'requires live Supabase env in .env.local')
    const admin = serviceClient()
    const orgId = await createEphemeralOrg(admin, 'Phase35 RLS Probe 1')
    const { userId: workerId } = await createEphemeralMember(admin, orgId, 'worker')
    const deptId = await createEphemeralDepartment(admin, orgId, 'Probe 1 Dept')
    await admin.from('member_departments').insert({ member_id: workerId, department_id: deptId })
    const { userId: supId, email: supEmail } = await createEphemeralMember(admin, orgId, 'supervisor')
    const sop = await createEphemeralSop(admin, orgId, supId)
    await seedCompletion(admin, orgId, sop, workerId)
    await seedObservation(admin, orgId, sop, workerId, supId)

    const sup = asUserClient(await mintAccessToken(admin, supEmail))

    // POSITIVE: 00054 recorder-role org branch — supervisor sees the worker's observation.
    const { data: obsRows, error: obsErr } = await sup.from('sop_observations').select('id').eq('observed_worker_id', workerId)
    expect(obsErr).toBeNull()
    expect(obsRows?.length ?? 0).toBeGreaterThan(0)

    // TRAP IS REAL: supervisor session read of an UNASSIGNED worker's completions
    // silently returns zero rows (00010 supervisor branch needs supervisor_assignments).
    // This is the 34-10 silent-empty class getTrainingMatrix must compensate for.
    const { data: compRows, error: compErr } = await sup.from('sop_completions').select('id').eq('worker_id', workerId)
    expect(compErr).toBeNull()
    expect(compRows?.length ?? 0).toBe(0)

    // COMPENSATION EXISTS: getTrainingMatrix runs its reads on createAdminClient()
    // AFTER the RECORDER_ROLES gate — the matrix can never silently render empty
    // for the supervisor persona.
    const actionsSrc = fs.readFileSync(path.join(ROOT, 'src/actions/competency.ts'), 'utf8')
    const matrixFn = actionsSrc.slice(actionsSrc.indexOf('export async function getTrainingMatrix'), actionsSrc.indexOf('export async function getTrainingRecordForPerson'))
    expect(matrixFn).toContain('RECORDER_ROLES.includes(role)')
    expect(matrixFn).toContain('createAdminClient()')
  })
})

// ---------------------------------------------------------------------------
// Probe 2 -- worker session cannot read peer evidence (2026-07-20 org-wide
// disclosure-hole probe: negative other-row, same-org, worker role).
// ---------------------------------------------------------------------------
test.describe('Probe 2 -- worker session denied at getTrainingMatrix / exportTrainingCsv', () => {
  test('a worker session reading a PEER\'s completions and observations gets zero rows', async () => {
    test.skip(!LIVE_ENV_READY, 'requires live Supabase env in .env.local')
    const admin = serviceClient()
    const orgId = await createEphemeralOrg(admin, 'Phase35 RLS Probe 2')
    const { email: workerEmail } = await createEphemeralMember(admin, orgId, 'worker')
    const { userId: peerId } = await createEphemeralMember(admin, orgId, 'worker')
    const { userId: supId } = await createEphemeralMember(admin, orgId, 'supervisor')
    const sop = await createEphemeralSop(admin, orgId, supId)
    await seedCompletion(admin, orgId, sop, peerId)
    await seedObservation(admin, orgId, sop, peerId, supId)

    const worker = asUserClient(await mintAccessToken(admin, workerEmail))

    const { data: peerComps, error: compErr } = await worker.from('sop_completions').select('id').eq('worker_id', peerId)
    expect(compErr).toBeNull()
    expect(peerComps?.length ?? 0).toBe(0)

    // 00054 closed the org-wide observations branch to recorder roles only.
    const { data: peerObs, error: obsErr } = await worker.from('sop_observations').select('id').eq('observed_worker_id', peerId)
    expect(obsErr).toBeNull()
    expect(peerObs?.length ?? 0).toBe(0)

    // The matrix/CSV role gate itself is server-action logic, pinned by source contract:
    const actionsSrc = fs.readFileSync(path.join(ROOT, 'src/actions/competency.ts'), 'utf8')
    expect(actionsSrc).toContain("if (!role || !RECORDER_ROLES.includes(role)) return { error: 'Not authorized' }")
  })
})

// ---------------------------------------------------------------------------
// Probe 3 -- admin, cross-org -> DENIED (negative cross-org, admin role).
// ---------------------------------------------------------------------------
test.describe('Probe 3 -- admin cross-org departmentId denied', () => {
  test('an org-A admin session cannot see org-B departments or completions', async () => {
    test.skip(!LIVE_ENV_READY, 'requires live Supabase env in .env.local')
    const admin = serviceClient()
    const orgAId = await createEphemeralOrg(admin, 'Phase35 RLS Probe 3 Org A')
    const orgBId = await createEphemeralOrg(admin, 'Phase35 RLS Probe 3 Org B')
    const { email: adminAEmail } = await createEphemeralMember(admin, orgAId, 'admin')
    const { userId: workerBId } = await createEphemeralMember(admin, orgBId, 'worker')
    const deptBId = await createEphemeralDepartment(admin, orgBId, 'Org B Dept')
    const sopB = await createEphemeralSop(admin, orgBId, workerBId)
    await seedCompletion(admin, orgBId, sopB, workerBId)

    const adminA = asUserClient(await mintAccessToken(admin, adminAEmail))

    const { data: deptRows, error: deptErr } = await adminA.from('departments').select('id').eq('id', deptBId)
    expect(deptErr).toBeNull()
    expect(deptRows?.length ?? 0).toBe(0)

    const { data: compRows, error: compErr } = await adminA.from('sop_completions').select('id').eq('worker_id', workerBId)
    expect(compErr).toBeNull()
    expect(compRows?.length ?? 0).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Probe 4 -- worker getMyCompetencyStates: own rows only, never a peer's
// (positive self-read + negative peer-read on both evidence tables).
// ---------------------------------------------------------------------------
test.describe('Probe 4 -- getMyCompetencyStates self-only (positive self + negative peer)', () => {
  test('a worker session reads their OWN completions/observations but a peer\'s return zero rows', async () => {
    test.skip(!LIVE_ENV_READY, 'requires live Supabase env in .env.local')
    const admin = serviceClient()
    const orgId = await createEphemeralOrg(admin, 'Phase35 RLS Probe 4')
    const { userId: workerAId, email: workerAEmail } = await createEphemeralMember(admin, orgId, 'worker')
    const { userId: workerBId } = await createEphemeralMember(admin, orgId, 'worker')
    const { userId: supId } = await createEphemeralMember(admin, orgId, 'supervisor')
    const deptId = await createEphemeralDepartment(admin, orgId, 'Probe 4 Dept')
    await admin.from('member_departments').insert([
      { member_id: workerAId, department_id: deptId },
      { member_id: workerBId, department_id: deptId },
    ])
    const sop = await createEphemeralSop(admin, orgId, supId)
    await seedCompletion(admin, orgId, sop, workerAId)
    await seedCompletion(admin, orgId, sop, workerBId)
    await seedObservation(admin, orgId, sop, workerAId, supId)
    await seedObservation(admin, orgId, sop, workerBId, supId)

    const workerA = asUserClient(await mintAccessToken(admin, workerAEmail))

    // POSITIVE self-read: worker A sees their own evidence.
    const { data: ownComps } = await workerA.from('sop_completions').select('id').eq('worker_id', workerAId)
    expect(ownComps?.length ?? 0).toBeGreaterThan(0)
    const { data: ownObs } = await workerA.from('sop_observations').select('id').eq('observed_worker_id', workerAId)
    expect(ownObs?.length ?? 0).toBeGreaterThan(0)

    // NEGATIVE peer-read: worker B's evidence is invisible to worker A.
    const { data: peerComps } = await workerA.from('sop_completions').select('id').eq('worker_id', workerBId)
    expect(peerComps?.length ?? 0).toBe(0)
    const { data: peerObs } = await workerA.from('sop_observations').select('id').eq('observed_worker_id', workerBId)
    expect(peerObs?.length ?? 0).toBe(0)

    // getMyCompetencyStates uses the SESSION client (self-scoped by these same
    // policies) — pinned by source contract: no admin client, no role gate.
    const actionsSrc = fs.readFileSync(path.join(ROOT, 'src/actions/competency.ts'), 'utf8')
    const myFn = actionsSrc.slice(actionsSrc.indexOf('export async function getMyCompetencyStates'), actionsSrc.indexOf('export async function exportTrainingCsv'))
    expect(myFn).not.toContain('createAdminClient')
  })
})
