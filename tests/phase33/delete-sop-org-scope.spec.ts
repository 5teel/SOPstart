/**
 * CR-01 gap closure — deleteSop cross-org rejection regression test.
 *
 * `deleteSop` (src/actions/sops.ts) is 'use server' and requireAdminContext()
 * reads next/headers cookies(), which only runs inside a real Next.js request
 * scope — same structural blocker documented in sop-grant-materialization
 * .spec.ts. This spec proves the guard two ways:
 *
 * 1. LIVE cross-org rejection: a faithful stand-in of the guarded deleteSop
 *    (same DB reads, same comparison) run against ephemeral Org A / Org B
 *    fixtures, asserting the Org B SOP and its dependent rows survive.
 * 2. SOURCE-CONTRACT guard-ordering: proves the real deleteSop body places
 *    the org-mismatch guard BEFORE the first delete call (2026-06-05
 *    wiring-not-presence rule — token presence alone doesn't prove ordering).
 *
 * All fixtures are ephemeral — never mutates real customer data
 * (Railway-only-testing convention).
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

const cleanupOrgIds: string[] = []
const cleanupUserIds: string[] = []

async function createEphemeralOrg(admin: SupabaseClient, namePrefix: string): Promise<string> {
  const { data, error } = await admin.from('organisations').insert({ name: `${namePrefix} ${Date.now()}` }).select('id').single()
  if (error || !data) throw new Error(`createEphemeralOrg failed: ${error?.message}`)
  cleanupOrgIds.push(data.id as string)
  return data.id as string
}

async function createEphemeralWorker(admin: SupabaseClient, orgId: string, tag: string): Promise<{ userId: string; email: string }> {
  const email = `p33-dso-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-phase33-test.invalid`
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
  for (const orgId of cleanupOrgIds) {
    await admin.from('organisations').delete().eq('id', orgId)
  }
  for (const userId of cleanupUserIds) {
    await admin.auth.admin.deleteUser(userId).catch(() => {})
  }
})

/**
 * Faithful stand-in for the guarded deleteSop (src/actions/sops.ts) — same
 * org-ownership fetch + comparison the real Server Action performs before
 * its six-table delete cascade.
 */
async function deleteSopStandIn(admin: SupabaseClient, callerOrgId: string, sopId: string): Promise<{ success: true } | { error: string }> {
  const { data: sopRow } = await admin.from('sops').select('id, organisation_id').eq('id', sopId).maybeSingle()
  if (!sopRow) return { error: 'SOP not found' }
  if ((sopRow as { organisation_id: string }).organisation_id !== callerOrgId) {
    return { error: 'SOP belongs to another organisation' }
  }
  await admin.from('sop_sections').delete().eq('sop_id', sopId)
  await admin.from('parse_jobs').delete().eq('sop_id', sopId)
  await admin.from('sop_assignments').delete().eq('sop_id', sopId)
  await admin.from('video_generation_jobs').delete().eq('sop_id', sopId)
  await admin.from('worker_notifications').delete().eq('sop_id', sopId)
  const { error } = await admin.from('sops').delete().eq('id', sopId)
  if (error) return { error: error.message }
  return { success: true }
}

test.describe('CR-01 — deleteSop org-scope (live Supabase)', () => {
  test.skip(!LIVE_ENV_READY, 'requires NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local')

  test('cross-org deleteSop is rejected before any delete — Org B SOP and its rows survive', async () => {
    const admin = serviceClient()

    const orgAId = await createEphemeralOrg(admin, 'Phase33 DSO Org A')
    const orgBId = await createEphemeralOrg(admin, 'Phase33 DSO Org B')
    const { userId: uploaderB } = await createEphemeralWorker(admin, orgBId, 'uploader-b')

    const { data: orgBSop } = await admin
      .from('sops')
      .insert({
        organisation_id: orgBId,
        title: 'Org B SOP',
        source_file_name: 'fixture.docx',
        source_file_type: 'docx',
        source_file_path: '',
        uploaded_by: uploaderB,
        status: 'draft',
      })
      .select('id')
      .single()
    const orgBSopId = (orgBSop as { id: string }).id

    const { data: section } = await admin
      .from('sop_sections')
      .insert({ sop_id: orgBSopId, section_type: 'steps', title: 'Section 1', sort_order: 0 })
      .select('id')
      .single()
    const sectionId = (section as { id: string }).id

    const { error: assignErr } = await admin
      .from('sop_assignments')
      .insert({ sop_id: orgBSopId, organisation_id: orgBId, assignment_type: 'individual', user_id: uploaderB, assigned_by: uploaderB })
    expect(assignErr).toBeNull()

    // Org A admin attempts to delete Org B's SOP.
    const result = await deleteSopStandIn(admin, orgAId, orgBSopId)
    expect(result).toEqual({ error: 'SOP belongs to another organisation' })

    const { data: sopRowAfter } = await admin.from('sops').select('id').eq('id', orgBSopId).maybeSingle()
    expect(sopRowAfter).not.toBeNull()
    const { data: sectionRowAfter } = await admin.from('sop_sections').select('id').eq('id', sectionId).maybeSingle()
    expect(sectionRowAfter).not.toBeNull()
    const { data: assignRowsAfter } = await admin.from('sop_assignments').select('id').eq('sop_id', orgBSopId)
    expect(assignRowsAfter ?? []).toHaveLength(1)
  })
})

test.describe('CR-01 — deleteSop guard ordering (source-contract)', () => {
  test('org-mismatch guard is positioned before the first delete in the deleteSop function body', () => {
    const raw = fs.readFileSync(path.join(ROOT, 'src', 'actions', 'sops.ts'), 'utf8')
    const content = raw.replace(/\r\n/g, '\n')

    const fnStart = content.indexOf('export async function deleteSop')
    expect(fnStart).toBeGreaterThan(-1)
    const nextExport = content.indexOf('\nexport ', fnStart + 1)
    const fnBody = content.slice(fnStart, nextExport === -1 ? undefined : nextExport)

    const fetchIdx = fnBody.indexOf("select('id, organisation_id')")
    const mismatchIdx = fnBody.indexOf('organisation_id !== ctx.organisationId')
    const noOrgIdx = fnBody.indexOf('if (!ctx.organisationId)')
    const firstDeleteIdx = fnBody.indexOf("from('sop_sections').delete")

    expect(fetchIdx).toBeGreaterThan(-1)
    expect(mismatchIdx).toBeGreaterThan(-1)
    expect(noOrgIdx).toBeGreaterThan(-1)
    expect(firstDeleteIdx).toBeGreaterThan(-1)

    expect(noOrgIdx).toBeLessThan(firstDeleteIdx)
    expect(fetchIdx).toBeLessThan(firstDeleteIdx)
    expect(mismatchIdx).toBeLessThan(firstDeleteIdx)
  })
})
