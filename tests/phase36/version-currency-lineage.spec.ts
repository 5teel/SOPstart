/**
 * Phase 36 -- CMP-03 version-currency orphaning probe (RESEARCH Pitfall 1:
 * the single most important scenario in this phase). Modeled on
 * tests/phase35/competency-rls-probe.spec.ts (ephemeral org + minted
 * sessions, live Supabase runtime probe).
 *
 * Scenario: a worker completes SOP v1. An admin supersedes the SOP to v2.
 * The worker's v1 completion must still surface as evidence under v2's
 * read (lineage is NOT orphaned -- state is never reset to 'not_started'),
 * and must be flagged `isOutdatedVersion: true`.
 *
 * getTrainingMatrix/getTrainingRecordForPerson/getMyCompetencyStates all
 * gate through getSessionContext(), which needs a Next.js request scope and
 * cannot be invoked from this harness (Phase 32-05 learning). This probe
 * therefore exercises the REAL, EXPORTED pure/data functions those actions
 * call -- resolveLineage (a plain module at src/lib/competency/lineage.ts,
 * moved out of the 'use server' file per review WR-07 so it is not a
 * POST-invokable endpoint), classifyCompetency, isOutdatedVersion, refresherDueDate,
 * isRefresherOverdue -- against REAL rows created and read against the live
 * database (ephemeral org, real sops/sop_departments/sop_completions rows,
 * a real supersede, a real materialize-replace-write of sop_departments,
 * and a real admin-session read). This is strictly stronger evidence than a
 * source-contract grep: it is the shipped lineage-resolution code running
 * against the shipped schema with live data, not a reimplementation.
 *
 * Registration: playwright.config.ts `phase36` project
 *   testDir: '.', testMatch: /tests\/phase36\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase36`
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { resolveLineage } from '@/lib/competency/lineage'
import { classifyCompetency } from '@/lib/competency/classify'
import { isOutdatedVersion } from '@/lib/competency/version-currency'
import { refresherDueDate, isRefresherOverdue } from '@/lib/competency/refresher'

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

async function createEphemeralMember(
  admin: SupabaseClient,
  orgId: string,
  role: 'worker' | 'supervisor' | 'admin'
): Promise<{ userId: string; email: string }> {
  const email = `p36-lineage-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-phase36-test.invalid`
  const { data: userResp, error } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (error || !userResp?.user) throw new Error(`createUser failed: ${error?.message}`)
  cleanupUserIds.push(userResp.user.id)
  const { error: memErr } = await admin.from('organisation_members').insert({ organisation_id: orgId, user_id: userResp.user.id, role })
  if (memErr) throw new Error(`organisation_members insert failed: ${memErr.message}`)
  return { userId: userResp.user.id, email }
}

async function createEphemeralDepartment(admin: SupabaseClient, orgId: string, name: string): Promise<string> {
  const code = `P36L-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
  const { data, error } = await admin.from('departments').insert({ organisation_id: orgId, name, code }).select('id').single()
  if (error || !data) throw new Error(`createEphemeralDepartment failed: ${error?.message}`)
  return data.id as string
}

interface SopRow {
  id: string
  version: number
  parent_sop_id: string | null
  refresher_interval_months: number | null
}

async function createSop(
  admin: SupabaseClient,
  orgId: string,
  uploaderId: string,
  opts: { version: number; parentSopId: string | null; refresherIntervalMonths: number | null }
): Promise<SopRow> {
  const { data, error } = await admin
    .from('sops')
    .insert({
      organisation_id: orgId,
      title: 'Phase36 lineage probe SOP',
      status: 'published',
      version: opts.version,
      parent_sop_id: opts.parentSopId,
      refresher_interval_months: opts.refresherIntervalMonths,
      uploaded_by: uploaderId,
      source_file_path: `phase36-lineage/probe-v${opts.version}.docx`,
      source_file_type: 'docx',
      source_file_name: `probe-v${opts.version}.docx`,
    })
    .select('id, version, parent_sop_id, refresher_interval_months')
    .single()
  if (error || !data) throw new Error(`createSop failed: ${error?.message}`)
  return data as SopRow
}

async function seedCompletion(
  admin: SupabaseClient,
  orgId: string,
  sop: { id: string; version: number },
  workerId: string,
  submittedAt: string
): Promise<string> {
  const id = randomUUID()
  const { error } = await admin.from('sop_completions').insert({
    id, organisation_id: orgId, sop_id: sop.id, worker_id: workerId,
    sop_version: sop.version, content_hash: 'p36-lineage-probe', status: 'pending_sign_off',
    step_data: { probe: true }, submitted_at: submittedAt,
  })
  if (error) throw new Error(`seedCompletion failed: ${error.message}`)
  return id
}

test.afterAll(async () => {
  if (!LIVE_ENV_READY) return
  const admin = serviceClient()
  for (const orgId of cleanupOrgIds) {
    await admin.from('organisations').delete().eq('id', orgId)
    // Verify teardown actually removed the ephemeral org (T-36-10-02).
    const { data: residual } = await admin.from('organisations').select('id').eq('id', orgId).maybeSingle()
    expect(residual).toBeNull()
  }
  for (const userId of cleanupUserIds) {
    await admin.auth.admin.deleteUser(userId).catch(() => {})
  }
})

test.describe('CMP-03 -- version-currency lineage survives supersede (orphaning scenario)', () => {
  test('worker v1 completion still surfaces as evidence under v2 read, flagged isOutdatedVersion (positive + negative control)', async () => {
    test.skip(!LIVE_ENV_READY, 'requires live Supabase env in .env.local')

    const admin = serviceClient()
    const orgId = await createEphemeralOrg(admin, 'Phase36 Lineage Probe')
    const { userId: adminId, email: adminEmail } = await createEphemeralMember(admin, orgId, 'admin')
    const { userId: workerId } = await createEphemeralMember(admin, orgId, 'worker')
    const { userId: workerBId } = await createEphemeralMember(admin, orgId, 'worker')
    const deptId = await createEphemeralDepartment(admin, orgId, 'Lineage Probe Dept')
    await admin.from('member_departments').insert([
      { member_id: workerId, department_id: deptId },
      { member_id: workerBId, department_id: deptId },
    ])

    // --- v1: published, required for the department (MTX-02: sop_departments,
    // never re-derived from access_grants), and the worker completes it. ---
    const sopV1 = await createSop(admin, orgId, adminId, { version: 1, parentSopId: null, refresherIntervalMonths: 6 })
    const { error: deptSopErr } = await admin.from('sop_departments').insert({ sop_id: sopV1.id, department_id: deptId })
    if (deptSopErr) throw new Error(`sop_departments seed failed: ${deptSopErr.message}`)

    const nowIso = new Date().toISOString()
    await seedCompletion(admin, orgId, sopV1, workerId, nowIso)

    // --- Supersede to v2 (mirrors uploadNewVersion: new row with the same
    // lineage root via parent_sop_id, old row gets superseded_by set,
    // refresher_interval_months carried forward per D-01). ---
    const sopV2 = await createSop(admin, orgId, adminId, { version: 2, parentSopId: sopV1.id, refresherIntervalMonths: sopV1.refresher_interval_months })
    const { error: supersedeErr } = await admin.from('sops').update({ superseded_by: sopV2.id }).eq('id', sopV1.id)
    if (supersedeErr) throw new Error(`supersede update failed: ${supersedeErr.message}`)

    // --- Materialize replace-write (mirrors materializeSopAccessForOrg's
    // replace semantics): the department's requirement junction now points
    // at the CURRENT version only. ---
    const { error: delDeptSopErr } = await admin.from('sop_departments').delete().eq('sop_id', sopV1.id).eq('department_id', deptId)
    if (delDeptSopErr) throw new Error(`sop_departments delete failed: ${delDeptSopErr.message}`)
    const { error: insDeptSopErr } = await admin.from('sop_departments').insert({ sop_id: sopV2.id, department_id: deptId })
    if (insDeptSopErr) throw new Error(`sop_departments re-insert failed: ${insDeptSopErr.message}`)

    // Negative control: worker B completes v2 directly.
    await seedCompletion(admin, orgId, sopV2, workerBId, new Date().toISOString())

    // --- Read as the admin (RECORDER_ROLES persona) via a real minted
    // session -- proves the worker's pre-supersede completion row is still
    // visible live, not merely present in the service-role view. ---
    const adminSession = asUserClient(await mintAccessToken(admin, adminEmail))
    const { data: adminVisibleComp, error: adminReadErr } = await adminSession
      .from('sop_completions')
      .select('id, sop_version')
      .eq('sop_id', sopV1.id)
      .eq('worker_id', workerId)
    expect(adminReadErr).toBeNull()
    expect(adminVisibleComp?.length ?? 0).toBeGreaterThan(0)

    // --- Required-sop resolution: the matrix's own read path (sop_departments
    // for this department) must now report ONLY the current version. ---
    const { data: deptSopRows } = await admin.from('sop_departments').select('sop_id').eq('department_id', deptId)
    const requiredSopIds = (deptSopRows ?? []).map(r => r.sop_id as string)
    expect(requiredSopIds).toEqual([sopV2.id])

    const { data: requiredSopRows } = await admin
      .from('sops')
      .select('id, version, parent_sop_id, refresher_interval_months')
      .in('id', requiredSopIds)

    // --- The REAL lineage resolver (exported from src/actions/competency.ts). ---
    const lineage = await resolveLineage((requiredSopRows ?? []) as SopRow[], admin, orgId)
    expect(lineage.canonicalBySopId.get(sopV1.id)).toBe(sopV2.id)
    expect(lineage.allSopIds).toEqual(expect.arrayContaining([sopV1.id, sopV2.id]))

    // --- Evidence read across the whole lineage (mirrors getTrainingRecordForPerson). ---
    const { data: compRowsA } = await admin
      .from('sop_completions')
      .select('id, sop_id, sop_version, submitted_at')
      .eq('worker_id', workerId)
      .in('sop_id', lineage.allSopIds)
    // ORPHANING ASSERTION: the pre-supersede completion row still surfaces.
    expect(compRowsA?.length ?? 0).toBeGreaterThan(0)

    const canonicalOf = (sopId: string): string => lineage.canonicalBySopId.get(sopId) ?? sopId
    const latestA = (compRowsA ?? [])[0] as { sop_id: string; sop_version: number; submitted_at: string }
    expect(canonicalOf(latestA.sop_id)).toBe(sopV2.id)

    // ORPHANING ASSERTION: classifying this evidence must NEVER read as
    // not_started -- the worker's v1 read is real evidence of state 'read'.
    const classifiedA = classifyCompetency({
      hasCompletion: true,
      hasPerformedToSopObservation: false,
      hasSignOff: false,
      latestNeedsSupportAt: null,
      latestPositiveEvidenceAt: null,
    })
    expect(classifiedA.state).not.toBe('not_started')

    // POSITIVE: worker A's latest completion (v1) is outdated against v2.
    const currentVersionForA = lineage.currentVersionBySopId.get(canonicalOf(latestA.sop_id)) ?? null
    expect(isOutdatedVersion(latestA.sop_version, currentVersionForA)).toBe(true)

    // Refresher lineage behaviour (RESEARCH Assumption A3): a RECENT v1
    // completion must NOT be instantly refresher-overdue the moment v2
    // publishes.
    const dueAtA = refresherDueDate(latestA.submitted_at, lineage.refresherIntervalBySopId.get(canonicalOf(latestA.sop_id)) ?? null)
    expect(isRefresherOverdue(dueAtA, new Date().toISOString())).toBe(false)

    // --- NEGATIVE control: worker B's completion is directly against v2. ---
    const { data: compRowsB } = await admin
      .from('sop_completions')
      .select('id, sop_id, sop_version, submitted_at')
      .eq('worker_id', workerBId)
      .in('sop_id', lineage.allSopIds)
    const latestB = (compRowsB ?? [])[0] as { sop_id: string; sop_version: number }
    expect(canonicalOf(latestB.sop_id)).toBe(sopV2.id)
    const currentVersionForB = lineage.currentVersionBySopId.get(canonicalOf(latestB.sop_id)) ?? null
    expect(isOutdatedVersion(latestB.sop_version, currentVersionForB)).toBe(false)

    // --- CR-01 regression: the EXPORT-path shape. exportTrainingCsv seeds
    // resolveLineage with the SOPs of the completions in the export cut —
    // for a single-worker export whose only completion is on v1, that is the
    // superseded v1 row ALONE. The resolver must still report the lineage's
    // published current (v2), never "v1 is current" (the pre-fix defect
    // emitted on_current_version=yes in an auditor-facing CSV). Also covers
    // the stale-interval sibling: refresher_due_date's interval must come
    // from the CURRENT version, not the completed row.
    await admin.from('sops').update({ refresher_interval_months: 12 }).eq('id', sopV2.id)
    const { data: v1RowOnly } = await admin
      .from('sops')
      .select('id, version, parent_sop_id, refresher_interval_months')
      .eq('id', sopV1.id)
      .single()
    const exportLineage = await resolveLineage([v1RowOnly as SopRow], admin, orgId)
    const exportCanonical = exportLineage.canonicalBySopId.get(sopV1.id) ?? sopV1.id
    expect(exportLineage.currentVersionBySopId.get(exportCanonical)).toBe(2)
    expect(isOutdatedVersion(1, exportLineage.currentVersionBySopId.get(exportCanonical) ?? null)).toBe(true)
    expect(exportLineage.refresherIntervalBySopId.get(exportCanonical)).toBe(12)

    // --- CR-01 draft exclusion: a cloned-but-unpublished v3 draft in flight
    // must NOT move the currency baseline — workers are never outdated
    // against an unshipped version.
    const { error: draftErr } = await admin.from('sops').insert({
      organisation_id: orgId,
      title: 'Phase36 lineage probe SOP (draft)',
      status: 'draft',
      version: 3,
      parent_sop_id: sopV1.id,
      refresher_interval_months: 12,
      uploaded_by: adminId,
      source_file_path: 'phase36-lineage/probe-v3.docx',
      source_file_type: 'docx',
      source_file_name: 'probe-v3.docx',
    })
    expect(draftErr).toBeNull()
    const draftLineage = await resolveLineage([v1RowOnly as SopRow], admin, orgId)
    expect(draftLineage.currentVersionBySopId.get(draftLineage.canonicalBySopId.get(sopV1.id) ?? sopV1.id)).toBe(2)
  })
})
