/**
 * AI reviewer orchestrator tests (Phase 21 + Phase 58-06).
 *
 *  1. Job A runs end-to-end; the user turn is the cached SOURCE block plus a
 *     second, non-cached DRAFT STEPS block; envelope reports cache_create.
 *  2. All five jobs run in one session.
 *  3. Cap exhausted -> throws; nothing dispatched, nothing written.
 *  4. A step_id the model invents becomes null; a real one is kept; rows are
 *     inserted into sop_ai_findings and the previous OPEN rows retired.
 *  5. A SOP with no parse job runs only the draft-only jobs (D, E) with a
 *     draft-only user turn (D-17).
 *  6. A job that errors becomes an open SOP-level `job_error` row; a run with
 *     nothing to flag writes one system-cleared `all_clear` row.
 *  7. No source and no steps -> NothingToReviewError, nothing dispatched.
 *
 * Strategy: swap `getAnthropic` (verify-sop) and the supabase admin client in
 * `require.cache`, the pattern the other __tests__ in this repo use. Runs under
 * the `phase21-ai-reviewer` Playwright project. No network, no Anthropic call.
 */

import { test, expect } from '@playwright/test'
import { resolve as pathResolve } from 'node:path'

const STEP_1 = '11111111-1111-4111-8111-111111111111'
const STEP_2 = '22222222-2222-4222-8222-222222222222'
const SOP = '33333333-3333-4333-8333-333333333333'

type AnthropicStubResponse =
  | {
      content: Array<{ type: 'text'; text: string }>
      usage: {
        input_tokens: number
        output_tokens: number
        cache_creation_input_tokens: number
        cache_read_input_tokens: number
      }
    }
  | { throws: string }

const ZERO_USAGE = {
  input_tokens: 0,
  output_tokens: 0,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
}
const empty = (usage = ZERO_USAGE): AnthropicStubResponse => ({
  content: [{ type: 'text', text: '[]' }],
  usage,
})

function makeAnthropicStub(responses: AnthropicStubResponse[]) {
  const calls: Array<Record<string, unknown>> = []
  let idx = 0
  return {
    calls,
    client: {
      messages: {
        create: async (req: Record<string, unknown>) => {
          calls.push(req)
          const r = responses[idx] ?? responses[responses.length - 1]
          idx += 1
          if ('throws' in r) throw new Error(r.throws)
          return r
        },
      },
    },
  }
}

type SupabaseStubOpts = {
  parseJob?: {
    id: string
    organisation_id: string
    sop_id: string | null
    transcript_text: string | null
    prompt_text?: string | null
  } | null
  spendRow?: { spend_cents: number; cap_cents: number | null } | null
  steps?: Array<{ id: string; section_id: string; kind: string; text: string; sort_order: number }>
  sections?: Array<{ id: string; title: string; sort_order: number }>
}

function makeSupabaseStub(opts: SupabaseStubOpts) {
  const parseJobUpdates: Array<Record<string, unknown>> = []
  const spendUpserts: Array<Record<string, unknown>> = []
  const findingInserts: Array<Record<string, unknown>> = []
  const findingDeletes: string[] = []

  function table(name: string) {
    // Every builder step returns the chain; awaiting the chain resolves rows.
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'neq', 'is', 'or', 'in', 'order', 'limit']) {
      chain[m] = () => chain
    }
    chain.then = (resolve: (v: unknown) => void) => {
      const data =
        name === 'sop_focus_steps' ? (opts.steps ?? []) : name === 'sop_sections' ? (opts.sections ?? []) : []
      resolve({ data, error: null })
    }
    chain.update = (vals: Record<string, unknown>) => {
      if (name === 'parse_jobs') parseJobUpdates.push(vals)
      return { eq: () => ({}) }
    }
    chain.upsert = (vals: Record<string, unknown>) => {
      if (name === 'org_anthropic_spend') spendUpserts.push(vals)
      return { error: null }
    }
    chain.insert = (rows: Array<Record<string, unknown>>) => {
      if (name === 'sop_ai_findings') findingInserts.push(...rows)
      return { error: null }
    }
    chain.delete = () => {
      findingDeletes.push(name)
      return chain
    }
    chain.maybeSingle = async () => {
      if (name === 'parse_jobs') {
        return { data: opts.parseJob ?? null, error: null }
      }
      if (name === 'org_anthropic_spend') {
        return { data: opts.spendRow ?? null, error: null }
      }
      return { data: null, error: null }
    }
    return chain
  }

  return {
    from: (name: string) => table(name),
    parseJobUpdates,
    spendUpserts,
    findingInserts,
    findingDeletes,
  }
}

type RequireWithCache = typeof require & {
  cache: Record<string, NodeJS.Module | undefined>
}
type ModuleWithResolve = typeof import('node:module') & {
  _resolveFilename: (req: string, parent: unknown, isMain: boolean) => string
}
const req = require as RequireWithCache
function moduleCache(): Record<string, NodeJS.Module | undefined> {
  return req.cache
}
// The `@/` alias is unavailable at Playwright's require() runtime, so modules
// are resolved by absolute path from __dirname.
const MODULE_PATHS: Record<string, string> = {
  '@/lib/parsers/verify-sop': pathResolve(__dirname, '..', '..', 'verify-sop.ts'),
  '@/lib/supabase/admin': pathResolve(__dirname, '..', '..', '..', 'supabase', 'admin.ts'),
  '@/lib/parsers/ai-reviewer/orchestrator': pathResolve(__dirname, '..', 'orchestrator.ts'),
  '@/lib/parsers/ai-reviewer/cost-guard': pathResolve(__dirname, '..', 'cost-guard.ts'),
  '@/lib/parsers/ai-reviewer/source-content': pathResolve(__dirname, '..', 'source-content.ts'),
  '@/lib/parsers/ai-reviewer/jobs/job-e-terminology': pathResolve(
    __dirname,
    '..',
    'jobs',
    'job-e-terminology.ts',
  ),
}

function resolveFile(modulePath: string): string {
  const direct = MODULE_PATHS[modulePath]
  if (direct) return direct
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Module = require('node:module') as ModuleWithResolve
  return Module._resolveFilename(modulePath, require.main, false)
}

/** Hot-swap a module's exports in require.cache; returns a restore function. */
function swapModule(modulePath: string, replacement: Record<string, unknown>) {
  const resolved = resolveFile(modulePath)
  const cache = moduleCache()
  const prev = cache[resolved]
  cache[resolved] = {
    ...((prev as unknown as Record<string, unknown>) ?? {}),
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: replacement,
  } as unknown as NodeJS.Module
  return () => {
    if (prev) cache[resolved] = prev
    else delete cache[resolved]
  }
}

/** Every module that captured a previous stub's admin client is re-evaluated. */
function evictOrchestrator() {
  const cache = moduleCache()
  for (const key of [
    '@/lib/parsers/ai-reviewer/orchestrator',
    '@/lib/parsers/ai-reviewer/cost-guard',
    '@/lib/parsers/ai-reviewer/source-content',
    '@/lib/parsers/ai-reviewer/jobs/job-e-terminology',
  ]) {
    delete cache[resolveFile(key)]
  }
}

type Harness = {
  anthropic: ReturnType<typeof makeAnthropicStub>
  supabase: ReturnType<typeof makeSupabaseStub>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orchestrator: any
  restore: () => void
}

function setup(responses: AnthropicStubResponse[], opts: SupabaseStubOpts): Harness {
  const anthropic = makeAnthropicStub(responses)
  const supabase = makeSupabaseStub(opts)
  const restoreAnthropic = swapModule('@/lib/parsers/verify-sop', {
    getAnthropic: () => anthropic.client,
    VERIFY_MODEL: 'claude-haiku-test',
    ADVERSARIAL_SYSTEM: '(stub adversarial prompt)',
    PROMPT_VERIFY_SYSTEM: '',
  })
  const restoreSupabase = swapModule('@/lib/supabase/admin', {
    createAdminClient: () => supabase,
  })
  evictOrchestrator()
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const orchestrator = require(MODULE_PATHS['@/lib/parsers/ai-reviewer/orchestrator']!)
  return {
    anthropic,
    supabase,
    orchestrator,
    restore: () => {
      restoreAnthropic()
      restoreSupabase()
      evictOrchestrator()
    },
  }
}

const SECTIONS = [{ id: 'sec-1', title: 'Isolate', sort_order: 0 }]
const STEPS = [
  { id: STEP_1, section_id: 'sec-1', kind: 'step', text: 'Isolate the pump at 45 Nm.', sort_order: 0 },
  { id: STEP_2, section_id: 'sec-1', kind: 'check', text: 'Confirm zero energy.', sort_order: 1 },
]
const PARSE_JOB = {
  id: 'parse-1',
  organisation_id: 'org-1',
  sop_id: SOP,
  transcript_text: 'short source content',
}

test.describe('runReviewerJobs orchestrator', () => {
  test('Job A runs end-to-end; user turn is cached source + non-cached draft steps', async () => {
    const h = setup(
      [
        empty({
          // ~5000 output tokens x $15/MTok is several cents, so the spend upsert fires.
          input_tokens: 1000,
          output_tokens: 5000,
          cache_creation_input_tokens: 500,
          cache_read_input_tokens: 0,
        }),
      ],
      { parseJob: PARSE_JOB, spendRow: { spend_cents: 0, cap_cents: 500 }, steps: STEPS, sections: SECTIONS },
    )
    try {
      const envelope = await h.orchestrator.runReviewerJobs('parse-1', ['A'])

      expect(envelope.parse_job_id).toBe('parse-1')
      expect(envelope.jobs_run).toEqual(['A'])
      expect(envelope.usage.cache_create_tokens).toBe(500)
      expect(envelope.job_status?.A).toBe('ok')
      expect(h.supabase.parseJobUpdates.length).toBe(1)
      expect(h.supabase.spendUpserts.length).toBe(1)

      const content = (h.anthropic.calls[0]!.messages as Array<{ content: Array<Record<string, unknown>> }>)[0]!
        .content
      expect(content).toHaveLength(2)
      expect(String(content[0]!.text)).toMatch(/^SOURCE CONTENT:/)
      expect(content[0]!.cache_control).toEqual({ type: 'ephemeral' })
      expect(String(content[1]!.text)).toMatch(/^DRAFT STEPS:/)
      expect(content[1]!.cache_control).toBeUndefined()
      const draft = JSON.parse(String(content[1]!.text).replace(/^DRAFT STEPS:\n/, ''))
      expect(draft).toEqual([
        { step_id: STEP_1, section: 'Isolate', kind: 'step', text: 'Isolate the pump at 45 Nm.' },
        { step_id: STEP_2, section: 'Isolate', kind: 'check', text: 'Confirm zero energy.' },
      ])
      const system = (h.anthropic.calls[0]!.system as Array<{ text: string }>)[0]!.text
      expect(system).toContain('step_id')
    } finally {
      h.restore()
    }
  })

  test('All five jobs A/B/C/D/E run live in one session (cache reused)', async () => {
    const hit = empty({
      input_tokens: 50,
      output_tokens: 5,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 500,
    })
    const h = setup(
      [
        empty({ input_tokens: 1000, output_tokens: 100, cache_creation_input_tokens: 500, cache_read_input_tokens: 0 }),
        hit,
        hit,
        hit,
        hit,
      ],
      {
        parseJob: { ...PARSE_JOB, id: 'parse-2' },
        spendRow: { spend_cents: 0, cap_cents: 500 },
        steps: STEPS,
        sections: SECTIONS,
      },
    )
    try {
      const envelope = await h.orchestrator.runReviewerJobs('parse-2', ['A', 'B', 'C', 'D', 'E'])
      expect(envelope.jobs_run).toEqual(['A', 'B', 'C', 'D', 'E'])
      for (const j of ['A', 'B', 'C', 'D', 'E']) expect(envelope.job_status?.[j]).toBe('ok')
      expect(h.anthropic.calls.length).toBe(5)
      expect(envelope.usage.cache_read_tokens).toBeGreaterThan(0)
    } finally {
      h.restore()
    }
  })

  test('Cap exceeded -> throws; nothing dispatched, nothing written', async () => {
    const h = setup([empty()], {
      parseJob: { ...PARSE_JOB, id: 'parse-3', organisation_id: 'org-2' },
      spendRow: { spend_cents: 500, cap_cents: 500 },
      steps: STEPS,
      sections: SECTIONS,
    })
    try {
      let threw: unknown = null
      try {
        await h.orchestrator.runReviewerJobs('parse-3', ['A'])
      } catch (e) {
        threw = e
      }
      expect(threw).not.toBeNull()
      expect((threw as Error).message).toMatch(/cap exhausted/i)
      expect(h.anthropic.calls.length).toBe(0)
      expect(h.supabase.parseJobUpdates.length).toBe(0)
      expect(h.supabase.spendUpserts.length).toBe(0)
      expect(h.supabase.findingInserts.length).toBe(0)
    } finally {
      h.restore()
    }
  })

  test('an unknown step_id becomes null; a real one is kept; rows land in sop_ai_findings', async () => {
    const flagsJson = JSON.stringify([
      { severity: 'critical', kind: 'table_fidelity', step_id: STEP_1, description: 'torque differs' },
      { severity: 'warning', kind: 'table_fidelity', step_id: 'not-a-real-step', description: 'x'.repeat(2000) },
    ])
    const h = setup(
      [{ content: [{ type: 'text', text: flagsJson }], usage: ZERO_USAGE }, empty()],
      { parseJob: PARSE_JOB, spendRow: { spend_cents: 0, cap_cents: 500 }, steps: STEPS, sections: SECTIONS },
    )
    try {
      const envelope = await h.orchestrator.runReviewerJobs('parse-1', ['D'])
      expect(envelope.flags.map((f: { step_id?: string }) => f.step_id)).toEqual([STEP_1, undefined])

      const rows = h.supabase.findingInserts
      expect(rows).toHaveLength(2)
      expect(rows[0]).toMatchObject({
        organisation_id: 'org-1',
        sop_id: SOP,
        run_id: envelope.run_id,
        job: 'D',
        kind: 'table_fidelity',
        severity: 'critical',
        step_id: STEP_1,
      })
      expect(rows[1]!.step_id).toBeNull()
      expect(String(rows[1]!.description).length).toBe(1000)
      expect(rows.every((r) => r.cleared_at === undefined)).toBe(true)
      // Previous OPEN rows are retired after the insert; cleared rows are not touched.
      expect(h.supabase.findingDeletes).toEqual(['sop_ai_findings'])
    } finally {
      h.restore()
    }
  })

  test('a SOP with no parse job runs only the draft-only jobs, on the draft alone', async () => {
    const h = setup([empty()], {
      parseJob: null,
      spendRow: { spend_cents: 0, cap_cents: 500 },
      steps: STEPS,
      sections: SECTIONS,
    })
    try {
      const envelope = await h.orchestrator.runReviewerForSop({
        sopId: SOP,
        organisationId: 'org-1',
        jobs: ['A', 'B', 'C', 'D', 'E'],
      })
      expect(envelope.parse_job_id).toBeNull()
      expect(envelope.jobs_run).toEqual(['D', 'E'])
      expect(h.anthropic.calls.length).toBe(2)
      for (const call of h.anthropic.calls) {
        const content = (call.messages as Array<{ content: Array<Record<string, unknown>> }>)[0]!.content
        expect(content).toHaveLength(1)
        expect(String(content[0]!.text)).toMatch(/^DRAFT STEPS:/)
        expect((call.system as Array<{ text: string }>)[0]!.text).toContain('NO source document')
      }
      // No parse job -> no envelope write.
      expect(h.supabase.parseJobUpdates.length).toBe(0)
    } finally {
      h.restore()
    }
  })

  test('an erroring job is stored as an open SOP-level job_error row, never as "no findings"', async () => {
    const h = setup([{ throws: 'overloaded' }, empty()], {
      parseJob: null,
      spendRow: { spend_cents: 0, cap_cents: 500 },
      steps: STEPS,
      sections: SECTIONS,
    })
    try {
      const envelope = await h.orchestrator.runReviewerForSop({ sopId: SOP, organisationId: 'org-1', jobs: ['D', 'E'] })
      expect(envelope.job_status).toMatchObject({ D: 'error', E: 'ok' })
      const rows = h.supabase.findingInserts
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ kind: 'job_error', job: 'D', step_id: null })
      expect(rows[0]!.cleared_at).toBeUndefined()
      expect(String(rows[0]!.description)).toMatch(/didn't run/)
    } finally {
      h.restore()
    }
  })

  test('a run with nothing to flag writes one system-cleared all_clear row', async () => {
    const h = setup([empty(), empty()], {
      parseJob: null,
      spendRow: { spend_cents: 0, cap_cents: 500 },
      steps: STEPS,
      sections: SECTIONS,
    })
    try {
      await h.orchestrator.runReviewerForSop({ sopId: SOP, organisationId: 'org-1', jobs: ['D', 'E'] })
      const rows = h.supabase.findingInserts
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ kind: 'all_clear', severity: 'warning', step_id: null })
      expect(typeof rows[0]!.cleared_at).toBe('string')
      expect(rows[0]!.cleared_by).toBeUndefined()
    } finally {
      h.restore()
    }
  })

  test('no source and no steps -> NothingToReviewError, nothing dispatched', async () => {
    const h = setup([empty()], {
      parseJob: null,
      spendRow: { spend_cents: 0, cap_cents: 500 },
      steps: [],
      sections: [],
    })
    try {
      let threw: unknown = null
      try {
        await h.orchestrator.runReviewerForSop({ sopId: SOP, organisationId: 'org-1', jobs: ['D', 'E'] })
      } catch (e) {
        threw = e
      }
      expect((threw as Error)?.name).toBe('NothingToReviewError')
      expect(h.anthropic.calls.length).toBe(0)
      expect(h.supabase.findingInserts.length).toBe(0)
    } finally {
      h.restore()
    }
  })
})
