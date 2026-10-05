/**
 * Phase 58 / Plan 58-01 -- repoint inventory (CLAUDE.md 2026-07-13, 2026-08-04).
 *
 * The focus screen retires the tabbed SOP page, the old walkthroughs, the
 * builder, the versions page and the block machinery. Dozens of specs and
 * evals read those files, routes or literals; left alone they go stale-red (or
 * keep passing against nothing). This guard names every one with a disposition
 * and an OWNING plan (the plan whose commit leaves the file correct; a
 * parenthesised note names earlier plans that edit their part first so every
 * commit stays green).
 *
 *  - RETIRED   tokens that mean "this file / route / literal is going away",
 *              each tagged with the plan that retires it.
 *  - INVENTORY every test file that references a retired token today, plus the
 *              named-in-research files an owning plan still has to touch.
 *  - LIVE_PLANS each owning plan appends its id when its last commit lands;
 *              from then on its tokens must be gone from every test file.
 *
 * Row owner is NOT the same as token owner: a retired token is checked against
 * LIVE_PLANS by the plan that retires it, whoever owns the row. So a file that
 * holds a 58-11 token must be clean of it when 58-11 goes live even if the row
 * says 58-15 (the row's note names that earlier edit).
 *
 * Comment lines are stripped before matching (same idiom as the Phase 57
 * inventory) so prose in a repointed spec cannot trip the guard. This file
 * necessarily holds the tokens as data, so it is excluded from the walk, as is
 * everything under tests/phase58/ (the retirement sweep there keeps the
 * NEGATIVE assertions that quote a retired literal). Comments here describe the
 * tokens in words only. Test files living beside source under a tests folder
 * inside src/ are tests too and are walked.
 *
 * Registration: playwright.config.ts `phase58` project.
 * Verify: `npx playwright test --list --project=phase58`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SELF = path.join('tests', 'phase58', 'repoint-inventory.spec.ts')
const P58 = path.join('tests', 'phase58') + path.sep

interface Retired { token: string | RegExp; plan: string }
export const RETIRED: Retired[] = [
  // 58-11 -- the tabbed page becomes the focus page; tab addresses redirect in the proxy
  { token: 'tab=walk', plan: '58-11' },
  { token: 'tab=read', plan: '58-11' },
  { token: 'Edit in builder', plan: '58-11' }, // the read page's admin link (sop-detail eval)
  // 58-14 -- builder and versions addresses, the converter's old apply scope
  { token: /\/admin\/sops\/builder\/\$\{/, plan: '58-14' },
  { token: /\/admin\/sops\/\$\{[^}]*\}\/versions/, plan: '58-14' },
  { token: /convert-sops-to-steps\.ts['"`]\s*,\s*['"`]--apply/, plan: '58-14' },
  // 58-16 -- components, hooks, stores, modules and routes deleted outright
  ...[
    'ReadTab', 'SopTabNav', 'WorkerPreviewToggle', 'MobileWalkthrough', 'DesktopWalkthrough',
    'ImmersiveStepCard', 'WalkthroughSwitcher', 'ViewModeToggle', 'SafetyAcknowledgement', 'StepProgress',
    'scopeSopToJob', 'procedureSections', 'useSopDetail', 'completionStore',
    'BuilderClient', 'BuilderStageShell', 'BuilderStageStepper', 'ReviewStation', 'OrientationStrip', 'NavRow',
    'SectionListSidebar', 'BuilderTreeRail', 'PublishStage', 'BlockEditShell', 'EditableDocument',
    'selection-bridge', 'SectionEditor', 'verify-checklist', 'useBuilderAutosave',
    'parsedSopToPerSectionLayoutData', 'verifyBlock', 'stepAckTrace', 'builder-v2',
    // builder directory, slash and path.join spellings
    'admin/sops/builder', "'admin', 'sops', 'builder'",
    // versions page, slash and path.join spellings
    'admin/sops/[sopId]/versions', "'admin', 'sops', '[sopId]', 'versions'",
  ].map((token) => ({ token, plan: '58-16' })),
]

interface Row { file: string; disposition: 'delete' | 'repoint'; plan: string }
export const INVENTORY: Row[] = [
  // ---- 58-05 publish gate re-key (D-16) ----
  { file: 'tests/phase26/spine-regression.spec.ts', disposition: 'repoint', plan: '58-05' }, // gate literals move to the re-keyed gate
  { file: 'tests/phase29/phase-gate.spec.ts', disposition: 'repoint', plan: '58-05' }, // 58-16 edits the versions-page part
  { file: 'tests/phase29/publish-core-extraction.spec.ts', disposition: 'repoint', plan: '58-05' },
  { file: 'tests/phase29/publish-chain-gate.spec.ts', disposition: 'repoint', plan: '58-05' },
  { file: 'tests/phase56/publish-gate-pin.spec.ts', disposition: 'repoint', plan: '58-05' }, // hash re-pinned WITH the decision recorded (D-16)
  // ---- 58-07 on-ramps write focus steps (D-19) ----
  { file: 'tests/integration/scp-parse-pipeline.test.ts', disposition: 'repoint', plan: '58-16' }, // 58-07 repoints the parse-route halves (focus steps, no layout); the builder halves go with 58-16
  { file: 'src/lib/parsers/__tests__/parser-creates-junctions.test.ts', disposition: 'delete', plan: '58-07' },
  // ---- 58-10 worker entry hrefs ----
  { file: 'tests/phase52/plant-panel.spec.ts', disposition: 'repoint', plan: '58-10' }, // 58-11 edits the tab literal
  { file: 'tests/phase52/plant-now-card.spec.ts', disposition: 'repoint', plan: '58-10' }, // 58-11 edits the tab literal
  { file: 'tests/phase54/admin-machine-panel.spec.ts', disposition: 'repoint', plan: '58-10' }, // 58-14 edits the builder href
  { file: 'tests/phase57/machine-body.spec.ts', disposition: 'repoint', plan: '58-10' }, // 58-11 tab literal, 58-14 builder href
  { file: 'tests/evals/one-screen.eval.ts', disposition: 'repoint', plan: '58-10' }, // worker half; 58-11 tab literal, 58-14 builder href
  // ---- 58-11 walk and page evals ----
  { file: 'tests/evals/cut-features.eval.ts', disposition: 'repoint', plan: '58-11' }, // 58-14 edits the builder/versions probes
  { file: 'tests/evals/sop-ledger.eval.ts', disposition: 'repoint', plan: '58-11' }, // 58-14 edits the builder href
  { file: 'tests/evals/sop-detail.eval.ts', disposition: 'delete', plan: '58-11' }, // replaced by tests/evals/sop-focus.eval.ts
  // ---- 58-12 builder buttons move to the edit rail ----
  { file: 'tests/phase51/builder-machines-row.spec.ts', disposition: 'repoint', plan: '58-12' },
  { file: 'tests/phase56/standards-actions.spec.ts', disposition: 'repoint', plan: '58-12' },
  { file: 'tests/phase56/placement.spec.ts', disposition: 'repoint', plan: '58-12' },
  // ---- 58-13 bundle gate ----
  { file: 'tests/phase41/bundle-gate.spec.ts', disposition: 'repoint', plan: '58-13' }, // baseline moves DOWN by hand with history, never recaptured by an executor
  // ---- 58-14 cutover ----
  { file: 'tests/evals/governance.eval.ts', disposition: 'repoint', plan: '58-14' },
  { file: 'tests/evals/site-editor.eval.ts', disposition: 'repoint', plan: '58-14' },
  { file: 'tests/phase56/convert-apply.spec.ts', disposition: 'repoint', plan: '58-14' }, // converter refuses --apply
  // ---- 58-15 surviving guards repointed onto the focus files ----
  { file: 'tests/sb-auth-builder.test.ts', disposition: 'repoint', plan: '58-15' }, // auth halves survive
  { file: 'tests/sb-builder-infrastructure.test.ts', disposition: 'repoint', plan: '58-15' },
  { file: 'tests/sb-ux-walkthrough.test.ts', disposition: 'repoint', plan: '58-15' },
  { file: 'tests/sb-ux-blueprint.test.ts', disposition: 'repoint', plan: '58-15' },
  { file: 'tests/phase28/library-and-worker.spec.ts', disposition: 'repoint', plan: '58-15' },
  { file: 'tests/phase30/dead-weight.spec.ts', disposition: 'repoint', plan: '58-15' },
  { file: 'tests/phase30/governance-fold.spec.ts', disposition: 'repoint', plan: '58-15' }, // 58-14 edits the builder href first
  { file: 'tests/phase32/wire-up-mode.spec.ts', disposition: 'repoint', plan: '58-15' }, // builder halves go, survivors stay
  { file: 'tests/phase35/no-competency-gate.spec.ts', disposition: 'repoint', plan: '58-15' },
  { file: 'tests/phase36/no-refresher-gate.spec.ts', disposition: 'repoint', plan: '58-15' },
  { file: 'tests/phase37/no-competency-gate-worker.spec.ts', disposition: 'repoint', plan: '58-15' },
  { file: 'tests/phase40/dup04-page-shell.spec.ts', disposition: 'repoint', plan: '58-15' },
  { file: 'tests/phase57/shell-structure.spec.ts', disposition: 'repoint', plan: '58-16' }, // 58-14 exempts the two redirect-only pages; 58-16 removes the exemption with the directories
  { file: 'tests/phase40/spine-freeze.spec.ts', disposition: 'repoint', plan: '58-15' },
  { file: 'tests/phase40/parse-status-no-navigate-after-unmount.spec.ts', disposition: 'repoint', plan: '58-15' },
  { file: 'tests/phase41/nav-and-shim.spec.ts', disposition: 'repoint', plan: '58-15' }, // 58-11 edits the admin-link literal first
  { file: 'tests/phase41/reference-sweep.spec.ts', disposition: 'repoint', plan: '58-15' },
  { file: 'tests/phase43/route-truth.spec.ts', disposition: 'repoint', plan: '58-15' },
  { file: 'tests/phase43/dead-controls.spec.ts', disposition: 'repoint', plan: '58-15' },
  { file: 'tests/phase46/sop-edit-guard-wiring.spec.ts', disposition: 'repoint', plan: '58-15' },
  { file: 'tests/phase53/login-next-redirect.spec.ts', disposition: 'repoint', plan: '58-15' }, // 58-11 edits the tab literal first
  { file: 'tests/phase54/governance-inbox.spec.ts', disposition: 'repoint', plan: '58-15' },
  { file: 'tests/phase54/inbox-reuses-governance-gating.spec.ts', disposition: 'repoint', plan: '58-15' },
  { file: 'tests/phase54/library-table.spec.ts', disposition: 'repoint', plan: '58-15' },
  { file: 'tests/phase55/worker-path-contract.spec.ts', disposition: 'repoint', plan: '58-15' },
  { file: 'tests/phase56/decision-writers-sweep.spec.ts', disposition: 'repoint', plan: '58-15' },
  { file: 'tests/phase57/place.spec.ts', disposition: 'repoint', plan: '58-15' }, // 58-11 makes placeForPath null on /sops/*
  { file: 'tests/lint/no-bulk-verify-ui.spec.ts', disposition: 'repoint', plan: '58-15' }, // allow-list stays; new code must not use the banned phrases
  { file: 'tests/lint/no-dead-internal-hrefs.spec.ts', disposition: 'repoint', plan: '58-15' },
  // ---- 58-16 retirement: whole-subject deletes and the deletion sweep ----
  { file: 'tests/phase55/deletion-sweep.spec.ts', disposition: 'repoint', plan: '58-16' }, // dropped-features list + LIVE_FEATURES
  { file: 'tests/builder/builder-edit-stage.spec.ts', disposition: 'delete', plan: '58-16' },
  { file: 'tests/builder/builder-review-flow.spec.ts', disposition: 'delete', plan: '58-16' }, // 58-05 moves the gate halves to phase58 first
  { file: 'tests/sb-layout-editor.test.ts', disposition: 'delete', plan: '58-16' },
  { file: 'tests/sb-section-schema.test.ts', disposition: 'delete', plan: '58-16' },
  { file: 'tests/integration/desktop-walkthrough-layout.spec.ts', disposition: 'delete', plan: '58-16' },
  { file: 'tests/integration/sequential-ack.spec.ts', disposition: 'delete', plan: '58-16' },
  { file: 'tests/integration/walkthrough-store-ack.spec.ts', disposition: 'delete', plan: '58-16' },
  { file: 'tests/integration/scp-source-viewer.test.ts', disposition: 'delete', plan: '58-16' },
  { file: 'tests/integration/scp-verify-checklist.test.ts', disposition: 'delete', plan: '58-16' },
  { file: 'tests/lint/no-static-desktop-import.spec.ts', disposition: 'delete', plan: '58-16' },
  { file: 'tests/phase22/visual-layer.spec.ts', disposition: 'delete', plan: '58-16' },
  { file: 'tests/phase23/version-supersede.spec.ts', disposition: 'delete', plan: '58-16' },
  { file: 'tests/phase26/ghosts.spec.ts', disposition: 'delete', plan: '58-16' },
  { file: 'tests/phase26/inserter.spec.ts', disposition: 'delete', plan: '58-16' },
  { file: 'tests/phase26/reorder.spec.ts', disposition: 'delete', plan: '58-16' },
  { file: 'tests/phase26/visual-block.spec.ts', disposition: 'delete', plan: '58-16' },
  { file: 'tests/phase26/field-map.spec.ts', disposition: 'delete', plan: '58-16' },
  { file: 'tests/phase26/field-inline-patterns.spec.ts', disposition: 'delete', plan: '58-16' },
  { file: 'tests/phase26/autosave-rewire.spec.ts', disposition: 'delete', plan: '58-16' },
  { file: 'tests/phase26/ai-overlay.spec.ts', disposition: 'delete', plan: '58-16' },
  { file: 'tests/phase26.5/agent-panel-readonly.spec.ts', disposition: 'delete', plan: '58-16' },
  { file: 'tests/phase29/publish-stage-approval.spec.ts', disposition: 'delete', plan: '58-16' },
  { file: 'tests/phase29/version-history-approvals.spec.ts', disposition: 'delete', plan: '58-16' },
  { file: 'tests/phase30/tab-merge.spec.ts', disposition: 'delete', plan: '58-16' },
  { file: 'tests/phase30/list-rows.spec.ts', disposition: 'delete', plan: '58-16' },
  { file: 'tests/phase30/plain-language.spec.ts', disposition: 'delete', plan: '58-16' },
  { file: 'tests/phase33/wayfinder-header.spec.ts', disposition: 'delete', plan: '58-16' },
  { file: 'tests/phase33/plain-language-access.spec.ts', disposition: 'delete', plan: '58-16' },
  { file: 'tests/phase36/version-breakdown-panel.spec.ts', disposition: 'delete', plan: '58-16' },
  { file: 'src/components/admin/verify-checklist/__tests__/VerifyChecklistGate.test.tsx', disposition: 'delete', plan: '58-16' },
  { file: 'src/components/admin/verify-checklist/__tests__/publish-gate.integration.test.ts', disposition: 'delete', plan: '58-16' }, // 58-05 moves the gate halves first
]

// Each owning plan appends its id (e.g. '58-05') when its last commit lands.
export const LIVE_PLANS: string[] = ['58-07', '58-11', '58-14']

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
  walk(path.join(ROOT, 'src'), files) // *.test.ts(x) beside source (verify-checklist, parsers, reviewer)
  const out: Array<{ rel: string; code: string }> = []
  for (const file of files) {
    const rel = path.relative(ROOT, file)
    if (rel === SELF || rel.startsWith(P58)) continue
    out.push({ rel: rel.replace(/\\/g, '/'), code: stripComments(fs.readFileSync(file, 'utf-8').replace(/\r\n/g, '\n')) })
  }
  return out
}

function hits(code: string, token: string | RegExp): boolean {
  return typeof token === 'string' ? code.includes(token) : token.test(code)
}

test.describe('phase 58 repoint inventory', () => {
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
      expect(row.plan).toMatch(/^58-\d\d$/)
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

  test('the builder and versions regex tokens catch a template-expression spelling and nothing else', () => {
    const builder = RETIRED.find((r) => r.plan === '58-14' && r.token instanceof RegExp && r.token.source.includes('builder'))!.token as RegExp
    const versions = RETIRED.find((r) => r.plan === '58-14' && r.token instanceof RegExp && r.token.source.includes('versions'))!.token as RegExp
    expect(builder.test('`/admin/sops/builder/${id}`')).toBe(true)
    expect(builder.test('/admin/sops/builder')).toBe(false)
    expect(versions.test('`/admin/sops/${sopId}/versions`')).toBe(true)
    expect(versions.test('/admin/sops/new')).toBe(false)
  })
})
