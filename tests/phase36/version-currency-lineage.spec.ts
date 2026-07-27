/**
 * Phase 36 -- CMP-03 version-currency orphaning probe (RESEARCH Pitfall 1:
 * the single most important scenario in this phase). Modeled on
 * tests/phase35/competency-rls-probe.spec.ts (ephemeral org + minted
 * sessions, live Supabase runtime probe).
 *
 * Scenario: a worker completes SOP v1. An admin supersedes the SOP to v2.
 * The worker's v1 completion must still surface as evidence under v2's
 * read (lineage is NOT orphaned -- state is never reset to 'not_started'),
 * and must be flagged `isOutdatedVersion: true`.
 *
 * test.fixme until Plan 36-10 activates it -- the body is pre-written now
 * (ephemeral-org scaffolding + full scenario) so activation in 36-10 is a
 * single-line flip (`test.fixme` -> `test`), not a from-scratch rewrite.
 * The functions/columns this probe exercises (isOutdatedVersion, the
 * lineage resolver, refresher_interval_months) do not exist until plans
 * 36-02/36-05 land, which is fine -- a fixme body never executes.
 *
 * Registration: playwright.config.ts `phase36` project
 *   testDir: '.', testMatch: /tests\/phase36\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase36`
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
  const email = `p36-lineage-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-phase36-test.invalid`
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
      title: 'Phase36 lineage probe SOP',
      status: 'published',
      version: 1,
      uploaded_by: uploaderId,
      source_file_path: 'phase36-lineage/probe.docx',
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
    sop_version: sop.version, content_hash: 'p36-lineage-probe', status: 'pending_sign_off',
    step_data: { probe: true }, submitted_at: new Date().toISOString(),
  })
  if (error) throw new Error(`seedCompletion failed: ${error.message}`)
  return id
}

test.afterAll(async () => {
  if (!(SUPABASE_URL && SERVICE_KEY && ANON_KEY)) return
  const admin = serviceClient()
  for (const orgId of cleanupOrgIds) {
    await admin.from('organisations').delete().eq('id', orgId)
  }
  for (const userId of cleanupUserIds) {
    await admin.auth.admin.deleteUser(userId).catch(() => {})
  }
})

test.describe('CMP-03 -- version-currency lineage survives supersede (orphaning scenario)', () => {
  test.fixme(
    'worker v1 completion still surfaces as evidence under v2 read, flagged isOutdatedVersion (activates in Plan 36-10)',
    async () => {
      const admin = serviceClient()
      const orgId = await createEphemeralOrg(admin, 'Phase36 Lineage Probe')
      const { userId: adminId } = await createEphemeralMember(admin, orgId, 'admin')
      const { userId: workerId, email: workerEmail } = await createEphemeralMember(admin, orgId, 'worker')

      // Worker completes SOP v1.
      const sopV1 = await createEphemeralSop(admin, orgId, adminId)
      await seedCompletion(admin, orgId, sopV1, workerId)

      // Admin supersedes the SOP to v2 (exact call TBD -- Plan 36-02/36-05
      // will have created the real supersede path; this probe activates
      // once that path and isOutdatedVersion exist).
      const { data: sopV2, error: superErr } = await admin
        .from('sops')
        .update({ version: 2 })
        .eq('id', sopV1.id)
        .select('id, version')
        .single()
      if (superErr || !sopV2) throw new Error(`supersede failed: ${superErr?.message}`)

      const worker = asUserClient(await mintAccessToken(admin, workerEmail))

      // The worker's v1 completion row must still surface as evidence
      // after supersede -- lineage is NOT orphaned/deleted.
      const { data: ownCompletion, error: compErr } = await worker
        .from('sop_completions')
        .select('id, sop_version')
        .eq('sop_id', sopV1.id)
        .eq('worker_id', workerId)
        .single()
      expect(compErr).toBeNull()
      expect(ownCompletion?.sop_version).toBe(1)

      // getMyCompetencyStates() (src/actions/competency.ts) is the real
      // consumer of this lineage -- it runs behind getSessionContext() and
      // cannot be invoked from this harness (Phase 32-05 learning), so
      // Plan 36-10 asserts the derived fields via its own request-scoped
      // integration path. This probe proves the underlying evidence row
      // survives the supersede, which is the precondition for that assertion.
      expect(sopV2.version).toBe(2)
    }
  )
})
