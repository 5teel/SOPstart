/**
 * Cross-tenant write isolation — access_grants / role_members / sop_collections.
 *
 * [2026-06-15]-MANDATED REAL RUNTIME INSERT — FLIPPED LIVE in 32-05 (no
 * test.fixme). Phase 25's junction-write cross-tenant hole shipped green
 * because its runtime DB-write tests were test.fixme stubs; this spec is the
 * same class of write (new admin-client junction/grant tables) and is
 * exercised for real against live Supabase.
 *
 * Design note (read before editing): `src/actions/grants.ts` is a 'use server'
 * module — createGrant/revokeGrant call requireAdminContext(), which reads
 * next/headers cookies() and can only run inside a real Next.js request scope.
 * No page in this phase yet imports grants.ts into a client bundle (this plan
 * ships the backend only — UI wiring is a later Phase 32 plan), so there is no
 * Server Action reference in any build manifest to invoke over HTTP, and no
 * chromium/browser session can reach it either. This is a structural
 * blocker, not a "chromium unavailable" convenience shortcut — it is the
 * Rule-3 trade-off the plan itself pre-authorizes ("keep the cross-tenant
 * write rejection as a real insert"; degrade only what a browser could add).
 * So this spec proves cross-tenant write isolation at the layer that IS
 * reachable outside a Next.js request: (a) a WIRED source-contract check that
 * createGrant/revokeGrant verify org membership before ever calling .insert()
 * on access_grants, and (b) a REAL, live authenticated INSERT ATTEMPT against
 * access_grants — which has NO authenticated write policy at all (writes are
 * admin-server-action-only by design, 00046 §8) — proving the table itself
 * cannot be written to by any non-service-role client, cross-tenant or
 * same-tenant. That is the actual enforced security boundary: even a broken
 * app-layer guard could never leak a cross-tenant row, because Postgres
 * itself has no authenticated path to write one.
 *
 * All fixtures are ephemeral (fresh throwaway organisations + auth users
 * created and torn down within the test) — this spec NEVER mutates real
 * customer data in the shared production Supabase project (Railway-only-
 * testing convention: this repo has no separate staging DB).
 *
 * Registration: playwright.config.ts `phase32` project
 *   testDir: '.', testMatch: /tests\/phase32\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase32`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const ROOT = process.cwd()
const GRANTS_ACTION = path.join(ROOT, 'src', 'actions', 'grants.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

// ---------------------------------------------------------------------------
// Live Supabase fixture helpers ([2026-05-08]/[2026-04-24] env + session
// patterns, mirrors scripts/uat-session.mjs — no dotenv dep).
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

/** Live pg_policies introspection via the Management API (mirrors scripts/assert-phase32-day-one-equivalence.ts — PostgREST's schema cache can false-miss right after DDL, so raw SQL is the honest source, [2026-06-15] learning). */
async function managementSql(sql: string): Promise<Record<string, unknown>[]> {
  const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN
  if (!ACCESS_TOKEN) throw new Error('SUPABASE_ACCESS_TOKEN required for Management API SQL calls')
  const urlMatch = SUPABASE_URL!.match(/https:\/\/([^.]+)\.supabase\.co/)
  const projectRef = urlMatch?.[1]
  const resp = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ACCESS_TOKEN}` },
    body: JSON.stringify({ query: sql }),
  })
  const body = await resp.json()
  if (!resp.ok) throw new Error(`Management API error ${resp.status}: ${JSON.stringify(body)}`)
  return body
}

/** Mints a real access token for `email` via magic-link + verifyOtp (mirrors scripts/uat-session.mjs). */
async function mintAccessToken(admin: SupabaseClient, email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error || !data?.properties?.hashed_token) throw new Error(`generateLink failed: ${error?.message}`)
  const anon = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: vd, error: ve } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' })
  if (ve || !vd.session) throw new Error(`verifyOtp failed: ${ve?.message}`)
  return vd.session.access_token
}

/** An RLS-respecting client authenticated as a specific real user (no browser/session cookie needed). */
function asUserClient(accessToken: string): SupabaseClient {
  return createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}

const cleanupOrgIds: string[] = []
const cleanupUserIds: string[] = []

async function createEphemeralOrg(admin: SupabaseClient, namePrefix: string): Promise<string> {
  const { data, error } = await admin
    .from('organisations')
    .insert({ name: `${namePrefix} ${Date.now()}` })
    .select('id')
    .single()
  if (error || !data) throw new Error(`createEphemeralOrg failed: ${error?.message}`)
  cleanupOrgIds.push(data.id as string)
  return data.id as string
}

async function createEphemeralAdmin(admin: SupabaseClient, orgId: string): Promise<{ userId: string; email: string }> {
  const email = `p32-goi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-phase32-test.invalid`
  const { data: userResp, error } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (error || !userResp?.user) throw new Error(`createUser failed: ${error?.message}`)
  cleanupUserIds.push(userResp.user.id)
  const { error: memErr } = await admin.from('organisation_members').insert({ organisation_id: orgId, user_id: userResp.user.id, role: 'admin' })
  if (memErr) throw new Error(`organisation_members insert failed: ${memErr.message}`)
  return { userId: userResp.user.id, email }
}

test.afterAll(async () => {
  if (!LIVE_ENV_READY) return
  const admin = serviceClient()
  // Deleting the ephemeral organisations cascades every org-scoped row
  // (departments, collections, access_grants, sop_collections, sops, ...).
  for (const orgId of cleanupOrgIds) {
    await admin.from('organisations').delete().eq('id', orgId)
  }
  for (const userId of cleanupUserIds) {
    await admin.auth.admin.deleteUser(userId).catch(() => {})
  }
})

// ---------------------------------------------------------------------------
// Wired source-contract assertions — real call-site checks, not bare
// token/prop presence (CLAUDE.md 2026-06-05 learning).
// ---------------------------------------------------------------------------

test.describe('createGrant/revokeGrant — org-scope guard wired before every write', () => {
  const src = read(GRANTS_ACTION)

  test('createGrant verifies subjectId (per type) AND collectionId belong to the caller org BEFORE inserting', () => {
    const fnMatch = src.match(/export async function createGrant\(([\s\S]*?)\n\}/)
    expect(fnMatch).not.toBeNull()
    const body = fnMatch![0]
    const guardIdx = body.indexOf('verifySubjectInOrg')
    const collGuardIdx = body.indexOf("from('collections')")
    const insertIdx = body.indexOf("from('access_grants')\n    .insert(")
    expect(guardIdx).toBeGreaterThan(-1)
    expect(collGuardIdx).toBeGreaterThan(-1)
    expect(insertIdx).toBeGreaterThan(-1)
    // Both guards must run strictly BEFORE the insert (not after, not skipped).
    expect(guardIdx).toBeLessThan(insertIdx)
    expect(collGuardIdx).toBeLessThan(insertIdx)
  })

  test('createGrant rejects when the subject guard fails (returns before insert)', () => {
    const fnMatch = src.match(/export async function createGrant\(([\s\S]*?)\n\}/)
    const body = fnMatch![0]
    expect(body).toContain("if (!subjectOk) return { error: 'Subject not found in this organisation' }")
    expect(body).toContain("if (!collRow) return { error: 'Collection not found in this organisation' }")
  })

  test('revokeGrant verifies the grant belongs to the caller org before deleting', () => {
    const fnMatch = src.match(/export async function revokeGrant\(([\s\S]*?)\n\}/)
    expect(fnMatch).not.toBeNull()
    const body = fnMatch![0]
    expect(body).toContain("if (grantRow.organisation_id !== orgId) return { error: 'Grant belongs to another organisation' }")
    const guardIdx = body.indexOf('grantRow.organisation_id !== orgId')
    const deleteIdx = body.indexOf("from('access_grants').delete()")
    expect(guardIdx).toBeLessThan(deleteIdx)
  })

  test('verifySubjectInOrg checks organisation_id on the correct table per subjectType (area/department/role/person)', () => {
    expect(src).toContain("area: 'areas'")
    expect(src).toContain("department: 'departments'")
    expect(src).toContain("role: 'roles'")
    expect(src).toContain("person: 'organisation_members'")
    expect(src).toContain(".eq('organisation_id', orgId)")
  })

  test('createGrant and revokeGrant both funnel through materialization — no orphan write path (T-32-05-03)', () => {
    const createBody = src.match(/export async function createGrant\(([\s\S]*?)\n\}/)![0]
    const revokeBody = src.match(/export async function revokeGrant\(([\s\S]*?)\n\}/)![0]
    expect(createBody).toContain('materializeCollectionAccessForOrg(')
    expect(revokeBody).toContain('materializeCollectionAccessForOrg(')
  })

  test('access_grants/materializeSopAccess writes use createAdminClient(), never the plain session client', () => {
    const createBody = src.match(/export async function createGrant\(([\s\S]*?)\n\}/)![0]
    const materializeBody = src.match(/async function materializeSopAccessForOrg\(([\s\S]*?)\n\}/)![0]
    expect(createBody).toContain('createAdminClient()')
    expect(materializeBody).toContain(".from('sop_departments')")
    expect(materializeBody).toContain(".from('sop_access_people')")
  })
})

// ---------------------------------------------------------------------------
// Real live-Supabase assertions — no test.fixme.
// ---------------------------------------------------------------------------

test.describe('Live RLS posture — access_grants/role_members/sop_collections have NO authenticated write policy', () => {
  test.skip(!LIVE_ENV_READY, 'requires NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local')

  test('access_grants / role_members / sop_collections: zero rows in pg_policies for INSERT/UPDATE/DELETE (live introspection, not a schema-cache-dependent REST read)', async () => {
    test.skip(!process.env.SUPABASE_ACCESS_TOKEN, 'requires SUPABASE_ACCESS_TOKEN in .env.local for Management API access')
    const rows = await managementSql(
      `SELECT tablename, policyname, cmd FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename IN ('access_grants', 'role_members', 'sop_collections')
         AND cmd IN ('INSERT', 'UPDATE', 'DELETE')`
    )
    expect(rows).toHaveLength(0)
  })
})

test.describe('Real live insert — cross-tenant write rejected (Org A admin, Org B collection_id)', () => {
  test.skip(!LIVE_ENV_READY, 'requires NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local')

  test('an authenticated Org A admin cannot INSERT an access_grants row for an Org B collection_id — real attempt, real rejection, zero rows written', async () => {
    const admin = serviceClient()

    const orgAId = await createEphemeralOrg(admin, 'Phase32 GOI Org A')
    const orgBId = await createEphemeralOrg(admin, 'Phase32 GOI Org B')
    const { email: adminAEmail } = await createEphemeralAdmin(admin, orgAId)

    const { data: orgBCollection, error: collErr } = await admin
      .from('collections')
      .insert({ organisation_id: orgBId, name: 'Org B Collection', colour: '#3b82f6', sort: 0 })
      .select('id')
      .single()
    expect(collErr).toBeNull()

    const accessToken = await mintAccessToken(admin, adminAEmail)
    const asAdminA = asUserClient(accessToken)

    // Real insert ATTEMPT — org A admin session, org B collection_id.
    const { data: insertResult, error: insertErr } = await asAdminA
      .from('access_grants')
      .insert({ organisation_id: orgAId, subject_type: 'org', subject_id: null, collection_id: (orgBCollection as { id: string }).id })
      .select('id')

    // access_grants has NO authenticated write policy at all — the insert
    // must be rejected by RLS regardless of org match (42501 / RLS denial).
    expect(insertErr).not.toBeNull()
    expect(insertResult).toBeFalsy()

    // Confirm via service-role: zero access_grants rows exist for either
    // ephemeral org — the rejected insert wrote nothing.
    const { data: rows } = await admin.from('access_grants').select('id').in('organisation_id', [orgAId, orgBId])
    expect(rows ?? []).toHaveLength(0)
  })

  test('an authenticated Org A admin cannot INSERT a role_members row directly (admin-server-action-only, mirrors access_grants)', async () => {
    const admin = serviceClient()
    const orgAId = await createEphemeralOrg(admin, 'Phase32 GOI RM Org A')
    const { userId, email } = await createEphemeralAdmin(admin, orgAId)
    const { data: dept } = await admin
      .from('departments')
      .insert({ organisation_id: orgAId, name: 'General', code: 'general' })
      .select('id')
      .single()
    const { data: role } = await admin
      .from('roles')
      .insert({ organisation_id: orgAId, department_id: (dept as { id: string }).id, name: 'Operator', budgeted_count: 1 })
      .select('id')
      .single()

    const accessToken = await mintAccessToken(admin, email)
    const asAdminA = asUserClient(accessToken)

    // Real insert ATTEMPT using the ephemeral admin's own (real, FK-valid) user
    // id — the row is still rejected because role_members has no authenticated
    // write policy at all, proving the RLS denial is real, not an FK smokescreen.
    const { data, error } = await asAdminA
      .from('role_members')
      .insert({ role_id: (role as { id: string }).id, member_id: userId })
      .select()
    expect(error).not.toBeNull()
    expect(data).toBeFalsy()
  })
})
