/**
 * Phase 27 — AIPS-REG-02 / AIPS-GAP-03: llm.ts routing behavioral unit tests (static imports).
 *
 * Registered under the `phase27-unit` Playwright project:
 *   testDir: './src/lib/ai/__tests__'
 * This ensures Playwright's TS compiler resolves @/ path aliases via static imports.
 *
 * CLAUDE.md 2026-04-24: dynamic import('@/...') fails in Playwright Node runner
 * outside a testDir-scoped project. Use STATIC @/ imports here.
 *
 * NEVER use `await import('@/lib/ai/llm')` here — it will fail at runtime
 * in the Playwright Node runner with "SyntaxError: Unexpected token 'export'".
 *
 * Sources:
 *   - 27-RESEARCH.md § Code Examples — providerForModel() / extractJson() (llm.ts:42-46, 118-133)
 *   - 27-PATTERNS.md § src/lib/ai/__tests__/registry.test.ts + llm-routing.test.ts
 */
import { test, expect } from '@playwright/test'
import { providerForModel, extractJson } from '@/lib/ai/llm'

// ---------------------------------------------------------------------------
// Behavioral test 1: providerForModel() routes by model-ID shape.
// ---------------------------------------------------------------------------

test(
  'AIPS-REG-02 [provider-shape]: providerForModel() routes openrouter/anthropic/openai by model-ID shape',
  async () => {
    expect(providerForModel('z-ai/glm-5.2')).toBe('openrouter')
    expect(providerForModel('claude-haiku-4-5-20251001')).toBe('anthropic')
    expect(providerForModel('gpt-4o-2024-08-06')).toBe('openai')
  },
)

// ---------------------------------------------------------------------------
// Behavioral test 2: extractJson() 3-stage fallback resolves raw / fenced /
// prose-wrapped JSON to the same parsed object.
// ---------------------------------------------------------------------------

test(
  'AIPS-REG-02 [extract-json]: extractJson() resolves raw, fenced, and prose-wrapped JSON to the same object',
  async () => {
    const expected = { foo: 'bar', n: 1 }

    const raw = JSON.stringify(expected)
    const fenced = '```json\n' + JSON.stringify(expected) + '\n```'
    const prose = `Sure, here's the result:\n${JSON.stringify(expected)}\nLet me know if you need anything else.`

    expect(extractJson(raw)).toEqual(expected)
    expect(extractJson(fenced)).toEqual(expected)
    expect(extractJson(prose)).toEqual(expected)
  },
)

// ---------------------------------------------------------------------------
// Behavioral test 3: extractJson() on garbage/non-JSON input returns null,
// never throws.
// ---------------------------------------------------------------------------

test(
  'AIPS-REG-02 [extract-json-garbage]: extractJson() returns null (not throw) on non-JSON input',
  async () => {
    expect(() => extractJson('this is not json at all, no braces here')).not.toThrow()
    expect(extractJson('this is not json at all, no braces here')).toBeNull()
    expect(extractJson('')).toBeNull()
  },
)
