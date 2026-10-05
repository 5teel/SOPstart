/**
 * 56-07 history, repointed in 58-14: the full-apply path is retired (the editor
 * writes steps now). What stays live: the runner refuses the old flag, and
 * `--missing` fills only a SOP that has no steps. Live proof runs in a THROWAWAY
 * org with the service key only (no sessions, no OTP), gated by PHASE56_LIVE=1.
 * The pure planner cases live in convert.spec.ts.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const ROOT = process.cwd()
const SCRIPT = 'scripts/convert-sops-to-steps.ts'
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

const run = (...flags: string[]) => {
  const r = spawnSync('npx', ['tsx', SCRIPT, ...flags], { cwd: ROOT, shell: true, encoding: 'utf8', env: process.env, timeout: 180_000 })
  return { code: r.status, out: `${r.stdout}\n${r.stderr}` }
}

test('the full-apply flag is refused with and without a scope', () => {
  for (const flags of [['--apply', '--all'], ['--apply']]) {
    const r = run(...flags)
    expect(r.code, r.out).toBe(1)
    expect(r.out).toContain('converter retired in Phase 58')
  }
})

test.describe('--missing (live, throwaway org)', () => {
  test.describe.configure({ mode: 'serial' })
  type Row = Record<string, unknown>
  let sb: SupabaseClient
  let orgId = ''
  let userId = ''
  let blank = ''
  let hasSteps = ''
  let bad = ''
  let secBlank = ''

  const ins = async (table: string, row: Row) => {
    const { data, error } = await sb.from(table).insert(row).select('id').single()
    if (error || !data) throw new Error(`${table} insert: ${error?.message}`)
    return data.id as string
  }
  const focus = async (sopId: string) => {
    const { data, error } = await sb.from('sop_focus_steps').select('*').eq('sop_id', sopId).order('sort_order')
    if (error) throw error
    return (data ?? []) as Row[]
  }
  const runs = async (sopId: string) => {
    const { data, error } = await sb.from('sop_conversion_runs').select('*').eq('sop_id', sopId)
    if (error) throw error
    return (data ?? []) as Row[]
  }

  test.beforeAll(async () => {
    test.skip(!LIVE, 'live DB spec -- run with PHASE56_LIVE=1')
    sb = createClient(URL!, KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
    orgId = await ins('organisations', { name: `p56 convert-missing ${Date.now()}` })
    const { data: u, error } = await sb.auth.admin.createUser({ email: `p56-missing-${Date.now()}@example-phase56-test.invalid`, email_confirm: true })
    if (error || !u?.user) throw new Error(`createUser: ${error?.message}`)
    userId = u.user.id
    const sop = (title: string) => ins('sops', {
      organisation_id: orgId, title, status: 'draft', version: 1, uploaded_by: userId,
      source_file_path: 'p56/missing.docx', source_file_type: 'docx', source_file_name: 'missing.docx',
    })
    const section = (sopId: string, title: string, layout_data: unknown) =>
      ins('sop_sections', { sop_id: sopId, section_type: 'procedure', title, sort_order: 10, approved: false, layout_data })
    blank = await sop('P56 missing blank')
    hasSteps = await sop('P56 missing has steps')
    bad = await sop('P56 missing bad')
    secBlank = await section(blank, 'Procedure', { content: [{ type: 'StepBlock', props: { id: 's1', text: 'Lock out.' } }] })
    const secHas = await section(hasSteps, 'Procedure', { content: [{ type: 'StepBlock', props: { id: 's1', text: 'Old text.' } }] })
    await ins('sop_focus_steps', {
      organisation_id: orgId, sop_id: hasSteps, section_id: secHas, kind: 'step', text: 'Edited in the editor.', sort_order: 0, source_key: `edit:${Date.now()}`,
    })
    await section(bad, 'Hazards', { content: [{ type: 'HazardCardBlock', props: { id: 'bad', title: 'Hazard', body: '' } }] })
  })

  test.afterAll(async () => {
    if (!sb) return
    if (orgId) await sb.from('organisations').delete().eq('id', orgId)
    if (userId) await sb.auth.admin.deleteUser(userId)
  })

  test('a SOP with no steps is converted, with an ok run row', async () => {
    const r = run('--missing', '--sop', blank)
    expect(r.code, r.out).toBe(0)
    const rows = await focus(blank)
    expect(rows.map((x) => x.text)).toEqual(['Lock out.'])
    expect(rows[0].section_id).toBe(secBlank)
    const rr = await runs(blank)
    expect(rr).toHaveLength(1)
    expect(rr[0].ok).toBe(true)
  })

  test('a SOP that has any step is never touched, and a second run changes nothing', async () => {
    const before = await focus(hasSteps)
    const r = run('--missing', '--sop', hasSteps)
    expect(r.code, r.out).toBe(0)
    expect(await focus(hasSteps)).toEqual(before)
    expect(await runs(hasSteps)).toHaveLength(0)
    const again = await focus(blank)
    expect(run('--missing', '--sop', blank).code).toBe(0)
    expect(await focus(blank)).toEqual(again)
  })

  test('a SOP that fails the gate writes no steps and an ok=false run row', async () => {
    const r = run('--missing', '--sop', bad)
    expect(r.code).not.toBe(0)
    expect(await focus(bad)).toHaveLength(0)
    const rr = await runs(bad)
    expect(rr).toHaveLength(1)
    expect(rr[0].ok).toBe(false)
    expect(JSON.stringify(rr[0].failures)).toMatch(/hazard/i)
  })
})
