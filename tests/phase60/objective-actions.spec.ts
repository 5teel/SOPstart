/**
 * Phase 60 -- Objective writers.
 * Requirements: OBJ-01, OBJ-03. Decisions: D-10, D-11, D-12, A-01, A-10. Owning plan: 60-09.
 * Source-contract cases on wiring and order, on comment-stripped source.
 * Registration: playwright.config.ts `phase60` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, '..', '..', rel), 'utf-8').replace(/\r\n/g, '\n')
const strip = (src: string) => src.split('\n').map((l) => (/^\s*(\/\/|\/\*|\*\/|\*)/.test(l) ? '' : l)).join('\n')

const ACTIONS = strip(read('src/actions/objectives.ts'))
const CORE = strip(read('src/lib/objectives/core.ts'))
const MIGRATION = read('supabase/migrations/00074_requests_notifications_objectives.sql')
const body = (src: string, name: string) => {
  const start = src.indexOf(`export async function ${name}`)
  const next = src.indexOf('\nexport async function ', start + 1)
  return src.slice(start, next === -1 ? undefined : next)
}

test.describe('Objective writers (60-09)', () => {
  test('the actions file is async-only, holds no service-role client, and every schema is strict with no org, user, setter or agent field', () => {
    expect(ACTIONS.trimStart().startsWith("'use server'")).toBe(true)
    expect(ACTIONS).not.toMatch(/createAdminClient|requests\/agent/)
    expect(ACTIONS.match(/^export (?!async function)/gm)).toBeNull()
    const schemas = ACTIONS.slice(ACTIONS.indexOf('const subjectSchema'), ACTIONS.indexOf('const previousDetails'))
    expect(schemas.match(/\.strict\(\)/g)?.length).toBe(4)
    expect(schemas).not.toMatch(/organisation|agent|setter|set_by|confirmed_by|userId/i)
    // the agent setter is never named in the client-reachable file
    expect(ACTIONS).not.toMatch(/\{ agent:/)
    expect(ACTIONS).toContain("'person')")
  })

  test('the core is server-only, reads the session itself and no exported function takes an organisation', () => {
    expect(CORE.trimStart().startsWith("import 'server-only'")).toBe(true)
    expect(CORE).not.toMatch(/['"]use server['"]/)
    expect(CORE).toContain('getSessionContext()')
    expect(CORE).not.toMatch(/export async function \w+\([^)]*organisation/)
    expect(CORE).not.toMatch(/\.organisation_id\b/) // never an organisation read off a fetched row
    for (const name of ['setObjectiveCore', 'clearObjectiveCore', 'confirmObjectiveCore']) {
      const b = body(CORE, name)
      expect(b, name).toContain('await editor()')
      expect(b, name).toMatch(/eq\('organisation_id', organisationId\)|, organisationId, subject\)/)
    }
    // the shared subject filter itself always carries the organisation
    expect(CORE).toContain("q.eq('organisation_id', organisationId).eq('subject_type', s.type)")
    expect(body(CORE, 'listObjectivesCore')).toContain(".eq('organisation_id', organisationId)")
  })

  test('only admin and safety_manager may set, clear or confirm; the gate is in the core so the agent path shares it', () => {
    expect(CORE).toContain("const EDIT_ROLES = ['admin', 'safety_manager']")
    const editor = CORE.slice(CORE.indexOf('async function editor'), CORE.indexOf('/** The subject as it is stored'))
    expect(editor).toMatch(/!EDIT_ROLES\.includes\(role\)/)
    expect(editor).toContain('getSessionContext()')
    for (const name of ['setObjectiveCore', 'clearObjectiveCore', 'confirmObjectiveCore']) {
      const b = body(CORE, name)
      expect(b.indexOf('await editor()'), name).toBeGreaterThan(-1)
      expect(b.indexOf('await editor()'), name).toBeLessThan(b.indexOf("from('objectives')"))
    }
  })

  test('the subject is checked in the session org (department, machine, SOP, person) and a SOP is keyed on its lineage root (A-01)', () => {
    const r = CORE.slice(CORE.indexOf('async function resolveSubject'), CORE.indexOf('const COLUMNS'))
    expect(r).toContain("if (s.type === 'site') return s.id === null ? s : null")
    expect(r).toContain('lineageRoot(data)')
    expect(r).toMatch(/department: 'departments', machine: 'site_machines', person: 'organisation_members'/)
    expect(r.match(/\.eq\('organisation_id', organisationId\)/g)?.length).toBe(2)
    // set and clear both resolve before they touch the table
    for (const name of ['setObjectiveCore', 'clearObjectiveCore']) {
      const b = body(CORE, name)
      expect(b.indexOf('resolveSubject('), name).toBeGreaterThan(-1)
      expect(b.indexOf('resolveSubject('), name).toBeLessThan(b.indexOf("from('objectives')"))
    }
  })

  test('one live objective per subject: select then update or insert, one retry on 23505, a zero-row write reports failure', () => {
    const b = body(CORE, 'setObjectiveCore')
    expect(b).toContain("ins.error?.code === '23505'")
    expect(b).toContain('!!data?.length')
    expect(b).toContain('Could not save the objective')
    expect(CORE).toContain("base.is('subject_id', null)") // the site subject has no id
    // the previous text, date and setter come back for the ledger row
    expect(b).toMatch(/previous: previous\s*\? \{ text: previous\.text, dueOn: previous\.due_on, setAt: previous\.set_at, setByAgent: previous\.set_by_agent \}/)
    // the 00074 table agrees: one row per (org, subject_type, subject_id), nulls not distinct
    expect(MIGRATION).toMatch(/objectives_one_per_subject unique nulls not distinct \(organisation_id, subject_type, subject_id\)/)
  })

  test('a person write is person-set and clears the confirm pair; an agent write is agent-set and clears the person column', () => {
    const b = body(CORE, 'setObjectiveCore')
    expect(b).toContain("set_by_user: setter === 'person' ? userId : null")
    expect(b).toContain("set_by_agent: setter === 'person' ? null : setter.agent")
    expect(b).toContain('confirmed_by: null')
    expect(b).toContain('confirmed_at: null')
  })

  test('confirm matches only an agent-set, unconfirmed row in the session org', () => {
    const b = body(CORE, 'confirmObjectiveCore')
    expect(b).toContain(".not('set_by_agent', 'is', null)")
    expect(b).toContain(".is('confirmed_by', null)")
    expect(b).toContain('!row')
  })

  test('clear reports an error when there was no objective to remove', () => {
    expect(body(CORE, 'clearObjectiveCore')).toContain('There is no objective to remove.')
  })

  test('objective_set, objective_cleared and objective_confirmed are each written once, after the core, with the literal summaries', () => {
    const cases: Array<[string, string, string, string]> = [
      ['setObjective', 'setObjectiveCore(', 'objective_set', 'Set an objective'],
      ['clearObjective', 'clearObjectiveCore(', 'objective_cleared', 'Removed an objective'],
      ['confirmObjective', 'confirmObjectiveCore(', 'objective_confirmed', 'Confirmed an objective'],
    ]
    for (const [name, core, kind, summary] of cases) {
      const b = body(ACTIONS, name)
      expect(b.match(/await recordDecision\(/g)?.length, name).toBe(1)
      expect(b.indexOf('await recordDecision('), name).toBeGreaterThan(b.indexOf(core))
      expect(b, name).toContain(`kind: '${kind}'`)
      expect(b, name).toContain(`summary: '${summary}'`)
      expect(b, name).toContain("subject: { kind: 'objective', id: done.id }")
      expect(b, name).toMatch(/if \('error' in done\) return done/)
    }
    // previous text and date ride in details, never an email
    expect(ACTIONS).toContain('previous_text')
    expect(ACTIONS).toContain('previous_set_by_agent')
    expect(ACTIONS).not.toMatch(/email/i)
    // the SOP subject carries the lineage root on the ledger row
    expect(body(ACTIONS, 'setObjective')).toContain("sopId: done.subject.type === 'sop' ? done.subject.id : null")
  })

  test('listObjectives returns the core result; set-by words use the viewer role so an email never reaches a worker', () => {
    expect(body(ACTIONS, 'listObjectives')).toContain('listObjectivesCore()')
    expect(body(CORE, 'listObjectivesCore')).toContain('setByWords(labels.get(r.set_by_user), role)')
  })

  test('the migrated sops.objective rows are keyed on the lineage root (A-01)', () => {
    expect(MIGRATION).toContain("coalesce(s.parent_sop_id, s.id) as root_id")
    expect(MIGRATION).toContain("'sop', src.root_id")
  })

  test('the new tables carry no foreign key to sops (A-10)', () => {
    for (const table of ['requests', 'notifications', 'objectives']) {
      const start = MIGRATION.indexOf(`create table if not exists public.${table} (`)
      const block = MIGRATION.slice(start, MIGRATION.indexOf('\n);', start))
      expect(block, table).not.toMatch(/references public\.sops/)
    }
  })

  test('deleteSop clears requests, notifications and objectives for the SOP, each under the session org (A-10)', () => {
    const src = strip(read('src/actions/sops.ts'))
    const del = src.slice(src.indexOf('export async function deleteSop'), src.indexOf('// createSopFromWizard'))
    for (const table of ['notifications', 'requests', 'objectives']) {
      expect(del, table).toMatch(
        new RegExp(`from\\('${table}'\\)\\.delete\\(\\)\\.eq\\('organisation_id', ctx\\.organisationId\\)\\.eq\\('subject_type', 'sop'\\)\\.eq\\('subject_id', sopId\\)`),
      )
    }
  })
})
