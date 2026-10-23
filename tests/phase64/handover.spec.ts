/**
 * Phase 64 / Plan 64-05 -- the handover model, the handover read and reassignApprovalStep.
 * Requirements MEMB-09, MEMB-10, MEMB-12, MEMB-13. Decisions D-10, D-11, D-12, D-17, D-18.
 * Registration: playwright.config.ts `phase64`. Source checks strip comments after normalising CRLF.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import type { GovernanceRow } from '@/actions/governance'
import { deriveInbox, inboxCounts, INBOX_CHIPS, type HandoverItem } from '@/lib/governance/inbox'

const norm = (s: string) => s.replace(/\r\n/g, '\n')
const src = (rel: string): string =>
  norm(fs.readFileSync(path.join(process.cwd(), rel), 'utf8'))
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\/\*|\*\/|\*)/.test(l))
    .join('\n')

/** Text of `function <name>` from its declaration to the next top-level declaration. */
function body(s: string, name: string): string {
  const start = s.search(new RegExp(`(?:^|\\n)(?:export )?(?:async )?function ${name}\\b`))
  expect(start, `function ${name} exists`).toBeGreaterThanOrEqual(0)
  const rest = s.slice(start + 1)
  const next = rest.search(/\n(?:export )?(?:async )?function \w+|\nexport (?:interface|const|type) /)
  return next < 0 ? rest : rest.slice(0, next)
}

const SOP = '0b0e0d6a-1c2d-4e5f-8a9b-0c1d2e3f4a5b'
const USER = '2d2a2f8c-3e4f-4a71-8cbd-2e3f4a5b6c7d'
const empty = { governance: [], library: [] }

const govRow = (o: Partial<GovernanceRow> = {}): GovernanceRow => ({
  id: SOP,
  title: 'Press 3',
  category_slug: null,
  status: 'published',
  ownerUserId: null,
  ownerLabel: 'No owner',
  reviewDueAt: null,
  flags: ['unowned'],
  isCallerNextApprover: false,
  ...o,
})

const dept: HandoverItem = { type: 'department', key: 'handover-dept-d1', title: 'Forming', personLabel: 'sam@x (left)', departmentId: 'd1' }
const step: HandoverItem = { type: 'approval_step', key: 'handover-step-s1', title: 'Press 3', personLabel: 'sam@x (left)', sopId: SOP, stepIndex: 0 }
const chain: HandoverItem = { type: 'chain_step', key: 'handover-chain-new-0', title: 'Safety', personLabel: 'sam@x (left)', category: 'safety', stepIndex: 0 }
const ask: HandoverItem = { type: 'ask', key: 'handover-ask-r1', title: 'Press 3', personLabel: 'sam@x (left)', requestId: 'r1', sopId: SOP }
const sup: HandoverItem = { type: 'supervision', key: 'handover-sup-w1', title: 'jo@x', personLabel: 'sam@x (left)', workerId: 'w1' }

test.describe('handover model (deriveInbox)', () => {
  test('one item per handover entry, with a meta line naming the person', () => {
    const items = deriveInbox({ ...empty, handover: [dept, step, chain, ask, sup] })
    expect(items).toHaveLength(5)
    for (const i of items) {
      expect(i).toMatchObject({ kind: 'handover', chips: ['handover'], severity: 'bad', age: '', gov: null, signOff: null, review: null, action: null })
    }
    const by = (key: string) => items.find((i) => i.key === key)!
    expect(by('handover-dept-d1').meta).toBe('Department owner sam@x (left)')
    expect(by('handover-step-s1').meta).toBe('Approval waiting on sam@x (left)')
    expect(by('handover-chain-new-0').meta).toBe('Approval chain for Safety names sam@x (left)')
    expect(by('handover-ask-r1').meta).toBe('Asked sam@x (left) to do this SOP')
    expect(by('handover-sup-w1').meta).toBe('sam@x (left) was their supervisor')
    expect(by('handover-dept-d1').handover).toEqual(dept)
    expect(by('handover-dept-d1').title).toBe('Forming')
  })

  test('a flagged-unowned SOP that still names an owner gets the handover chip; with no owner it keeps owner', () => {
    const [named] = deriveInbox({ ...empty, governance: [govRow({ ownerUserId: USER, ownerLabel: 'sam@x (left)' })] })
    expect(named.chips).toEqual(['handover'])
    expect(named.severity).toBe('bad')
    const [none] = deriveInbox({ ...empty, governance: [govRow()] })
    expect(none.chips).toEqual(['owner'])
  })

  test('counts include handover; the chip sits right after owner; older items carry handover null', () => {
    const items = deriveInbox({ ...empty, governance: [govRow({ ownerUserId: USER })], handover: [dept, ask] })
    expect(inboxCounts(items).handover).toBe(3)
    expect(inboxCounts([]).handover).toBe(0)
    const keys = INBOX_CHIPS.map((c) => c.key)
    expect(keys.indexOf('handover')).toBe(keys.indexOf('owner') + 1)
    expect(INBOX_CHIPS.find((c) => c.key === 'handover')?.label).toBe('Needs a new owner')
    const [plain] = deriveInbox({ ...empty, governance: [govRow()] })
    expect(plain.handover).toBeNull()
  })
})

test.describe('listHandover (source contract)', () => {
  const s = src('src/lib/governance/load-inbox.ts')

  test('admin and safety manager only, session client, nothing when nobody is non-active', () => {
    const b = body(s, 'listHandover')
    expect(s).toContain("HANDOVER_ROLES = ['safety_manager', 'admin']")
    expect(b).toContain('!HANDOVER_ROLES.includes(role)) return []')
    expect(b).toContain(".from('organisation_members')")
    expect(b).toMatch(/status/)
    expect(b).toContain(".neq('status', 'active')")
    expect(b).not.toContain('createAdminClient')
  })

  test('reads every assignment source and feeds deriveInbox', () => {
    const b = body(s, 'listHandover')
    for (const t of ['departments', 'approval_chains', 'sops', 'sop_approvals', 'requests', 'supervisor_assignments']) {
      expect(b, t).toContain(`.from('${t}')`)
    }
    expect(b).toContain('resolveNextStepIndex')
    expect(b).toContain('statusSuffix')
    expect(s).toContain('listHandover()')
    expect(s).toMatch(/deriveInbox\(\{[\s\S]*handover/)
  })
})

test.describe('reassignApprovalStep (source contract)', () => {
  const s = src('src/actions/approvals.ts')
  const b = body(s, 'reassignApprovalStep')

  test('admin / safety manager, uuid ids, active admin-or-safety-manager target', () => {
    expect(b).toContain('requireAdmin()')
    expect(b).toContain('z.string().uuid()')
    expect(b).toContain(".eq('status', 'active')")
    expect(b).toContain("'safety_manager'")
    expect(b).toContain('Pick an admin or safety manager who is still on the site.')
  })

  test('only a pending approval, only a step held by someone no longer active', () => {
    expect(b).toContain('No pending approval for this SOP')
    expect(b).toContain('Chain already complete')
    expect(b).toContain('That step is still with someone who is on the site.')
    expect(b).toContain('resolveNextStepIndex')
  })

  test('writes with the session client, filtered by id and pending, ends in select, then logs owner_change', () => {
    expect(b).toContain('.update(')
    expect(b).toContain(".eq('id', sopId)")
    expect(b).toContain(".eq('approval_state', 'pending')")
    expect(b).toContain(".select('id')")
    expect(b).not.toContain('createAdminClient')
    expect(b.indexOf('.update(')).toBeLessThan(b.indexOf('recordDecision('))
    expect(b).toContain("kind: 'owner_change'")
    expect(b).toContain("target: 'approval_step'")
  })
})
