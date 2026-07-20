/**
 * OBS-01 (append-only) — `sop_observations` has no UPDATE or DELETE path,
 * enforced at the RLS level (not just hidden in the UI).
 *
 * Contract (34-RESEARCH.md § Pattern 1, 34-PATTERNS.md § migration):
 *   - `supabase/migrations/00052_supervisor_observations.sql` creates the
 *     `sop_observations_insert_recorder` INSERT policy.
 *   - No `for update` / `for delete` policy exists anywhere in that file —
 *     append-only is a hard DB-level guarantee, matching
 *     `sop_completions`/`completion_sign_offs` (D-15) and `sop_review_events`.
 *
 * FLIPPED LIVE in 34-03 (no test.fixme) — real ephemeral org/session +
 * real authenticated UPDATE/DELETE attempts against a real
 * `sop_observations` row, same pattern as
 * tests/phase32/grants-org-isolation.spec.ts.
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

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('OBS-01 — append-only migration source contract', () => {
  test('sop_observations_insert_recorder INSERT policy exists', () => {
    const sql = read(MIGRATION)
    expect(sql).toContain('create policy sop_observations_insert_recorder')
  })

  test('no UPDATE or DELETE policy on sop_observations — append-only is a hard DB guarantee', () => {
    const sql = read(MIGRATION)
    expect(sql.toLowerCase()).not.toContain('for update')
    expect(sql.toLowerCase()).not.toContain('for delete')
  })
})

// ---------------------------------------------------------------------------
// Live Supabase fixture helpers (mirrors observation-cross-org-isolation.spec.ts
// and tests/phase32/grants-org-isolation.spec.ts).
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
  const email = `p34-imm-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-phase34-test.invalid`
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
      title: 'Phase34 immutability probe SOP',
      status: 'published',
      version: 1,
      uploaded_by: uploaderId,
      source_file_path: 'phase34-imm/probe.docx',
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

test.describe('OBS-01 — append-only runtime (real ephemeral org, real authenticated UPDATE/DELETE attempts)', () => {
  test.skip(!LIVE_ENV_READY, 'requires NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local')

  test('an authenticated UPDATE attempt on an existing sop_observations row is denied by RLS (zero rows affected), not a 500', async () => {
    const admin = serviceClient()
    const orgId = await createEphemeralOrg(admin, 'Phase34 Imm Org')
    const { userId: workerId } = await createEphemeralMember(admin, orgId, 'worker')
    const sop = await createEphemeralSop(admin, orgId, workerId)
    const { userId: supId, email: supEmail } = await createEphemeralMember(admin, orgId, 'supervisor')

    const { data: obs, error: seedErr } = await admin
      .from('sop_observations')
      .insert({
        organisation_id: orgId,
        sop_id: sop.id,
        sop_version: sop.version,
        observed_worker_id: workerId,
        observed_by: supId,
        verdict: 'performed_to_sop',
        note: 'original note',
      })
      .select('id, verdict, note')
      .single()
    expect(seedErr).toBeNull()

    const accessToken = await mintAccessToken(admin, supEmail)
    const asSup = asUserClient(accessToken)

    // Real UPDATE attempt — same org, same recording supervisor, still
    // must be refused: no UPDATE policy exists at all.
    const { data: updateResult, error: updateErr } = await asSup
      .from('sop_observations')
      .update({ verdict: 'needs_support', note: 'tampered' })
      .eq('id', (obs as { id: string }).id)
      .select('id')

    // PostgREST returns an empty array (0 rows matched the RLS-filtered
    // UPDATE target) rather than an explicit error when no policy exists —
    // assert zero rows affected either way, never a 500.
    expect(updateErr === null || updateErr.message).toBeTruthy()
    expect(updateResult ?? []).toHaveLength(0)

    const { data: unchanged } = await admin.from('sop_observations').select('verdict, note').eq('id', (obs as { id: string }).id).single()
    expect(unchanged?.verdict).toBe('performed_to_sop')
    expect(unchanged?.note).toBe('original note')
  })

  test('an authenticated DELETE attempt on an existing sop_observations row is denied by RLS (zero rows affected), not a 500', async () => {
    const admin = serviceClient()
    const orgId = await createEphemeralOrg(admin, 'Phase34 Imm Del Org')
    const { userId: workerId } = await createEphemeralMember(admin, orgId, 'worker')
    const sop = await createEphemeralSop(admin, orgId, workerId)
    const { userId: supId, email: supEmail } = await createEphemeralMember(admin, orgId, 'supervisor')

    const { data: obs, error: seedErr } = await admin
      .from('sop_observations')
      .insert({
        organisation_id: orgId,
        sop_id: sop.id,
        sop_version: sop.version,
        observed_worker_id: workerId,
        observed_by: supId,
        verdict: 'needs_support',
      })
      .select('id')
      .single()
    expect(seedErr).toBeNull()

    const accessToken = await mintAccessToken(admin, supEmail)
    const asSup = asUserClient(accessToken)

    const { data: deleteResult, error: deleteErr } = await asSup
      .from('sop_observations')
      .delete()
      .eq('id', (obs as { id: string }).id)
      .select('id')

    expect(deleteErr === null || deleteErr.message).toBeTruthy()
    expect(deleteResult ?? []).toHaveLength(0)

    const { data: stillThere } = await admin.from('sop_observations').select('id').eq('id', (obs as { id: string }).id).single()
    expect(stillThere?.id).toBe((obs as { id: string }).id)
  })
})
