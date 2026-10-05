/**
 * Phase 60 -- Raise and withdraw.
 * Requirements: RQS-01. Decisions: D-01, D-03. Owning plan: 60-04.
 * Source-contract cases on wiring and order, on comment-stripped source.
 * Registration: playwright.config.ts `phase60` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, '..', '..', rel), 'utf-8').replace(/\r\n/g, '\n')
const strip = (src: string) => src.split('\n').map((l) => (/^\s*(\/\/|\/\*|\*\/|\*)/.test(l) ? '' : l)).join('\n')

const ACTIONS = strip(read('src/actions/requests.ts'))
const CORE = strip(read('src/lib/requests/core.ts'))
const body = (src: string, name: string) => {
  const start = src.indexOf(`export async function ${name}`)
  const next = src.indexOf('\nexport async function ', start + 1)
  return src.slice(start, next === -1 ? undefined : next)
}

test.describe('Raise and withdraw (60-04)', () => {
  test('every input schema is strict and carries no organisation, user or agent field', () => {
    const schemas = ACTIONS.slice(ACTIONS.indexOf('const raiseSchema'), ACTIONS.indexOf('const key ='))
    expect(schemas.match(/\.strict\(\)/g)?.length).toBe(4) // three schemas plus the nested subject
    expect(schemas).not.toMatch(/organisation|user_?id|userId|agent|asker|raised_by/i)
  })

  test('organisation and actor come from the session, never the input', () => {
    for (const name of ['raiseRequest', 'withdrawRequest', 'answerRequest', 'listMyRequests']) {
      const b = body(ACTIONS, name)
      expect(b, name).toContain('await getSessionContext()')
      expect(b, name).toMatch(/if \(!userId\) return/)
      expect(b, name).toMatch(/if \(!organisationId\) return/)
    }
    expect(body(ACTIONS, 'raiseRequest')).toContain('raisedByUser: userId')
    expect(body(ACTIONS, 'raiseRequest')).not.toContain('parsed.data.organisation')
  })

  test('raiseRequest checks kind and subject type fit, the note rule, then the subject in the session org, then inserts', () => {
    const b = body(ACTIONS, 'raiseRequest')
    const order = ['subjectTypesFor(kind)', 'noteRule(kind, note)', 'subjectInOrg(organisationId, subject)', 'insertRequest(organisationId']
    const at = order.map((o) => b.indexOf(o))
    expect(at.every((i) => i > -1), at.join()).toBe(true)
    expect([...at].sort((x, y) => x - y)).toEqual(at)
    expect(ACTIONS).toContain('z.enum(RAISABLE_KINDS)')
  })

  test('raising and withdrawing never write the ledger or fan out notifications', () => {
    for (const name of ['raiseRequest', 'withdrawRequest']) {
      expect(body(ACTIONS, name), name).not.toMatch(/recordDecision|notify\(/)
    }
  })

  test('insertRequest is a plain core module and withdrawOwnRequest filters on the asker and state open', () => {
    expect(CORE.trimStart().startsWith("import 'server-only'")).toBe(true)
    expect(CORE).not.toMatch(/['"]use server['"]/)
    const w = CORE.slice(CORE.indexOf('export async function withdrawOwnRequest'), CORE.indexOf('export async function listMyRequestRows'))
    for (const f of [".eq('raised_by_user', userId)", ".eq('state', 'open')", ".eq('organisation_id', organisationId)"]) expect(w).toContain(f)
    expect(body(ACTIONS, 'withdrawRequest')).toContain('withdrawOwnRequest(organisationId, userId')
  })

  test('the action file exports only async functions and imports neither the service role nor the agent helper', () => {
    const exports = ACTIONS.split('\n').filter((l) => l.startsWith('export '))
    expect(exports.length).toBeGreaterThanOrEqual(4)
    for (const l of exports) expect(l, l).toMatch(/^export async function /)
    expect(ACTIONS).not.toMatch(/createAdminClient|requests\/agent/)
  })

  test('listMyRequests reads through the session client under RLS', () => {
    const b = body(ACTIONS, 'listMyRequests')
    expect(b).toContain('listMyRequestRows(supabase, userId)')
    expect(CORE).toContain('sessionClient')
  })
})
