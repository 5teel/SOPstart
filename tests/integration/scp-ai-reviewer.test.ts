/**
 * SCP-AI-01..08 — AI reviewer (Phase 21, Wave 3 LIVE).
 *
 * Plan 21-03 flipped the Wave-0 `test.fixme` stubs to LIVE source-contract
 * assertions.
 *
 * Browser fallback policy: the chromium binary required by `@playwright/test`
 * is NOT installed on this Windows machine (CLAUDE.md learning: Playwright
 * install is blocked by the corporate TLS cert intercept). Per the
 * project's standard Rule-3 downgrade pattern (mirrors Plan 21-02 +
 * Plans 15-01..04), the SCP-AI cases assert the source-contract guarantees
 * that the design promises — file existence, exported public surface,
 * Spike 003 fixture compatibility, single-call shape (D-21-11),
 * cache_control: ephemeral, per-day cap, per-org cap — instead of driving
 * a real browser. The deeper "fixture-runs-through-orchestrator" coverage
 * lives in `src/lib/parsers/ai-reviewer/jobs/__tests__/jobs.test.ts` and
 * `src/lib/parsers/ai-reviewer/__tests__/orchestrator.test.ts`.
 *
 * When chromium is available (Linux CI or any machine with
 * `npx playwright install chromium` working), a future browser-backed
 * suite will assert the end-to-end UX (parse → flag panel → click-to-jump)
 * on top of these contract assertions.
 *
 * Pre-locked design contract (see `.planning/phases/21-safety-critical-parsing/21-CONTEXT.md`):
 *   - D-CV2-05: reviewer = all five jobs (A hallucination, B omission, C anchoring,
 *     D table fidelity / safety completeness, E terminology / clarity).
 *   - D-21-03: all five jobs run in ONE HTTP session with cache_control: ephemeral
 *     on the shared source-content block.
 *   - D-21-11: SCP-AI-02 (anchoring) + SCP-AI-03 (alignment) served by Job C
 *     as a SINGLE LLM call returning both `suggested_step_id` and
 *     `alignment_concern` in one response.
 *   - D-21-13: per-day re-run cap (5/SOP/day) backed by `ai_review_rate_limits`
 *     table from Wave 1 migration 00032.
 *   - Spike 003 validated: max_tokens 1500-2000; "top 5 cap,
 *     ≤ 100-char descriptions" in system prompts; ~$0.06 per parse for B+C,
 *     ~$0.15 for all five at Sonnet.
 */
import { test, expect } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '..', '..')

function readFile(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf-8')
}

test.describe('SCP-AI — AI reviewer five-jobs (Phase 21)', () => {
  test('SCP-AI-01: Job B (omission) is implemented with Spike 003 verbosity caps', () => {
    // Acceptance: Job B reads source + parsed blocks and returns omission
    // flags; system prompt enforces "top 5" + "≤100 char" caps per
    // Spike 003 finding #2. The unit test
    // `src/lib/parsers/ai-reviewer/jobs/__tests__/jobs.test.ts` flexes the
    // parseResponse against the Spike 003 corrupted-fixture dropped-step
    // defect (matching expected-defects.json).
    expect(
      existsSync(resolve(ROOT, 'src/lib/parsers/ai-reviewer/jobs/job-b-omission.ts')),
      'job-b-omission.ts must exist',
    ).toBe(true)
    const src = readFile('src/lib/parsers/ai-reviewer/jobs/job-b-omission.ts')
    expect(src).toContain('OMISSION')
    expect(src.toLowerCase()).toContain('top 5')
    expect(src.toLowerCase()).toContain('100 char')
    expect(src).toContain("id: 'B'")
    expect(src).toMatch(/maxTokens:\s*(1500|2000)/)
  })

  test('SCP-AI-02 + SCP-AI-03: Job C is SINGLE LLM call returning both anchoring + alignment (D-21-11)', () => {
    // Acceptance (D-21-11 single-call shape): Job C system prompt asks for
    // BOTH facets in one response: (a) suggested_step_id when the photo is
    // attached to the wrong step, (b) alignment_concern: boolean when the
    // photo is visually misaligned with the step's action.
    expect(
      existsSync(resolve(ROOT, 'src/lib/parsers/ai-reviewer/jobs/job-c-anchoring.ts')),
      'job-c-anchoring.ts must exist',
    ).toBe(true)
    const src = readFile('src/lib/parsers/ai-reviewer/jobs/job-c-anchoring.ts')
    expect(src).toContain("id: 'C'")
    // SINGLE call: the file MUST NOT export a second job for alignment.
    expect(src.match(/export const JOB_/g)?.length ?? 0).toBe(1)
    // BOTH facets:
    expect(src.toLowerCase()).toContain('anchor')
    expect(src.toLowerCase()).toContain('alignment')
    expect(src).toContain('suggested_step_id')
    expect(src).toContain('alignment_concern')
    // Spike 003 verbosity cap:
    expect(src.toLowerCase()).toContain('top 5')
  })

  test('SCP-AI-04: Job D (table fidelity) enumerates numeric safety kinds', () => {
    expect(
      existsSync(resolve(ROOT, 'src/lib/parsers/ai-reviewer/jobs/job-d-table-fidelity.ts')),
      'job-d-table-fidelity.ts must exist',
    ).toBe(true)
    const src = readFile('src/lib/parsers/ai-reviewer/jobs/job-d-table-fidelity.ts')
    expect(src).toContain("id: 'D'")
    const lower = src.toLowerCase()
    expect(lower).toContain('dosage')
    expect(lower).toContain('torque')
    expect(lower).toContain('temperature')
    expect(lower).toContain('pressure')
    expect(lower).toContain('voltage')
    // Verbosity cap:
    expect(lower).toContain('top 5')
    expect(lower).toContain('100 char')
  })

  test('SCP-AI-05: Job E (terminology) injects org vocabulary into the prompt', () => {
    expect(
      existsSync(resolve(ROOT, 'src/lib/parsers/ai-reviewer/jobs/job-e-terminology.ts')),
      'job-e-terminology.ts must exist',
    ).toBe(true)
    const src = readFile('src/lib/parsers/ai-reviewer/jobs/job-e-terminology.ts')
    expect(src).toContain("id: 'E'")
    // Vocabulary fetched per-org and injected into the system prompt slot:
    expect(src).toContain('fetchOrgVocabulary')
    expect(src).toContain('buildJobESystemPrompt')
    expect(src).toContain('{{ORG_VOCABULARY}}')
    // Output shape includes the canonical suggested term:
    expect(src).toContain('suggested_term')
    expect(src).toContain('source_term')
    expect(src).toContain('draft_term')
  })

  test('SCP-AI-06: parse pipeline auto-triggers reviewer on completion (fire-and-forget)', () => {
    // Acceptance (SCP-AI-06 + SCP-PARSE-04): on parse-job completion, the
    // pipeline calls runReviewerJobs without awaiting. The parse-completion
    // response MUST NOT block on Anthropic latency.
    expect(
      existsSync(resolve(ROOT, 'src/lib/parsers/parse-pipeline.ts')),
      'parse-pipeline.ts must exist',
    ).toBe(true)
    const helper = readFile('src/lib/parsers/parse-pipeline.ts')
    expect(helper).toContain('triggerReviewerOnParseCompletion')
    expect(helper).toContain('runReviewerJobs')
    // CONV-12 carve-out:
    expect(helper).toContain('ai_prompt')
    // Wired into all four completion sites — each calls the helper
    // with `void` (fire-and-forget).
    for (const route of [
      'src/app/api/sops/parse/route.ts',
      'src/app/api/sops/restructure/route.ts',
      'src/app/api/sops/youtube/route.ts',
      'src/app/api/sops/transcribe/route.ts',
    ]) {
      const body = readFile(route)
      expect(
        body,
        `${route} must call triggerReviewerOnParseCompletion`,
      ).toContain('triggerReviewerOnParseCompletion')
      // The call MUST be fire-and-forget — we wrote `void
      // triggerReviewerOnParseCompletion` in each route file.
      expect(body).toContain('void triggerReviewerOnParseCompletion')
    }
  })

  test('SCP-AI-07: POST endpoint accepts jobs subset; admin auth gated', () => {
    expect(
      existsSync(resolve(ROOT, 'src/app/api/sops/[sopId]/ai-reviewer/route.ts')),
      'ai-reviewer/route.ts must exist',
    ).toBe(true)
    const route = readFile('src/app/api/sops/[sopId]/ai-reviewer/route.ts')
    expect(route).toContain('export async function POST')
    expect(route).toContain('export async function GET')
    // Zod-validated subset (T-21-03-02 mitigation):
    expect(route).toContain('ReviewerJobIdSchema')
    expect(route).toMatch(/z\.enum\(\[\s*'A',\s*'B',\s*'C',\s*'D',\s*'E'\s*\]\)/)
    // Admin auth gate:
    expect(route).toContain('assertAdminAuth')
    expect(route).toContain('safety_manager')
    // Default jobs = all five when body.jobs absent:
    expect(route).toContain("ALL_JOBS: ReviewerJobId[] = ['A', 'B', 'C', 'D', 'E']")
  })

  test('SCP-AI-08: per-day cap + per-org cap both return 429 with structured error codes', () => {
    // Per-day cap (CONV-09 / D-21-13):
    const rateLimit = readFile('src/app/api/sops/[sopId]/ai-reviewer/rate-limit.ts')
    expect(rateLimit).toContain('PerDayRunCapExceededError')
    expect(rateLimit).toMatch(/PER_DAY_CAP\s*=\s*5/)
    expect(rateLimit).toContain('assertWithinPerDayRunCap')
    expect(rateLimit).toContain('incrementPerDayRunCounter')
    // UTC-midnight rollover semantics:
    expect(rateLimit).toContain('isResetWindowExpired')
    expect(rateLimit).toContain('Date.UTC')

    // Route maps both 429 paths to structured error codes:
    const route = readFile('src/app/api/sops/[sopId]/ai-reviewer/route.ts')
    expect(route).toContain("error: 'per_day_cap'")
    expect(route).toContain("error: 'per_org_cap'")
    expect(route).toContain('OrgSpendCapExceededError')

    // Single-session cache_control: ephemeral on the source block (D-21-03):
    const orchestrator = readFile('src/lib/parsers/ai-reviewer/orchestrator.ts')
    expect(orchestrator).toContain("cache_control: { type: 'ephemeral' as const }")
    expect(orchestrator).toContain("JOB_ORDER: ReviewerJobId[] = ['A', 'B', 'C', 'D', 'E']")
    // Synthetic error flag (T-21-03-06 safety fail-safe):
    expect(orchestrator).toContain('syntheticErrorFlag')
  })
})
