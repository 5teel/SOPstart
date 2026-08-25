/**
 * CAP-02 -- live RLS probe set: owner-edit, non-owner-denied, admin-regression,
 * cross-org-denied, and publish-still-denied against real Supabase RLS.
 *
 * Mirrors tests/phase34/observation-read-role-scope.spec.ts verbatim (env
 * loader, ephemeral-org fixtures, teardown, mint-token pattern) -- no shared
 * test-utils module exists for this pattern in this codebase.
 *
 * Per CLAUDE.md 2026-07-20 (one probe per policy is not coverage) and
 * 2026-08-04 (permissive policies OR-combine -- the owner arm must live
 * INSIDE the org-scope AND, never as a sibling policy), this spec enumerates
 * role x own/other x same-org/cross-org x allowed/denied, not a single probe.
 *
 * CRITICAL assertion shape: an RLS-denied UPDATE through PostgREST does not
 * error -- it silently affects zero rows. Every probe therefore re-reads the
 * target row with the SERVICE client after the attempted write and compares
 * the persisted value, never trusting the update response alone.
 *
 * All tests here are `test.fixme` -- migration 00063 (which extends the RLS
 * policies with the owner-OR-role predicate) does not exist until Plan
 * 46-03. Probes 3-7 (the negative half) must ALSO stay red-if-broken after
 * CAP-02 ships -- they are the negative half of the 2026-07-20 rule, not a
 * one-time proof. Plan 46-03's final task removes the fixme markers.
 *
 * Registration: playwright.config.ts `phase46` project
 *   testDir: '.', testMatch: /tests\/phase46\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase46`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const ROOT = process.cwd()

// ---------------------------------------------------------------------------
// Live Supabase fixture helpers (copied verbatim from
// tests/phase34/observation-read-role-scope.spec.ts -- no shared test-utils
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
// This project's anon key is NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, not
// NEXT_PUBLIC_SUPABASE_ANON_KEY (CLAUDE.md 2026-05-08).
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
  const email = `p46-owner-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-phase46-test.invalid`
  const { data: userResp, error } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (error || !userResp?.user) throw new Error(`createUser failed: ${error?.message}`)
  cleanupUserIds.push(userResp.user.id)
  const { error: memErr } = await admin.from('organisation_members').insert({ organisation_id: orgId, user_id: userResp.user.id, role })
  if (memErr) throw new Error(`organisation_members insert failed: ${memErr.message}`)
  return { userId: userResp.user.id, email }
}

async function createEphemeralSop(
  admin: SupabaseClient,
  orgId: string,
  uploaderId: string,
  ownerUserId: string
): Promise<{ id: string; version: number }> {
  const { data, error } = await admin
    .from('sops')
    .insert({
      organisation_id: orgId,
      title: 'Phase46 owner-edit probe SOP',
      status: 'draft',
      version: 1,
      uploaded_by: uploaderId,
      owner_user_id: ownerUserId,
      source_file_path: 'phase46-owner/probe.docx',
      source_file_type: 'docx',
      source_file_name: 'probe.docx',
    })
    .select('id, version')
    .single()
  if (error || !data) throw new Error(`createEphemeralSop failed: ${error?.message}`)
  return data as { id: string; version: number }
}

async function createEphemeralSection(admin: SupabaseClient, sopId: string): Promise<{ id: string }> {
  const { data, error } = await admin
    .from('sop_sections')
    .insert({
      sop_id: sopId,
      section_type: 'procedure',
      title: 'Phase46 owner-edit probe section',
      sort_order: 10,
      approved: false,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`createEphemeralSection failed: ${error?.message}`)
  return data as { id: string }
}

async function createEphemeralStep(admin: SupabaseClient, sectionId: string): Promise<{ id: string }> {
  const { data, error } = await admin
    .from('sop_steps')
    .insert({
      section_id: sectionId,
      step_number: 1,
      text: 'Phase46 owner-edit probe step',
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`createEphemeralStep failed: ${error?.message}`)
  return data as { id: string }
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
// Live-Supabase probes -- all test.fixme pending migration 00063 (Plan 46-03).
// Probes 3-7 (negative/regression/isolation/containment) must stay red if
// CAP-02 regresses -- they are not a one-time proof, per CLAUDE.md 2026-07-20.
// ---------------------------------------------------------------------------

test.describe('CAP-02 -- owner-edit runtime probes (real ephemeral org, real RLS)', () => {
  test.skip(!LIVE_ENV_READY, 'requires NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local')

  // activated by plan 46-03 after migration 00063 is applied
  test.fixme('POSITIVE -- a worker who is the SOP owner can update sop_sections.title on their own SOP', async () => {
    test.skip(!LIVE_ENV_READY, 'requires .env.local live Supabase credentials')
    const admin = serviceClient()
    const orgId = await createEphemeralOrg(admin, 'Phase46 Owner Org')
    const { userId: ownerId, email: ownerEmail } = await createEphemeralMember(admin, orgId, 'worker')
    const sop = await createEphemeralSop(admin, orgId, ownerId, ownerId)
    const section = await createEphemeralSection(admin, sop.id)

    const accessToken = await mintAccessToken(admin, ownerEmail)
    const asOwner = asUserClient(accessToken)

    const { error } = await asOwner.from('sop_sections').update({ title: 'Owner-edited title' }).eq('id', section.id)
    expect(error).toBeNull()

    const { data: persisted } = await admin.from('sop_sections').select('title').eq('id', section.id).single()
    expect(persisted?.title).toBe('Owner-edited title')
  })

  // activated by plan 46-03 after migration 00063 is applied
  test.fixme('POSITIVE -- the same owner can update sop_steps.text on a step under their SOP (admins_can_manage_steps extended, not just sections)', async () => {
    test.skip(!LIVE_ENV_READY, 'requires .env.local live Supabase credentials')
    const admin = serviceClient()
    const orgId = await createEphemeralOrg(admin, 'Phase46 Owner Steps Org')
    const { userId: ownerId, email: ownerEmail } = await createEphemeralMember(admin, orgId, 'worker')
    const sop = await createEphemeralSop(admin, orgId, ownerId, ownerId)
    const section = await createEphemeralSection(admin, sop.id)
    const step = await createEphemeralStep(admin, section.id)

    const accessToken = await mintAccessToken(admin, ownerEmail)
    const asOwner = asUserClient(accessToken)

    const { error } = await asOwner.from('sop_steps').update({ text: 'Owner-edited step text' }).eq('id', step.id)
    expect(error).toBeNull()

    const { data: persisted } = await admin.from('sop_steps').select('text').eq('id', step.id).single()
    expect(persisted?.text).toBe('Owner-edited step text')
  })

  // activated by plan 46-03 after migration 00063 is applied
  test.fixme('NEGATIVE -- a second worker in the same org who is NOT the owner cannot update sop_sections.title', async () => {
    test.skip(!LIVE_ENV_READY, 'requires .env.local live Supabase credentials')
    const admin = serviceClient()
    const orgId = await createEphemeralOrg(admin, 'Phase46 Non-Owner Worker Org')
    const { userId: ownerId } = await createEphemeralMember(admin, orgId, 'worker')
    const { email: otherWorkerEmail } = await createEphemeralMember(admin, orgId, 'worker')
    const sop = await createEphemeralSop(admin, orgId, ownerId, ownerId)
    const section = await createEphemeralSection(admin, sop.id)

    const accessToken = await mintAccessToken(admin, otherWorkerEmail)
    const asOtherWorker = asUserClient(accessToken)

    await asOtherWorker.from('sop_sections').update({ title: 'Should not persist' }).eq('id', section.id)

    const { data: persisted } = await admin.from('sop_sections').select('title').eq('id', section.id).single()
    expect(persisted?.title).not.toBe('Should not persist')
  })

  // activated by plan 46-03 after migration 00063 is applied
  test.fixme('NEGATIVE -- a supervisor in the same org who is not the owner cannot update sop_sections.title (sign-off != edit)', async () => {
    test.skip(!LIVE_ENV_READY, 'requires .env.local live Supabase credentials')
    const admin = serviceClient()
    const orgId = await createEphemeralOrg(admin, 'Phase46 Supervisor Non-Owner Org')
    const { userId: ownerId } = await createEphemeralMember(admin, orgId, 'worker')
    const { email: supEmail } = await createEphemeralMember(admin, orgId, 'supervisor')
    const sop = await createEphemeralSop(admin, orgId, ownerId, ownerId)
    const section = await createEphemeralSection(admin, sop.id)

    const accessToken = await mintAccessToken(admin, supEmail)
    const asSup = asUserClient(accessToken)

    await asSup.from('sop_sections').update({ title: 'Should not persist' }).eq('id', section.id)

    const { data: persisted } = await admin.from('sop_sections').select('title').eq('id', section.id).single()
    expect(persisted?.title).not.toBe('Should not persist')
  })

  // activated by plan 46-03 after migration 00063 is applied
  test.fixme('REGRESSION -- an admin in the same org who is not the owner CAN still update sop_sections.title (universal admin edit unchanged)', async () => {
    test.skip(!LIVE_ENV_READY, 'requires .env.local live Supabase credentials')
    const admin = serviceClient()
    const orgId = await createEphemeralOrg(admin, 'Phase46 Admin Regression Org')
    const { userId: ownerId } = await createEphemeralMember(admin, orgId, 'worker')
    const { email: adminEmail } = await createEphemeralMember(admin, orgId, 'admin')
    const sop = await createEphemeralSop(admin, orgId, ownerId, ownerId)
    const section = await createEphemeralSection(admin, sop.id)

    const accessToken = await mintAccessToken(admin, adminEmail)
    const asAdmin = asUserClient(accessToken)

    const { error } = await asAdmin.from('sop_sections').update({ title: 'Admin-edited title' }).eq('id', section.id)
    expect(error).toBeNull()

    const { data: persisted } = await admin.from('sop_sections').select('title').eq('id', section.id).single()
    expect(persisted?.title).toBe('Admin-edited title')
  })

  // activated by plan 46-03 after migration 00063 is applied
  test.fixme('CROSS-ORG ISOLATION -- the owner of org A cannot update a section of org B\'s SOP (owner arm lives inside the org-scope AND, never as a sibling policy)', async () => {
    test.skip(!LIVE_ENV_READY, 'requires .env.local live Supabase credentials')
    const admin = serviceClient()
    const orgAId = await createEphemeralOrg(admin, 'Phase46 Cross-Org Owner A')
    const orgBId = await createEphemeralOrg(admin, 'Phase46 Cross-Org Org B')
    const { userId: ownerAId, email: ownerAEmail } = await createEphemeralMember(admin, orgAId, 'worker')
    const { userId: ownerBId } = await createEphemeralMember(admin, orgBId, 'worker')
    const sopB = await createEphemeralSop(admin, orgBId, ownerBId, ownerBId)
    const sectionB = await createEphemeralSection(admin, sopB.id)

    const accessToken = await mintAccessToken(admin, ownerAEmail)
    const asOwnerA = asUserClient(accessToken)

    await asOwnerA.from('sop_sections').update({ title: 'Should not persist cross-org' }).eq('id', sectionB.id)

    const { data: persisted } = await admin.from('sop_sections').select('title').eq('id', sectionB.id).single()
    expect(persisted?.title).not.toBe('Should not persist cross-org')
  })

  // activated by plan 46-03 after migration 00063 is applied
  test.fixme('SCOPE CONTAINMENT -- the owner (role worker) cannot publish their own SOP; CAP-02 grants content edit only, not publish', async () => {
    test.skip(!LIVE_ENV_READY, 'requires .env.local live Supabase credentials')
    const admin = serviceClient()
    const orgId = await createEphemeralOrg(admin, 'Phase46 Scope Containment Org')
    const { userId: ownerId, email: ownerEmail } = await createEphemeralMember(admin, orgId, 'worker')
    const sop = await createEphemeralSop(admin, orgId, ownerId, ownerId)

    const accessToken = await mintAccessToken(admin, ownerEmail)
    const asOwner = asUserClient(accessToken)

    await asOwner.from('sops').update({ status: 'published' }).eq('id', sop.id)

    const { data: persisted } = await admin.from('sops').select('status').eq('id', sop.id).single()
    expect(persisted?.status).not.toBe('published')
  })
})
