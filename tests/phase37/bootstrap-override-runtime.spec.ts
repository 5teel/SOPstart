/**
 * ASR-01 -- success criterion 2 bootstrap probe: an org with ZERO signed-off
 * assessors must not be permanently locked out of recording advancing
 * observations. An admin override succeeds and lands is_assessor_override =
 * true with a reason; a plain supervisor in the same org is rejected at the
 * RLS layer (the override path is admin/safety_manager only, D-05/D-06); the
 * reason is mandatory at the DB CHECK-constraint layer regardless of who
 * inserts; the bootstrap resolves after the first sign-off (D-05); and a
 * later needs_support observation suspends assess capability again (D-02
 * carried into assess capability).
 *
 * FLIPPED LIVE in 37-06 (no test.fixme) -- modeled on
 * tests/phase34/observation-cross-org-isolation.spec.ts and
 * tests/phase36/version-currency-lineage.spec.ts: ephemeral throwaway org +
 * real magic-link-minted sessions + the REAL, EXPORTED isSignedOffAssessor
 * predicate (src/lib/competency/assessor.ts) called directly against the
 * live database, since recordObservation/signOffCompletion gate through
 * getSessionContext() and cannot be invoked outside a Next.js request scope
 * (Phase 32-05 learning).
 *
 * Registration: playwright.config.ts `phase37` project
 *   testDir: '.', testMatch: /tests\/phase37\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --project=phase37 -g "bootstrap"`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isSignedOffAssessor } from '@/lib/competency/assessor'

const ROOT = process.cwd()

// ---------------------------------------------------------------------------
// Live Supabase fixture helpers ([2026-05-08]/[2026-04-24] env + session
// patterns, mirrors tests/phase34/observation-cross-org-isolation.spec.ts).
// ---------------------------------------------------------------------------

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
  role: 'admin' | 'supervisor' | 'worker'
): Promise<{ userId: string; email: string }> {
  const email = `p37-boot-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-phase37-test.invalid`
  const { data: userResp, error } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (error || !userResp?.user) throw new Error(`createUser failed: ${error?.message}`)
  cleanupUserIds.push(userResp.user.id)
  const { error: memErr } = await admin.from('organisation_members').insert({ organisation_id: orgId, user_id: userResp.user.id, role })
  if (memErr) throw new Error(`organisation_members insert failed: ${memErr.message}`)
  return { userId: userResp.user.id, email }
}

async function createEphemeralSop(admin: SupabaseClient, orgId: string, uploaderId: string): Promise<{ id: string; version: number }> {
  const { data, error } = await admin
    .from('sops')
    .insert({
      organisation_id: orgId,
      title: 'Phase37 bootstrap probe SOP',
      status: 'published',
      version: 1,
      uploaded_by: uploaderId,
      source_file_path: 'phase37-bootstrap/probe.docx',
      source_file_type: 'docx',
      source_file_name: 'probe.docx',
    })
    .select('id, version')
    .single()
  if (error || !data) throw new Error(`createEphemeralSop failed: ${error?.message}`)
  return data as { id: string; version: number }
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
// Real live-Supabase assertions -- no test.fixme. test.describe.serial keeps
// the six assertions running in order against ONE shared ephemeral org/SOP,
// since assertions 5/6 depend on evidence written by earlier assertions.
// ---------------------------------------------------------------------------

test.describe.serial('ASR-01 -- bootstrap override (zero signed-off assessors in org)', () => {
  test.skip(!LIVE_ENV_READY, 'requires NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local')

  const admin = LIVE_ENV_READY ? serviceClient() : (null as unknown as SupabaseClient)
  let orgId: string
  let sopId: string
  let sopVersion: number
  let adminId: string
  let supervisorId: string
  let workerId: string
  let asAdmin: SupabaseClient
  let asSupervisor: SupabaseClient

  test.beforeAll(async () => {
    if (!LIVE_ENV_READY) return
    orgId = await createEphemeralOrg(admin, 'Phase37 Bootstrap Org')
    const adminMember = await createEphemeralMember(admin, orgId, 'admin')
    const supervisorMember = await createEphemeralMember(admin, orgId, 'supervisor')
    const workerMember = await createEphemeralMember(admin, orgId, 'worker')
    adminId = adminMember.userId
    supervisorId = supervisorMember.userId
    workerId = workerMember.userId
    const sop = await createEphemeralSop(admin, orgId, adminId)
    sopId = sop.id
    sopVersion = sop.version
    asAdmin = asUserClient(await mintAccessToken(admin, adminMember.email))
    asSupervisor = asUserClient(await mintAccessToken(admin, supervisorMember.email))
  })

  test('1. zero assessors exist -- neither admin nor supervisor is a signed-off assessor before any evidence', async () => {
    expect(await isSignedOffAssessor(adminId, sopId, admin, orgId)).toBe(false)
    expect(await isSignedOffAssessor(supervisorId, sopId, admin, orgId)).toBe(false)
  })

  test('2. the override bootstraps (SC-2) -- admin records an advancing observation with a reason and the row reads back with a reconstructible audit trail (D-07)', async () => {
    const { data, error } = await asAdmin
      .from('sop_observations')
      .insert({
        organisation_id: orgId,
        sop_id: sopId,
        sop_version: sopVersion,
        observed_worker_id: workerId,
        observed_by: adminId,
        verdict: 'performed_to_sop',
        is_assessor_override: true,
        override_reason: 'Bootstrap: no signed-off assessors exist yet in this brand-new org.',
      })
      .select('id, observed_by, created_at, observed_worker_id, sop_id, is_assessor_override, override_reason')
      .single()

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.is_assessor_override).toBe(true)
    expect(data!.override_reason).toBe('Bootstrap: no signed-off assessors exist yet in this brand-new org.')
    // D-07 -- reconstructible audit trail: who / when / which worker / which SOP / which record.
    expect(data!.id).toBeTruthy()
    expect(data!.observed_by).toBe(adminId)
    expect(data!.created_at).toBeTruthy()
    expect(data!.observed_worker_id).toBe(workerId)
    expect(data!.sop_id).toBe(sopId)
  })

  test('3. the override reason is mandatory at the DB level -- a reasonless override insert is rejected with 23514', async () => {
    const { data, error } = await asAdmin
      .from('sop_observations')
      .insert({
        organisation_id: orgId,
        sop_id: sopId,
        sop_version: sopVersion,
        observed_worker_id: workerId,
        observed_by: adminId,
        verdict: 'performed_to_sop',
        is_assessor_override: true,
        override_reason: null,
      })
      .select('id')

    expect(error).not.toBeNull()
    expect(error?.code).toBe('23514')
    expect(error?.message).toContain('sop_observations_override_reason_required')
    expect(data).toBeFalsy()
  })

  test('4. a plain supervisor cannot self-stamp an override -- sop_observations_insert_recorder denies the insert (37-01 T-37-01-02)', async () => {
    const { data, error } = await asSupervisor
      .from('sop_observations')
      .insert({
        organisation_id: orgId,
        sop_id: sopId,
        sop_version: sopVersion,
        observed_worker_id: workerId,
        observed_by: supervisorId,
        verdict: 'performed_to_sop',
        is_assessor_override: true,
        override_reason: 'A supervisor attempting to self-stamp an override should never succeed.',
      })
      .select('id')

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/row-level security/i)
    expect(data).toBeFalsy()
  })

  test('5. the bootstrap resolves and never re-deadlocks (D-05) -- once signed off, the supervisor is an assessor with no override needed', async () => {
    const t0 = new Date()
    const t1 = new Date(t0.getTime() + 1000)

    const completionId = randomUUID()
    const { error: completionError } = await admin.from('sop_completions').insert({
      id: completionId,
      organisation_id: orgId,
      sop_id: sopId,
      worker_id: supervisorId,
      sop_version: sopVersion,
      content_hash: 'phase37-bootstrap-probe-hash',
      step_data: {},
      submitted_at: t0.toISOString(),
    })
    expect(completionError).toBeNull()

    const { error: signOffError } = await admin.from('completion_sign_offs').insert({
      organisation_id: orgId,
      completion_id: completionId,
      supervisor_id: adminId,
      decision: 'approved',
      created_at: t1.toISOString(),
    })
    expect(signOffError).toBeNull()

    expect(await isSignedOffAssessor(supervisorId, sopId, admin, orgId)).toBe(true)
  })

  test('6. the reset suspends assess capability again -- a later needs_support observation flips the newly signed-off supervisor back to false (D-02 carried into assess capability)', async () => {
    const later = new Date(Date.now() + 120_000)
    const { error } = await (admin as any).from('sop_observations').insert({
      organisation_id: orgId,
      sop_id: sopId,
      sop_version: sopVersion,
      observed_worker_id: supervisorId,
      observed_by: adminId,
      verdict: 'needs_support',
      is_assessor_override: false,
      override_reason: null,
      created_at: later.toISOString(),
    })
    expect(error).toBeNull()

    expect(await isSignedOffAssessor(supervisorId, sopId, admin, orgId)).toBe(false)
  })
})
