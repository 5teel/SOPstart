/**
 * Phase 51 -- SIT-01. Live RLS / FK / storage probes for the site model
 * (role x same-org/cross-org x read/write matrix, 2026-07-20 pattern).
 *
 * D-14: the required cells are cross-org and worker-read. This spec uses
 * ephemeral throwaway orgs (phase34/46 precedent), never the SOPstart-org
 * eval accounts, so no probe ever writes into a real tenant.
 *
 * Mirrors tests/phase46/sop-edit-owner-access.spec.ts verbatim (env loader,
 * serviceClient, mintAccessToken, asUserClient, ephemeral org/member/SOP
 * helpers, afterAll teardown) -- no shared test-utils module exists for this
 * pattern in this codebase.
 *
 * CRITICAL assertion shape (CLAUDE.md 2026-07-20): an RLS-denied write does
 * not error the way an app expects -- sometimes it's a clean 403 (WITH CHECK
 * / FK violation), sometimes it silently affects zero rows (UPDATE/DELETE
 * denied by USING). Every probe that attempts a denied write re-reads the
 * target row with a FRESH serviceClient() afterwards and asserts the
 * persisted value is unchanged -- never trusting the write response alone.
 *
 * Probes run in serial (test.describe.configure) because probes 2+ read
 * rows probe 1 created (shared org-A layout/machine/link), and probe 6/7/8
 * depend on the org-B layout/machine seeded in beforeAll.
 *
 * Registration: playwright.config.ts `phase51` project
 *   testDir: '.', testMatch: /tests\/phase51\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase51`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { newMachineCode, scenePath, SCENE_BUCKET } from '@/lib/site/scene'

const ROOT = process.cwd()

// ---------------------------------------------------------------------------
// Live Supabase fixture helpers (copied verbatim from
// tests/phase46/sop-edit-owner-access.spec.ts -- no shared test-utils module
// exists for this pattern in this codebase).
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
const cleanupStoragePaths: string[] = []

async function createEphemeralOrg(admin: SupabaseClient, namePrefix: string): Promise<string> {
  const { data, error } = await admin.from('organisations').insert({ name: `${namePrefix} ${Date.now()}` }).select('id').single()
  if (error || !data) throw new Error(`createEphemeralOrg failed: ${error?.message}`)
  cleanupOrgIds.push(data.id as string)
  return data.id as string
}

async function createEphemeralMember(
  admin: SupabaseClient,
  orgId: string,
  role: 'worker' | 'admin'
): Promise<{ userId: string; email: string }> {
  const email = `p51-site-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-phase51-test.invalid`
  const { data: userResp, error } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (error || !userResp?.user) throw new Error(`createUser failed: ${error?.message}`)
  cleanupUserIds.push(userResp.user.id)
  const { error: memErr } = await admin.from('organisation_members').insert({ organisation_id: orgId, user_id: userResp.user.id, role })
  if (memErr) throw new Error(`organisation_members insert failed: ${memErr.message}`)
  return { userId: userResp.user.id, email }
}

async function createEphemeralSop(admin: SupabaseClient, orgId: string, uploaderId: string): Promise<{ id: string }> {
  const { data, error } = await admin
    .from('sops')
    .insert({
      organisation_id: orgId,
      title: 'Phase51 site-model probe SOP',
      status: 'draft',
      version: 1,
      uploaded_by: uploaderId,
      source_file_path: 'phase51-site/probe.docx',
      source_file_type: 'docx',
      source_file_name: 'probe.docx',
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`createEphemeralSop failed: ${error?.message}`)
  return data as { id: string }
}

async function createEphemeralDepartment(admin: SupabaseClient, orgId: string): Promise<string> {
  const { data, error } = await admin
    .from('departments')
    .insert({ organisation_id: orgId, name: 'Phase51 Probe Dept', code: `P51${Date.now() % 100000}` })
    .select('id')
    .single()
  if (error || !data) throw new Error(`createEphemeralDepartment failed: ${error?.message}`)
  return data.id as string
}

async function createSiteLayout(
  client: SupabaseClient,
  orgId: string,
  overrides: Record<string, unknown> = {}
): Promise<{ id: string }> {
  const { data, error } = await client
    .from('site_layouts')
    .insert({ organisation_id: orgId, name: 'Phase51 Probe Site', scene_width: 1600, scene_height: 900, ...overrides })
    .select('id')
    .single()
  if (error) throw new Error(`createSiteLayout failed: ${error.message}`)
  return data as { id: string }
}

function samplePolygon(): number[][] {
  return [
    [10, 10],
    [110, 10],
    [110, 110],
    [10, 110],
  ]
}

test.afterAll(async () => {
  if (!LIVE_ENV_READY) return
  const svc = serviceClient()
  for (const objectPath of cleanupStoragePaths) {
    await svc.storage.from(SCENE_BUCKET).remove([objectPath]).catch(() => {})
  }
  for (const orgId of cleanupOrgIds) {
    await svc.from('organisations').delete().eq('id', orgId)
  }
  for (const userId of cleanupUserIds) {
    await svc.auth.admin.deleteUser(userId).catch(() => {})
  }
})

// ---------------------------------------------------------------------------
// Shared fixture: org A (admin + worker), org B (admin), a department in A,
// a SOP in A and a SOP in B, plus an org-B layout+machine seeded by the
// service client for the cross-org FK probes (7).
// ---------------------------------------------------------------------------

type Fixture = {
  orgA: string
  orgB: string
  adminA: { userId: string; client: SupabaseClient }
  workerA: { userId: string; client: SupabaseClient }
  adminB: { userId: string; client: SupabaseClient }
  deptA: string
  sopA: { id: string }
  sopB: { id: string }
  layoutBId: string
  machineBId: string
  // populated by probe 1, read by later probes
  layoutAId: string
  machineAId: string
  machineACode: string
  linkAId: { sop_id: string; machine_id: string } | null
}

let fx: Fixture

test.describe.configure({ mode: 'serial' })

test.describe('SIT-01 -- site model RLS runtime probes (live, ephemeral orgs)', () => {
  test.skip(!LIVE_ENV_READY, 'requires NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local')

  test.beforeAll(async () => {
    if (!LIVE_ENV_READY) return
    const svc = serviceClient()
    const orgA = await createEphemeralOrg(svc, 'Phase51 Site Org A')
    const orgB = await createEphemeralOrg(svc, 'Phase51 Site Org B')
    const adminAMember = await createEphemeralMember(svc, orgA, 'admin')
    const workerAMember = await createEphemeralMember(svc, orgA, 'worker')
    const adminBMember = await createEphemeralMember(svc, orgB, 'admin')
    const deptA = await createEphemeralDepartment(svc, orgA)
    const sopA = await createEphemeralSop(svc, orgA, adminAMember.userId)
    const sopB = await createEphemeralSop(svc, orgB, adminBMember.userId)

    // Seed an org-B layout + machine via the service client so probe 7 can
    // attempt a cross-org link without depending on admin B's own writes.
    const layoutB = await createSiteLayout(svc, orgB)
    const { data: machineB, error: machineBErr } = await svc
      .from('site_machines')
      .insert({
        site_layout_id: layoutB.id,
        organisation_id: orgB,
        name: 'Phase51 Org B seed machine',
        polygon: samplePolygon(),
        code: newMachineCode(),
      })
      .select('id')
      .single()
    if (machineBErr || !machineB) throw new Error(`seed machineB failed: ${machineBErr?.message}`)

    const adminAToken = await mintAccessToken(svc, adminAMember.email)
    const workerAToken = await mintAccessToken(svc, workerAMember.email)
    const adminBToken = await mintAccessToken(svc, adminBMember.email)

    fx = {
      orgA,
      orgB,
      adminA: { userId: adminAMember.userId, client: asUserClient(adminAToken) },
      workerA: { userId: workerAMember.userId, client: asUserClient(workerAToken) },
      adminB: { userId: adminBMember.userId, client: asUserClient(adminBToken) },
      deptA,
      sopA,
      sopB,
      layoutBId: layoutB.id,
      machineBId: machineB.id as string,
      layoutAId: '',
      machineAId: '',
      machineACode: '',
      linkAId: null,
    }
  })

  // -- Probe 1: admin A creates layout, machine, link -- all succeed --------
  test('1. admin A can insert a site_layouts row, a site_machines row on it, and a sop_machines link', async () => {
    const { data: layout, error: layoutErr } = await fx.adminA.client
      .from('site_layouts')
      .insert({ organisation_id: fx.orgA, name: 'Phase51 Org A Site', scene_width: 1600, scene_height: 900 })
      .select('id')
      .single()
    expect(layoutErr).toBeNull()
    fx.layoutAId = layout!.id as string

    const code = newMachineCode()
    const { data: machine, error: machineErr } = await fx.adminA.client
      .from('site_machines')
      .insert({
        site_layout_id: fx.layoutAId,
        organisation_id: fx.orgA,
        name: 'Press 1',
        department_id: fx.deptA,
        polygon: samplePolygon(),
        code,
      })
      .select('id')
      .single()
    expect(machineErr).toBeNull()
    fx.machineAId = machine!.id as string
    fx.machineACode = code

    const { data: link, error: linkErr } = await fx.adminA.client
      .from('sop_machines')
      .insert({ sop_id: fx.sopA.id, machine_id: fx.machineAId, organisation_id: fx.orgA })
      .select('sop_id, machine_id')
      .single()
    expect(linkErr).toBeNull()
    fx.linkAId = link as { sop_id: string; machine_id: string }
  })

  // -- Probe 2: worker-read cell ---------------------------------------------
  test('2. same-org worker A can read the org-A layout, machine and link', async () => {
    const { data: layouts, error: layoutErr } = await fx.workerA.client.from('site_layouts').select('id').eq('id', fx.layoutAId)
    expect(layoutErr).toBeNull()
    expect(layouts).toHaveLength(1)

    const { data: machines, error: machineErr } = await fx.workerA.client.from('site_machines').select('id').eq('id', fx.machineAId)
    expect(machineErr).toBeNull()
    expect(machines).toHaveLength(1)

    const { data: links, error: linkErr } = await fx.workerA.client
      .from('sop_machines')
      .select('sop_id, machine_id')
      .eq('sop_id', fx.sopA.id)
      .eq('machine_id', fx.machineAId)
    expect(linkErr).toBeNull()
    expect(links).toHaveLength(1)
  })

  // -- Probe 3: same-org worker write is denied -------------------------------
  test('3. same-org worker A write to site_machines/sop_machines is denied (silent zero-row deny, verified by re-read)', async () => {
    const { error: insErr } = await fx.workerA.client
      .from('site_machines')
      .insert({
        site_layout_id: fx.layoutAId,
        organisation_id: fx.orgA,
        name: 'Worker-inserted machine',
        polygon: samplePolygon(),
        code: newMachineCode(),
      })
    expect(insErr).not.toBeNull()

    await fx.workerA.client.from('site_machines').update({ name: 'Worker-edited name' }).eq('id', fx.machineAId)
    const { data: afterUpdate } = await serviceClient().from('site_machines').select('name').eq('id', fx.machineAId).single()
    expect(afterUpdate?.name).not.toBe('Worker-edited name')

    await fx.workerA.client.from('sop_machines').delete().eq('sop_id', fx.sopA.id).eq('machine_id', fx.machineAId)
    const { data: afterDelete } = await serviceClient()
      .from('sop_machines')
      .select('sop_id')
      .eq('sop_id', fx.sopA.id)
      .eq('machine_id', fx.machineAId)
      .maybeSingle()
    expect(afterDelete).not.toBeNull()
  })

  // -- Probe 4: cross-org read cell -------------------------------------------
  test('4. foreign-org admin B reads zero rows across all three tables', async () => {
    const { data: layouts } = await fx.adminB.client.from('site_layouts').select('id').eq('id', fx.layoutAId)
    expect(layouts ?? []).toHaveLength(0)

    const { data: machines } = await fx.adminB.client.from('site_machines').select('id').eq('id', fx.machineAId)
    expect(machines ?? []).toHaveLength(0)

    const { data: links } = await fx.adminB.client
      .from('sop_machines')
      .select('sop_id, machine_id')
      .eq('sop_id', fx.sopA.id)
      .eq('machine_id', fx.machineAId)
    expect(links ?? []).toHaveLength(0)
  })

  // -- Probe 5: cross-org write is denied --------------------------------------
  test('5. foreign-org admin B write to org-A rows is denied (update/delete zero-row, insert with foreign org id rejected by WITH CHECK)', async () => {
    await fx.adminB.client.from('site_machines').update({ name: 'Admin-B-edited name' }).eq('id', fx.machineAId)
    const { data: afterUpdate } = await serviceClient().from('site_machines').select('name').eq('id', fx.machineAId).single()
    expect(afterUpdate?.name).not.toBe('Admin-B-edited name')

    await fx.adminB.client.from('site_layouts').delete().eq('id', fx.layoutAId)
    const { data: afterDelete } = await serviceClient().from('site_layouts').select('id').eq('id', fx.layoutAId).maybeSingle()
    expect(afterDelete).not.toBeNull()

    const { error: insErr } = await fx.adminB.client.from('site_machines').insert({
      site_layout_id: fx.layoutAId,
      organisation_id: fx.orgA, // admin B's session org is B -- WITH CHECK must reject this
      name: 'Admin-B cross-org insert',
      polygon: samplePolygon(),
      code: newMachineCode(),
    })
    expect(insErr).not.toBeNull()
  })

  // -- Probe 6: composite FK blocks a foreign layout reference -----------------
  test('6. a machine cannot be created on another org\'s layout even with a matching organisation_id (composite FK)', async () => {
    const { error } = await fx.adminB.client.from('site_machines').insert({
      site_layout_id: fx.layoutAId, // org A's layout
      organisation_id: fx.orgB, // admin B's own org -- passes WITH CHECK, fails the composite FK
      name: 'Admin-B mismatched-layout machine',
      polygon: samplePolygon(),
      code: newMachineCode(),
    })
    expect(error).not.toBeNull()
  })

  // -- Probe 7: composite FK blocks a foreign machine reference ----------------
  test('7. a sop_machines link cannot point at another org\'s machine even with a matching organisation_id (composite FK)', async () => {
    const { error } = await fx.adminA.client.from('sop_machines').insert({
      sop_id: fx.sopA.id,
      machine_id: fx.machineBId, // org B's seeded machine
      organisation_id: fx.orgA, // admin A's own org -- passes WITH CHECK, fails the composite FK
    })
    expect(error).not.toBeNull()
  })

  // -- Probe 8: a row cannot be reassigned to a foreign org -------------------
  test('8. admin A cannot rewrite their own machine\'s organisation_id to org B (re-read shows org A unchanged)', async () => {
    await fx.adminA.client.from('site_machines').update({ organisation_id: fx.orgB }).eq('id', fx.machineAId)
    const { data: persisted } = await serviceClient().from('site_machines').select('organisation_id').eq('id', fx.machineAId).single()
    expect(persisted?.organisation_id).toBe(fx.orgA)
  })

  // -- Probe 9: column constraints ---------------------------------------------
  test('9. constraint checks: polygon needs >= 3 points, code is unique, code must be uppercase Crockford base32', async () => {
    const { error: shortPolygonErr } = await fx.adminA.client.from('site_machines').insert({
      site_layout_id: fx.layoutAId,
      organisation_id: fx.orgA,
      name: 'Two-point machine',
      polygon: [
        [0, 0],
        [1, 1],
      ],
      code: newMachineCode(),
    })
    expect(shortPolygonErr).not.toBeNull()

    const { error: dupCodeErr } = await fx.adminA.client.from('site_machines').insert({
      site_layout_id: fx.layoutAId,
      organisation_id: fx.orgA,
      name: 'Duplicate-code machine',
      polygon: samplePolygon(),
      code: fx.machineACode, // reuses probe 1's code
    })
    expect(dupCodeErr).not.toBeNull()
    expect(dupCodeErr?.code).toBe('23505')

    const { error: lowercaseErr } = await fx.adminA.client.from('site_machines').insert({
      site_layout_id: fx.layoutAId,
      organisation_id: fx.orgA,
      name: 'Lowercase-code machine',
      polygon: samplePolygon(),
      code: 'abc123',
    })
    expect(lowercaseErr).not.toBeNull()
  })

  // -- Probe 10: cascades (D-13) -----------------------------------------------
  test('10. cascades: department delete sets machine.department_id null; machine delete cascades its link; SOP delete cascades its link', async () => {
    const svc = serviceClient()

    await svc.from('departments').delete().eq('id', fx.deptA)
    const { data: afterDeptDelete } = await svc.from('site_machines').select('id, department_id').eq('id', fx.machineAId).single()
    expect(afterDeptDelete?.id).toBe(fx.machineAId)
    expect(afterDeptDelete?.department_id).toBeNull()

    await svc.from('site_machines').delete().eq('id', fx.machineAId)
    const { data: linkAfterMachineDelete } = await svc
      .from('sop_machines')
      .select('sop_id')
      .eq('sop_id', fx.sopA.id)
      .eq('machine_id', fx.machineAId)
      .maybeSingle()
    expect(linkAfterMachineDelete).toBeNull()

    // Recreate a machine + link, then delete the SOP and confirm the link cascades too.
    const { data: machine2, error: machine2Err } = await svc
      .from('site_machines')
      .insert({
        site_layout_id: fx.layoutAId,
        organisation_id: fx.orgA,
        name: 'Phase51 cascade-probe machine 2',
        polygon: samplePolygon(),
        code: newMachineCode(),
      })
      .select('id')
      .single()
    expect(machine2Err).toBeNull()

    const { error: link2Err } = await svc
      .from('sop_machines')
      .insert({ sop_id: fx.sopA.id, machine_id: machine2!.id, organisation_id: fx.orgA })
    expect(link2Err).toBeNull()

    await svc.from('sops').delete().eq('id', fx.sopA.id)
    const { data: linkAfterSopDelete } = await svc
      .from('sop_machines')
      .select('sop_id')
      .eq('machine_id', machine2!.id)
      .maybeSingle()
    expect(linkAfterSopDelete).toBeNull()
  })

  // -- Probe 11: storage.objects for site-scenes ------------------------------
  test('11. site-scenes storage is scoped to the caller\'s own org folder, admin/safety_manager write, jpeg/png only', async () => {
    const pngBytes = fs.readFileSync(path.join(ROOT, 'tests', 'evals', 'fixtures', 'site-scene.png'))
    const ownPath = scenePath(fx.orgA, randomUUID(), 'png')
    const foreignPath = scenePath(fx.orgB, randomUUID(), 'png')

    const { error: uploadOwnErr } = await fx.adminA.client.storage
      .from(SCENE_BUCKET)
      .upload(ownPath, pngBytes, { contentType: 'image/png', upsert: false })
    expect(uploadOwnErr).toBeNull()
    cleanupStoragePaths.push(ownPath)

    const { error: uploadForeignErr } = await fx.adminA.client.storage
      .from(SCENE_BUCKET)
      .upload(foreignPath, pngBytes, { contentType: 'image/png', upsert: false })
    expect(uploadForeignErr).not.toBeNull()

    const { error: workerUploadErr } = await fx.workerA.client.storage
      .from(SCENE_BUCKET)
      .upload(scenePath(fx.orgA, randomUUID(), 'png'), pngBytes, { contentType: 'image/png', upsert: false })
    expect(workerUploadErr).not.toBeNull()

    const { error: workerDownloadErr } = await fx.workerA.client.storage.from(SCENE_BUCKET).download(ownPath)
    expect(workerDownloadErr).toBeNull()

    const { error: adminBDownloadErr } = await fx.adminB.client.storage.from(SCENE_BUCKET).download(ownPath)
    expect(adminBDownloadErr).not.toBeNull()

    const { error: htmlUploadErr } = await fx.adminA.client.storage
      .from(SCENE_BUCKET)
      .upload(scenePath(fx.orgA, randomUUID(), 'png'), Buffer.from('<html></html>'), { contentType: 'text/html', upsert: false })
    expect(htmlUploadErr).not.toBeNull()
  })
})
