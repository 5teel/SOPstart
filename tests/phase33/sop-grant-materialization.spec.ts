/**
 * SC-4 — Narrowing override + org-isolation + revoke-propagation against LIVE
 * materialized junctions (sop_departments / sop_access_people).
 *
 * [2026-06-15]-MANDATED REAL RUNTIME INSERT — flipped LIVE in 33-05 (no
 * test.fixme). Same structural blocker as tests/phase32/grants-org-isolation
 * .spec.ts / person-grant-rls.spec.ts: src/actions/grants.ts is 'use server'
 * and requireAdminContext() reads next/headers cookies(), which can only run
 * inside a real Next.js request scope — no chromium/browser session can
 * reach it either (no page in this phase wires grants.ts into a client
 * bundle yet). This spec therefore proves materialization the same way
 * person-grant-rls.spec.ts proved D-13: it imports the REAL production pure
 * resolver (resolveSopAccess, resolve-sop-access.ts) and drives it against
 * real DB-fetched org shape data, then performs the SAME replace-write
 * materializeSopAccessForOrg performs (real INSERT/DELETE against
 * sop_departments/sop_access_people/access_grants — none of which carry an
 * authenticated write policy, so service-role writes here faithfully stand
 * in for the Server Action's own admin-client writes). The DECISION LOGIC
 * under test is the real imported module, not a reimplementation.
 *
 * Per RESEARCH Pitfall 6: org_members_can_view_sops (00003) OR-composes an
 * org-wide raw-SELECT on sops — asserting raw-select denial for a
 * non-chosen same-org worker would assert something false. Person
 * visibility is asserted via JUNCTION TRUTH (sop_access_people rows) and
 * the sop_in_user_person_grants() D-13 RPC outcome, never raw-select denial.
 *
 * All fixtures are ephemeral (fresh throwaway organisations + auth users)
 * — this spec NEVER mutates real customer data (Railway-only-testing
 * convention: no separate staging DB).
 *
 * Registration: playwright.config.ts `phase33` project
 *   testDir: '.', testMatch: /tests\/phase33\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase33`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { resolveSopAccess } from '@/lib/org-model/resolve-sop-access'

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

async function createEphemeralWorker(admin: SupabaseClient, orgId: string, tag: string): Promise<{ userId: string; email: string }> {
  const email = `p33-sgm-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-phase33-test.invalid`
  const { data: userResp, error } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (error || !userResp?.user) throw new Error(`createUser failed: ${error?.message}`)
  cleanupUserIds.push(userResp.user.id)
  const { error: memErr } = await admin.from('organisation_members').insert({ organisation_id: orgId, user_id: userResp.user.id, role: 'worker' })
  if (memErr) throw new Error(`organisation_members insert failed: ${memErr.message}`)
  return { userId: userResp.user.id, email }
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

/**
 * Faithful stand-in for materializeSopAccessForOrg (grants.ts) — same DB
 * reads + same replace-write, decision logic delegated to the REAL
 * resolveSopAccess() import (not reimplemented here).
 */
async function materialize(admin: SupabaseClient, orgId: string, sopId: string): Promise<void> {
  const { data: sopCollRows } = await admin.from('sop_collections').select('collection_id').eq('sop_id', sopId)
  const sopCollectionIds = new Set(((sopCollRows ?? []) as Array<{ collection_id: string }>).map(r => r.collection_id))

  const { data: deptsData } = await admin.from('departments').select('id, area_id').eq('organisation_id', orgId).eq('archived', false)
  const { data: rolesData } = await admin.from('roles').select('id, department_id').eq('organisation_id', orgId)
  const { data: grantsData } = await admin.from('access_grants').select('subject_type, subject_id, collection_id, sop_id').eq('organisation_id', orgId)

  const depts = (deptsData ?? []) as Array<{ id: string; area_id: string | null }>
  const roles = (rolesData ?? []) as Array<{ id: string; department_id: string }>
  const grants = (grantsData ?? []) as Array<{ subject_type: 'org' | 'area' | 'department' | 'role' | 'person'; subject_id: string | null; collection_id: string | null; sop_id: string | null }>

  const sopTargetGrants = grants.filter(g => g.sop_id === sopId).map(g => ({ subjectType: g.subject_type, subjectId: g.subject_id }))
  if (sopCollectionIds.size === 0 && sopTargetGrants.length === 0) return

  const roleIds = roles.map(r => r.id)
  const { data: roleMembersData } = roleIds.length > 0 ? await admin.from('role_members').select('role_id, member_id').in('role_id', roleIds) : { data: [] }
  const membersByRole: Record<string, string[]> = {}
  for (const rm of (roleMembersData ?? []) as Array<{ role_id: string; member_id: string }>) {
    ;(membersByRole[rm.role_id] ??= []).push(rm.member_id)
  }

  const collectionGrantsByUnit: Record<string, string[]> = {}
  const collectionPersonGrants: Array<{ subjectId: string; collectionId: string }> = []
  for (const g of grants) {
    if (!g.collection_id) continue
    const key = g.subject_type === 'org' ? orgId : g.subject_id
    if (!key) continue
    ;(collectionGrantsByUnit[key] ??= []).push(g.collection_id)
    if (g.subject_type === 'person' && g.subject_id) collectionPersonGrants.push({ subjectId: g.subject_id, collectionId: g.collection_id })
  }

  const { overridden, deptSet, personSet } = resolveSopAccess({
    orgId,
    depts: depts.map(d => ({ id: d.id, areaId: d.area_id })),
    roles: roles.map(r => ({ id: r.id, departmentId: r.department_id })),
    membersByRole,
    collectionGrantsByUnit,
    collectionPersonGrants,
    sopCollectionIds,
    sopTargetGrants,
  })

  if (overridden) {
    await admin.from('sops').update({ all_departments: false }).eq('id', sopId)
  }

  await admin.from('sop_departments').delete().eq('sop_id', sopId)
  if (deptSet.size > 0) {
    await admin.from('sop_departments').insert([...deptSet].map(department_id => ({ sop_id: sopId, department_id })))
  }

  await admin.from('sop_access_people').delete().eq('sop_id', sopId)
  if (personSet.size > 0) {
    await admin.from('sop_access_people').insert([...personSet].map(member_id => ({ sop_id: sopId, member_id })))
  }
}

test.describe('SC-4 — SOP-target override materialization (live Supabase)', () => {
  test.skip(!LIVE_ENV_READY, 'requires NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local')

  test('a person-subject SOP-target grant overrides one SOP (sibling unaffected), revoking the last override re-follows the collection', async () => {
    const admin = serviceClient()

    const orgId = await createEphemeralOrg(admin, 'Phase33 SGM Org')
    const { userId: grantee, email: granteeEmail } = await createEphemeralWorker(admin, orgId, 'grantee')
    const { userId: nonGrantee, email: nonGranteeEmail } = await createEphemeralWorker(admin, orgId, 'nongrantee')

    const { data: dept } = await admin
      .from('departments')
      .insert({ organisation_id: orgId, name: 'General', code: 'general' })
      .select('id')
      .single()
    const deptId = (dept as { id: string }).id

    const { data: collection } = await admin
      .from('collections')
      .insert({ organisation_id: orgId, name: 'Test Collection', colour: '#3b82f6', sort: 0 })
      .select('id')
      .single()
    const collectionId = (collection as { id: string }).id

    async function makeSop(title: string) {
      const { data } = await admin
        .from('sops')
        .insert({
          organisation_id: orgId,
          title,
          category: 'Test Collection',
          status: 'published',
          source_file_path: 'phase33-test/fixture.docx',
          source_file_type: 'docx',
          source_file_name: 'fixture.docx',
          uploaded_by: grantee,
          all_departments: false,
        })
        .select('id')
        .single()
      return (data as { id: string }).id
    }
    const sop1Id = await makeSop('Phase33 SGM SOP 1')
    const sop2Id = await makeSop('Phase33 SGM SOP 2')

    await admin.from('sop_collections').insert([
      { sop_id: sop1Id, collection_id: collectionId },
      { sop_id: sop2Id, collection_id: collectionId },
    ])

    // 1. Department-subject collection grant, materialize both SOPs — both
    //    should reflect the department via the collection.
    const { error: collGrantErr } = await admin
      .from('access_grants')
      .insert({ organisation_id: orgId, subject_type: 'department', subject_id: deptId, collection_id: collectionId })
    expect(collGrantErr).toBeNull()

    await materialize(admin, orgId, sop1Id)
    await materialize(admin, orgId, sop2Id)

    const deptRowsBefore = async (sopId: string) => (await admin.from('sop_departments').select('department_id').eq('sop_id', sopId)).data ?? []
    expect((await deptRowsBefore(sop1Id)).map(r => r.department_id)).toEqual([deptId])
    expect((await deptRowsBefore(sop2Id)).map(r => r.department_id)).toEqual([deptId])

    // 2. Person-subject SOP-target grant on SOP-1 -> override.
    const { data: sopTargetGrant, error: sopGrantErr } = await admin
      .from('access_grants')
      .insert({ organisation_id: orgId, subject_type: 'person', subject_id: grantee, sop_id: sop1Id })
      .select('id')
      .single()
    expect(sopGrantErr).toBeNull()

    await materialize(admin, orgId, sop1Id)

    const { data: sop1DeptRows } = await admin.from('sop_departments').select('department_id').eq('sop_id', sop1Id)
    expect(sop1DeptRows ?? []).toHaveLength(0)
    const { data: sop1PeopleRows } = await admin.from('sop_access_people').select('member_id').eq('sop_id', sop1Id)
    expect((sop1PeopleRows ?? []).map(r => r.member_id)).toEqual([grantee])
    const { data: sop1Row } = await admin.from('sops').select('all_departments').eq('id', sop1Id).single()
    expect((sop1Row as { all_departments: boolean }).all_departments).toBe(false)

    // Sibling SOP-2 is untouched — still follows the collection.
    const { data: sop2DeptRows } = await admin.from('sop_departments').select('department_id').eq('sop_id', sop2Id)
    expect((sop2DeptRows ?? []).map(r => r.department_id)).toEqual([deptId])

    // 3. Junction truth + the D-13 RPC — never raw-select denial (Pitfall 6).
    const granteeToken = await mintAccessToken(admin, granteeEmail)
    const { data: granteeResult } = await asUserClient(granteeToken).rpc('sop_in_user_person_grants', { p_sop_id: sop1Id })
    expect(granteeResult).toBe(true)

    const nonGranteeToken = await mintAccessToken(admin, nonGranteeEmail)
    const { data: nonGranteeResult } = await asUserClient(nonGranteeToken).rpc('sop_in_user_person_grants', { p_sop_id: sop1Id })
    expect(nonGranteeResult).toBe(false)
    void nonGrantee

    // 4. Revoke the last SOP-target grant -> SOP-1 re-follows its collection
    //    (emergent — no stored overridden flag).
    const { error: revokeErr } = await admin.from('access_grants').delete().eq('id', (sopTargetGrant as { id: string }).id)
    expect(revokeErr).toBeNull()

    await materialize(admin, orgId, sop1Id)

    const { data: sop1DeptRowsAfter } = await admin.from('sop_departments').select('department_id').eq('sop_id', sop1Id)
    expect((sop1DeptRowsAfter ?? []).map(r => r.department_id)).toEqual([deptId])
    const { data: sop1PeopleRowsAfter } = await admin.from('sop_access_people').select('member_id').eq('sop_id', sop1Id)
    expect(sop1PeopleRowsAfter ?? []).toHaveLength(0)
  })

  test('cross-tenant SOP-target grant write is rejected — Org A admin session, Org B sop_id, zero rows written', async () => {
    const admin = serviceClient()

    const orgAId = await createEphemeralOrg(admin, 'Phase33 SGM Org A')
    const orgBId = await createEphemeralOrg(admin, 'Phase33 SGM Org B')
    const { userId: adminAId, email: adminAEmail } = await createEphemeralWorker(admin, orgAId, 'admin-a')
    await admin.from('organisation_members').update({ role: 'admin' }).eq('user_id', adminAId).eq('organisation_id', orgAId)

    const { data: orgBSop } = await admin
      .from('sops')
      .insert({
        organisation_id: orgBId,
        title: 'Org B SOP',
        source_file_name: 'fixture.docx',
        source_file_type: 'docx',
        source_file_path: '',
        uploaded_by: adminAId,
        status: 'draft',
      })
      .select('id')
      .single()

    const accessToken = await mintAccessToken(admin, adminAEmail)
    const asAdminA = asUserClient(accessToken)

    const { data: insertResult, error: insertErr } = await asAdminA
      .from('access_grants')
      .insert({ organisation_id: orgAId, subject_type: 'org', subject_id: null, sop_id: (orgBSop as { id: string }).id })
      .select('id')

    expect(insertErr).not.toBeNull()
    expect(insertResult).toBeFalsy()

    const { data: rows } = await admin.from('access_grants').select('id').in('organisation_id', [orgAId, orgBId])
    expect(rows ?? []).toHaveLength(0)
  })
})
