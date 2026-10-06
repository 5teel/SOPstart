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

  test('no component or action imports the agent helper directly (actions go through machine-requests)', () => {
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

test.describe('Agent requests (ADR-0002 producer)', () => {
  const MACHINES = strip(read('src/lib/requests/machine-requests.ts'))

  test('machines without a SOP raise as the default agent, on the event and on read, never via the ledger', () => {
    expect(MACHINES.trimStart().startsWith("import 'server-only'")).toBe(true)
    expect(MACHINES).not.toMatch(/['"]use server['"]/)
    expect(MACHINES).toContain('machinesWithoutSops(')
    expect(MACHINES).toContain('raiseRequestAsAgent({')
    expect(MACHINES).toContain('agent: DEFAULT_AGENT_NAME')
    expect(MACHINES).toContain("type: 'machine'")
    expect(MACHINES).toContain('This machine has no SOPs yet.')
    expect(MACHINES).not.toContain('recordDecision')
    expect(MACHINES).toMatch(/catch \(err\)/)
    expect(strip(read('src/actions/site.ts'))).toContain('reconcileMachineRequests(orgId, [(inserted as SiteMachine).id])')
    expect(strip(read('src/actions/site.ts'))).toContain('reconcileMachineRequests(orgId, [...new Set([...prior, ...validIds])])')
    expect(strip(read('src/actions/office.ts'))).toContain('reconcileMachineRequests(organisationId)')
  })

  test('both reads carry the session organisation; a machine that gained a SOP has its open agent request withdrawn', () => {
    expect(MACHINES).toContain(".from('site_machines').select('id').eq('organisation_id', organisationId)")
    expect(MACHINES).toContain(".from('sop_machines').select('machine_id').eq('organisation_id', organisationId)")
    expect(MACHINES).toContain("state: 'withdrawn'")
    expect(MACHINES).toContain(".not('raised_by_agent', 'is', null)")
    // the read path (no ids) never withdraws
    expect(MACHINES).toContain('if (!machineIds) return')
  })

  test('a declined request is not re-raised on the next read (the helper skips an answered one for 30 days)', () => {
    expect(AGENT).toContain("in('state', ['accepted', 'declined'])")
    expect(AGENT).toContain('RECENT_DAYS = 30')
    expect(AGENT).toContain("skipped: 'recent'")
  })
})
