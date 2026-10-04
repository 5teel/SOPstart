/**
 * Phase 57 / Plan 57-01 -- repoint inventory (CLAUDE.md 2026-07-13, RESEARCH Pitfall 5).
 *
 * The one screen retires a header, a dashboard route, a list page, a plant
 * home, two admin pages and a library table. About thirty specs and seven
 * evals read those files or routes; left alone they go stale-red (or worse,
 * keep passing against nothing). This guard names every one of them with a
 * disposition and an OWNING plan (the last plan to edit the file; a
 * parenthesised note names earlier plans that edit their part first so every
 * commit stays green).
 *
 *  - RETIRED   tokens that mean "this file / route / literal is going away",
 *              each tagged with the plan that retires it.
 *  - INVENTORY every test file that references a retired token today.
 *  - LIVE_PLANS each owning plan appends its id when its last commit lands;
 *              from then on its tokens must be gone from every test file.
 *
 * Comment lines are stripped before matching (same idiom as
 * tests/phase41/spec-repoint-inventory.spec.ts), so prose in a repointed spec
 * cannot trip the guard. This file necessarily holds the tokens as data, so
 * it is excluded from the walk, as is everything under tests/phase57/ (the
 * retirement sweep there keeps the NEGATIVE assertions that quote a retired
 * literal). Comments here describe the tokens in words only.
 *
 * Registration: playwright.config.ts `phase57` project.
 * Verify: `npx playwright test --list --project=phase57`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const TESTS_DIR = path.join(ROOT, 'tests')
const SELF = path.join('tests', 'phase57', 'repoint-inventory.spec.ts')
const P57 = path.join('tests', 'phase57') + path.sep

// Quote forms a redirect literal can be spelled with: a plain quote, or a
// regex character class holding one or more quote characters.
const Q = '(?:[\'"`]|\\[[^\\]]*[\'"`][^\\]]*\\])'
const redirectTo = (target: string) =>
  new RegExp(`redirect\\\\?\\(\\s*${Q}\\\\?/${target}${Q}\\s*\\\\?\\)`)

interface Retired { token: string | RegExp; plan: string }
export const RETIRED: Retired[] = [
  // 57-05 -- the floor-health component folds into the shell
  { token: 'AdminFloorHealth', plan: '57-05' },
  // 57-06 -- header, dashboard route, dashboard redirect literal
  { token: 'TopHeader', plan: '57-06' },
  { token: 'NotificationBadge', plan: '57-06' },
  { token: 'NavPendingSpinner', plan: '57-06' },
  { token: "'dashboard', 'page", plan: '57-06' },
  { token: redirectTo('dashboard'), plan: '57-06' },
  // 57-07 -- departments page and site page become edit mode
  { token: "'admin', 'departments', 'page", plan: '57-07' },
  { token: 'DepartmentGrid', plan: '57-07' },
  { token: 'DepartmentCard', plan: '57-07' },
  { token: 'DepartmentFormModal', plan: '57-07' },
  { token: 'admin/site/page', plan: '57-07' },
  { token: "'admin', 'site', 'page", plan: '57-07' },
  // 57-08 -- list page, plant home, worker list surfaces
  { token: '(protected)/sops/page', plan: '57-08' },
  { token: "'(protected)', 'sops', 'page", plan: '57-08' },
  { token: 'PlantHome', plan: '57-08' },
  { token: 'PlantAskBar', plan: '57-08' },
  { token: 'WorkerSimpleList', plan: '57-08' },
  { token: 'CategoryBottomSheet', plan: '57-08' },
  { token: 'SopLibraryCard', plan: '57-08' },
  { token: redirectTo('sops'), plan: '57-08' },
  // 57-09 -- admin library table and its helpers
  { token: 'AdminLibraryTable', plan: '57-09' },
  { token: 'libraryNavToUrl', plan: '57-09' },
  { token: 'resolveLibraryNav', plan: '57-09' },
  { token: 'deriveChecks', plan: '57-09' },
  { token: 'sops?view=access', plan: '57-09' },
]

interface Row { file: string; disposition: 'delete' | 'repoint'; plan: string }
export const INVENTORY: Row[] = [
  // 57-05
  { file: 'tests/phase54/admin-machine-panel.spec.ts', disposition: 'repoint', plan: '57-05' },
  // 57-06 (owner 06)
  { file: 'tests/phase30/admin-nav.spec.ts', disposition: 'repoint', plan: '57-06' }, // kept: settings guard + journeys mapping survive
  { file: 'tests/phase30/role-homes.spec.ts', disposition: 'repoint', plan: '57-06' },
  { file: 'tests/sb-auth-builder.test.ts', disposition: 'repoint', plan: '57-06' },
  { file: 'tests/phase53/login-next-redirect.spec.ts', disposition: 'repoint', plan: '57-06' },
  { file: 'tests/phase26.5/agent-dashboard.spec.ts', disposition: 'repoint', plan: '57-06' },
  { file: 'tests/phase32/org-chart-build.spec.ts', disposition: 'repoint', plan: '57-06' },
  // 57-07 (owner 07)
  { file: 'tests/phase51/site-workspace-wiring.spec.ts', disposition: 'repoint', plan: '57-07' }, // 06 edits the header part first
  { file: 'tests/e2e/admin-departments.spec.ts', disposition: 'delete', plan: '57-07' }, // 06 repoints its dashboard assertion first
  { file: 'tests/phase32/wire-up-mode.spec.ts', disposition: 'repoint', plan: '57-07' },
  { file: 'tests/phase51/builder-machines-row.spec.ts', disposition: 'repoint', plan: '57-07' },
  { file: 'tests/lint/no-global-blocks-in-journeys.spec.ts', disposition: 'repoint', plan: '57-07' },
  // 57-08 (owner 08)
  { file: 'tests/phase30/dead-weight.spec.ts', disposition: 'repoint', plan: '57-08' }, // 06 edits the header parts first
  { file: 'tests/phase30/create-entry.spec.ts', disposition: 'repoint', plan: '57-08' }, // 06 edits the header parts first
  { file: 'tests/sb-builder-infrastructure.test.ts', disposition: 'repoint', plan: '57-08' }, // 06 edits the dashboard line first
  { file: 'tests/phase43/route-truth.spec.ts', disposition: 'repoint', plan: '57-08' }, // 06 edits the roleHome part; 08 the proxy attention-rule literal
  { file: 'tests/phase41/merged-surface.spec.ts', disposition: 'delete', plan: '57-08' },
  { file: 'tests/phase52/plant-render-seam.spec.ts', disposition: 'repoint', plan: '57-09' }, // kept (survivors): 08 edits the list-page/plant parts first
  { file: 'tests/phase52/plant-ask-bar.spec.ts', disposition: 'delete', plan: '57-08' },
  { file: 'tests/phase54/library-table.spec.ts', disposition: 'repoint', plan: '57-09' }, // kept (survivors): 08 edits the list-page/plant parts first
  { file: 'tests/phase32/library-filter-deeplink.spec.ts', disposition: 'repoint', plan: '57-09' }, // kept (survivors): 08 edits the list-page/plant parts first
  { file: 'tests/phase36/worker-library-chip.spec.ts', disposition: 'delete', plan: '57-08' },
  { file: 'tests/phase30/list-rows.spec.ts', disposition: 'repoint', plan: '57-09' }, // kept (survivors): 08 edits the list-page/plant parts first
  { file: 'tests/phase23/version-indicator.spec.ts', disposition: 'repoint', plan: '57-08' },
  { file: 'tests/phase36/no-refresher-gate.spec.ts', disposition: 'repoint', plan: '57-08' },
  { file: 'tests/phase37/no-competency-gate-worker.spec.ts', disposition: 'repoint', plan: '57-08' },
  { file: 'tests/phase41/admin-sop-list-action.spec.ts', disposition: 'repoint', plan: '57-08' },
  { file: 'tests/phase41/bundle-gate.spec.ts', disposition: 'repoint', plan: '57-08' },
  { file: 'tests/phase52/plant-panel.spec.ts', disposition: 'repoint', plan: '57-08' },
  { file: 'tests/phase55/worker-path-contract.spec.ts', disposition: 'repoint', plan: '57-08' },
  // 57-09 (owner 09)
  { file: 'tests/lint/no-static-admin-lens-import.spec.ts', disposition: 'repoint', plan: '57-09' }, // 05 drops the floor component, 08 repoints the worker-surface contract first
  { file: 'tests/phase41/nav-and-shim.spec.ts', disposition: 'repoint', plan: '57-09' }, // 06 header part, 08 worker-list part first
  { file: 'tests/phase41/reference-sweep.spec.ts', disposition: 'repoint', plan: '57-09' }, // 06 edits the header part first
  { file: 'tests/phase28/governance-queue.spec.ts', disposition: 'repoint', plan: '57-09' }, // 06 edits the dashboard line first
  { file: 'tests/phase30/governance-fold.spec.ts', disposition: 'repoint', plan: '57-09' }, // 06 edits the dashboard line first
  { file: 'tests/phase28/library-and-worker.spec.ts', disposition: 'repoint', plan: '57-09' }, // 08 edits the list-page part and proxy literal first
  { file: 'tests/phase33/sop-drilldown.spec.ts', disposition: 'repoint', plan: '57-09' }, // 08 edits the list-page part first
  { file: 'tests/phase54/library-table-checks.spec.ts', disposition: 'delete', plan: '57-09' },
  { file: 'tests/phase32/banner-slot-stability.spec.ts', disposition: 'repoint', plan: '57-09' },
  { file: 'tests/phase32/wiring-at-scale.spec.ts', disposition: 'repoint', plan: '57-09' },
  { file: 'tests/phase33/teams-ladder.spec.ts', disposition: 'repoint', plan: '57-09' },
  { file: 'tests/phase54/deletion-sweep.spec.ts', disposition: 'repoint', plan: '57-09' },
  // 57-10 (evals)
  { file: 'tests/evals/plant-home.eval.ts', disposition: 'delete', plan: '57-10' },
  { file: 'tests/evals/sop-surface.eval.ts', disposition: 'delete', plan: '57-10' },
  { file: 'tests/evals/dead-surface.eval.ts', disposition: 'repoint', plan: '57-10' },
  { file: 'tests/evals/governance.eval.ts', disposition: 'repoint', plan: '57-10' },
  { file: 'tests/evals/site-editor.eval.ts', disposition: 'repoint', plan: '57-10' },
  { file: 'tests/evals/cut-features.eval.ts', disposition: 'repoint', plan: '57-10' },
  // Informational (no retired token today; the owning plan still edits them)
  { file: 'tests/phase54/governance-inbox.spec.ts', disposition: 'repoint', plan: '57-03' },
  { file: 'tests/phase52/plant-stage.spec.ts', disposition: 'repoint', plan: '57-02' },
  { file: 'tests/phase52/plant-now-card.spec.ts', disposition: 'repoint', plan: '57-04' },
]

// Each owning plan appends its id (e.g. '57-05') when its last commit lands.
export const LIVE_PLANS: string[] = ['57-05']

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
    } else if (entry.isFile() && /\.(spec|test|eval)\.ts$/.test(entry.name)) {
      out.push(full)
    }
  }
}

function walked(): Array<{ rel: string; code: string }> {
  const files: string[] = []
  walk(TESTS_DIR, files)
  const out: Array<{ rel: string; code: string }> = []
  for (const file of files) {
    const rel = path.relative(ROOT, file)
    if (rel === SELF || rel.startsWith(P57)) continue
    out.push({ rel: rel.replace(/\\/g, '/'), code: stripComments(fs.readFileSync(file, 'utf-8').replace(/\r\n/g, '\n')) })
  }
  return out
}

function hits(code: string, token: string | RegExp): boolean {
  return typeof token === 'string' ? code.includes(token) : token.test(code)
}

test.describe('retire repoint inventory', () => {
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
      expect(row.plan).toMatch(/^57-\d\d$/)
      if (!LIVE_PLANS.includes(row.plan) || row.disposition !== 'delete') {
        expect(fs.existsSync(path.join(ROOT, row.file)), `${row.file} should exist until ${row.plan} is live`).toBe(true)
      }
    }
  })

  test('retired tokens are gone once their plan is live', () => {
    const offenders: string[] = []
    for (const { rel, code } of walked()) {
      if (rel.startsWith('tests/evals/') && !LIVE_PLANS.includes('57-10')) continue
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

  test('the redirect tokens catch every spelling', () => {
    const call = ['redi', 'rect('].join('')
    const forms = (target: string) => {
      const t = `/${target}`
      return [
        `${call}'${t}')`,
        `${call}"${t}")`,
        `${call}\`${t}\`)`,
        `${call} '${t}' )`,
        `${call.replace('(', '\\(')}[\\'"]\\${t}[\\'"]\\)`,
      ]
    }
    const dash = RETIRED.find((r) => r.plan === '57-06' && r.token instanceof RegExp)!.token as RegExp
    const list = RETIRED.find((r) => r.plan === '57-08' && r.token instanceof RegExp)!.token as RegExp
    for (const s of forms('dashboard')) expect(dash.test(s), s).toBe(true)
    for (const s of forms('sops')) expect(list.test(s), s).toBe(true)
    // the list token must not catch a deeper path or a query
    for (const s of [`${call}'/sops/abc')`, `${call}'/sops?view=x')`, `${call}\`/sops/\${id}\`)`]) {
      expect(list.test(s), s).toBe(false)
    }
    expect(dash.test(`${call}'/dashboard/x')`)).toBe(false)
  })
})
