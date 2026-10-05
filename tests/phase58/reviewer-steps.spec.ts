/**
 * Phase 58 -- WRK-04 (D-02, D-17): the AI reviewer reads the draft's steps.
 * Filled by: 58-06.
 * Registration: playwright.config.ts `phase58` project.
 *
 * Source-contract guards over the orchestrator, the jobs and the route. The
 * behaviour itself (draft block, step_id nulling, rows, draft-only jobs, job
 * errors, all-clear) is run for real in
 * src/lib/parsers/ai-reviewer/__tests__/orchestrator.test.ts; these pin the
 * wiring so a refactor cannot quietly drop it.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')

// Comments describe what is absent; the guards must not trip on them.
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const ORCH = 'src/lib/parsers/ai-reviewer/orchestrator.ts'
const ROUTE = 'src/app/api/sops/[sopId]/ai-reviewer/route.ts'
const JOBS = [
  'job-a-hallucination',
  'job-b-omission',
  'job-c-anchoring',
  'job-d-table-fidelity',
  'job-e-terminology',
].map((f) => `src/lib/parsers/ai-reviewer/jobs/${f}.ts`)

test.describe('WRK-04 reviewer reads steps', () => {
  test('draft steps are sent as a second non-cached block (58-06)', () => {
    const src = strip(read(ORCH))
    const draftLine = src.split('\n').find((l) => l.includes('DRAFT STEPS:'))
    expect(draftLine, 'DRAFT STEPS block').toBeTruthy()
    expect(draftLine).not.toContain('cache_control')
    // The block literal itself carries no cache_control either.
    const block = src.slice(src.indexOf('const draftBlock'), src.indexOf('const content ='))
    expect(block).not.toContain('cache_control')
    // The cached source block still comes first.
    expect(src).toContain('[cachedSourceBlock, draftBlock]')
    expect(src).toMatch(/from\('sop_focus_steps'\)[\s\S]*?\.eq\('organisation_id', organisationId\)/)
  })

  test('every finding carries a step_id, never a block_id (58-06)', () => {
    for (const f of JOBS) {
      const src = strip(read(f))
      expect(src, f).not.toContain('block_id')
      expect(src, f).toContain('step_id')
    }
    expect(strip(read('src/lib/parsers/ai-reviewer/types.ts'))).not.toContain('block_id')
    const orch = strip(read(ORCH))
    // A step_id the model made up never targets a step.
    expect(orch).toContain('stepIds.has(f.step_id)')
    expect(orch).toMatch(/step_id: f\.step_id && stepIds\.has\(f\.step_id\) \? f\.step_id : null/)
    expect(orch).toContain('.slice(0, 1000)')
    // The vocabulary job reads focus steps, not the old step table.
    const jobE = strip(read(JOBS[4]!))
    expect(jobE).toContain("from('sop_focus_steps')")
    expect(jobE).not.toContain('sop_steps')
  })

  test('findings are persisted as sop_ai_findings rows (D-17) (58-06)', () => {
    const orch = strip(read(ORCH))
    expect(orch).toContain("from('sop_ai_findings').insert(")
    // New rows go in BEFORE the previous run's open rows are retired.
    const ins = orch.indexOf("from('sop_ai_findings').insert(")
    const del = orch.indexOf(".from('sop_ai_findings')\n    .delete()")
    expect(ins).toBeGreaterThan(-1)
    expect(del).toBeGreaterThan(ins)
    // Only OPEN rows of other runs are deleted: cleared rows stay on record.
    const delChain = orch.slice(del, del + 320)
    expect(delChain).toContain(".is('cleared_at', null)")
    // review WR-03 / IN-05: other runs (a null run_id included), and only the jobs this run re-checked.
    expect(delChain).toContain(".or(`run_id.is.null,run_id.neq.${runId}`)")
    expect(delChain).toContain(".in('job', [...jobsRequested, 'all'])")
    expect(delChain).toContain(".eq('organisation_id', organisationId)")
    expect(orch).toContain('persistFindings(sopId, organisationId, runId, flags, stepIds, [...requested])')
    // An erroring job is an open SOP-level row; a clean run leaves a cleared marker.
    expect(orch).toContain("'job_error'")
    expect(orch).toContain("kind: 'all_clear'")
    expect(orch).toMatch(/kind: 'all_clear'[\s\S]*?cleared_at: now/)
    expect(orch).not.toMatch(/all_clear[\s\S]{0,200}cleared_by/)
    // The old builder panel keeps its envelope.
    expect(orch).toContain('persistEnvelope(load.parse_job_id, envelope)')
  })

  test('a SOP without a source document runs the draft-only jobs (D-02) (58-06)', () => {
    const orch = strip(read(ORCH))
    expect(orch).toContain("const DRAFT_ONLY_JOBS: ReviewerJobId[] = ['D', 'E']")
    expect(orch).toMatch(/if \(!hasSource\) \{\s*requested\.clear\(\)/)
    expect(orch).toContain('runReviewerForSop')
    const route = strip(read(ROUTE))
    expect(route).not.toContain('no_parse_job')
    expect(route).not.toContain('never_run')
    expect(route).toContain('runReviewerForSop(')
  })

  test('the route keeps its caps, scopes every query to the session org, and gates by role', () => {
    const route = strip(read(ROUTE))
    // POST: admin / safety_manager only, SOP resolved in the SESSION org.
    expect(route).toContain("['admin', 'safety_manager'].includes(role)")
    const post = route.slice(route.indexOf('export async function POST'), route.indexOf('export async function GET'))
    expect(post).toMatch(/from\('sops'\)[\s\S]*?\.eq\('organisation_id', auth\.organisationId\)/)
    expect(post).toContain('assertWithinPerDayRunCap(sopId)')
    expect(post).toContain("error: 'per_day_cap'")
    expect(post).toContain("error: 'per_org_cap'")
    expect(post).toContain('incrementPerDayRunCounter(sopId)')
    // GET: edit access, resolved server-side.
    const get = route.slice(route.indexOf('export async function GET'))
    expect(get).toContain('requireSopEditAccess({ sopId })')
    expect(get).toContain('lastRunAt')
    expect(get).toContain('hasSource')
    // Every admin-client read in GET filters by the session organisation.
    const reads = get.split(/admin\s*\n?\s*\.from\(/).slice(1)
    expect(reads.length).toBeGreaterThanOrEqual(3)
    for (const r of reads) expect(r.slice(0, 500), r.slice(0, 40)).toContain(".eq('organisation_id', orgId)")
  })

  test('the per-day cap is keyed on sop_id, so a blank SOP is capped too', () => {
    const rl = strip(read('src/app/api/sops/[sopId]/ai-reviewer/rate-limit.ts'))
    expect(rl).toContain(".eq('sop_id', sopId)")
    expect(rl).not.toContain('parse_job')
  })
})
