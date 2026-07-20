/**
 * Success Criterion 4 — Cross-org write/read isolation: an org-B
 * supervisor cannot write an observation about an org-A worker; an
 * org-B session cannot read org-A observations.
 *
 * This is the codebase's recurring service-role write-hole class
 * (2026-06-15, 2026-06-26 x2, 2026-07-05 Learnings). Because Pattern 1
 * (34-RESEARCH.md) is RLS-only (no admin client), this is the primary
 * proof that the RLS policy — not app code — enforces tenant isolation.
 *
 * FLIPPED LIVE in 34-03 (no test.fixme) — same pattern as
 * tests/phase32/grants-org-isolation.spec.ts: ephemeral throwaway orgs +
 * a real magic-link-minted session, real supabase-js insert/select
 * attempts, no chromium/browser needed (Pattern 1 has no admin-client or
 * server-action layer to reach — RLS is the only enforcement surface).
 *
 * REAL BUG FOUND + FIXED during this plan (migration 00053): the original
 * 00052 INSERT policy checked `organisation_id = current_organisation_id()`
 * but never verified sop_id / observed_worker_id actually belong to that
 * org. An org-B supervisor could insert organisation_id=orgB (their own,
 * valid) while referencing an org-A sop_id/observed_worker_id — a real
 * cross-tenant write. 00053 adds `sop_observation_refs_in_org()` (a
 * SECURITY DEFINER helper) to the WITH CHECK to close this.
 *
 * Contract:
 *   - `supabase/migrations/00052_supervisor_observations.sql`'s
 *     `sop_observations_read_org` policy scopes on
 *     `organisation_id = public.current_organisation_id()` OR
 *     `observed_worker_id = auth.uid()` — the worker branch matches
 *     ONLY the caller's own id, never a widened `= any(...)` form
 *     (Information Disclosure threat per 34-RESEARCH.md § Known Threat
 *     Patterns).
 *   - `supabase/migrations/00053_sop_observations_cross_org_guard.sql`'s
 *     `sop_observations_insert_recorder` policy calls
 *     `sop_observation_refs_in_org(sop_id, observed_worker_id, organisation_id)`.
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
const MIGRATION = path.join(ROOT, 'supabase', 'migrations', '00052_supervisor_observations.sql')
const GUARD_MIGRATION = path.join(ROOT, 'supabase', 'migrations', '00053_sop_observations_cross_org_guard.sql')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('SC-4 — cross-org isolation source contract', () => {
  test('sop_observations_read_org scopes on org OR self — never a widened observed_worker_id = any(...) form', () => {
    const sql = read(MIGRATION)
    expect(sql).toContain('create policy sop_observations_read_org')
    expect(sql).toContain('organisation_id = public.current_organisation_id()')
    expect(sql).toContain('observed_worker_id = auth.uid()')
    expect(sql).not.toMatch(/observed_worker_id\s*=\s*any\s*\(/i)
  })

  test('sop_observations_insert_recorder verifies sop_id/observed_worker_id belong to the inserted org (00053 guard)', () => {
    const sql = read(GUARD_MIGRATION)
    expect(sql).toContain('sop_observation_refs_in_org')
    expect(sql).toContain('security definer')
  })
})

// ---------------------------------------------------------------------------
// Live Supabase fixture helpers ([2026-05-08]/[2026-04-24] env + session
// patterns, mirrors scripts/uat-session.mjs and tests/phase32/grants-org-isolation.spec.ts).
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
  const email = `p34-goi-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-phase34-test.invalid`
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
      title: 'Phase34 GOI probe SOP',
      status: 'published',
      version: 1,
      uploaded_by: uploaderId,
      source_file_path: 'phase34-goi/probe.docx',
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

test.describe('SC-4 — cross-org isolation runtime (real ephemeral orgs, real RLS)', () => {
  test.skip(!LIVE_ENV_READY, 'requires NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local')

  test('an org-B supervisor CANNOT insert an observation about an org-A worker — using their own (valid) organisation_id but org-A sop/worker refs, RLS denies via sop_observation_refs_in_org', async () => {
    const admin = serviceClient()
    const orgAId = await createEphemeralOrg(admin, 'Phase34 GOI Org A')
    const orgBId = await createEphemeralOrg(admin, 'Phase34 GOI Org B')
    const { userId: workerAId } = await createEphemeralMember(admin, orgAId, 'worker')
    const sopA = await createEphemeralSop(admin, orgAId, workerAId)
    const { userId: supBId, email: supBEmail } = await createEphemeralMember(admin, orgBId, 'supervisor')

    const accessToken = await mintAccessToken(admin, supBEmail)
    const asSupB = asUserClient(accessToken)

    // Real insert ATTEMPT — org-B supervisor's own (valid) organisation_id,
    // but naming an org-A worker + org-A sop.
    const { data: insertResult, error: insertErr } = await asSupB
      .from('sop_observations')
      .insert({
        organisation_id: orgBId,
        sop_id: sopA.id,
        sop_version: sopA.version,
        observed_worker_id: workerAId,
        observed_by: supBId,
        verdict: 'performed_to_sop',
      })
      .select('id')

    expect(insertErr).not.toBeNull()
    expect(insertErr?.message).not.toMatch(/^(500|internal server error)/i)
    expect(insertResult).toBeFalsy()

    const { data: rows } = await admin.from('sop_observations').select('id').in('organisation_id', [orgAId, orgBId])
    expect(rows ?? []).toHaveLength(0)
  })

  test('an org-B session reading observations returns ZERO org-A observation rows', async () => {
    const admin = serviceClient()
    const orgAId = await createEphemeralOrg(admin, 'Phase34 GOI Read Org A')
    const orgBId = await createEphemeralOrg(admin, 'Phase34 GOI Read Org B')
    const { userId: workerAId } = await createEphemeralMember(admin, orgAId, 'worker')
    const sopA = await createEphemeralSop(admin, orgAId, workerAId)
    const { userId: supAId, email: supAEmail } = await createEphemeralMember(admin, orgAId, 'supervisor')
    const { email: supBEmail } = await createEphemeralMember(admin, orgBId, 'supervisor')

    // Seed a real org-A observation as the org-A supervisor (service-role
    // insert, bypassing RLS, to seed the fixture directly).
    const { error: seedErr } = await admin.from('sop_observations').insert({
      organisation_id: orgAId,
      sop_id: sopA.id,
      sop_version: sopA.version,
      observed_worker_id: workerAId,
      observed_by: supAId,
      verdict: 'performed_to_sop',
    })
    expect(seedErr).toBeNull()

    const accessToken = await mintAccessToken(admin, supBEmail)
    const asSupB = asUserClient(accessToken)

    const { data: rows, error } = await asSupB.from('sop_observations').select('id, organisation_id')
    expect(error).toBeNull()
    expect((rows ?? []).filter((r) => r.organisation_id === orgAId)).toHaveLength(0)

    // sanity: confirm the org-A session's own read includes the seeded row
    const accessTokenA = await mintAccessToken(admin, supAEmail)
    const asSupA = asUserClient(accessTokenA)
    const { data: rowsA } = await asSupA.from('sop_observations').select('id').eq('organisation_id', orgAId)
    expect((rowsA ?? []).length).toBeGreaterThan(0)
  })
})
