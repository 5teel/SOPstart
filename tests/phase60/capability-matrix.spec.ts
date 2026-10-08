/**
 * Phase 60 -- Capability matrix rows (stub; Wave 0 / 60-01).
 * Requirements: RQS-01, RQS-02, RQS-03, OBJ-01. Decisions: D-01, D-07, D-10. Owning plan: 60-02 / 60-04 / 60-06 / 60-09 / 60-11 / 60-17.
 * Each case below is a test.fixme the owning plan turns live with real assertions.
 * Registration: playwright.config.ts `phase60` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const MATRIX = fs.readFileSync(path.resolve(__dirname, '..', '..', '.planning', 'codebase', 'CAPABILITY-MATRIX.md'), 'utf-8')
const row = (label: string) => MATRIX.split(/\r?\n/).find((l) => l.startsWith(`| ${label} |`)) ?? ''

test.describe("Capability matrix rows (60-02 / 60-04 / 60-06 / 60-09 / 60-11 / 60-17)", () => {
  test("60-02: read rows for requests, notifications and objectives", () => {
    const n = row('Read own notifications and mark them read')
    for (const name of ['notifications_read_own', 'notifications_mark_own_read', '00074', 'read_at']) expect(n).toContain(name)
    const r = row('Read requests')
    for (const name of ['requests_read', '00074', 'service-role']) expect(r).toContain(name)
    const o = row('Read objectives')
    for (const name of ['objectives_read_org', '00074', 'service-role']) expect(o).toContain(name)
    // the three new read rows grant a worker a read (own rows for requests), never a write
    expect(n.split('|').map((c) => c.trim()).slice(2, 6)).toEqual(['✅', '✅', '✅', '✅'])
    expect(o.split('|').map((c) => c.trim()).slice(2, 6)).toEqual(['✅', '✅', '✅', '✅'])
  })
  test('60-04: raise, withdraw, answer and agent rows', () => {
    const cells = (l: string) => l.split('|').map((c) => c.trim()).slice(2, 7)
    const raise = row('Raise a request (change a SOP, new SOP, observe me)')
    expect(cells(raise)).toEqual(['✅', '✅', '✅', '✅', '✅'])
    for (const name of ['raiseRequest()', 'src/lib/requests/core.ts', 'No ledger row']) expect(raise).toContain(name)
    const withdraw = row('Withdraw your own open request')
    expect(cells(withdraw)).toEqual(['✅', '✅', '✅', '✅', '✅'])
    expect(withdraw).toContain('withdrawOwnRequest()')
    const answer = row('Answer a request')
    expect(cells(answer)).toEqual(['—', '✅', '✅', '✅', '—']) // a worker never answers
    for (const name of ['answerRequest()', "state = 'open'", 'request_accepted', 'request_declined']) expect(answer).toContain(name)
    const agent = row('Agent raises a request')
    expect(cells(agent)).toEqual(['—', '—', '—', '—', '—']) // no client path in any role
    for (const name of ['raiseRequestAsAgent()', 'machine-coverage producer was removed', 'ADR-0004 rule 4']) expect(agent).toContain(name)
  })
  test('60-06: ask, decline, stop asking and list-targets rows', () => {
    const cells = (l: string) => l.split('|').map((c) => c.trim()).slice(2, 7)
    const ask = row('Ask someone to do a SOP')
    expect(cells(ask)).toEqual(['—', '✅', '✅', '✅', '—']) // a worker never asks
    for (const name of ['askToDoSop()', 'src/lib/requests/ask-core.ts', 'service role', 'request_accepted']) expect(ask).toContain(name)
    const decline = row('Decline a SOP you were asked to do')
    expect(cells(decline)).toEqual(['✅', '✅', '✅', '✅', '—'])
    for (const name of ['declineAsk()', 'target_user_id', 'role ask cannot be declined', 'request_declined']) expect(decline).toContain(name)
    const stop = row('Stop asking')
    expect(cells(stop)).toEqual(['—', '✅ (own asks)', '✅ (any ask)', '✅ (any ask)', '—'])
    for (const name of ['stopAsking()', 'raised_by_user', 'request_declined']) expect(stop).toContain(name)
    const targets = row('List people and roles to ask')
    expect(cells(targets)).toEqual(['—', '✅', '✅', '✅', '—'])
    for (const name of ['listAskTargets()', 'getOrgMembers']) expect(targets).toContain(name)
  })
  test('60-09: set, confirm and agent objective rows, and the list read', () => {
    const cells = (l: string) => l.split('|').map((c) => c.trim()).slice(2, 7)
    const set = row('Set, change or remove an objective')
    expect(cells(set)).toEqual(['—', '—', '✅', '✅', '—']) // only admin and safety manager
    for (const name of ['setObjective()', 'clearObjective()', 'src/lib/objectives/core.ts', 'service role', 'lineage root', 'objective_set', 'objective_cleared']) expect(set).toContain(name)
    const confirm = row('Confirm an agent-set objective')
    expect(cells(confirm)).toEqual(['—', '—', '✅', '✅', '—'])
    for (const name of ['confirmObjective()', 'objective_confirmed', 'not yet confirmed']) expect(confirm).toContain(name)
    const agent = row('Agent sets an objective')
    expect(cells(agent)).toEqual(['—', '—', '✅', '✅', '—']) // the same core gate, under the caller's session
    for (const name of ['objective.*', 'setObjectiveCore()', 'ai_field_write', 'unconfirmed']) expect(agent).toContain(name)
    expect(row('Read objectives')).toContain('listObjectives()')
  })
  test('60-11: Sign-offs Requests tab row: worker none, supervisor, admin and safety manager yes', () => {
    const r = row('Sign-offs -- Requests tab')
    expect(r.split('|').map((c) => c.trim()).slice(2, 6)).toEqual(['—', '✅', '✅', '✅'])
    for (const name of ['tabsForRole()', 'getOfficeInbox()', 'requests_read', 'answerRequest()', 'browse address']) expect(r).toContain(name)
  })
  test('60-17: no matrix row names a live assign action; the self-add note says assignments come from asks', () => {
    const self = row('Self-add SOP')
    expect(self).toContain('askToDoSop')
    expect(self).toContain('deleted')
    expect(row('Ask someone to do a SOP')).not.toContain('remain until')
    expect(MATRIX).not.toMatch(/^\|\s*Assign (SOP|a SOP)/m)
  })
})
