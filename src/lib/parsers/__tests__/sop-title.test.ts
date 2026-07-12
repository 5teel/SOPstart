/**
 * Phase 27 — AIPS-TITLE-01 / AIPS-GAP-03: title-guard behavioral unit tests (static imports).
 *
 * Registered under the existing `phase20-parsers` Playwright project:
 *   testDir: './src/lib/parsers/__tests__'
 * This ensures Playwright's TS compiler resolves relative imports via static imports.
 *
 * CLAUDE.md 2026-04-24: dynamic import('@/...') fails in Playwright Node runner
 * outside a testDir-scoped project. Use STATIC imports here.
 *
 * Sources:
 *   - 27-RESEARCH.md § Code Examples — isPlaceholderTitle / titleFromFileName / ensureSopTitle (sop-title.ts:31-89)
 *   - 27-PATTERNS.md § src/lib/parsers/__tests__/sop-title.test.ts
 */
import { test, expect } from '@playwright/test'
import { isPlaceholderTitle, titleFromFileName, ensureSopTitle, TITLE_CONVENTIONS } from '../sop-title'

test.describe('sop-title — naming guard (pure functions)', () => {
  test('placeholder titles are detected', () => {
    expect(isPlaceholderTitle('Untitled SOP')).toBe(true)
    expect(isPlaceholderTitle('untitled')).toBe(true)
    expect(isPlaceholderTitle('')).toBe(true)
    expect(isPlaceholderTitle(null)).toBe(true)
    expect(isPlaceholderTitle('SOP')).toBe(true)
    expect(isPlaceholderTitle('Standard Operating Procedure')).toBe(true)
  })

  test('real titles pass through untouched', () => {
    expect(isPlaceholderTitle('Changing Neck Rings on 21 Machines')).toBe(false)
    expect(isPlaceholderTitle('Forklift Pre-Start Checks — Hamilton Site')).toBe(false)
  })

  test('filename fallback strips extension, doc codes, and version noise', () => {
    expect(titleFromFileName('EN-FOR-03-031 Blank Side Hanger Change_v2_FINAL.docx')).toBe(
      'Blank Side Hanger Change',
    )
    expect(titleFromFileName('Changing Baffles.doc')).toBe('Changing Baffles')
    expect(titleFromFileName(null)).toBe(null)
    expect(titleFromFileName('a.pdf')).toBe(null) // too short to be a title
  })

  test('conventions md file loads (agent instructions present)', () => {
    // The conventions file is the single agent-instruction source for naming —
    // if it goes missing the parser silently loses its title guidance.
    expect(TITLE_CONVENTIONS).toContain('SOP Title Naming Conventions')
    expect(TITLE_CONVENTIONS).toContain('Never include')
  })
})

// ---------------------------------------------------------------------------
// AIPS-TITLE-01 [fallback-chain]: ensureSopTitle()'s 3-rung fallback chain.
// The naming LLM call is deliberately forced to fail (no API key / unroutable
// model id — save/restore env, same pattern as registry.test.ts) so these
// tests are deterministic and never hit a real provider.
// ---------------------------------------------------------------------------

test.describe('AIPS-TITLE-01 — ensureSopTitle fallback chain', () => {
  test('AIPS-TITLE-01 [llm-title-kept]: a non-placeholder existing title is returned untouched (no LLM call)', async () => {
    const title = await ensureSopTitle({
      title: 'Changing Neck Rings on 21 Machines',
      extractedText: 'irrelevant',
      model: 'model-that-would-throw-if-called',
    })
    expect(title).toBe('Changing Neck Rings on 21 Machines')
  })

  test('AIPS-TITLE-01 [placeholder-to-filename]: placeholder title + failed naming call falls back to filename-derived title', async () => {
    const original = process.env.OPENAI_API_KEY
    try {
      delete process.env.OPENAI_API_KEY
      const title = await ensureSopTitle({
        title: 'Untitled SOP',
        extractedText: 'irrelevant excerpt',
        fileName: 'EN-FOR-03-031 Blank Side Hanger Change_v2_FINAL.docx',
        model: 'unroutable-test-model', // routes to openai adapter (no '/' , no 'claude' prefix)
      })
      expect(title).toBe('Blank Side Hanger Change')
    } finally {
      if (original === undefined) delete process.env.OPENAI_API_KEY
      else process.env.OPENAI_API_KEY = original
    }
  })

  test('AIPS-TITLE-01 [junk-no-filename]: placeholder title, failed naming call, and no filename falls back to "Untitled SOP"', async () => {
    const original = process.env.OPENAI_API_KEY
    try {
      delete process.env.OPENAI_API_KEY
      const title = await ensureSopTitle({
        title: '',
        extractedText: 'irrelevant excerpt',
        fileName: null,
        model: 'unroutable-test-model',
      })
      expect(title).toBe('Untitled SOP')
    } finally {
      if (original === undefined) delete process.env.OPENAI_API_KEY
      else process.env.OPENAI_API_KEY = original
    }
  })
})
