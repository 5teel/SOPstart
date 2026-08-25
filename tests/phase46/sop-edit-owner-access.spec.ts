/**
 * CAP-02 -- live RLS probe set for the A1-RESOLVED model (Simon, 2026-08-25):
 * sign-off authority = approval-chain approvers (Phase 29 approval_chains),
 * NOT sops.owner_user_id. Probes: approver-edit (userId step and role step),
 * owner-now-denied (the key flip probe), non-approver-denied, no-chain-denied,
 * admin-regression, cross-org-denied, and publish-still-denied against real
 * Supabase RLS (migration 00066 is_sop_sign_off_approver()).
 *
 * Mirrors tests/phase34/observation-read-role-scope.spec.ts verbatim (env
 * loader, ephemeral-org fixtures, teardown, mint-token pattern) -- no shared
 * test-utils module exists for this pattern in this codebase.
 *
 * Per CLAUDE.md 2026-07-20 (one probe per policy is not coverage) and
 * 2026-08-04 (permissive policies OR-combine -- the approver arm must live
 * INSIDE the org-scope AND, never as a sibling policy), this spec enumerates
 * role x approver/non-approver x same-org/cross-org x allowed/denied, not a
 * single probe.
 *
 * CRITICAL assertion shape: an RLS-denied UPDATE through PostgREST does not
 * error -- it silently affects zero rows. Every probe therefore re-reads the
 * target row with the SERVICE client after the attempted write and compares
 * the persisted value, never trusting the update response alone.
 *
 * The negative half must stay red-if-broken going forward -- it is the
 * negative half of the 2026-07-20 rule, not a one-time proof.
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

// Every probe SOP is created in this category; the chain fixture writes the
// approval_chains row for the same slug (values from src/lib/sop-categories.ts).
const PROBE_CATEGORY = 'safety'

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
  const email = `p46-appr-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-phase46-test.invalid`
  const { data: userResp, error } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (error || !userResp?.user) throw new Error(`createUser failed: ${error?.message}`)
  cleanupUserIds.push(userResp.user.id)
  const { error: memErr } = await admin.from('organisation_members').insert({ organisation_id: orgId, user_id: userResp.user.id, role })
  if (memErr) throw new Error(`organisation_members insert failed: ${memErr.message}`)
  return { userId: userResp.user.id, email }
}

/**
 * A1 fixture: writes the approval_chains row for (orgId, PROBE_CATEGORY).
 * Steps use the real ChainStep shape ({ userId | role, label }) that
 * stepMatchesCaller and is_sop_sign_off_approver() both read. Cleaned up by
 * the org cascade (approval_chains.organisation_id ON DELETE CASCADE, 00045).
 */
async function setEphemeralChain(
  admin: SupabaseClient,
  orgId: string,
  steps: Array<{ userId?: string; role?: string; label: string }>
): Promise<void> {
  const { error } = await admin
    .from('approval_chains')
    .insert({ organisation_id: orgId, category: PROBE_CATEGORY, steps })
  if (error) throw new Error(`setEphemeralChain failed: ${error.message}`)
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
      title: 'Phase46 approver-edit probe SOP',
      status: 'draft',
      version: 1,
      uploaded_by: uploaderId,
      owner_user_id: ownerUserId,
      category_slug: PROBE_CATEGORY,
      source_file_path: 'phase46-approver/probe.docx',
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
      title: 'Phase46 approver-edit probe section',
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
      text: 'Phase46 approver-edit probe step',
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`createEphemeralStep failed: ${error?.message}`)
  return data as { id: string }
}

async function createEphemeralBlock(
  admin: SupabaseClient,
  orgId: string
): Promise<{ blockId: string; versionId: string; snapshot: object }> {
  const snapshot = { kind: 'text', text: 'Phase46 junction probe block' }
  const { data: block, error: bErr } = await admin
    .from('blocks')
    .insert({ organisation_id: orgId, kind_slug: 'text', name: `Phase46 probe block ${Date.now()}` })
    .select('id')
    .single()
  if (bErr || !block) throw new Error(`createEphemeralBlock blocks insert failed: ${bErr?.message}`)
  const { data: version, error: vErr } = await admin
    .from('block_versions')
    .insert({ block_id: block.id, version_number: 1, content: snapshot })
    .select('id')
    .single()
  if (vErr || !version) throw new Error(`createEphemeralBlock block_versions insert failed: ${vErr?.message}`)
  const { error: uErr } = await admin.from('blocks').update({ current_version_id: version.id }).eq('id', block.id)
  if (uErr) throw new Error(`createEphemeralBlock current_version_id update failed: ${uErr.message}`)
  return { blockId: block.id as string, versionId: version.id as string, snapshot }
}

async function createEphemeralJunction(
  admin: SupabaseClient,
  sectionId: string,
  blockId: string,
  versionId: string,
  snapshot: object,
  sortOrder: number
): Promise<{ id: string }> {
  const { data, error } = await admin
    .from('sop_section_blocks')
    .insert({
      sop_section_id: sectionId,
      block_id: blockId,
      pinned_version_id: versionId,
      pin_mode: 'pinned',
      snapshot_content: snapshot,
      sort_order: sortOrder,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`createEphemeralJunction failed: ${error?.message}`)
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
// Live-Supabase probes -- against live migration 00066 (A1 resolution).
// The negative/regression/isolation/containment probes must stay red if
// CAP-02 regresses -- they are not a one-time proof, per CLAUDE.md 2026-07-20.
// ---------------------------------------------------------------------------

test.describe('CAP-02 -- approver-edit runtime probes (real ephemeral org, real RLS, A1 = chain approvers)', () => {
  test.skip(!LIVE_ENV_READY, 'requires NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local')

  test('POSITIVE -- a plain worker named by userId in the category chain can update sop_sections.title', async () => {
    test.skip(!LIVE_ENV_READY, 'requires .env.local live Supabase credentials')
    const admin = serviceClient()
    const orgId = await createEphemeralOrg(admin, 'Phase46 Approver Org')
    const { userId: ownerId } = await createEphemeralMember(admin, orgId, 'worker')
    const { userId: approverId, email: approverEmail } = await createEphemeralMember(admin, orgId, 'worker')
    await setEphemeralChain(admin, orgId, [{ userId: approverId, label: 'Named approver' }])
    const sop = await createEphemeralSop(admin, orgId, ownerId, ownerId)
    const section = await createEphemeralSection(admin, sop.id)

    const accessToken = await mintAccessToken(admin, approverEmail)
    const asApprover = asUserClient(accessToken)

    const { error } = await asApprover.from('sop_sections').update({ title: 'Approver-edited title' }).eq('id', section.id)
    expect(error).toBeNull()

    const { data: persisted } = await admin.from('sop_sections').select('title').eq('id', section.id).single()
    expect(persisted?.title).toBe('Approver-edited title')
  })

  test('POSITIVE -- the same userId-step approver can update sop_steps.text (admins_can_manage_steps carries the approver arm, not just sections)', async () => {
    test.skip(!LIVE_ENV_READY, 'requires .env.local live Supabase credentials')
    const admin = serviceClient()
    const orgId = await createEphemeralOrg(admin, 'Phase46 Approver Steps Org')
    const { userId: ownerId } = await createEphemeralMember(admin, orgId, 'worker')
    const { userId: approverId, email: approverEmail } = await createEphemeralMember(admin, orgId, 'worker')
    await setEphemeralChain(admin, orgId, [{ userId: approverId, label: 'Named approver' }])
    const sop = await createEphemeralSop(admin, orgId, ownerId, ownerId)
    const section = await createEphemeralSection(admin, sop.id)
    const step = await createEphemeralStep(admin, section.id)

    const accessToken = await mintAccessToken(admin, approverEmail)
    const asApprover = asUserClient(accessToken)

    const { error } = await asApprover.from('sop_steps').update({ text: 'Approver-edited step text' }).eq('id', step.id)
    expect(error).toBeNull()

    const { data: persisted } = await admin.from('sop_steps').select('text').eq('id', step.id).single()
    expect(persisted?.text).toBe('Approver-edited step text')
  })

  test('POSITIVE -- a supervisor matched by a { role: supervisor } chain step can update sop_sections.title (role-step arm, not just userId)', async () => {
    test.skip(!LIVE_ENV_READY, 'requires .env.local live Supabase credentials')
    const admin = serviceClient()
    const orgId = await createEphemeralOrg(admin, 'Phase46 Role-Step Org')
    const { userId: ownerId } = await createEphemeralMember(admin, orgId, 'worker')
    const { email: supEmail } = await createEphemeralMember(admin, orgId, 'supervisor')
    await setEphemeralChain(admin, orgId, [{ role: 'supervisor', label: 'Any supervisor' }])
    const sop = await createEphemeralSop(admin, orgId, ownerId, ownerId)
    const section = await createEphemeralSection(admin, sop.id)

    const accessToken = await mintAccessToken(admin, supEmail)
    const asSup = asUserClient(accessToken)

    const { error } = await asSup.from('sop_sections').update({ title: 'Supervisor-approver-edited title' }).eq('id', section.id)
    expect(error).toBeNull()

    const { data: persisted } = await admin.from('sop_sections').select('title').eq('id', section.id).single()
    expect(persisted?.title).toBe('Supervisor-approver-edited title')
  })

  // The key A1 flip probe: ownership no longer carries edit rights.
  test('NEGATIVE (A1 flip) -- the SOP owner (worker) who is NOT in the chain cannot update sop_sections.title (silent zero-row deny, verified by re-read)', async () => {
    test.skip(!LIVE_ENV_READY, 'requires .env.local live Supabase credentials')
    const admin = serviceClient()
    const orgId = await createEphemeralOrg(admin, 'Phase46 Owner-Denied Org')
    const { userId: ownerId, email: ownerEmail } = await createEphemeralMember(admin, orgId, 'worker')
    const { userId: approverId } = await createEphemeralMember(admin, orgId, 'worker')
    // The chain exists but names someone else -- the owner as such gains nothing.
    await setEphemeralChain(admin, orgId, [{ userId: approverId, label: 'Named approver (not the owner)' }])
    const sop = await createEphemeralSop(admin, orgId, ownerId, ownerId)
    const section = await createEphemeralSection(admin, sop.id)

    const accessToken = await mintAccessToken(admin, ownerEmail)
    const asOwner = asUserClient(accessToken)

    await asOwner.from('sop_sections').update({ title: 'Should not persist' }).eq('id', section.id)

    const { data: persisted } = await admin.from('sop_sections').select('title').eq('id', section.id).single()
    expect(persisted?.title).not.toBe('Should not persist')
  })

  test('NEGATIVE -- a same-org worker in no chain step cannot update sop_steps.text (silent zero-row deny, verified by re-read)', async () => {
    test.skip(!LIVE_ENV_READY, 'requires .env.local live Supabase credentials')
    const admin = serviceClient()
    const orgId = await createEphemeralOrg(admin, 'Phase46 Non-Approver Org')
    const { userId: ownerId } = await createEphemeralMember(admin, orgId, 'worker')
    const { userId: approverId } = await createEphemeralMember(admin, orgId, 'worker')
    const { email: otherEmail } = await createEphemeralMember(admin, orgId, 'worker')
    await setEphemeralChain(admin, orgId, [{ userId: approverId, label: 'Named approver' }])
    const sop = await createEphemeralSop(admin, orgId, ownerId, ownerId)
    const section = await createEphemeralSection(admin, sop.id)
    const step = await createEphemeralStep(admin, section.id)

    const accessToken = await mintAccessToken(admin, otherEmail)
    const asOther = asUserClient(accessToken)

    await asOther.from('sop_steps').update({ text: 'Should not persist' }).eq('id', step.id)

    const { data: persisted } = await admin.from('sop_steps').select('text').eq('id', step.id).single()
    expect(persisted?.text).not.toBe('Should not persist')
  })

  // Accepted consequence of A1 (Simon, 2026-08-25): no chain for the category
  // means zero people with sign-off-derived edit rights.
  test('NO-CHAIN -- with no approval_chains row for the category, the owner-worker (the former positive) is denied', async () => {
    test.skip(!LIVE_ENV_READY, 'requires .env.local live Supabase credentials')
    const admin = serviceClient()
    const orgId = await createEphemeralOrg(admin, 'Phase46 No-Chain Org')
    const { userId: ownerId, email: ownerEmail } = await createEphemeralMember(admin, orgId, 'worker')
    // Deliberately NO setEphemeralChain call.
    const sop = await createEphemeralSop(admin, orgId, ownerId, ownerId)
    const section = await createEphemeralSection(admin, sop.id)

    const accessToken = await mintAccessToken(admin, ownerEmail)
    const asOwner = asUserClient(accessToken)

    await asOwner.from('sop_sections').update({ title: 'Should not persist' }).eq('id', section.id)

    const { data: persisted } = await admin.from('sop_sections').select('title').eq('id', section.id).single()
    expect(persisted?.title).not.toBe('Should not persist')
  })

  test('REGRESSION -- an admin in the same org who is in no chain step CAN still update sop_sections.title (universal admin edit unchanged)', async () => {
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

  test('CROSS-ORG ISOLATION -- a worker of org A named in ORG B\'s chain still cannot update org B\'s section (org conjunct binds to the SESSION org, never the chain row)', async () => {
    test.skip(!LIVE_ENV_READY, 'requires .env.local live Supabase credentials')
    const admin = serviceClient()
    const orgAId = await createEphemeralOrg(admin, 'Phase46 Cross-Org A')
    const orgBId = await createEphemeralOrg(admin, 'Phase46 Cross-Org B')
    const { userId: userAId, email: userAEmail } = await createEphemeralMember(admin, orgAId, 'worker')
    const { userId: ownerBId } = await createEphemeralMember(admin, orgBId, 'worker')
    // The sharpest probe of the org conjunct: org B's chain NAMES user A.
    // The helper must still deny -- user A's session org is A, the SOP's is B.
    await setEphemeralChain(admin, orgBId, [{ userId: userAId, label: 'Foreign-org user named in chain' }])
    const sopB = await createEphemeralSop(admin, orgBId, ownerBId, ownerBId)
    const sectionB = await createEphemeralSection(admin, sopB.id)

    const accessToken = await mintAccessToken(admin, userAEmail)
    const asUserA = asUserClient(accessToken)

    await asUserA.from('sop_sections').update({ title: 'Should not persist cross-org' }).eq('id', sectionB.id)

    const { data: persisted } = await admin.from('sop_sections').select('title').eq('id', sectionB.id).single()
    expect(persisted?.title).not.toBe('Should not persist cross-org')
  })

  test('SCOPE CONTAINMENT -- a userId-step approver (role worker) cannot publish the SOP; CAP-02 grants content edit only, not publish', async () => {
    test.skip(!LIVE_ENV_READY, 'requires .env.local live Supabase credentials')
    const admin = serviceClient()
    const orgId = await createEphemeralOrg(admin, 'Phase46 Scope Containment Org')
    const { userId: ownerId } = await createEphemeralMember(admin, orgId, 'worker')
    const { userId: approverId, email: approverEmail } = await createEphemeralMember(admin, orgId, 'worker')
    await setEphemeralChain(admin, orgId, [{ userId: approverId, label: 'Named approver' }])
    const sop = await createEphemeralSop(admin, orgId, ownerId, ownerId)

    const accessToken = await mintAccessToken(admin, approverEmail)
    const asApprover = asUserClient(accessToken)

    await asApprover.from('sops').update({ status: 'published' }).eq('id', sop.id)

    const { data: persisted } = await admin.from('sops').select('status').eq('id', sop.id).single()
    expect(persisted?.status).not.toBe('published')
  })

  // -------------------------------------------------------------------------
  // sop_section_blocks (block junction) probes -- ssb_admin_manage_own_org
  // carries the approver arm in BOTH USING and WITH CHECK (00066); without
  // these probes the guard-approved-but-RLS-denied state ships invisible
  // (delete + reorder fail as SILENT zero-row success).
  // -------------------------------------------------------------------------

  test('JUNCTION POSITIVE -- a userId-step approver (role worker) can insert, update pin_mode, and delete a sop_section_blocks row', async () => {
    test.skip(!LIVE_ENV_READY, 'requires .env.local live Supabase credentials')
    const admin = serviceClient()
    const orgId = await createEphemeralOrg(admin, 'Phase46 Junction Approver Org')
    const { userId: ownerId } = await createEphemeralMember(admin, orgId, 'worker')
    const { userId: approverId, email: approverEmail } = await createEphemeralMember(admin, orgId, 'worker')
    await setEphemeralChain(admin, orgId, [{ userId: approverId, label: 'Named approver' }])
    const sop = await createEphemeralSop(admin, orgId, ownerId, ownerId)
    const section = await createEphemeralSection(admin, sop.id)
    const { blockId, versionId, snapshot } = await createEphemeralBlock(admin, orgId)

    const accessToken = await mintAccessToken(admin, approverEmail)
    const asApprover = asUserClient(accessToken)

    // INSERT (the addBlockToSection path)
    const { data: inserted, error: insErr } = await asApprover
      .from('sop_section_blocks')
      .insert({
        sop_section_id: section.id,
        block_id: blockId,
        pinned_version_id: versionId,
        pin_mode: 'pinned',
        snapshot_content: snapshot,
        sort_order: 1,
      })
      .select('id')
      .single()
    expect(insErr).toBeNull()
    expect(inserted?.id).toBeTruthy()

    // UPDATE (the setPinMode path) -- re-read via service client, never trust the response
    await asApprover.from('sop_section_blocks').update({ pin_mode: 'follow_latest' }).eq('id', inserted!.id)
    const { data: afterUpdate } = await admin.from('sop_section_blocks').select('pin_mode').eq('id', inserted!.id).single()
    expect(afterUpdate?.pin_mode).toBe('follow_latest')

    // DELETE (the removeBlockFromSection path -- the silent-false-success case)
    await asApprover.from('sop_section_blocks').delete().eq('id', inserted!.id)
    const { data: afterDelete } = await admin.from('sop_section_blocks').select('id').eq('id', inserted!.id).maybeSingle()
    expect(afterDelete).toBeNull()
  })

  test('JUNCTION POSITIVE -- the approver can reorder junctions via the reorder_sop_section_blocks RPC (NOT SECURITY DEFINER -- runs under the extended policy)', async () => {
    test.skip(!LIVE_ENV_READY, 'requires .env.local live Supabase credentials')
    const admin = serviceClient()
    const orgId = await createEphemeralOrg(admin, 'Phase46 Junction Reorder Org')
    const { userId: ownerId } = await createEphemeralMember(admin, orgId, 'worker')
    const { userId: approverId, email: approverEmail } = await createEphemeralMember(admin, orgId, 'worker')
    await setEphemeralChain(admin, orgId, [{ userId: approverId, label: 'Named approver' }])
    const sop = await createEphemeralSop(admin, orgId, ownerId, ownerId)
    const section = await createEphemeralSection(admin, sop.id)
    const { blockId, versionId, snapshot } = await createEphemeralBlock(admin, orgId)
    const j1 = await createEphemeralJunction(admin, section.id, blockId, versionId, snapshot, 1)
    const j2 = await createEphemeralJunction(admin, section.id, blockId, versionId, snapshot, 2)

    const accessToken = await mintAccessToken(admin, approverEmail)
    const asApprover = asUserClient(accessToken)

    const { error: rpcErr } = await asApprover.rpc('reorder_sop_section_blocks', {
      p_sop_section_id: section.id,
      p_ordered_junction_ids: [j2.id, j1.id],
    })
    expect(rpcErr).toBeNull()

    const { data: rows } = await admin
      .from('sop_section_blocks')
      .select('id, sort_order')
      .in('id', [j1.id, j2.id])
    const byId = new Map((rows ?? []).map((r: { id: string; sort_order: number }) => [r.id, r.sort_order]))
    expect(byId.get(j2.id)).toBe(1)
    expect(byId.get(j1.id)).toBe(2)

    // Explicit junction cleanup: blocks FK is ON DELETE RESTRICT, so the org
    // cascade in afterAll must not race a surviving junction row.
    await admin.from('sop_section_blocks').delete().in('id', [j1.id, j2.id])
  })

  test('JUNCTION NEGATIVE -- a same-org worker in no chain step cannot update or delete a junction (silent zero-row deny, verified by re-read)', async () => {
    test.skip(!LIVE_ENV_READY, 'requires .env.local live Supabase credentials')
    const admin = serviceClient()
    const orgId = await createEphemeralOrg(admin, 'Phase46 Junction Non-Approver Org')
    const { userId: ownerId } = await createEphemeralMember(admin, orgId, 'worker')
    const { userId: approverId } = await createEphemeralMember(admin, orgId, 'worker')
    const { email: otherEmail } = await createEphemeralMember(admin, orgId, 'worker')
    await setEphemeralChain(admin, orgId, [{ userId: approverId, label: 'Named approver' }])
    const sop = await createEphemeralSop(admin, orgId, ownerId, ownerId)
    const section = await createEphemeralSection(admin, sop.id)
    const { blockId, versionId, snapshot } = await createEphemeralBlock(admin, orgId)
    const junction = await createEphemeralJunction(admin, section.id, blockId, versionId, snapshot, 1)

    const accessToken = await mintAccessToken(admin, otherEmail)
    const asOther = asUserClient(accessToken)

    await asOther.from('sop_section_blocks').update({ pin_mode: 'follow_latest' }).eq('id', junction.id)
    await asOther.from('sop_section_blocks').delete().eq('id', junction.id)

    const { data: persisted } = await admin
      .from('sop_section_blocks')
      .select('id, pin_mode')
      .eq('id', junction.id)
      .maybeSingle()
    expect(persisted).not.toBeNull()
    expect(persisted?.pin_mode).toBe('pinned')

    await admin.from('sop_section_blocks').delete().eq('id', junction.id)
  })

  // -------------------------------------------------------------------------
  // sop_images probes (admins_can_manage_images carries the approver arm).
  // -------------------------------------------------------------------------

  test('IMAGES POSITIVE -- a userId-step approver (role worker) can insert a sop_images row', async () => {
    test.skip(!LIVE_ENV_READY, 'requires .env.local live Supabase credentials')
    const admin = serviceClient()
    const orgId = await createEphemeralOrg(admin, 'Phase46 Images Approver Org')
    const { userId: ownerId } = await createEphemeralMember(admin, orgId, 'worker')
    const { userId: approverId, email: approverEmail } = await createEphemeralMember(admin, orgId, 'worker')
    await setEphemeralChain(admin, orgId, [{ userId: approverId, label: 'Named approver' }])
    const sop = await createEphemeralSop(admin, orgId, ownerId, ownerId)

    const accessToken = await mintAccessToken(admin, approverEmail)
    const asApprover = asUserClient(accessToken)

    const { data: inserted, error } = await asApprover
      .from('sop_images')
      .insert({ sop_id: sop.id, storage_path: 'phase46-probe/approver.jpg', content_type: 'image/jpeg' })
      .select('id')
      .single()
    expect(error).toBeNull()

    const { data: persisted } = await admin.from('sop_images').select('id').eq('id', inserted!.id).maybeSingle()
    expect(persisted).not.toBeNull()
  })

  test('IMAGES NEGATIVE -- a same-org worker in no chain step cannot insert a sop_images row (verified by service re-read)', async () => {
    test.skip(!LIVE_ENV_READY, 'requires .env.local live Supabase credentials')
    const admin = serviceClient()
    const orgId = await createEphemeralOrg(admin, 'Phase46 Images Non-Approver Org')
    const { userId: ownerId } = await createEphemeralMember(admin, orgId, 'worker')
    const { userId: approverId } = await createEphemeralMember(admin, orgId, 'worker')
    const { email: otherEmail } = await createEphemeralMember(admin, orgId, 'worker')
    await setEphemeralChain(admin, orgId, [{ userId: approverId, label: 'Named approver' }])
    const sop = await createEphemeralSop(admin, orgId, ownerId, ownerId)

    const accessToken = await mintAccessToken(admin, otherEmail)
    const asOther = asUserClient(accessToken)

    await asOther
      .from('sop_images')
      .insert({ sop_id: sop.id, storage_path: 'phase46-probe/non-approver.jpg', content_type: 'image/jpeg' })

    const { data: rows } = await admin
      .from('sop_images')
      .select('id')
      .eq('sop_id', sop.id)
      .eq('storage_path', 'phase46-probe/non-approver.jpg')
    expect(rows ?? []).toHaveLength(0)
  })
})
