/**
 * Phase 21 (Plan 21-01 Task 3) — AI reviewer orchestrator tests.
 *
 * Three tests:
 *  1. Job A runs end-to-end with a stubbed Anthropic; envelope has
 *     cache_create_tokens > 0 on first call (shared source block).
 *  2. Mixed run ['A', 'B'] — Job B is a Wave-3 stub that surfaces as
 *     NotImplementedError in job_status; envelope still completes with
 *     jobs_run = ['A'] and the A flags.
 *  3. assertOrgCapNotExceeded throws → orchestrator rethrows;
 *     recordOrgSpend is NOT called.
 *
 * Strategy: mock `getAnthropic` (via verify-sop module) and the supabase
 * admin client (via @/lib/supabase/admin) using `Module._cache` swap, which
 * is the existing pattern other __tests__ in this repo use.
 *
 * Note: these tests run under the new `phase21-ai-reviewer` Playwright project.
 */

import { test, expect } from '@playwright/test'
import { resolve as pathResolve } from 'node:path'

// We'll lazy-import the orchestrator inside each test AFTER swapping the
// mocked module entries, so the orchestrator's transitive imports resolve
// to our stubs.

type AnthropicStubResponse = {
  content: Array<{ type: 'text'; text: string }>
  usage: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens: number
    cache_read_input_tokens: number
  }
}

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
    transcript_text: string | null
    prompt_text?: string | null
  } | null
  spendRow?: { spend_cents: number; cap_cents: number | null } | null
  parseJobUpdates?: Array<Record<string, unknown>>
  spendUpserts?: Array<Record<string, unknown>>
}

function makeSupabaseStub(opts: SupabaseStubOpts) {
  const parseJobUpdates = opts.parseJobUpdates ?? []
  const spendUpserts = opts.spendUpserts ?? []

  function table(name: string) {
    // Each chain returns `this` so .select().eq().eq().maybeSingle() works.
    const chain: Record<string, unknown> = {}
    chain.select = () => chain
    chain.eq = () => chain
    chain.update = (vals: Record<string, unknown>) => {
      if (name === 'parse_jobs') parseJobUpdates.push(vals)
      return { eq: () => ({ }) }
    }
    chain.upsert = (vals: Record<string, unknown>) => {
      if (name === 'org_anthropic_spend') spendUpserts.push(vals)
      return { error: null }
    }
    chain.maybeSingle = async () => {
      if (name === 'parse_jobs') {
        return opts.parseJob === null
          ? { data: null, error: null }
          : { data: opts.parseJob, error: null }
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
  }
}

// Typed helpers around require/cache to keep the test runtime simple.
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
// Module path table — the test resolves via absolute filesystem paths since
// the `@/` ts-path alias is unavailable at Playwright's require() runtime.
// Resolved relative to __dirname so the test runs from any cwd.
const MODULE_PATHS: Record<string, string> = {
  '@/lib/parsers/verify-sop': pathResolve(__dirname, '..', '..', 'verify-sop.ts'),
  '@/lib/supabase/admin': pathResolve(__dirname, '..', '..', '..', 'supabase', 'admin.ts'),
  '@/lib/parsers/ai-reviewer/orchestrator': pathResolve(__dirname, '..', 'orchestrator.ts'),
  '@/lib/parsers/ai-reviewer/cost-guard': pathResolve(__dirname, '..', 'cost-guard.ts'),
}

function resolveFile(modulePath: string): string {
  const direct = MODULE_PATHS[modulePath]
  if (direct) return direct
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Module = require('node:module') as ModuleWithResolve
  return Module._resolveFilename(modulePath, require.main, false)
}

/**
 * Hot-swap a module's exports in require.cache so subsequent `import`s
 * resolve to our stubs. Returns the previous cache entry so we can restore.
 */
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

/** Force a re-evaluation of the orchestrator and cost-guard on next require(). */
function evictOrchestrator() {
  const cache = moduleCache()
  delete cache[resolveFile('@/lib/parsers/ai-reviewer/orchestrator')]
  delete cache[resolveFile('@/lib/parsers/ai-reviewer/cost-guard')]
}

test.describe('runReviewerJobs orchestrator', () => {
  test('Job A runs end-to-end; envelope reports cache_create_tokens', async () => {
    const anthropicStub = makeAnthropicStub([
      {
        content: [{ type: 'text', text: '[]' }],
        usage: {
          // Numbers chosen so total cost rounds to >= 1 cent — small fractional
          // costs round to 0 and skip the spendUpsert call. ~5000 output tokens
          // × $15/MTok ≈ $0.075 = 7-8 cents.
          input_tokens: 1000,
          output_tokens: 5000,
          cache_creation_input_tokens: 500,
          cache_read_input_tokens: 0,
        },
      },
    ])
    const supabaseStub = makeSupabaseStub({
      parseJob: {
        id: 'parse-1',
        organisation_id: 'org-1',
        transcript_text: 'short source content',
      },
      spendRow: { spend_cents: 0, cap_cents: 500 },
    })

    const restoreAnthropic = swapModule('@/lib/parsers/verify-sop', {
      getAnthropic: () => anthropicStub.client,
      VERIFY_MODEL: 'claude-3-5-haiku-test',
      ADVERSARIAL_SYSTEM: '(stub adversarial prompt)',
      PROMPT_VERIFY_SYSTEM: '',
    })
    const restoreSupabase = swapModule('@/lib/supabase/admin', {
      createAdminClient: () => supabaseStub,
    })

    try {
      evictOrchestrator()
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const orchestrator = require(MODULE_PATHS['@/lib/parsers/ai-reviewer/orchestrator']!)
      const envelope = await orchestrator.runReviewerJobs('parse-1', ['A'])

      expect(envelope.parse_job_id).toBe('parse-1')
      expect(envelope.jobs_run).toEqual(['A'])
      expect(envelope.usage.cache_create_tokens).toBe(500)
      expect(envelope.usage.input_tokens).toBe(1000)
      expect(envelope.job_status?.A).toBe('ok')
      expect(supabaseStub.parseJobUpdates.length).toBe(1)
      expect(supabaseStub.spendUpserts.length).toBe(1)
    } finally {
      restoreAnthropic()
      restoreSupabase()
      evictOrchestrator()
    }
  })

  test('All five jobs A/B/C/D/E run live in one session (Wave 3 — Plan 21-03)', async () => {
    // Wave 1 originally asserted these surfaced as `not_implemented`. Wave 3
    // (Plan 21-03) wired the live jobs, so we now assert the full A→B→C→D→E
    // dispatch produces ok statuses for each — proving D-21-03 single-session
    // ordering and confirming the stubs are gone.
    const anthropicStub = makeAnthropicStub([
      {
        content: [{ type: 'text', text: '[]' }],
        usage: {
          input_tokens: 1000,
          output_tokens: 100,
          cache_creation_input_tokens: 500,
          cache_read_input_tokens: 0,
        },
      },
      {
        content: [{ type: 'text', text: '[]' }],
        usage: {
          input_tokens: 50,
          output_tokens: 5,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 500,
        },
      },
      {
        content: [{ type: 'text', text: '[]' }],
        usage: {
          input_tokens: 50,
          output_tokens: 5,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 500,
        },
      },
      {
        content: [{ type: 'text', text: '[]' }],
        usage: {
          input_tokens: 50,
          output_tokens: 5,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 500,
        },
      },
      {
        content: [{ type: 'text', text: '[]' }],
        usage: {
          input_tokens: 50,
          output_tokens: 5,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 500,
        },
      },
    ])
    const supabaseStub = makeSupabaseStub({
      parseJob: {
        id: 'parse-2',
        organisation_id: 'org-1',
        transcript_text: 'src',
      },
      spendRow: { spend_cents: 0, cap_cents: 500 },
    })

    const restoreAnthropic = swapModule('@/lib/parsers/verify-sop', {
      getAnthropic: () => anthropicStub.client,
      VERIFY_MODEL: 'claude-3-5-haiku-test',
      ADVERSARIAL_SYSTEM: '(stub)',
      PROMPT_VERIFY_SYSTEM: '',
    })
    const restoreSupabase = swapModule('@/lib/supabase/admin', {
      createAdminClient: () => supabaseStub,
    })

    try {
      evictOrchestrator()
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const orchestrator = require(MODULE_PATHS['@/lib/parsers/ai-reviewer/orchestrator']!)
      const envelope = await orchestrator.runReviewerJobs('parse-2', [
        'A',
        'B',
        'C',
        'D',
        'E',
      ])

      expect(envelope.jobs_run).toEqual(['A', 'B', 'C', 'D', 'E'])
      expect(envelope.job_status?.A).toBe('ok')
      expect(envelope.job_status?.B).toBe('ok')
      expect(envelope.job_status?.C).toBe('ok')
      expect(envelope.job_status?.D).toBe('ok')
      expect(envelope.job_status?.E).toBe('ok')
      // 5 HTTP calls — one per job — proving single-session dispatch.
      expect(anthropicStub.calls.length).toBe(5)
      // cache_read_tokens should be non-zero — calls 2-5 hit the cached
      // source block per D-21-03 / Spike 003 finding #1.
      expect(envelope.usage.cache_read_tokens).toBeGreaterThan(0)
    } finally {
      restoreAnthropic()
      restoreSupabase()
      evictOrchestrator()
    }
  })

  test('Cap exceeded → throws; recordOrgSpend not called', async () => {
    const anthropicStub = makeAnthropicStub([
      {
        content: [{ type: 'text', text: '[]' }],
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
        },
      },
    ])
    const supabaseStub = makeSupabaseStub({
      parseJob: {
        id: 'parse-3',
        organisation_id: 'org-2',
        transcript_text: 'src',
      },
      // spend at cap — assertOrgCapNotExceeded should throw.
      spendRow: { spend_cents: 500, cap_cents: 500 },
    })

    const restoreAnthropic = swapModule('@/lib/parsers/verify-sop', {
      getAnthropic: () => anthropicStub.client,
      VERIFY_MODEL: 'claude-3-5-haiku-test',
      ADVERSARIAL_SYSTEM: '(stub)',
      PROMPT_VERIFY_SYSTEM: '',
    })
    const restoreSupabase = swapModule('@/lib/supabase/admin', {
      createAdminClient: () => supabaseStub,
    })

    try {
      evictOrchestrator()
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const orchestrator = require(MODULE_PATHS['@/lib/parsers/ai-reviewer/orchestrator']!)
      let threw: unknown = null
      try {
        await orchestrator.runReviewerJobs('parse-3', ['A'])
      } catch (e) {
        threw = e
      }
      expect(threw).not.toBeNull()
      expect((threw as Error).message).toMatch(/cap exhausted/i)

      // Crucial: no Anthropic call, no parse-job update, no spend upsert.
      expect(anthropicStub.calls.length).toBe(0)
      expect(supabaseStub.parseJobUpdates.length).toBe(0)
      expect(supabaseStub.spendUpserts.length).toBe(0)
    } finally {
      restoreAnthropic()
      restoreSupabase()
      evictOrchestrator()
    }
  })
})
