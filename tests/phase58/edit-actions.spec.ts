/**
 * Phase 58 / 58-04 -- FOC-02, WRK-04 (D-01, D-04, D-17, D-20): focus-step edit actions.
 *
 * Source-contract, comment-stripped (CLAUDE.md 2026-09-28). Each assertion pins
 * wiring, not just a token: the guard runs before any privileged work, every
 * service-role write carries the session organisation, no schema accepts a trust
 * field, and the ledger row follows the write.
 *
 * The real server actions need a request cookie, so they cannot be called from
 * Playwright; the cross-org and non-approver outcomes are proved by the deployed
 * evals (58-12/13/18). The database half (no authenticated write policy, the tick
 * trigger) is proved by focus-rls-live.spec.ts.
 *
 * Registration: playwright.config.ts `phase58` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
const readRaw = (p: string) => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n')
const read = (p: string) => strip(readRaw(p))

const STEPS = 'src/actions/focus-steps.ts'
const FINDINGS = 'src/actions/findings.ts'
const steps = read(STEPS)
const findings = read(FINDINGS)

/** Source of one exported function: its declaration to the next top-level export (or end). */
function body(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}(`)
  expect(start, `${name} exists`).toBeGreaterThan(-1)
  const next = src.indexOf('\nexport ', start + 1)
  return src.slice(start, next === -1 ? undefined : next)
}

const exportsOf = (src: string) => [...src.matchAll(/^export async function (\w+)/gm)].map((m) => m[1])

const STEP_EXPORTS = [
  'getFocusSop',
  'updateFocusStep',
  'addFocusStep',
  'deleteFocusStep',
  'moveFocusStep',
  'deleteFocusSection',
  'tickFocusStep',
  'untickFocusStep',
  'setAllowForwardJump',
  'getStepImageUploadUrl',
  'attachStepImage',
  'removeStepImage',
  'getStepAnnotation',
  'saveAnnotatedStepImage',
]
const ADMIN_ONLY = ['tickFocusStep', 'untickFocusStep', 'setAllowForwardJump']
const NOT_CONTENT = ['getFocusSop', 'getStepAnnotation']

test.describe('FOC-02/WRK-04 edit actions', () => {
  test('both files are use-server with async-only exports and the plan\'s exact export list', () => {
    for (const f of [STEPS, FINDINGS]) {
      expect(readRaw(f).trimStart().startsWith("'use server'"), f).toBe(true)
      const src = read(f)
      expect(src.match(/^export\s/gm)?.length, `${f} exports only async functions`).toBe(exportsOf(src).length)
    }
    expect(exportsOf(steps).sort()).toEqual([...STEP_EXPORTS].sort())
    expect(exportsOf(findings)).toEqual(['clearFinding'])
    // no tick-all / bulk export (D-21-07)
    expect(exportsOf(steps).join(' ')).not.toMatch(/tickAll|verifyAll|bulk/i)
  })

  test('requireSopEditAccess accepts { stepId } and resolves the SOP from it (58-04)', () => {
    const g = read('src/lib/auth/guards.ts')
    expect(g).toContain('| { stepId: string }')
    const arm = g.indexOf("'stepId' in target")
    expect(arm).toBeGreaterThan(-1)
    expect(g.slice(arm, arm + 260)).toContain(".from('sop_focus_steps')")
    // the session-org sops filter runs after every arm, unchanged
    expect(g.indexOf(".eq('organisation_id', organisationId)", arm)).toBeGreaterThan(arm)
    for (const fn of ['updateFocusStep', 'deleteFocusStep', 'moveFocusStep', 'getStepImageUploadUrl', 'attachStepImage', 'removeStepImage', 'getStepAnnotation', 'saveAnnotatedStepImage']) {
      expect(body(steps, fn), fn).toContain('requireSopEditAccess({ stepId })')
    }
  })

  test('the guard is the first privileged step of every export', () => {
    for (const [file, src, names] of [
      [STEPS, steps, STEP_EXPORTS],
      [FINDINGS, findings, ['clearFinding']],
    ] as Array<[string, string, string[]]>) {
      for (const fn of names) {
        const b = body(src, fn)
        const adminOnly = ADMIN_ONLY.includes(fn) || file === FINDINGS
        const guard = b.search(adminOnly ? /requireAdminContext\(\)/ : /requireSopEditAccess\(/)
        expect(guard, `${fn} calls its guard`).toBeGreaterThan(-1)
        if (!adminOnly) expect(b, `${fn} must not use the admin-only guard`).not.toContain('requireAdminContext(')
        const firstWork = b.search(/createAdminClient\(\)|recordDecision\(|editableSop\(|\.from\(|stepSopId\(|sectionSteps\(|loadFocusSop\(/)
        expect(firstWork, `${fn} does no work before its guard`).toBeGreaterThan(guard)
      }
    }
  })

  test("service-role writes are filtered by the session org, never the fetched row's org (58-04)", () => {
    for (const [name, src] of [[STEPS, steps], [FINDINGS, findings]]) {
      const chains = [...src.matchAll(/\.from\('(sop_focus_steps|sops|sop_ai_findings)'\)/g)]
      expect(chains.length, name).toBeGreaterThanOrEqual(1)
      for (const c of chains) {
        const chain = src.slice(c.index!).split(/\n\s*\n|\n\s*if \(/)[0]
        expect(chain, `${name} ${c[1]} chain`).toMatch(
          /\.eq\('organisation_id', (ctx\.organisationId|organisationId)\)|organisation_id: ctx\.organisationId/
        )
      }
      expect(src, name).not.toMatch(/organisation_id', (step|row|data|finding|sop)\b/)
      expect(src, name).not.toMatch(/organisation_id: (step|row|data|finding)\b/)
    }
    // every step write also pins the SOP the guard resolved
    for (const fn of ['updateFocusStep', 'deleteFocusStep', 'attachStepImage', 'removeStepImage']) {
      expect(body(steps, fn), fn).toContain(".eq('sop_id', ctx.sopId)")
    }
    expect(body(steps, 'deleteFocusSection')).toContain(".eq('sop_id', ctx.sopId)")
  })

  test('no schema accepts an organisation, user or agent field (CLAUDE.md 2026-09-30)', () => {
    for (const src of [steps, findings]) {
      for (const m of src.matchAll(/z\s*\.object\(/g)) {
        let depth = 1
        let i = m.index! + m[0].length
        while (i < src.length && depth > 0) {
          if (src[i] === '(') depth++
          else if (src[i] === ')') depth--
          i++
        }
        expect(src.slice(m.index!, i)).not.toMatch(/\b(organisationId|organisation_id|userId|user_id|agent|agentName)\b/)
      }
    }
  })

  test('edits are refused on published and parsing SOPs (58-04)', () => {
    const rule = read('src/lib/sop/editable.ts')
    expect(rule).toContain("status === 'draft'")
    expect(rule).toContain('Published — start a new version to change it.')
    expect(rule).toContain("Still reading the document")
    // the rule filters by the caller's organisation passed in, never the row's
    expect(rule).toContain(".eq('organisation_id', organisationId)")
    for (const fn of STEP_EXPORTS.filter((n) => !NOT_CONTENT.includes(n))) {
      expect(body(steps, fn), `${fn} calls editableSop`).toContain('editableSop(ctx.organisationId')
    }
    const sections = read('src/actions/sections.ts')
    expect(sections.match(/editableSop\(ctx\.organisationId, ctx\.sopId\)/g)?.length).toBe(3)
    for (const fn of ['createSection', 'reorderSections', 'updateSectionTitle']) {
      expect(body(sections, fn), fn).toContain('editableSop(')
    }
    // review WR-04: the two parse re-runs delete sop_sections (and so the focus steps by
    // cascade); both refuse a published SOP, check the role, and scope to the session org
    // before anything destructive.
    const sops = read('src/actions/sops.ts')
    expect(sops).toContain("import { PUBLISHED_MSG } from '@/lib/sop/editable'")
    for (const fn of ['reparseSop', 'restructureSop']) {
      const b = body(sops, fn)
      const refuse = b.indexOf("sop.status === 'published') return { error: PUBLISHED_MSG }")
      expect(refuse, `${fn} refuses a published SOP`).toBeGreaterThan(-1)
      expect(refuse).toBeLessThan(b.indexOf(".from('sop_sections')"))
      expect(b.indexOf("'safety_manager'"), `${fn} role check`).toBeLessThan(refuse)
      expect(b).toContain('sop.organisation_id !== organisationId')
      expect(b).not.toContain('existingJob.organisation_id')
      expect(b).toMatch(/\.from\('parse_jobs'\)\s*\.insert\(\{\s*organisation_id: organisationId/)
    }
  })

  test('tick is admin-only and writes one ledger row after the write (58-04)', () => {
    for (const fn of ['tickFocusStep', 'untickFocusStep']) {
      const b = body(steps, fn)
      expect(b).toContain('requireAdminContext()')
      expect(b.lastIndexOf('await recordDecision(')).toBeGreaterThan(b.indexOf('.update('))
      expect(b).toContain("subject: { kind: 'focus_step', id: stepId }")
    }
    expect(body(steps, 'tickFocusStep')).toContain("kind: 'verify'")
    expect(body(steps, 'untickFocusStep')).toContain("kind: 'verify_withdrawn'")
    // the SOP for the ledger row is resolved server-side from the session-org step lookup
    expect(body(steps, 'tickFocusStep')).toContain('stepSopId(ctx.organisationId, stepId)')
  })

  test('clearFinding writes a ledger decision through recordDecision (D-17) (58-04)', () => {
    const b = body(findings, 'clearFinding')
    expect(b).toContain('requireAdminContext()')
    expect(b).toContain(".is('cleared_at', null)")
    expect(b.match(/\.eq\('organisation_id', ctx\.organisationId\)/g)?.length).toBeGreaterThanOrEqual(2)
    expect(b.lastIndexOf('await recordDecision(')).toBeGreaterThan(b.indexOf('.update('))
    expect(b).toContain("subject: { kind: 'ai_finding', id: findingId }")
    expect(b).toContain('sopId: row.sop_id')
    expect(findings).toMatch(/import\s*\{\s*recordDecision\s*\}\s*from\s*'@\/lib\/decisions\/record'/)
  })

  test('the SOP objective is written through the objectives actions, not a focus-steps writer (A-01)', () => {
    expect(steps).not.toMatch(/\bobjective\b\s*:/)
    expect(read('src/actions/objectives.ts')).toContain('export async function setObjective(')
  })

  test('attachStepImage rebuilds the exact path prefix from the session and resolved SOP', () => {
    const b = body(steps, 'attachStepImage')
    expect(b).toContain('`${ctx.organisationId}/${ctx.sopId}/steps/${stepId}`')
    expect(b).toContain('storagePath.startsWith(`${dir}/`)')
    expect(b).toContain('IMAGE_FILE.test(file)')
    expect(steps).toMatch(/IMAGE_FILE = \/\^\[0-9a-f\]\{8\}-.*\\\.\(jpg\|png\)\$\/i/)
    // the image row exists before the step points at it
    expect(b.indexOf(".from('sop_images')")).toBeLessThan(b.indexOf('image_paths: [...image_paths, storagePath]'))
    expect(steps).toContain('createSignedUploadUrl')
    expect(body(steps, 'getStepImageUploadUrl')).toContain("z.enum(['image/jpeg', 'image/png'])")
  })

  test('review WR-07: deleting a draft sweeps its editor-uploaded step photos, best effort', () => {
    const route = read('src/app/api/sops/[sopId]/route.ts')
    const del = route.slice(route.indexOf('export async function DELETE'))
    const sweep = del.indexOf('/steps`')
    expect(sweep).toBeGreaterThan(-1)
    // one list per step folder, then one remove; inside the non-fatal try so a storage error never fails the delete
    expect(del.slice(sweep)).toMatch(/\.list\(`\$\{stepsDir\}\/\$\{d\.name\}`\)[\s\S]*\.remove\(stepFiles\)/)
    expect(sweep).toBeGreaterThan(del.indexOf('try {'))
    expect(sweep).toBeLessThan(del.indexOf('catch (storageErr)'))
  })

  test('the plain read loader has no directive and no service role', () => {
    const raw = readRaw('src/lib/sop/focus-read.ts')
    expect(raw.trimStart().startsWith("'use")).toBe(false)
    expect(raw).not.toContain('createAdminClient')
    expect(raw).toContain('export async function loadFocusSop(client')
    expect(body(steps, 'getFocusSop')).toContain('loadFocusSop(ctx.supabase')
  })

  test('the capability matrix names the guard each row uses (CLAUDE.md Capability Matrix)', () => {
    const matrix = readRaw('.planning/codebase/CAPABILITY-MATRIX.md').split('\n')
    const edit = matrix.find((l) => l.startsWith('| Phase 58 -- edit steps, sections'))
    const tick = matrix.find((l) => l.startsWith('| Phase 58 -- tick or untick a step'))
    expect(edit).toContain('requireSopEditAccess')
    expect(tick).toContain('requireAdminContext')
  })

  test.describe('live (PHASE58_LIVE=1)', () => {
    test.skip(!process.env.PHASE58_LIVE, 'live probes share the Supabase OTP budget; set PHASE58_LIVE=1')
    test.fixme(
      'a non-approver supervisor and a foreign-org admin are refused (58-04)',
      () => {
        // The real actions read the session from request cookies, which a Playwright
        // spec cannot supply. Covered by the deployed evals (58-12/13/18) and, for the
        // database half, focus-rls-live.spec.ts.
      }
    )
  })
})
