/**
 * SC-3 — Grant can target an individual SOP from any subject tier; schema
 * enforces the XOR (a grant targets a collection OR a SOP, never both/neither).
 *
 * Contract (33-05-PLAN must_haves, RESEARCH Pattern 1):
 *   - Migration `supabase/migrations/00050_access_grants_sop_target.sql`
 *     adds a nullable `sop_id` arm to `access_grants` + an XOR CHECK
 *     constraint (exactly one of collection_id/sop_id set) + replaces
 *     00049's `uq_access_grants_subject_collection` with
 *     `uq_access_grants_subject_target` (covers both target types).
 *   - `src/actions/grants.ts` `createGrant` gains a `sopId` target arm,
 *     verifying the SOP row's `organisation_id === orgId` BEFORE insert
 *     (Pitfall 1 — mirrors the existing collRow guard).
 *   - Choosing a SOP-target grant is the trigger for the narrowing
 *     override (a chosen-by-name SOP stops following its collection).
 *
 * Flipped LIVE in 33-05.
 *
 * Registration: playwright.config.ts `phase33` project
 *   testDir: '.', testMatch: /tests\/phase33\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase33`
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
const LIVE_ENV_READY = !!(SUPABASE_URL && SERVICE_KEY)

function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
}

/** Live pg introspection via the Management API — PostgREST's schema cache can
 * false-miss right after DDL, so raw SQL is the honest source ([2026-06-15]). */
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

test.describe('createGrant — SOP-target arm source-contract (wired, not just present)', () => {
  const src = read(GRANTS_ACTION)

  test('CreateGrantInput enforces collectionId XOR sopId', () => {
    expect(src).toContain('sopId: z.string().uuid().nullable().default(null)')
    expect(src).toContain("message: 'Exactly one of collectionId or sopId must be set'")
  })

  test('createGrant verifies the sopId target belongs to the caller org BEFORE inserting, mirroring the collection guard', () => {
    const fnMatch = src.match(/export async function createGrant\(([\s\S]*?)\n\}/)
    expect(fnMatch).not.toBeNull()
    const body = fnMatch![0]
    const sopGuardIdx = body.indexOf("from('sops')")
    const insertIdx = body.indexOf("from('access_grants')\n    .insert(")
    expect(sopGuardIdx).toBeGreaterThan(-1)
    expect(insertIdx).toBeGreaterThan(-1)
    expect(sopGuardIdx).toBeLessThan(insertIdx)
    expect(body).toContain("if (!sopRow) return { error: 'SOP not found in this organisation' }")
  })

  test('createGrant materializes via materializeSopAccessForOrg when the target is a SOP (not the collection fanout)', () => {
    const body = src.match(/export async function createGrant\(([\s\S]*?)\n\}/)![0]
    expect(body).toContain('materializeSopAccessForOrg(admin, orgId, sopId')
  })

  test('revokeGrant re-materializes via materializeSopAccessForOrg for a SOP-target grant (drives last-grant-removed re-follow)', () => {
    const body = src.match(/export async function revokeGrant\(([\s\S]*?)\n\}/)![0]
    expect(body).toContain('materializeSopAccessForOrg(admin, orgId, grantRow.sop_id')
  })

  test('materializeSopAccessForOrg forces all_departments=false on override (closes the 00035 bypass)', () => {
    const body = src.match(/async function materializeSopAccessForOrg\(([\s\S]*?)\n\}/)![0]
    // WR-02 (all_departments_pre_override snapshot/restore) split the single
    // `update({ all_departments: false })` call into a ternary — both arms
    // still force all_departments: false on override, only the "first
    // override" arm additionally snapshots the pre-override value.
    expect(body).toMatch(/if \(overridden\) \{/)
    const overrideBlock = body.match(/if \(overridden\) \{([\s\S]*?)\n {2}\} else/)
    expect(overrideBlock).not.toBeNull()
    expect(overrideBlock![1]).toContain('all_departments: false, all_departments_pre_override: currentAllDepartments')
    expect(overrideBlock![1]).toContain('{ all_departments: false }')
  })
})

test.describe('Live pg introspection — access_grants nullable-arm schema (00050)', () => {
  test.skip(!LIVE_ENV_READY, 'requires NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local')

  test('access_grants.collection_id is nullable and sop_id exists, nullable, FK-referencing sops', async () => {
    test.skip(!process.env.SUPABASE_ACCESS_TOKEN, 'requires SUPABASE_ACCESS_TOKEN in .env.local for Management API access')
    const rows = await managementSql(
      `SELECT column_name, is_nullable FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'access_grants'
         AND column_name IN ('collection_id', 'sop_id')`
    )
    const byName = Object.fromEntries(rows.map(r => [r.column_name as string, r.is_nullable as string]))
    expect(byName.collection_id).toBe('YES')
    expect(byName.sop_id).toBe('YES')
  })

  test('access_grants_exactly_one_target CHECK constraint exists', async () => {
    test.skip(!process.env.SUPABASE_ACCESS_TOKEN, 'requires SUPABASE_ACCESS_TOKEN in .env.local for Management API access')
    const rows = await managementSql(
      `SELECT conname FROM pg_constraint WHERE conname = 'access_grants_exactly_one_target'`
    )
    expect(rows).toHaveLength(1)
  })

  test('uq_access_grants_subject_target replaced uq_access_grants_subject_collection', async () => {
    test.skip(!process.env.SUPABASE_ACCESS_TOKEN, 'requires SUPABASE_ACCESS_TOKEN in .env.local for Management API access')
    const rows = await managementSql(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'access_grants'
         AND indexname IN ('uq_access_grants_subject_target', 'uq_access_grants_subject_collection')`
    )
    const names = rows.map(r => r.indexname as string)
    expect(names).toContain('uq_access_grants_subject_target')
    expect(names).not.toContain('uq_access_grants_subject_collection')
  })
})

test.describe('Real live insert — SOP-target grant, cross-tenant rejected', () => {
  test.skip(!LIVE_ENV_READY, 'requires NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local')

  test('an authenticated Org A admin cannot INSERT a SOP-target access_grants row for an Org B sop_id', async () => {
    const admin = serviceClient()
    const orgAId = (
      await admin.from('organisations').insert({ name: `P33 SGS Org A ${Date.now()}` }).select('id').single()
    ).data!.id as string
    const orgBId = (
      await admin.from('organisations').insert({ name: `P33 SGS Org B ${Date.now()}` }).select('id').single()
    ).data!.id as string

    const email = `p33-sgs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-phase33-test.invalid`
    const { data: userResp } = await admin.auth.admin.createUser({ email, email_confirm: true })
    const userId = userResp!.user!.id
    await admin.from('organisation_members').insert({ organisation_id: orgAId, user_id: userId, role: 'admin' })

    const { data: orgBSop } = await admin
      .from('sops')
      .insert({
        organisation_id: orgBId,
        title: 'Org B SOP',
        source_file_name: 'Org B SOP',
        source_file_type: 'docx',
        source_file_path: '',
        uploaded_by: userId,
        status: 'draft',
      })
      .select('id')
      .single()

    const { data: linkData } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    const anon = createClient(SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: vd } = await anon.auth.verifyOtp({ token_hash: linkData!.properties!.hashed_token, type: 'magiclink' })
    const asAdminA = createClient(SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${vd!.session!.access_token}` } },
    })

    const { data: insertResult, error: insertErr } = await asAdminA
      .from('access_grants')
      .insert({ organisation_id: orgAId, subject_type: 'org', subject_id: null, sop_id: (orgBSop as { id: string }).id })
      .select('id')

    expect(insertErr).not.toBeNull()
    expect(insertResult).toBeFalsy()

    const { data: rows } = await admin.from('access_grants').select('id').in('organisation_id', [orgAId, orgBId])
    expect(rows ?? []).toHaveLength(0)

    // Cleanup — org delete cascades sops/access_grants/members.
    await admin.from('organisations').delete().eq('id', orgAId)
    await admin.from('organisations').delete().eq('id', orgBId)
    await admin.auth.admin.deleteUser(userId).catch(() => {})
  })
})
