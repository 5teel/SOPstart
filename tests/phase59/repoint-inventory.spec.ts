/**
 * Phase 59 / Plan 59-01 -- repoint inventory (CLAUDE.md 2026-07-13, 2026-08-04).
 *
 * The Office retires the governance page, the team page, the access page, the
 * org-model canvases, the supervisor activity view and the supervisor half of
 * the completion page. Dozens of specs and evals read those files, routes or
 * literals; left alone they go stale-red (or keep passing against nothing). This
 * guard names every one with a disposition and an OWNING plan (the plan whose
 * commit leaves the file correct; a parenthesised note names earlier plans that
 * edit their part first so every commit stays green).
 *
 *  - RETIRED   tokens that mean "this file / route / literal is going away",
 *              each tagged with the plan that retires it.
 *  - INVENTORY every test file that references a retired token today, plus the
 *              named-in-research files an owning plan still has to touch.
 *  - LIVE_PLANS each owning plan appends its id when its last commit lands;
 *              from then on its tokens must be gone from every test file.
 *
 * Row owner is NOT the same as token owner: a retired token is checked against
 * LIVE_PLANS by the plan that retires it, whoever owns the row.
 *
 * Comment lines are stripped before matching so prose in a repointed spec cannot
 * trip the guard. This file necessarily holds the tokens as data, so it is
 * excluded from the walk, as is everything under tests/phase59/ (the retirement
 * sweep there keeps the NEGATIVE assertions that quote a retired literal) and the
 * Office eval (which necessarily quotes the legacy addresses to prove they
 * redirect). Comments here describe the tokens in words only. Test files living
 * beside source under a tests folder inside src/ are tests too and are walked.
 *
 * Registration: playwright.config.ts `phase59` project.
 * Verify: `npx playwright test --list --project=phase59`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SELF = path.join('tests', 'phase59', 'repoint-inventory.spec.ts')
const P59 = path.join('tests', 'phase59') + path.sep
const OFFICE_EVAL = path.join('tests', 'evals', 'office.eval.ts')

interface Retired { token: string | RegExp; plan: string }
export const RETIRED: Retired[] = [
  // 59-05 -- the unsafe role writer (call form only: the Safe sibling survives) and the by-email add
  { token: /\bupdateMemberRole\(/, plan: '59-05' },
  { token: 'addMemberByEmail', plan: '59-05' },
  // 59-12 -- the old Office card body and its test ids; the pending-count hook
  ...['AdminOfficeBody', 'room-office-inbox', 'room-office-signoffs', 'room-office-access', 'usePendingSignOffCount']
    .map((token) => ({ token, plan: '59-12' })),
  // 59-14 -- governance / team / access pages and the org-model canvases
  ...[
    'GovernanceInbox', 'GovernanceQueueRow', 'gov-inbox', 'gov-clear', 'gov-chip', 'gov-row',
    'TeamViewShell', 'OrgChartCanvas', 'OrgColumnsBoard', 'RoleAssignmentTable', 'ViewToggle',
    'createRole', 'assignRoleMembers',
    // governance page, slash and path.join spellings
    'governance/page.tsx', "'governance', 'page.tsx'",
    // team page, slash and path.join spellings
    'admin/team/page.tsx', "'team', 'page.tsx'",
    // access page file, slash and path.join spellings (the lens component stays)
    'admin/access/page.tsx', "'access', 'page.tsx'",
  ].map((token) => ({ token, plan: '59-14' })),
  // the proxy destination that sent the attention view to the old governance page (59-13 changes it, checked once 59-14 is live)
  { token: /destination = '\/governance'/, plan: '59-14' },
  // 59-15 -- the supervisor activity view and the supervisor half of the completion page
  ...['SupervisorActivityView', 'ActivityFilter', 'CompletionSummaryCard', 'RejectReasonSheet', 'useSupervisorCompletions']
    .map((token) => ({ token, plan: '59-15' })),
]

interface Row { file: string; disposition: 'delete' | 'repoint'; plan: string }
export const INVENTORY: Row[] = [
  // ---- 59-02 ledger kinds ----
  { file: 'tests/phase56/decision-kinds-live.spec.ts', disposition: 'repoint', plan: '59-02' }, // Record<DecisionKind, ...> sample for the three new kinds
  // ---- 59-03 shell place + tab ----
  { file: 'tests/phase57/shell-structure.spec.ts', disposition: 'repoint', plan: '59-03' }, // the parsePlace(initialPlace) pin
  // ---- 59-04 inbox model ----
  { file: 'tests/phase54/governance-inbox.spec.ts', disposition: 'repoint', plan: '59-04' }, // chip order + action labels; page / component wiring half goes in 59-14
  { file: 'tests/phase30/governance-fold.spec.ts', disposition: 'repoint', plan: '59-04' }, // stuck-action literal; wiring half goes in 59-14
  // ---- 59-05 people actions ----
  { file: 'tests/phase56/decision-writers-sweep.spec.ts', disposition: 'repoint', plan: '59-05' }, // LIVE_WRITERS + registered writers
  // ---- 59-07 owner + review ----
  { file: 'tests/phase28/governance-actions.spec.ts', disposition: 'repoint', plan: '59-07' }, // confirmSopCurrent owner path
  // ---- 59-12 mount ----
  { file: 'tests/phase57/machine-body.spec.ts', disposition: 'repoint', plan: '59-12' }, // Office links
  { file: 'tests/evals/one-screen.eval.ts', disposition: 'repoint', plan: '59-12' }, // Office bridge, supervisor Office, Office count vs page, retired-URL list
  // ---- 59-13 addresses ----
  { file: 'tests/phase57/place.spec.ts', disposition: 'repoint', plan: '59-13' }, // placeForPath Office group
  { file: 'tests/phase54/deletion-sweep.spec.ts', disposition: 'repoint', plan: '59-13' }, // attention view destination
  // ---- 59-14 retirement A ----
  { file: 'tests/phase57/retirement-sweep.spec.ts', disposition: 'repoint', plan: '59-14' }, // 59-12 repoints the access-bridge link case, 59-13 its proxy and place cases
  { file: 'tests/lint/no-static-admin-lens-import.spec.ts', disposition: 'repoint', plan: '59-14' }, // 59-12 adds the OfficePane entry first
  { file: 'tests/evals/governance.eval.ts', disposition: 'delete', plan: '59-14' }, // subject gone; replaced by tests/evals/office.eval.ts
  // whole-subject governance / team / access / org-model specs (the grep is the source of truth; first-guess dispositions)
  { file: 'tests/phase28/governance-queue.spec.ts', disposition: 'repoint', plan: '59-14' }, // page + queue wiring dropped; the data gate, picker and redirect guards stay
  { file: 'tests/phase28/library-and-worker.spec.ts', disposition: 'repoint', plan: '59-14' }, // queue row wiring + proxy destination; 59-13 changes the destination first
  { file: 'tests/phase29/phase-gate.spec.ts', disposition: 'repoint', plan: '59-14' },
  { file: 'tests/phase29/queue-approve-action.spec.ts', disposition: 'repoint', plan: '59-14' },
  { file: 'tests/phase29/approval-chain-editor.spec.ts', disposition: 'repoint', plan: '59-14' }, // page path literal
  { file: 'tests/phase30/admin-nav.spec.ts', disposition: 'repoint', plan: '59-14' }, // proxy destination; 59-13 changes it first
  { file: 'tests/phase32/org-chart-build.spec.ts', disposition: 'delete', plan: '59-14' }, // canvases + team page gone
  { file: 'tests/phase32/banner-slot-stability.spec.ts', disposition: 'repoint', plan: '59-14' }, // navigates the access address (redirects once 59-13 lands)
  { file: 'tests/phase32/library-filter-deeplink.spec.ts', disposition: 'repoint', plan: '59-14' },
  { file: 'tests/phase32/wire-up-mode.spec.ts', disposition: 'repoint', plan: '59-14' },
  { file: 'tests/phase32/wiring-at-scale.spec.ts', disposition: 'repoint', plan: '59-14' },
  { file: 'tests/phase33/sop-drilldown.spec.ts', disposition: 'repoint', plan: '59-14' }, // access page path literal
  { file: 'tests/phase33/teams-ladder.spec.ts', disposition: 'repoint', plan: '59-14' },
  { file: 'tests/phase43/dead-controls.spec.ts', disposition: 'repoint', plan: '59-14' }, // the org-model view toggle
  { file: 'tests/phase43/route-truth.spec.ts', disposition: 'repoint', plan: '59-14' }, // proxy destination; 59-13 changes it first
  { file: 'tests/phase54/inbox-reuses-governance-gating.spec.ts', disposition: 'delete', plan: '59-14' }, // wrapper + page gone; gating literals re-homed in 59-04
  { file: 'tests/phase57/one-query.spec.ts', disposition: 'repoint', plan: '59-14' }, // 59-12 removes the pending-count hook token first
  { file: 'tests/phase57/departments.spec.ts', disposition: 'repoint', plan: '59-14' },
  { file: 'tests/e2e/sub-trade-assignment.spec.ts', disposition: 'repoint', plan: '59-14' },
  { file: 'tests/lint/design-tokens.spec.ts', disposition: 'repoint', plan: '59-14' }, // names the org-model component folder
  { file: 'tests/evals/dead-surface.eval.ts', disposition: 'repoint', plan: '59-14' }, // legacy governance links
  { file: 'tests/evals/sop-focus.eval.ts', disposition: 'repoint', plan: '59-14' }, // one governance-inbox test id
  // ---- 59-15 retirement B ----
  { file: 'tests/phase37/assessor-ui-signoff.spec.ts', disposition: 'repoint', plan: '59-15' }, // 59-06 edits the client counter-sign line first
  { file: 'tests/phase37/assessor-ui-observation.spec.ts', disposition: 'repoint', plan: '59-15' },
  { file: 'tests/phase37/gap-migration-and-state.spec.ts', disposition: 'repoint', plan: '59-15' }, // reads the completion page client
  { file: 'tests/phase37/gap-org-guards.spec.ts', disposition: 'repoint', plan: '59-15' }, // reads the completion page
  { file: 'tests/phase34/record-observation.spec.ts', disposition: 'repoint', plan: '59-15' }, // navigates the team address
  { file: 'tests/phase34/sop-version-stamp.spec.ts', disposition: 'repoint', plan: '59-15' },
  { file: 'tests/phase34/worker-observation-visibility.spec.ts', disposition: 'repoint', plan: '59-15' },
  { file: 'tests/phase35/training-record.spec.ts', disposition: 'repoint', plan: '59-15' }, // the person panel itself survives
  { file: 'tests/phase55/worker-path-contract.spec.ts', disposition: 'repoint', plan: '59-15' }, // reads the completion page client
  { file: 'tests/evals/sop-ledger.eval.ts', disposition: 'repoint', plan: '59-15' }, // sign-off case; row test id token is 59-14
  { file: 'tests/evals/cut-features.eval.ts', disposition: 'repoint', plan: '59-15' }, // admin sign-off test visits the activity addresses
]

// Each owning plan appends its id (e.g. '59-05') when its last commit lands.
export const LIVE_PLANS: string[] = ['59-05', '59-12', '59-14', '59-15']

function stripComments(src: string): string {
  return src
    .split('\n')
    .map((line) => (/^\s*(\/\/|\/\*|\*\/|\*)/.test(line) ? '' : line))
    .join('\n')
}

function walk(dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue
      walk(full, out)
    } else if (entry.isFile() && /\.(spec|test|eval)\.tsx?$/.test(entry.name)) {
      out.push(full)
    }
  }
}

function walked(): Array<{ rel: string; code: string }> {
  const files: string[] = []
  walk(path.join(ROOT, 'tests'), files)
  walk(path.join(ROOT, 'src'), files) // *.test.ts(x) beside source
  const out: Array<{ rel: string; code: string }> = []
  for (const file of files) {
    const rel = path.relative(ROOT, file)
    if (rel === SELF || rel === OFFICE_EVAL || rel.startsWith(P59)) continue
    out.push({ rel: rel.replace(/\\/g, '/'), code: stripComments(fs.readFileSync(file, 'utf-8').replace(/\r\n/g, '\n')) })
  }
  return out
}

function hits(code: string, token: string | RegExp): boolean {
  return typeof token === 'string' ? code.includes(token) : token.test(code)
}

test.describe('phase 59 repoint inventory', () => {
  test('inventory is complete: every test file referencing a retired token is listed', () => {
    const listed = new Set(INVENTORY.map((r) => r.file))
    const offenders: string[] = []
    for (const { rel, code } of walked()) {
      if (listed.has(rel)) continue
      for (const r of RETIRED) if (hits(code, r.token)) offenders.push(`${rel}: ${String(r.token)}`)
    }
    expect(offenders, `Unlisted files:\n${offenders.join('\n')}`).toEqual([])
  })

  test('every inventory row names a plan and, unless already deleted, a real file', () => {
    for (const row of INVENTORY) {
      expect(row.plan).toMatch(/^59-\d\d$/)
      if (!LIVE_PLANS.includes(row.plan) || row.disposition !== 'delete') {
        expect(fs.existsSync(path.join(ROOT, row.file)), `${row.file} should exist until ${row.plan} is live`).toBe(true)
      }
    }
  })

  test('retired tokens are gone once their plan is live', () => {
    const offenders: string[] = []
    for (const { rel, code } of walked()) {
      for (const r of RETIRED) {
        if (LIVE_PLANS.includes(r.plan) && hits(code, r.token)) offenders.push(`${rel}: ${String(r.token)}`)
      }
    }
    expect(offenders, `Stale references:\n${offenders.join('\n')}`).toEqual([])
  })

  test('deleted specs are gone once their plan is live', () => {
    const still = INVENTORY.filter((r) => r.disposition === 'delete' && LIVE_PLANS.includes(r.plan) && fs.existsSync(path.join(ROOT, r.file)))
    expect(still.map((r) => r.file)).toEqual([])
  })

  test('the role-writer and proxy-destination regex tokens catch the call form and nothing else', () => {
    const writer = RETIRED.find((r) => r.plan === '59-05' && r.token instanceof RegExp)!.token as RegExp
    const dest = RETIRED.find((r) => r.plan === '59-14' && r.token instanceof RegExp)!.token as RegExp
    expect(writer.test('await updateMemberRole(id, role)')).toBe(true)
    expect(writer.test('await updateMemberRoleSafe(id, role)')).toBe(false)
    expect(dest.test("destination = '/governance'")).toBe(true)
    expect(dest.test("destination = '/'")).toBe(false)
  })
})
