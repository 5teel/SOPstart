/**
 * Phase 60 -- Agent requests.
 * Requirements: RQS-04. Decisions: D-05. Owning plan: 60-04 (helper), 60-08 (producer).
 * The helper cases are live; the producer cases stay fixme for 60-08.
 * Registration: playwright.config.ts `phase60` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')
const strip = (src: string) => src.split('\n').map((l) => (/^\s*(\/\/|\/\*|\*\/|\*)/.test(l) ? '' : l)).join('\n')

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p)
  }
  return out
}

const AGENT = strip(read('src/lib/requests/agent.ts'))
const CORE = strip(read('src/lib/requests/core.ts'))
const WRITE = strip(read('src/lib/notifications/write.ts'))

test.describe('Agent requests (60-04 helper)', () => {
  test('raiseRequestAsAgent lives in a plain server-only module, not a use-server file', () => {
    expect(AGENT.trimStart().startsWith("import 'server-only'")).toBe(true)
    expect(AGENT).not.toMatch(/['"]use server['"]/)
    expect(AGENT).toContain('export async function raiseRequestAsAgent')
  })

  test('no component or action imports the agent helper directly (a caller wraps it; none exists today)', () => {
    for (const f of [...walk(path.join(ROOT, 'src/components')), ...walk(path.join(ROOT, 'src/actions'))]) {
      expect(fs.readFileSync(f, 'utf-8'), f).not.toContain('requests/agent')
    }
  })

  test('the agent name is checked against the allowlist at runtime and the org is verified', () => {
    expect(AGENT).toContain('AGENT_NAMES as readonly string[]')
    expect(AGENT).toContain('subjectInOrg(organisationId')
    expect(AGENT).toContain(".eq('organisation_id', organisationId)")
  })

  test('a recent answer skips, and a unique-index violation is a skip, not an error', () => {
    expect(AGENT).toContain("skipped: 'recent'")
    expect(AGENT).toMatch(/error\.code === '23505'[\s\S]*skipped: 'open'/)
  })

  test('none of the three server modules writes the ledger', () => {
    for (const src of [AGENT, CORE, WRITE]) expect(src).not.toContain('recordDecision')
  })

  test('claimOpenRequest claims on id, org and state open for the raisable kinds', () => {
    const claim = CORE.slice(CORE.indexOf('export async function claimOpenRequest'), CORE.indexOf('export async function withdrawOwnRequest'))
    expect(claim).toContain(".eq('id', id)")
    expect(claim).toContain(".eq('organisation_id', organisationId)")
    expect(claim).toContain(".eq('state', 'open')")
    expect(claim).toContain('RAISABLE_KINDS')
    expect(claim).toContain('?? null')
  })

  test('notify keeps safe places and members of the org only, upserts ignoring duplicates, and never throws', () => {
    expect(WRITE).toContain('isSafePlace(r.place)')
    expect(WRITE).toContain(".eq('organisation_id', organisationId)")
    expect(WRITE).toContain(".in('user_id'")
    expect(WRITE).toContain("onConflict: 'user_id,dedupe_key', ignoreDuplicates: true")
    expect(WRITE).toMatch(/catch \(err\)[\s\S]*return 0/)
  })
})

test.describe('Agent requests (machine-coverage producer removed, R1 / ADR-0004 rule 4)', () => {
  test('the producer module is absent and no action, component or lib module imports it', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/lib/requests/machine-requests.ts'))).toBe(false)
    for (const f of [...walk(path.join(ROOT, 'src/components')), ...walk(path.join(ROOT, 'src/actions')), ...walk(path.join(ROOT, 'src/lib')), ...walk(path.join(ROOT, 'src/app'))]) {
      expect(fs.readFileSync(f, 'utf-8'), f).not.toContain('requests/machine-requests')
    }
  })

  test('the Requests read does not offer a request the agent raised about a machine; the rows stay', () => {
    const inbox = strip(read('src/lib/governance/load-inbox.ts'))
    const list = inbox.slice(inbox.indexOf('export async function listOpenRequests'))
    expect(list).toContain(".or('raised_by_agent.is.null,subject_type.neq.machine')")
    expect(list).not.toContain('.delete(')
    expect(list).not.toContain('.update(')
  })

  test('a declined request is not re-raised by the helper (it skips an answered one for 30 days)', () => {
    expect(AGENT).toContain("in('state', ['accepted', 'declined'])")
    expect(AGENT).toContain('RECENT_DAYS = 30')
    expect(AGENT).toContain("skipped: 'recent'")
  })
})
