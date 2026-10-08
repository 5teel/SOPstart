/**
 * Phase 60 / Plan 60-01 -- repoint inventory (CLAUDE.md 2026-07-13, 2026-08-04).
 *
 * Requests retire the assign screen, the four assign actions, the old
 * notifications hook, the SOP objective writer, the Machines inbox kind and a
 * handful of copy literals. Specs and evals that read those files, routes or
 * literals would go stale-red (or keep passing against nothing). This guard names
 * every one with a disposition and an OWNING plan (the plan whose commit leaves the
 * file correct; a parenthesised note names earlier plans that edit their part first
 * so every commit stays green).
 *
 *  - RETIRED   tokens that mean "this file / route / literal is going away",
 *              each tagged with the plan that retires it.
 *  - INVENTORY every test file that references a retired token today, plus the
 *              pin files the research names that hold behaviour rather than tokens.
 *  - LIVE_PLANS each owning plan appends its id when its last commit lands;
 *              from then on its tokens must be gone from every test file.
 *
 * Row owner is NOT the same as token owner: a retired token is checked against
 * LIVE_PLANS by the plan that retires it, whoever owns the row.
 *
 * Comment lines are stripped before matching so prose in a repointed spec cannot
 * trip the guard. This file necessarily holds the tokens as data, so it is
 * excluded from the walk, as is everything under tests/phase60/ (the retirement
 * sweep there keeps the NEGATIVE assertions that quote a retired literal) and the
 * requests eval (which necessarily names the legacy assign address to prove it
 * redirects). Comments here describe the tokens in words only.
 *
 * Registration: playwright.config.ts `phase60` project.
 * Verify: `npx playwright test --list --project=phase60`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SELF = path.join('tests', 'phase60', 'repoint-inventory.spec.ts')
const P60 = path.join('tests', 'phase60') + path.sep
const REQUESTS_EVAL = path.join('tests', 'evals', 'requests.eval.ts')

interface Retired { token: string | RegExp; plan: string }
export const RETIRED: Retired[] = [
  // 60-05 -- the Machines inbox kind (retired into agent requests, D-05) and the stale-department button rename (A-12)
  { token: 'Fix assignment', plan: '60-05' },
  { token: 'Write a SOP', plan: '60-05' },
  { token: /label: 'Machines'/, plan: '60-05' },
  // 60-12 -- the This SOP assign link text (D-06)
  { token: 'Assign this SOP', plan: '60-12' },
  // 60-14 -- the SOP objective writer (A-01)
  { token: 'setSopObjective', plan: '60-14' },
  // 60-16 -- the old search placeholder and the worker Office placeholder sentence
  { token: 'Search machines and SOPs', plan: '60-16' },
  { token: 'Your requests will show here in a later update.', plan: '60-16' },
  // 60-17 -- the assign screen, its actions, its API route and the old notifications hook (A-12)
  ...['AssignmentRow', 'SubTradePicker', 'assignSopToRole', 'assignSopToUser', 'requestRemoveAssignment', 'useNotifications',
    // assign page file, slash and path.join spellings
    '[sopId]/assign/page.tsx', "'assign', 'page.tsx'",
    // assignments API route file
    '[sopId]/assignments/route.ts',
  ].map((token) => ({ token, plan: '60-17' })),
  // word-boundary forms: neither matches the sibling whose name starts with "request", nor the per-user reader
  { token: /\bremoveAssignment\b/, plan: '60-17' },
  { token: /\bgetAssignments\b/, plan: '60-17' },
]

interface Row { file: string; disposition: 'delete' | 'repoint' | 'keep'; plan: string }
export const INVENTORY: Row[] = [
  // ---- 60-05 Office data (Machines kind retired, pin = inbox + requests) ----
  { file: 'tests/phase59/inbox-model.spec.ts', disposition: 'repoint', plan: '60-05' }, // chip order
  { file: 'tests/phase54/governance-inbox.spec.ts', disposition: 'repoint', plan: '60-05' }, // machines rows
  { file: 'tests/phase59/office-pane-structure.spec.ts', disposition: 'repoint', plan: '60-05' }, // stale-department fix link
  { file: 'tests/evals/office.eval.ts', disposition: 'repoint', plan: '60-05' }, // Machines row case; the idle-supervisor "no tab control" case is 60-11's
  { file: 'tests/evals/one-screen.eval.ts', disposition: 'repoint', plan: '60-05' }, // pin equals Inbox
  // ---- 60-11 Requests tab ----
  { file: 'tests/phase59/place-tab.spec.ts', disposition: 'repoint', plan: '60-11' }, // supervisor tabs
  { file: 'tests/phase59/capability-matrix.spec.ts', disposition: 'repoint', plan: '60-11' }, // Office rows
  // ---- 60-12 raise + ask UI ----
  { file: 'tests/phase58/edit-rail.spec.ts', disposition: 'repoint', plan: '60-12' }, // assign link; also holds a 60-14 token (the objective writer), so 60-14 repoints that part after
  // ---- 60-14 SOP objective ----
  { file: 'tests/phase58/edit-actions.spec.ts', disposition: 'repoint', plan: '60-14' }, // objective writer
  { file: 'tests/phase46/sop-edit-guard-wiring.spec.ts', disposition: 'repoint', plan: '60-14' }, // objective writer
  { file: 'tests/phase58/fork-draft.spec.ts', disposition: 'repoint', plan: '60-14' }, // forkDraft stops copying the column
  // ---- 60-16 bell + mount ----
  { file: 'tests/phase57/shell-structure.spec.ts', disposition: 'repoint', plan: '60-16' }, // placeholder copy; 60-13 edits the dept slot first
  // ---- 60-17 retirement ----
  { file: 'tests/phase56/decision-writers-sweep.spec.ts', disposition: 'repoint', plan: '60-17' }, // 60-04/06/09 append writers first
  { file: 'tests/phase58/legacy-redirects.spec.ts', disposition: 'repoint', plan: '60-17' }, // the assign address returns null today
  { file: 'tests/e2e/sub-trade-assignment.spec.ts', disposition: 'repoint', plan: '60-17' }, // assign page integration block
  // ---- kept on purpose ----
  { file: 'tests/phase57/place.spec.ts', disposition: 'keep', plan: '60-17' }, // back-bar path of the assign address still resolves to the site
]

// Each owning plan appends its id (e.g. '60-05') when its last commit lands.
export const LIVE_PLANS: string[] = ['60-05', '60-12', '60-14', '60-16', '60-17']

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
    if (rel === SELF || rel === REQUESTS_EVAL || rel.startsWith(P60)) continue
    out.push({ rel: rel.replace(/\\/g, '/'), code: stripComments(fs.readFileSync(file, 'utf-8').replace(/\r\n/g, '\n')) })
  }
  return out
}

function hits(code: string, token: string | RegExp): boolean {
  return typeof token === 'string' ? code.includes(token) : token.test(code)
}

test.describe('phase 60 repoint inventory', () => {
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
      expect(row.plan).toMatch(/^60-\d\d$/)
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

  test('the word-boundary tokens catch the writer and nothing else', () => {
    const remove = RETIRED.find((r) => r.token instanceof RegExp && r.token.source === '\\bremoveAssignment\\b')!.token as RegExp
    const get = RETIRED.find((r) => r.token instanceof RegExp && r.token.source === '\\bgetAssignments\\b')!.token as RegExp
    expect(remove.test('await removeAssignment(id)')).toBe(true)
    expect(remove.test('await requestRemoveAssignment(id)')).toBe(false)
    expect(get.test('await getAssignments(sopId)')).toBe(true)
    expect(get.test('await getUserSopAssignments()')).toBe(false)
  })
})
