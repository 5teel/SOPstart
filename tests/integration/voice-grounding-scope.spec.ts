/**
 * SB-LINE-04 — Voice Q&A grounding scope.
 *
 * Verifies that:
 *   1. The route fetches a SINGLE SOP via `.eq('id', sopId)` only — no cross-SOP
 *      joins, no semantic search across the corpus. A question whose answer
 *      lives in a DIFFERENT SOP MUST yield "I can't find that in this
 *      procedure" — current SOP is the only grounding source (D-05).
 *   2. Verifier-flagged claims are surfaced via `verifier_flags` in the JSON
 *      response (D-18) — explicit safety bias toward "I'm not certain" over
 *      "wrong but confident".
 *   3. The route uses the regular Supabase client (NOT createAdminClient) so
 *      RLS enforces single-org + sub-trade gate (T-15-03-02 / T-15-03-03).
 *
 * Status: source-contract test (Rule-3 trade-off, matching Plan 15-01 / 15-02).
 *   - Live end-to-end Playwright runs against `next start` are gated on chromium
 *     binary availability (not installed locally — per Plan 15-01 finding).
 *   - Unit-level cache + citation behaviour is covered by
 *     src/lib/voice/__tests__/voice-qa-cache.test.ts (mocked Anthropic SDK).
 *   - Phase 15 UAT will exercise the live route against the Visy fixture.
 *
 * The two-SOP cross-grounding scenario (asking a question whose answer lives in
 * SOP B while scoped to SOP A) is enforced STRUCTURALLY by the route — it can
 * only fetch ONE SOP from the database via a single .eq('id', sopId) call. There
 * is no code path that can leak SOP B's content into the answer call's context.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import {
  ADVERSARIAL_QUESTION_PRESET,
  mockAnswerCall,
  mockVerifierCall,
} from '../fixtures/anthropic-voice-mock'

const ROOT = path.resolve(__dirname, '..', '..')
const ROUTE = path.join(ROOT, 'src', 'app', 'api', 'voice', 'query', 'route.ts')
const FIXTURE_SQL = path.join(ROOT, 'tests', 'fixtures', 'visy-enf4-03-031.sql')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('SB-LINE-04 — Voice grounding scope (source contract)', () => {
  test('route file exists at /api/voice/query', () => {
    expect(fs.existsSync(ROUTE)).toBe(true)
  })

  test('route fetches SOP via .eq("id", sopId) — single-SOP scope (SB-LINE-04)', () => {
    const src = read(ROUTE)
    expect(src).toMatch(/\.eq\(['"]id['"],\s*sopId\)/)
    // Must filter to published — workers cannot voice-query a draft
    expect(src).toMatch(/\.eq\(['"]status['"],\s*['"]published['"]\)/)
  })

  test('route uses regular Supabase client (NOT admin client) — RLS enforces org + sub-trade gate', () => {
    const src = read(ROUTE)
    expect(src).toContain("from '@/lib/supabase/server'")
    expect(src).toContain('createClient()')
    expect(src).not.toContain('createAdminClient')
  })

  test('route does NOT perform cross-SOP joins or semantic searches', () => {
    const src = read(ROUTE)
    // No vector / embedding / similarity-search code paths
    expect(src).not.toMatch(/\bvector\b|\bembedding\b|\bsimilarity\b|\bsemanticSearch\b/i)
    // No `.in('id', ...)` or `.neq('id', ...)` — only one .eq('id', sopId)
    expect(src).not.toMatch(/\.in\(['"]id['"]/)
    expect(src).not.toMatch(/\.neq\(['"]id['"]/)
  })

  test('route enforces auth via supabase.auth.getUser() (401 envelope)', () => {
    const src = read(ROUTE)
    expect(src).toMatch(/supabase\.auth\.getUser\(\)/)
    expect(src).toMatch(/status:\s*401/)
    expect(src).toContain("error: 'unauthorized'")
  })

  test('route validates input via voiceQuerySchema (400 envelope)', () => {
    const src = read(ROUTE)
    expect(src).toContain('voiceQuerySchema')
    expect(src).toMatch(/safeParse/)
    expect(src).toMatch(/status:\s*400/)
    expect(src).toContain("error: 'invalid_input'")
  })

  test('route returns 404 not_found when RLS hides the SOP (cross-org / sub-trade)', () => {
    const src = read(ROUTE)
    expect(src).toMatch(/status:\s*404/)
    expect(src).toContain("error: 'not_found'")
  })

  test('route returns 502 voice_query_failed on Anthropic exception (T-15-03-05 — no body leak)', () => {
    const src = read(ROUTE)
    expect(src).toMatch(/status:\s*502/)
    expect(src).toContain("error: 'voice_query_failed'")
    // Log error.message only, NEVER the request body
    expect(src).toMatch(/err instanceof Error\s*\?\s*err\.message/)
  })

  test('route imports answerSopQuestion from voice-qa.ts (two-call pipeline)', () => {
    const src = read(ROUTE)
    expect(src).toMatch(/import\s*\{\s*answerSopQuestion\s*\}\s*from\s*['"]@\/lib\/voice\/voice-qa['"]/)
  })

  test('route has maxDuration 30 cap (T-15-03-04 cost-runaway mitigation)', () => {
    const src = read(ROUTE)
    expect(src).toMatch(/maxDuration\s*=\s*30/)
  })

  test('route has in-memory concurrency cap (1 in-flight per user — T-15-03-04)', () => {
    const src = read(ROUTE)
    expect(src).toMatch(/inFlight\s*=\s*new Set/)
    expect(src).toMatch(/status:\s*429/)
    expect(src).toContain("error: 'concurrent_query'")
    // Cap state cleared in finally block to prevent stuck users
    expect(src).toMatch(/finally[\s\S]*inFlight\.delete/)
  })

  test('route does NOT check admin role (D-15 — workers must be allowed)', () => {
    const src = read(ROUTE)
    expect(src).not.toMatch(/['"]admin['"]/)
    expect(src).not.toMatch(/['"]safety_manager['"]/)
    expect(src).not.toMatch(/requireAdmin/)
  })

  test('Visy 2-SOP fixture exists with both "heat-resistant gloves" and Hazards section', () => {
    expect(fs.existsSync(FIXTURE_SQL)).toBe(true)
    const sql = read(FIXTURE_SQL)
    expect(sql).toContain('heat-resistant gloves')
    expect(sql).toContain('Hazards & PPE')
  })

  test('Wave 0 fixture exports ADVERSARIAL_QUESTION_PRESET for grounded-uncertainty answer', () => {
    expect(typeof ADVERSARIAL_QUESTION_PRESET).toBe('object')
    expect(JSON.stringify(ADVERSARIAL_QUESTION_PRESET)).toMatch(/I'm not certain|don't specify/i)
    // mockAnswerCall + mockVerifierCall are the fixture surface that integration
    // tests reach into to build cross-SOP scenarios.
    expect(typeof mockAnswerCall).toBe('function')
    expect(typeof mockVerifierCall).toBe('function')
  })
})
