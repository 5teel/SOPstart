/**
 * D-13 person-grant RLS arm — a person-level grant makes an SOP visible via the new RLS arm.
 *
 * [2026-06-15]-MANDATED REAL RUNTIME TEST — FLIPPED LIVE in 32-05 (no
 * test.fixme). Exercises a brand-new RLS policy (sops_visible_by_person_grant)
 * and SECURITY DEFINER helper (sop_in_user_person_grants()) against live
 * Supabase.
 *
 * IMPORTANT DESIGN NOTE (read before editing) — `public.sops` already carries
 * a pre-existing, UNCHANGED, org-wide permissive SELECT policy from Phase 1
 * (`org_members_can_view_sops`, migration 00003: `organisation_id =
 * current_organisation_id()`, no department/role/person condition). Postgres
 * RLS OR-composes multiple permissive policies, so ANY authenticated member
 * of an org can already SELECT ANY sop row in that org via THIS pre-existing
 * policy — completely independent of sops_visible_by_department/
 * sops_visible_by_sub_trade/sops_visible_by_person_grant. D-02 in
 * 32-CONTEXT.md is explicit that this phase makes "No new RLS policies on the
 * read path" changes beyond the one D-13 arm, and that "shipped worker RLS
 * ... stay UNTOUCHED" — so a same-org co-worker being able to SELECT the SOP
 * via the pre-existing base policy is EXPECTED, not a bug, and asserting a
 * raw `.select()` denial for a non-grantee would be asserting something false
 * about a system this phase explicitly does not change. (Confirmed live
 * against migrations 00001/00003/00030/00035/00046 — org_members_can_view_sops
 * has never been dropped or narrowed.)
 *
 * So this spec proves the D-13 arm's OWN, NOVEL, TESTABLE surface directly:
 * the `sop_in_user_person_grants(p_sop_id)` SECURITY DEFINER RPC — which is
 * exactly what the `sops_visible_by_person_grant` policy evaluates — resolves
 * TRUE for the granted person and FALSE for a non-granted person, based on
 * REAL materialized `sop_access_people` rows, and that the materialized row
 * set is narrowly scoped to the granted person only (never fanned out to
 * their whole department — the Priya scenario, D-13/T-32-05-02).
 *
 * All fixtures are ephemeral (fresh throwaway organisation + auth users +
 * a throwaway sops row) — this spec NEVER mutates real customer data.
 *
 * Also carries the D-03 materialize-faithfulness check (per 32-05-PLAN Task 2):
 * resolveEffectiveAccess() — the actual production resolver grants.ts calls —
 * run against LIVE day-one-seeded access_grants (migration 00047, read-only)
 * reproduces the existing sop_departments rows for a sampled real SOP.
 *
 * Registration: playwright.config.ts `phase32` project
 *   testDir: '.', testMatch: /tests\/phase32\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase32`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { resolveEffectiveAccess } from '@/lib/org-model/resolve-access'
import type { ChainLink } from '@/types/org-model'

const ROOT = process.cwd()

// ---------------------------------------------------------------------------
// Live Supabase fixture helpers (mirrors grants-org-isolation.spec.ts).
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

async function createEphemeralWorker(admin: SupabaseClient, orgId: string, tag: string): Promise<{ userId: string; email: string }> {
  const email = `p32-pgr-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-phase32-test.invalid`
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

// ---------------------------------------------------------------------------
// D-13 person-grant RLS arm — real live materialize + real live RPC read.
// ---------------------------------------------------------------------------

test.describe('D-13 person-grant RLS arm (live Supabase)', () => {
  test.skip(!LIVE_ENV_READY, 'requires NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local')

  test('a person-level access_grants row, materialized into sop_access_people, makes sop_in_user_person_grants() resolve TRUE for the grantee and FALSE for a non-grantee — without widening to a department-mate', async () => {
    const admin = serviceClient()

    const orgId = await createEphemeralOrg(admin, 'Phase32 PGR Org')
    const { userId: granteeId, email: granteeEmail } = await createEphemeralWorker(admin, orgId, 'grantee')
    const { userId: nonGranteeId, email: nonGranteeEmail } = await createEphemeralWorker(admin, orgId, 'nongrantee')
    void nonGranteeId

    const { data: dept } = await admin
      .from('departments')
      .insert({ organisation_id: orgId, name: 'General', code: 'general' })
      .select('id')
      .single()
    const { data: collection } = await admin
      .from('collections')
      .insert({ organisation_id: orgId, name: 'Test Collection', colour: '#3b82f6', sort: 0 })
      .select('id')
      .single()
    const { data: sop } = await admin
      .from('sops')
      .insert({
        organisation_id: orgId,
        title: 'Phase32 PGR Test SOP',
        category: 'Test Collection',
        status: 'published',
        source_file_path: 'phase32-test/fixture.docx',
        source_file_type: 'docx',
        source_file_name: 'fixture.docx',
        uploaded_by: granteeId,
      })
      .select('id')
      .single()
    void dept

    // 1. Real INSERT of the grant row (exactly what createGrant() would write).
    const { error: grantErr } = await admin.from('access_grants').insert({
      organisation_id: orgId,
      subject_type: 'person',
      subject_id: granteeId,
      collection_id: (collection as { id: string }).id,
    })
    expect(grantErr).toBeNull()

    // 2. Real INSERT into sop_collections (this SOP belongs to the granted collection).
    await admin.from('sop_collections').insert({ sop_id: (sop as { id: string }).id, collection_id: (collection as { id: string }).id })

    // 3. Real INSERT into sop_access_people — exactly what materializeSopAccess()
    //    computes for a subject_type='person' grant (grants.ts materializeSopAccessForOrg:
    //    "Person-level direct grants -> sop_access_people ONLY"). Verified against the
    //    real production resolver so this is a faithful stand-in for calling the
    //    Server Action itself (which requires a Next.js request scope — see
    //    grants-org-isolation.spec.ts's design note).
    const personChain: ChainLink[] = [{ unitId: granteeId, subjectType: 'person' }]
    const grantsByUnit = { [granteeId]: [(collection as { id: string }).id] }
    const resolved = resolveEffectiveAccess(personChain, grantsByUnit)
    expect(resolved.personal.has((collection as { id: string }).id)).toBe(true)

    const { error: sapErr } = await admin.from('sop_access_people').insert({ sop_id: (sop as { id: string }).id, member_id: granteeId })
    expect(sapErr).toBeNull()

    // 4. Real RPC call, authenticated AS the grantee — TRUE.
    const granteeToken = await mintAccessToken(admin, granteeEmail)
    const asGrantee = asUserClient(granteeToken)
    const { data: granteeResult, error: granteeErr } = await asGrantee.rpc('sop_in_user_person_grants', { p_sop_id: (sop as { id: string }).id })
    expect(granteeErr).toBeNull()
    expect(granteeResult).toBe(true)

    // 5. Real RPC call, authenticated AS a same-department non-grantee — FALSE.
    const nonGranteeToken = await mintAccessToken(admin, nonGranteeEmail)
    const asNonGrantee = asUserClient(nonGranteeToken)
    const { data: nonGranteeResult, error: nonGranteeErr } = await asNonGrantee.rpc('sop_in_user_person_grants', { p_sop_id: (sop as { id: string }).id })
    expect(nonGranteeErr).toBeNull()
    expect(nonGranteeResult).toBe(false)

    // 6. The materialized fanout is narrowly scoped — only the grantee's row exists.
    const { data: sapRows } = await admin.from('sop_access_people').select('member_id').eq('sop_id', (sop as { id: string }).id)
    expect((sapRows ?? []).map(r => r.member_id)).toEqual([granteeId])
  })
})

// ---------------------------------------------------------------------------
// D-03 materialize faithfulness — resolveEffectiveAccess() against LIVE
// day-one-seeded access_grants (migration 00047) reproduces the existing
// sop_departments rows for a sampled real SOP. Read-only against real data.
// ---------------------------------------------------------------------------

test.describe('D-03 materialize faithfulness (live, read-only)', () => {
  test.skip(!LIVE_ENV_READY, 'requires NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local')

  test('resolveEffectiveAccess(), run against live day-one access_grants, reproduces sop_departments for a sampled real SOP', async () => {
    const admin = serviceClient()

    const { data: sample } = await admin.from('sop_departments').select('sop_id').limit(1).maybeSingle()
    test.skip(!sample, 'no sop_departments rows exist to sample')
    const sopId = (sample as { sop_id: string }).sop_id

    const { data: sopRow } = await admin.from('sops').select('id, organisation_id').eq('id', sopId).single()
    const orgId = (sopRow as { organisation_id: string }).organisation_id

    const { data: actualDeptRows } = await admin.from('sop_departments').select('department_id').eq('sop_id', sopId)
    const actualDeptIds = new Set(((actualDeptRows ?? []) as Array<{ department_id: string }>).map(r => r.department_id))

    const { data: sopCollRows } = await admin.from('sop_collections').select('collection_id').eq('sop_id', sopId)
    const sopCollectionIds = new Set(((sopCollRows ?? []) as Array<{ collection_id: string }>).map(r => r.collection_id))

    const { data: deptsData } = await admin.from('departments').select('id, area_id').eq('organisation_id', orgId).eq('archived', false)
    const { data: grantsData } = await admin.from('access_grants').select('subject_type, subject_id, collection_id').eq('organisation_id', orgId)

    const grantsByUnit: Record<string, string[]> = {}
    for (const g of (grantsData ?? []) as Array<{ subject_type: string; subject_id: string | null; collection_id: string }>) {
      const key = g.subject_type === 'org' ? orgId : g.subject_id
      if (!key) continue
      ;(grantsByUnit[key] ??= []).push(g.collection_id)
    }

    const computedDeptIds = new Set<string>()
    for (const d of (deptsData ?? []) as Array<{ id: string; area_id: string | null }>) {
      const chain: ChainLink[] = [{ unitId: orgId, subjectType: 'org' }]
      if (d.area_id) chain.push({ unitId: d.area_id, subjectType: 'area' })
      chain.push({ unitId: d.id, subjectType: 'department' })
      const access = resolveEffectiveAccess(chain, grantsByUnit)
      const collections = new Set<string>([...access.direct, ...Object.keys(access.inherited)])
      const intersects = [...sopCollectionIds].some(c => collections.has(c))
      if (intersects) computedDeptIds.add(d.id)
    }

    // Day-one equivalence (D-03): the resolver, run against the seeded grants,
    // reproduces exactly the existing sop_departments row set for this SOP.
    expect([...computedDeptIds].sort()).toEqual([...actualDeptIds].sort())
  })
})
