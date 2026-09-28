/**
 * Phase 53 -- PHN-02. Live runtime probe for `/m/[code]` org scoping:
 * same-org success, foreign-org and absent/malformed codes all 404
 * identically (mirrors tests/phase51/site-model-rls-runtime.spec.ts).
 *
 * Registration: playwright.config.ts `phase53` project
 *   testDir: '.', testMatch: /tests\/phase53\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase53`
 *
 * CLAUDE.md 2026-09-28: this spec mints exactly two OTP sessions (one per
 * worker) and must run once -- never loop it. `verifyOtp failed: Request
 * rate limit reached` is the shared OTP budget, not a regression.
 *
 * Static @/ imports only -- CLAUDE.md 2026-06-24.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { newMachineCode } from '@/lib/site/scene'

const ROOT = process.cwd()

// ---------------------------------------------------------------------------
// Live Supabase fixture helpers (copied verbatim from
// tests/phase51/site-model-rls-runtime.spec.ts -- no shared test-utils
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
  role: 'worker' | 'admin'
): Promise<{ userId: string; email: string }> {
  const email = `p53-mcode-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-phase53-test.invalid`
  const { data: userResp, error } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (error || !userResp?.user) throw new Error(`createUser failed: ${error?.message}`)
  cleanupUserIds.push(userResp.user.id)
  const { error: memErr } = await admin.from('organisation_members').insert({ organisation_id: orgId, user_id: userResp.user.id, role })
  if (memErr) throw new Error(`organisation_members insert failed: ${memErr.message}`)
  return { userId: userResp.user.id, email }
}

function samplePolygon(): number[][] {
  return [
    [10, 10],
    [110, 10],
    [110, 110],
    [10, 110],
  ]
}

async function createSiteLayout(client: SupabaseClient, orgId: string): Promise<{ id: string }> {
  const { data, error } = await client
    .from('site_layouts')
    .insert({ organisation_id: orgId, name: 'Phase53 m-code probe site', scene_width: 1600, scene_height: 900 })
    .select('id')
    .single()
  if (error) throw new Error(`createSiteLayout failed: ${error.message}`)
  return data as { id: string }
}

test.afterAll(async () => {
  if (!LIVE_ENV_READY) return
  const svc = serviceClient()
  for (const orgId of cleanupOrgIds) {
    await svc.from('organisations').delete().eq('id', orgId)
  }
  for (const userId of cleanupUserIds) {
    await svc.auth.admin.deleteUser(userId).catch(() => {})
  }
  // Service-role count check: nothing ephemeral this spec created survives.
  if (cleanupOrgIds.length > 0) {
    const { count } = await svc.from('organisations').select('id', { count: 'exact', head: true }).in('id', cleanupOrgIds)
    expect(count ?? 0).toBe(0)
  }
  if (cleanupUserIds.length > 0) {
    for (const userId of cleanupUserIds) {
      const { data } = await svc.auth.admin.getUserById(userId)
      expect(data?.user).toBeNull()
    }
  }
})

// ---------------------------------------------------------------------------
// Shared fixture: org A with a site layout, one machine (code from
// newMachineCode()) and a worker member; org B with a worker member only.
// ---------------------------------------------------------------------------

type Fixture = {
  orgA: string
  orgB: string
  workerA: SupabaseClient
  workerB: SupabaseClient
  machineACode: string
}

let fx: Fixture

test.describe.configure({ mode: 'serial' })

test.describe('/m/[code] org scope -- live probes (ephemeral orgs)', () => {
  test.skip(!LIVE_ENV_READY, 'requires NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local')

  test.beforeAll(async () => {
    if (!LIVE_ENV_READY) return
    const svc = serviceClient()
    const orgA = await createEphemeralOrg(svc, 'Phase53 m-code Org A')
    const orgB = await createEphemeralOrg(svc, 'Phase53 m-code Org B')
    const workerAMember = await createEphemeralMember(svc, orgA, 'worker')
    const workerBMember = await createEphemeralMember(svc, orgB, 'worker')

    const layoutA = await createSiteLayout(svc, orgA)
    const code = newMachineCode()
    const { data: machineA, error: machineErr } = await svc
      .from('site_machines')
      .insert({
        site_layout_id: layoutA.id,
        organisation_id: orgA,
        name: 'Phase53 m-code probe machine',
        polygon: samplePolygon(),
        code,
      })
      .select('id')
      .single()
    if (machineErr || !machineA) throw new Error(`seed machineA failed: ${machineErr?.message}`)

    const workerAToken = await mintAccessToken(svc, workerAMember.email)
    const workerBToken = await mintAccessToken(svc, workerBMember.email)

    fx = {
      orgA,
      orgB,
      workerA: asUserClient(workerAToken),
      workerB: asUserClient(workerBToken),
      machineACode: code,
    }
  })

  test('a worker resolves a same-org machine code to its SOP list (the page\'s exact query shape)', async () => {
    const { data, error } = await fx.workerA
      .from('site_machines')
      .select('id, code')
      .eq('code', fx.machineACode)
      .eq('organisation_id', fx.orgA)
      .maybeSingle()
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data?.code).toBe(fx.machineACode)
  })

  test('RLS alone hides another org\'s machine by code, with no org filter at all', async () => {
    const { data, error } = await fx.workerB.from('site_machines').select('id').eq('code', fx.machineACode).maybeSingle()
    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  test('a worker gets nothing for a foreign-org code even with the page\'s belt-and-braces org filter applied to their OWN org', async () => {
    const { data, error } = await fx.workerB
      .from('site_machines')
      .select('id')
      .eq('code', fx.machineACode)
      .eq('organisation_id', fx.orgB)
      .maybeSingle()
    expect(error).toBeNull()
    expect(data).toBeNull()
  })
})
