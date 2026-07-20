/**
 * Gap 1 (CR-01, BLOCKER) — sop_observations_read_org role-scope proof.
 *
 * The 00052 org-wide read branch had NO role check, so any authenticated
 * same-org user (including a plain worker) could read every observation
 * in the org via PostgREST -- peers' verdicts and supervisors' coaching
 * notes. Migration 00054 adds a role check to the org-wide branch,
 * mirroring the sop_completions (00010) role-scoped SELECT precedent.
 *
 * Per CLAUDE.md 2026-07-20 RLS-branch-coverage learning: every RLS branch
 * needs its OWN positive AND negative probe per role -- one probe per
 * policy is not coverage. This spec probes:
 *   - worker self-read: positive (own row) + negative (peer's row) in the
 *     same assertion.
 *   - supervisor org-wide read: positive across BOTH workers (unaffected
 *     by the fix -- recorder roles still see everything in-org).
 *
 * Registration: playwright.config.ts `phase34` project
 *   testDir: '.', testMatch: /tests\/phase34\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase34`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const ROOT = process.cwd()
const MIGRATION = path.join(ROOT, 'supabase', 'migrations', '00054_observation_read_role_scope.sql')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('CR-01 Gap 1 — role-scoped read policy source contract', () => {
  test('00054 creates sop_observations_read_org with a recorder-role check on the org-wide branch, self-read branch unchanged', () => {
    const sql = read(MIGRATION)
    expect(sql).toContain('create policy sop_observations_read_org')
    expect(sql).toContain("current_user_role() in ('admin', 'safety_manager', 'supervisor')")
    expect(sql).toContain('observed_worker_id = auth.uid()')
  })
})

// ---------------------------------------------------------------------------
// Live Supabase fixture helpers (mirrors observation-cross-org-isolation.spec.ts
// and observation-immutability.spec.ts verbatim -- no shared test-utils
// module exists for this pattern in this codebase).
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

async function createEphemeralMember(admin: SupabaseClient, orgId: string, role: 'worker' | 'supervisor'): Promise<{ userId: string; email: string }> {
  const email = `p34-rrs-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-phase34-test.invalid`
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
      title: 'Phase34 role-scope probe SOP',
      status: 'published',
      version: 1,
      uploaded_by: uploaderId,
      source_file_path: 'phase34-rrs/probe.docx',
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
// Real live-Supabase assertions — no test.fixme.
// ---------------------------------------------------------------------------

test.describe('CR-01 Gap 1 — role-scoped read runtime (real ephemeral org, real RLS)', () => {
  test.skip(!LIVE_ENV_READY, 'requires NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local')

  test('a plain worker reading sop_observations sees only their own row -- a same-org peer worker row is never returned', async () => {
    const admin = serviceClient()
    const orgId = await createEphemeralOrg(admin, 'Phase34 RRS Org')
    const { userId: supId } = await createEphemeralMember(admin, orgId, 'supervisor')
    const { userId: workerAId, email: workerAEmail } = await createEphemeralMember(admin, orgId, 'worker')
    const { userId: workerBId } = await createEphemeralMember(admin, orgId, 'worker')
    const sop = await createEphemeralSop(admin, orgId, supId)

    const { error: seedAErr } = await admin.from('sop_observations').insert({
      organisation_id: orgId,
      sop_id: sop.id,
      sop_version: sop.version,
      observed_worker_id: workerAId,
      observed_by: supId,
      verdict: 'performed_to_sop',
    })
    expect(seedAErr).toBeNull()

    const { error: seedBErr } = await admin.from('sop_observations').insert({
      organisation_id: orgId,
      sop_id: sop.id,
      sop_version: sop.version,
      observed_worker_id: workerBId,
      observed_by: supId,
      verdict: 'needs_support',
      note: "worker B's private coaching note",
    })
    expect(seedBErr).toBeNull()

    const accessToken = await mintAccessToken(admin, workerAEmail)
    const asWorkerA = asUserClient(accessToken)

    const { data: rows, error } = await asWorkerA
      .from('sop_observations')
      .select('id, observed_worker_id')
      .eq('organisation_id', orgId)

    expect(error).toBeNull()
    // Positive: worker A's own row is present.
    expect((rows ?? []).some((r) => r.observed_worker_id === workerAId)).toBe(true)
    // Negative: worker B's row (a same-org peer) is NEVER returned.
    expect((rows ?? []).some((r) => r.observed_worker_id === workerBId)).toBe(false)
  })

  test('a supervisor reading sop_observations sees every observation in the org -- org-wide recorder read still works post-fix', async () => {
    const admin = serviceClient()
    const orgId = await createEphemeralOrg(admin, 'Phase34 RRS Supervisor Org')
    const { userId: supId, email: supEmail } = await createEphemeralMember(admin, orgId, 'supervisor')
    const { userId: workerAId } = await createEphemeralMember(admin, orgId, 'worker')
    const { userId: workerBId } = await createEphemeralMember(admin, orgId, 'worker')
    const sop = await createEphemeralSop(admin, orgId, supId)

    const { error: seedAErr } = await admin.from('sop_observations').insert({
      organisation_id: orgId,
      sop_id: sop.id,
      sop_version: sop.version,
      observed_worker_id: workerAId,
      observed_by: supId,
      verdict: 'performed_to_sop',
    })
    expect(seedAErr).toBeNull()

    const { error: seedBErr } = await admin.from('sop_observations').insert({
      organisation_id: orgId,
      sop_id: sop.id,
      sop_version: sop.version,
      observed_worker_id: workerBId,
      observed_by: supId,
      verdict: 'needs_support',
    })
    expect(seedBErr).toBeNull()

    const accessToken = await mintAccessToken(admin, supEmail)
    const asSup = asUserClient(accessToken)

    const { data: rows, error } = await asSup
      .from('sop_observations')
      .select('id, observed_worker_id')
      .eq('organisation_id', orgId)

    expect(error).toBeNull()
    expect((rows ?? []).some((r) => r.observed_worker_id === workerAId)).toBe(true)
    expect((rows ?? []).some((r) => r.observed_worker_id === workerBId)).toBe(true)
  })
})
