/**
 * Phase 60 -- Ask someone to do a SOP.
 * Requirements: RQS-03. Decisions: D-02, A-03, A-05. Owning plan: 60-06.
 * Source-contract cases on wiring and order, on comment-stripped source.
 * Registration: playwright.config.ts `phase60` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, '..', '..', rel), 'utf-8').replace(/\r\n/g, '\n')
const strip = (src: string) => src.split('\n').map((l) => (/^\s*(\/\/|\/\*|\*\/|\*)/.test(l) ? '' : l)).join('\n')

const ACTIONS = strip(read('src/actions/asks.ts'))
const CORE = strip(read('src/lib/requests/ask-core.ts'))
const body = (src: string, name: string) => {
  const start = src.indexOf(`export async function ${name}`)
  const next = src.indexOf('\nexport async function ', start + 1)
  return src.slice(start, next === -1 ? undefined : next)
}

test.describe('Ask someone to do a SOP (60-06)', () => {
  test('the actions file is async-only, holds no service-role client, and every schema is strict with no org, user or agent field', () => {
    expect(ACTIONS.trimStart().startsWith("'use server'")).toBe(true)
    expect(ACTIONS).not.toMatch(/createAdminClient|requests\/agent/)
    expect(ACTIONS.match(/^export (?!async function)/gm)).toBeNull()
    const schemas = ACTIONS.slice(ACTIONS.indexOf('const askSchema'), ACTIONS.indexOf('export async function askToDoSop'))
    expect(schemas.match(/\.strict\(\)/g)?.length).toBe(5) // three top-level schemas plus the two target shapes
    expect(schemas).not.toMatch(/organisation|agent|asker|raised_by/i)
  })

  test('the core is server-only and every query carries the session organisation', () => {
    expect(CORE.trimStart().startsWith("import 'server-only'")).toBe(true)
    expect(CORE).not.toMatch(/['"]use server['"]/)
    for (const name of ['askToDoSopCore', 'declineAskCore', 'stopAskingCore']) {
      const b = body(CORE, name)
      expect(b, name).toContain('organisationId')
      expect(b, name).toContain(".eq('organisation_id', organisationId)")
    }
    expect(CORE).not.toMatch(/\.organisation_id\b/) // never an organisation read off a fetched row
  })

  test('a supervisor may ask: the guard is canAsk(role) from the session, before any read or write (A-04)', () => {
    for (const name of ['askToDoSop', 'stopAsking', 'listAskTargets']) {
      const b = body(ACTIONS, name)
      expect(b, name).toContain('canAsk(role)')
    }
    const b = body(ACTIONS, 'askToDoSop')
    expect(b.indexOf('canAsk(role)')).toBeLessThan(b.indexOf('askToDoSopCore('))
    expect(read('src/lib/requests/model.ts')).toMatch(/role === 'supervisor'/)
  })

  test('a role ask writes a role row; a person ask writes an individual row; the SOP and person are checked in the session org', () => {
    const b = body(CORE, 'askToDoSopCore')
    expect(b).toContain("assignment_type: type")
    expect(b).toContain("'role' in target ? 'role' : 'individual'")
    expect(b).toContain(".eq('status', 'published')")
    expect(b).toMatch(/from\('organisation_members'\)[\s\S]*?\.eq\('organisation_id', organisationId\)[\s\S]*?\.eq\('user_id', target\.userId\)/)
  })

  test('the assignment write precedes the request insert, and a failed request insert undoes the assignment', () => {
    const b = body(CORE, 'askToDoSopCore')
    const assign = b.indexOf(".from('sop_assignments')\n    .insert(")
    const request = b.indexOf(".from('requests')\n    .insert(")
    expect(assign).toBeGreaterThan(-1)
    expect(request).toBeGreaterThan(assign)
    const failure = b.slice(request)
    expect(failure).toMatch(/if \(req\.error \|\| !req\.data\)[\s\S]*await undo\(\)[\s\S]*return \{ error/)
    // the undo deletes a row it inserted, or restores the previous owner of one it re-attributed
    expect(b).toMatch(/\.delete\(\)\.eq\('id', insertedId\)/)
    expect(b).toMatch(/\.update\(\{ assigned_by: previous \}\)/)
  })

  test('a 23505 conflict re-attributes assigned_by to the asker rather than failing (F-21)', () => {
    const b = body(CORE, 'askToDoSopCore')
    expect(b).toContain("ins.error?.code === '23505'")
    expect(b).toMatch(/\.update\(\{ assigned_by: userId \}\)/)
    expect(b).toMatch(/upd\.error \|\| !upd\.data\?\.length/) // a zero-row write reports failure
  })

  test('an auto-accepted ask writes ONE request_accepted ledger row at raise time, after the core, and none for the raise (A-05)', () => {
    const b = body(ACTIONS, 'askToDoSop')
    expect(b.match(/await recordDecision\(/g)?.length).toBe(1)
    expect(b.indexOf('askToDoSopCore(')).toBeLessThan(b.indexOf('await recordDecision('))
    expect(b).toContain("kind: 'request_accepted'")
    expect(b).toContain('auto: true')
    expect(b).toContain("summary: 'Asked someone to do a SOP'")
    expect(b.indexOf('await recordDecision(')).toBeLessThan(b.indexOf('await notify('))
    expect(b).toContain("kind: 'asked' as const")
    expect(read('src/actions/requests.ts')).not.toContain('askToDoSopCore')
    const core = body(CORE, 'askToDoSopCore')
    expect(core).toContain("state: 'accepted'")
    expect(core).toContain('answered_by: userId')
    expect(core).toContain('decided_at:')
  })

  test('ledger details carry ids, titles and notes, never an email', () => {
    expect(ACTIONS).not.toMatch(/email/i)
    for (const s of ['Asked someone to do a SOP', 'Declined a SOP they were asked to do', 'Stopped asking someone to do a SOP']) {
      expect(ACTIONS).toContain(`'${s}'`)
    }
  })

  test('decline is person-targeted only, needs a 10 character note before any write, and resolves the SOP lineage (A-03)', () => {
    const a = body(ACTIONS, 'declineAsk')
    expect(a.indexOf('declineNoteRule(note)')).toBeGreaterThan(-1)
    expect(a.indexOf('declineNoteRule(note)')).toBeLessThan(a.indexOf('declineAskCore('))
    const c = body(CORE, 'declineAskCore')
    for (const f of [".eq('kind', 'do_sop')", ".eq('state', 'accepted')", ".eq('target_user_id', userId)"]) expect(c).toContain(f)
    expect(CORE).toContain('lineageRoot(')
    expect(CORE).toMatch(/\.eq\('assigned_by', row\.raised_by_user\)/)
    expect(CORE).toMatch(/assignment_type', 'individual'\)\.eq\('user_id', row\.target_user_id\)/)
    expect(a).toContain("outcome: 'ask_declined'")
    expect(a.indexOf('await recordDecision(')).toBeGreaterThan(a.indexOf('declineAskCore('))
    expect(a.match(/await recordDecision\(/g)?.length).toBe(1)
  })

  test('stopping is the asker\'s own unless admin or safety manager, with a reason, one ledger row, no notification', () => {
    const a = body(ACTIONS, 'stopAsking')
    expect(a).toContain("role === 'admin' || role === 'safety_manager'")
    expect(a).toContain('stopped: true')
    expect(a.match(/await recordDecision\(/g)?.length).toBe(1)
    expect(a).not.toContain('notify(')
    expect(a.indexOf('declineNoteRule(note)')).toBeLessThan(a.indexOf('stopAskingCore('))
    const c = body(CORE, 'stopAskingCore')
    expect(c).toContain("state: 'withdrawn'")
    expect(c).toContain('canStopAny ? claim : claim.eq(\'raised_by_user\', userId)')
  })

  test('a failed assignment drop puts the ask back as the asker accepted it, not as the decliner or stopper (WR-04)', () => {
    const r = CORE.slice(CORE.indexOf('async function restoreAccepted'), CORE.indexOf('export async function declineAskCore'))
    expect(r).toContain("state: 'accepted', answered_by: claimed.raised_by_user, answer_note: null, decided_at: claimed.created_at")
    expect(r).toContain(".eq('organisation_id', organisationId)")
    expect(CORE).toContain("const CLAIM_COLUMNS = 'id, subject_id, raised_by_user, target_role, target_user_id, note, created_at'")
    for (const name of ['declineAskCore', 'stopAskingCore']) {
      const c = body(CORE, name)
      expect(c, name).toContain('await restoreAccepted(organisationId, claimed)')
      expect(c, name).not.toContain("state: 'accepted', answered_by: userId")
    }
  })

  test('listAskTargets is guarded and returns labels, role and hasIt only', () => {
    const c = body(CORE, 'listAskTargetsCore')
    expect(c).toContain('userLabels(')
    expect(c).toContain('hasIt')
    expect(c).not.toMatch(/email/i)
  })

  test('worker-signal and the assignment half of useWorkerSops are unchanged since the phase began (git diff empty)', () => {
    const cwd = path.resolve(__dirname, '..', '..')
    execSync('git diff --quiet f1b2ff93 -- src/lib/sop/worker-signal.ts', { cwd })
    // Phase 63-05 (edf20637) deliberately extracted the library query into libraryQueryFn; the pin moves to that commit
    execSync('git diff --quiet edf20637 -- src/hooks/useWorkerSops.ts', { cwd })
  })
})
