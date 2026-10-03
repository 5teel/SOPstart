/**
 * 56-07: live proof of `convert-sops-to-steps.ts --apply` in a THROWAWAY org.
 * Service key only (no sessions, no OTP). Gated by PHASE56_LIVE=1.
 *
 * Proves: converts, idempotent re-run, edit-safe + attachment-safe re-run,
 * item removal deletes only that row, old rows (sop_sections / sop_steps)
 * untouched, and a gate-failing SOP writes no focus steps.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const ROOT = process.cwd()
for (const f of ['.env.local', '.env']) {
  try {
    for (const line of fs.readFileSync(path.join(ROOT, f), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
    }
  } catch { /* env from shell */ }
}
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const LIVE = process.env.PHASE56_LIVE === '1' && !!URL && !!KEY

test.describe.configure({ mode: 'serial' })

type Row = Record<string, unknown>
let sb: SupabaseClient
let orgId = ''
let userId = ''
let s1 = ''
let s2 = ''
let secH = ''
let secP = ''
let secR = ''
let stepsSnapshot: Row[] = []
const expectedSections = new Map<string, Row>()

const layout = (content: unknown[]) => ({ content })
const item = (type: string, props: Record<string, unknown>) => ({ type, props })

function runApply(sopId: string) {
  const r = spawnSync('npx', ['tsx', 'scripts/convert-sops-to-steps.ts', '--apply', '--sop', sopId], {
    cwd: ROOT, shell: true, encoding: 'utf8', env: process.env, timeout: 180_000,
  })
  return { code: r.status, out: `${r.stdout}\n${r.stderr}` }
}

const focus = async (sopId: string) => {
  const { data, error } = await sb.from('sop_focus_steps').select('*').eq('sop_id', sopId).order('section_id').order('sort_order')
  if (error) throw error
  return (data ?? []) as Row[]
}
const runs = async (sopId: string) => {
  const { data, error } = await sb.from('sop_conversion_runs').select('*').eq('sop_id', sopId)
  if (error) throw error
  return (data ?? []) as Row[]
}
const sectionRows = async (sopId: string) => {
  const { data, error } = await sb.from('sop_sections').select('*').eq('sop_id', sopId).order('sort_order')
  if (error) throw error
  return (data ?? []) as Row[]
}
const stepRows = async (sopId: string) => {
  const { data, error } = await sb.from('sop_steps').select('*, sop_sections!inner(sop_id)').eq('sop_sections.sop_id', sopId).order('id')
  if (error) throw error
  return (data ?? []) as Row[]
}
const ins = async (table: string, row: Row) => {
  const { data, error } = await sb.from(table).insert(row).select('id').single()
  if (error || !data) throw new Error(`${table} insert: ${error?.message}`)
  return data.id as string
}
const editLayout = async (sectionId: string, content: unknown[]) => {
  const { data, error } = await sb.from('sop_sections').update({ layout_data: layout(content) }).eq('id', sectionId).select('*').single()
  if (error || !data) throw new Error(`layout edit: ${error?.message}`)
  expectedSections.set(sectionId, data as Row)
}

const H_CONTENT = [item('HazardCardBlock', { id: 'h1', severity: 'warning', title: 'Crush', body: 'Keep hands clear of the press.' })]
const P_CONTENT = (stepText: string) => [
  item('StepBlock', { id: 's1', text: stepText }),
  item('CalloutBlock', { id: 'w1', title: 'Warning', body: 'Stored energy.' }),
  item('CalloutBlock', { id: 't1', title: 'Tip', body: 'Use the red tag.' }),
  item('MeasurementBlock', { id: 'm1', label: 'Pressure', unit: 'bar', tolerance: { min: 1, max: 2 } }),
]

test.beforeAll(async () => {
  test.skip(!LIVE, 'live DB spec -- run with PHASE56_LIVE=1')
  sb = createClient(URL!, KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  orgId = await ins('organisations', { name: `p56 convert-apply ${Date.now()}` })
  const { data: u, error } = await sb.auth.admin.createUser({ email: `p56-apply-${Date.now()}@example-phase56-test.invalid`, email_confirm: true })
  if (error || !u?.user) throw new Error(`createUser: ${error?.message}`)
  userId = u.user.id
  const sop = (title: string) => ins('sops', {
    organisation_id: orgId, title, status: 'draft', version: 1, uploaded_by: userId,
    source_file_path: 'p56/apply.docx', source_file_type: 'docx', source_file_name: 'apply.docx',
  })
  s1 = await sop('P56 apply S1')
  s2 = await sop('P56 apply S2')
  const section = (sopId: string, section_type: string, title: string, sort_order: number, layout_data: unknown) =>
    ins('sop_sections', { sop_id: sopId, section_type, title, sort_order, approved: false, layout_data })
  secH = await section(s1, 'hazards', 'Hazards', 10, layout(H_CONTENT))
  secP = await section(s1, 'procedure', 'Procedure', 20, layout(P_CONTENT('Lock out.')))
  secR = await section(s1, 'procedure', 'Rows', 30, null)
  await ins('sop_steps', { section_id: secR, step_number: 1, text: 'Row step.', warning: 'Hot surface.', caution: 'Slippery floor.' })
  await section(s2, 'hazards', 'Hazards', 10, layout([item('HazardCardBlock', { id: 'bad', title: 'Hazard', body: '' })]))
  for (const r of await sectionRows(s1)) expectedSections.set(r.id as string, r)
  stepsSnapshot = await stepRows(s1)
})

test.afterAll(async () => {
  if (!sb) return
  if (orgId) await sb.from('organisations').delete().eq('id', orgId)
  if (userId) await sb.auth.admin.deleteUser(userId)
})

const sectionsUnchanged = async () => {
  const now = await sectionRows(s1)
  expect(now).toEqual([...expectedSections.values()].sort((a, b) => (a.sort_order as number) - (b.sort_order as number)))
  expect(await stepRows(s1)).toEqual(stepsSnapshot)
}

test('S1 converts: hazards ordered before their step, tip folded, measurement is a check', async () => {
  const r = runApply(s1)
  expect(r.code, r.out).toBe(0)
  const rows = await focus(s1)
  expect(rows.filter((x) => x.kind === 'hazard').length).toBeGreaterThanOrEqual(1 + 1 + 2)
  const w = rows.find((x) => String(x.text).includes('Stored energy'))!
  const lock = rows.find((x) => x.text === 'Lock out.')!
  expect(w.kind).toBe('hazard')
  expect(w.section_id).toBe(lock.section_id)
  expect(w.sort_order as number).toBeLessThan(lock.sort_order as number)
  expect(lock.tip).toBe('Use the red tag.')
  expect(rows.find((x) => String(x.text).startsWith('Check Pressure'))!.kind).toBe('check')
  const rr = await runs(s1)
  expect(rr).toHaveLength(1)
  expect(rr[0].ok).toBe(true)
  await sectionsUnchanged()
})

test('S1 re-run is a no-op', async () => {
  const before = await focus(s1)
  const r = runApply(s1)
  expect(r.code, r.out).toBe(0)
  expect(r.out).toContain('1 unchanged')
  expect(await focus(s1)).toEqual(before)
  expect(await runs(s1)).toHaveLength(1)
})

test('layout edit updates in place and a step-level standard attachment survives', async () => {
  const lock = (await focus(s1)).find((x) => x.text === 'Lock out.')!
  const stdId = await ins('standards', { organisation_id: orgId, name: 'ISO 45001' })
  await ins('standard_attachments', { organisation_id: orgId, standard_id: stdId, focus_step_id: lock.id })
  await editLayout(secP, P_CONTENT('Lock out the press.'))
  const r = runApply(s1)
  expect(r.code, r.out).toBe(0)
  const after = (await focus(s1)).find((x) => x.id === lock.id)!
  expect(after.text).toBe('Lock out the press.')
  const { data: att } = await sb.from('standard_attachments').select('id').eq('focus_step_id', lock.id)
  expect(att).toHaveLength(1)
  await sectionsUnchanged()
})

test('removing an item deletes only that row', async () => {
  const before = await focus(s1)
  const h1 = before.find((x) => String(x.source_key) === 'h1')!
  expect(h1).toBeTruthy()
  await editLayout(secH, [])
  const r = runApply(s1)
  expect(r.code, r.out).toBe(0)
  const after = await focus(s1)
  expect(after.find((x) => x.id === h1.id)).toBeUndefined()
  expect(after.map((x) => x.id).sort()).toEqual(before.filter((x) => x.id !== h1.id).map((x) => x.id).sort())
  await sectionsUnchanged()
})

test('S2 fails the gate: non-zero exit, no focus steps, ok=false run row with a sentence', async () => {
  const r = runApply(s2)
  expect(r.code).not.toBe(0)
  expect(await focus(s2)).toHaveLength(0)
  const rr = await runs(s2)
  expect(rr).toHaveLength(1)
  expect(rr[0].ok).toBe(false)
  expect(JSON.stringify(rr[0].failures)).toMatch(/hazard/i)
})

test('--apply without a scope exits 2', async () => {
  const r = spawnSync('npx', ['tsx', 'scripts/convert-sops-to-steps.ts', '--apply'], { cwd: ROOT, shell: true, encoding: 'utf8', env: process.env })
  expect(r.status).toBe(2)
})
