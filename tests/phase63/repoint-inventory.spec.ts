/**
 * Phase 63 / Plan 63-01 -- repoint inventory (CLAUDE.md 2026-07-13, 2026-08-04).
 *
 * The SOP-first home replaces the one-screen shell and its rooms. Specs and evals
 * that read the retired components, address strings or walk words would go
 * stale-red (or keep passing against nothing). This guard names every one with a
 * disposition and an OWNING plan (the plan whose commit leaves the file correct).
 *
 *  - RETIRED   tokens that mean "this file / address / word is going away",
 *              each tagged with the plan that retires it.
 *  - INVENTORY every test file that references a retired token today.
 *              retire  = the spec exists only to pin retired code; deleted by its owner.
 *              repoint = the code it tests survives under a new address; edited by its owner.
 *  - LIVE_PLANS each owning plan appends its id when its last commit lands;
 *              from then on its tokens must be gone from every test file.
 *              63-18 appended 63-13, 63-16 and itself once every test file was clean of their
 *              tokens; 63-19 appended itself with 63-11 and 63-15 once the room specs were retired or
 *              repointed. 63-14 still has one holder (the legacy-address reader test, whose inputs are
 *              the old addresses by nature); 63-20 appends 63-14 and itself with the room deletion.
 *
 * A retire row is exempt from the stale-token check until its owner is live (a file
 * slated for deletion is not "stale"); once live it must be gone from disk.
 *
 * This file necessarily holds the tokens as data, so it is excluded from the walk,
 * as are everything under tests/phase63/, the three new Phase 63 evals, and the two
 * guards that hold retired literals as data (the walk-words guard, 63-16, and the
 * rooms guard, 63-20). Comments here describe the tokens in words only.
 *
 * Registration: playwright.config.ts phase63 project.
 * Verify: npx playwright test --list --project=phase63
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SELF = path.join('tests', 'phase63', 'repoint-inventory.spec.ts')
const P63 = path.join('tests', 'phase63') + path.sep
const EXCLUDED = new Set(
  [
    'tests/evals/home.eval.ts',
    'tests/evals/home-addresses.eval.ts',
    'tests/evals/start.eval.ts',
    'tests/lint/no-walk-words.spec.ts',
    'tests/lint/no-rooms.spec.ts',
  ].map((p) => path.normalize(p)),
)

interface Retired { token: string | RegExp; plan: string }
export const RETIRED: Retired[] = [
  // 63-11 -- the one-screen shell and its bell count
  { token: 'OneScreen', plan: '63-11' },
  { token: 'shell-bell-count', plan: '63-11' },
  // 63-13 -- the Back bar copy and the place translators
  { token: 'Back to the site', plan: '63-13' },
  { token: 'placeForPath', plan: '63-13' },
  { token: 'officeRedirectFor', plan: '63-13' },
  // 63-14 -- the room addresses
  { token: '/?place=office', plan: '63-14' },
  { token: '/?place=workshop', plan: '63-14' },
  { token: '/?place=smoko', plan: '63-14' },
  { token: '/?place=edit', plan: '63-14' },
  { token: '/?place=dept:', plan: '63-14' },
  // 63-15 -- the walk start words
  { token: 'Resume where you left off', plan: '63-15' },
  { token: 'Keep walking', plan: '63-15' },
  { token: 'Start walking', plan: '63-15' },
  { token: 'Updated since you last walked it', plan: '63-15' },
  // 63-16 -- the walk words in supervisor and history copy
  { token: 'Reject walk', plan: '63-16' },
  { token: 'Start the walk again.', plan: '63-16' },
  { token: 'walkthrough to see your history', plan: '63-16' },
  // 63-19 -- the machine-coverage producer
  { token: 'reconcileMachineRequests', plan: '63-19' },
  { token: 'machinesWithoutSops', plan: '63-19' },
  // 63-20 -- the room code
  { token: '@/lib/site/rooms', plan: '63-20' },
  { token: 'ROOM_IDS', plan: '63-20' },
  { token: 'PRESET_ROOMS', plan: '63-20' },
  { token: 'roomsFor', plan: '63-20' },
  { token: 'ShellFrame', plan: '63-20' },
  { token: 'WorkerShell', plan: '63-20' },
  { token: 'AdminShell', plan: '63-20' },
  { token: 'RoomBodies', plan: '63-20' },
  { token: 'AdminRoomBodies', plan: '63-20' },
  { token: 'SiteSummary', plan: '63-20' },
  { token: 'OfficeCard', plan: '63-20' },
  { token: 'SiteOverview', plan: '63-20' },
  { token: 'PlantStage', plan: '63-20' },
  { token: 'NowCard', plan: '63-20' },
  { token: 'MachinePanel', plan: '63-20' },
  { token: 'RelBadge', plan: '63-20' },
  { token: 'AdminMachinePanel', plan: '63-20' },
  { token: 'getAdminShell', plan: '63-20' },
  { token: '@/lib/shell/place', plan: '63-20' },
  { token: 'derivePlantPins', plan: '63-20' },
  { token: 'pickNowQueue', plan: '63-20' },
  { token: 'shell-room-row', plan: '63-20' },
  { token: 'room-body', plan: '63-20' },
]

interface Row { file: string; disposition: 'retire' | 'repoint'; plan: string }
export const INVENTORY: Row[] = [
  // ---- evals: 63-18 rewrites the siblings; the one-screen eval is folded into the home evals ----
  { file: 'tests/evals/one-screen.eval.ts', disposition: 'retire', plan: '63-18' },
  { file: 'tests/evals/cut-features.eval.ts', disposition: 'repoint', plan: '63-18' },
  { file: 'tests/evals/office.eval.ts', disposition: 'repoint', plan: '63-18' },
  { file: 'tests/evals/requests.eval.ts', disposition: 'repoint', plan: '63-18' },
  { file: 'tests/evals/site-editor.eval.ts', disposition: 'repoint', plan: '63-18' },
  { file: 'tests/evals/site-templates.eval.ts', disposition: 'repoint', plan: '63-18' },
  { file: 'tests/evals/sop-focus.eval.ts', disposition: 'repoint', plan: '63-18' },
  { file: 'tests/evals/sop-ledger.eval.ts', disposition: 'repoint', plan: '63-18' },
  // ---- earlier inventories that hold a retired token as data (63-13 owns the translator token) ----
  { file: 'tests/phase58/repoint-inventory.spec.ts', disposition: 'repoint', plan: '63-13' },
  { file: 'tests/phase59/repoint-inventory.spec.ts', disposition: 'repoint', plan: '63-13' },
  { file: 'tests/phase60/repoint-inventory.spec.ts', disposition: 'repoint', plan: '63-13' },
  // ---- 63-14: room address literals in surviving specs ----
  { file: 'tests/phase28/library-and-worker.spec.ts', disposition: 'repoint', plan: '63-14' },
  { file: 'tests/phase30/admin-nav.spec.ts', disposition: 'repoint', plan: '63-14' },
  { file: 'tests/phase32/banner-slot-stability.spec.ts', disposition: 'repoint', plan: '63-14' },
  { file: 'tests/phase32/library-filter-deeplink.spec.ts', disposition: 'repoint', plan: '63-14' },
  { file: 'tests/phase32/wire-up-mode.spec.ts', disposition: 'repoint', plan: '63-14' },
  { file: 'tests/phase32/wiring-at-scale.spec.ts', disposition: 'repoint', plan: '63-14' },
  { file: 'tests/phase33/teams-ladder.spec.ts', disposition: 'repoint', plan: '63-14' },
  { file: 'tests/phase43/route-truth.spec.ts', disposition: 'repoint', plan: '63-14' },
  { file: 'tests/phase51/builder-machines-row.spec.ts', disposition: 'repoint', plan: '63-14' },
  { file: 'tests/phase59/capability-matrix.spec.ts', disposition: 'repoint', plan: '63-14' },
  { file: 'tests/phase60/notification-places.spec.ts', disposition: 'repoint', plan: '63-14' },
  // ---- 63-16: walk words ----
  { file: 'tests/phase58/walk-no-leak.spec.ts', disposition: 'repoint', plan: '63-16' },
  // ---- 63-19: room specs retired / repointed ahead of the deletion (R1 producer specs too) ----
  { file: 'tests/phase57/rooms.spec.ts', disposition: 'retire', plan: '63-20' }, // ADR-0003's guard; 63-20 supersedes it with ADR-0005
  { file: 'tests/lint/no-static-admin-lens-import.spec.ts', disposition: 'repoint', plan: '63-19' },
  { file: 'tests/phase23/version-indicator.spec.ts', disposition: 'repoint', plan: '63-19' },
  { file: 'tests/phase30/create-entry.spec.ts', disposition: 'repoint', plan: '63-19' },
  { file: 'tests/phase30/dead-weight.spec.ts', disposition: 'repoint', plan: '63-19' },
  { file: 'tests/phase36/no-refresher-gate.spec.ts', disposition: 'repoint', plan: '63-19' },
  { file: 'tests/phase37/no-competency-gate-worker.spec.ts', disposition: 'repoint', plan: '63-19' },
  { file: 'tests/phase41/nav-and-shim.spec.ts', disposition: 'repoint', plan: '63-19' },
  { file: 'tests/phase41/reference-sweep.spec.ts', disposition: 'repoint', plan: '63-19' },
  { file: 'tests/phase51/site-workspace-wiring.spec.ts', disposition: 'repoint', plan: '63-19' },
  { file: 'tests/phase54/admin-health.spec.ts', disposition: 'repoint', plan: '63-19' }, // machine-coverage producer
  { file: 'tests/phase55/worker-path-contract.spec.ts', disposition: 'repoint', plan: '63-19' },
  { file: 'tests/phase57/retirement-sweep.spec.ts', disposition: 'repoint', plan: '63-19' },
  { file: 'tests/phase58/frame-structure.spec.ts', disposition: 'repoint', plan: '63-19' },
  { file: 'tests/phase59/office-pane-structure.spec.ts', disposition: 'repoint', plan: '63-19' },
  { file: 'tests/phase59/owner-review-meta.spec.ts', disposition: 'repoint', plan: '63-19' },
  { file: 'tests/phase59/retirement-sweep.spec.ts', disposition: 'repoint', plan: '63-19' },
  { file: 'tests/phase59/signoff-panel.spec.ts', disposition: 'repoint', plan: '63-19' },
  { file: 'tests/phase60/agent-requests.spec.ts', disposition: 'repoint', plan: '63-19' },
  { file: 'tests/phase60/bell-structure.spec.ts', disposition: 'repoint', plan: '63-19' },
  { file: 'tests/phase60/capability-matrix.spec.ts', disposition: 'repoint', plan: '63-19' },
  { file: 'tests/phase60/objective-meta.spec.ts', disposition: 'repoint', plan: '63-19' },
  { file: 'tests/phase60/office-requests.spec.ts', disposition: 'repoint', plan: '63-19' },
  { file: 'tests/phase60/request-surfaces.spec.ts', disposition: 'repoint', plan: '63-19' },
  { file: 'tests/phase60/retirement-sweep.spec.ts', disposition: 'repoint', plan: '63-19' },
  { file: 'tests/sb-auth-builder.test.ts', disposition: 'repoint', plan: '63-19' },
]

// Each owning plan appends its id when its last commit lands (see header).
export const LIVE_PLANS: string[] = ['63-11', '63-13', '63-15', '63-16', '63-18', '63-19']

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
    if (rel === SELF || rel.startsWith(P63) || EXCLUDED.has(rel)) continue
    out.push({ rel: rel.replace(/\\/g, '/'), code: stripComments(fs.readFileSync(file, 'utf-8').replace(/\r\n/g, '\n')) })
  }
  return out
}

function hits(code: string, token: string | RegExp): boolean {
  return typeof token === 'string' ? code.includes(token) : token.test(code)
}

test.describe('phase 63 repoint inventory', () => {
  test('inventory is complete: every test file referencing a retired token is listed', () => {
    const listed = new Set(INVENTORY.map((r) => r.file))
    const offenders: string[] = []
    for (const { rel, code } of walked()) {
      if (listed.has(rel)) continue
      for (const r of RETIRED) if (hits(code, r.token)) offenders.push(`${rel}: ${String(r.token)}`)
    }
    expect(offenders, `Unlisted files:\n${offenders.join('\n')}`).toEqual([])
  })

  test('every inventory row names a plan and, unless already retired, a real file', () => {
    for (const row of INVENTORY) {
      expect(row.plan).toMatch(/^63-\d\d$/)
      if (!LIVE_PLANS.includes(row.plan) || row.disposition !== 'retire') {
        expect(fs.existsSync(path.join(ROOT, row.file)), `${row.file} should exist until ${row.plan} is live`).toBe(true)
      }
    }
  })

  test('retired tokens are gone once their plan is live', () => {
    const rows = new Map(INVENTORY.map((r) => [r.file, r]))
    const offenders: string[] = []
    for (const { rel, code } of walked()) {
      const row = rows.get(rel)
      if (row && row.disposition === 'retire' && !LIVE_PLANS.includes(row.plan)) continue // slated for deletion
      for (const r of RETIRED) {
        if (LIVE_PLANS.includes(r.plan) && hits(code, r.token)) offenders.push(`${rel}: ${String(r.token)}`)
      }
    }
    expect(offenders, `Stale references:\n${offenders.join('\n')}`).toEqual([])
  })

  test('retired specs are gone once their plan is live', () => {
    const still = INVENTORY.filter((r) => r.disposition === 'retire' && LIVE_PLANS.includes(r.plan) && fs.existsSync(path.join(ROOT, r.file)))
    expect(still.map((r) => r.file)).toEqual([])
  })
})
