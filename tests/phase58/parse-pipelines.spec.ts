/**
 * Phase 58 -- WRK-03 (D-19): every on-ramp writes focus steps and none writes
 * the block layout. Comment-stripped source contract (the Phase 41 idiom).
 * Registration: playwright.config.ts `phase58` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8').replace(/\r\n/g, '\n')
const stripComments = (src: string) =>
  src
    .split('\n')
    .map((l) => (/^\s*(\/\/|\/\*|\*\/|\*)/.test(l) ? '' : l))
    .join('\n')

const ROUTES = {
  parse: 'src/app/api/sops/parse/route.ts',
  'ai-prompt': 'src/app/api/sops/ai-prompt/route.ts',
  transcribe: 'src/app/api/sops/transcribe/route.ts',
  restructure: 'src/app/api/sops/restructure/route.ts',
} as const

test.describe('WRK-03 parse pipelines', () => {
  test('every on-ramp writes focus steps before the job completes and before the AI check', () => {
    for (const [name, rel] of Object.entries(ROUTES)) {
      const code = stripComments(read(rel))
      const write = code.indexOf('writeFocusStepsForSop(')
      const done = code.indexOf("status: 'completed'")
      expect(write, `${name} calls writeFocusStepsForSop`).toBeGreaterThan(-1)
      expect(done, `${name} completes the job`).toBeGreaterThan(write)
      expect(code, `${name} turns a write error into a failed job`).toMatch(/'error' in written\) throw new Error\(written\.error\)/)
      const reviewer = code.indexOf('triggerReviewerOnParseCompletion(')
      if (reviewer > -1 && code.includes('void triggerReviewerOnParseCompletion(')) {
        expect(reviewer, `${name} triggers the AI check after the steps exist`).toBeGreaterThan(write)
      }
    }
  })

  test('no on-ramp writes layout_data, block junctions or the layout converter', () => {
    for (const [name, rel] of Object.entries(ROUTES)) {
      const code = stripComments(read(rel))
      expect(code, name).not.toContain('layout_data')
      expect(code, name).not.toContain('materializeJunctionsForLayout')
      expect(code, name).not.toContain('parsedSopToPerSectionLayoutData')
    }
  })

  test('the blank wizard inserts the SOP row and no sections or layout', () => {
    const src = stripComments(read('src/actions/sops.ts'))
    const start = src.indexOf('export async function createSopFromWizard')
    const end = src.indexOf('export async function setSopCategory')
    expect(start).toBeGreaterThan(-1)
    const body = src.slice(start, end)
    expect(body).toContain(".from('sops')")
    expect(body).not.toContain("from('sop_sections')")
    expect(body).not.toContain('layout_data')
  })

  test('focus-write.ts converts in-process, gate-checks, keys natives with new: and never deletes', () => {
    const code = stripComments(read('src/lib/sop/focus-write.ts'))
    expect(code).toContain('convertSop(')
    expect(code).toContain('checkGate(')
    expect(code).toContain('`new:${randomUUID()}`')
    expect(code).not.toContain('.delete(')
    // org pin: the SOP row is read with the session organisation before anything is written
    expect(code).toContain(".eq('organisation_id', organisationId)")
    // a failed or empty conversion never writes
    expect(code).toMatch(/c\.steps\.length === 0/)
  })

  test('re-running transcribe or restructure replaces the draft instead of duplicating it', () => {
    for (const rel of [ROUTES.transcribe, ROUTES.restructure]) {
      const code = stripComments(read(rel))
      const del = code.indexOf(".from('sop_sections').delete()")
      expect(del, rel).toBeGreaterThan(-1)
      expect(code.indexOf(".from('sop_sections')\n        .insert("), rel).toBeGreaterThan(del)
    }
  })

  test('the document route writes current_stage as parsing progresses (D-19), with keys the stepper knows', () => {
    const code = stripComments(read(ROUTES.parse))
    expect(code).toContain('current_stage')
    const stages = [...code.matchAll(/(?:setStage\(|current_stage: )'([a-z_]+)'/g)].map((m) => m[1])
    const known = read('src/lib/admin/job-stages.ts')
    for (const s of stages.filter((x) => x !== 'completed' && x !== 'failed')) {
      expect(known, `stage ${s} is a STAGE_TO_PLAIN key`).toMatch(new RegExp(`\\b${s}:`))
    }
    expect(stages).toEqual(expect.arrayContaining(['parsing', 'drafting', 'structuring']))
  })
})
