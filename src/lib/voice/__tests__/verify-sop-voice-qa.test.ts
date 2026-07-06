/**
 * Phase 15-03 / Task 2 — verify-sop.ts mode: 'voice_qa' tests.
 *
 * Test strategy: this file exercises the public surface of verifyTranscriptVsSop
 * in voice_qa mode without mocking the Anthropic SDK module (project has no
 * vitest/jest module-mocking harness; Playwright is the only test runner).
 *
 * - Structural invariants on VOICE_QA_VERIFY_SYSTEM (Pitfall 6 prompt-tuning guards)
 * - Fail-safe behaviour (Pitfall 10): when Anthropic throws because no API key is
 *   present at call time, the voice_qa branch returns the synthetic warning flag
 *   (NOT []), and the transcript branch returns []
 *
 * Live mocked Anthropic happy-path tests live in voice-qa-cache.test.ts (Task 3).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { verifyTranscriptVsSop, VOICE_QA_VERIFY_SYSTEM } from '@/lib/parsers/verify-sop'

const ROOT = path.resolve(__dirname, '..', '..', '..', '..')
const VERIFY_SOP = path.join(ROOT, 'src', 'lib', 'parsers', 'verify-sop.ts')

test.describe('verify-sop.ts — Pitfall 6 prompt-tuning invariants on VOICE_QA_VERIFY_SYSTEM', () => {
  test('prompt explicitly permits "I\'m not certain" / "I don\'t know" responses', () => {
    // TRUE NEGATIVE — not-found uncertainty must NOT be flaggable
    expect(VOICE_QA_VERIFY_SYSTEM).toMatch(/I'm not certain|I don't know|not specified/i)
    expect(VOICE_QA_VERIFY_SYSTEM).toMatch(/GROUNDED.*Do not flag|Do not flag/i)
  })

  test('prompt explicitly permits paraphrase (the "wear gloves" / "heat-resistant gloves" equivalence)', () => {
    // FALSE POSITIVE TO AVOID — paraphrase from the SOP must pass
    expect(VOICE_QA_VERIFY_SYSTEM).toMatch(/paraphrase/i)
  })

  test('prompt explicitly flags invention (added detail / substitutions not in the SOP)', () => {
    // TRUE POSITIVE — invention / substitution must be caught
    expect(VOICE_QA_VERIFY_SYSTEM).toMatch(/adds detail|invent|substitution|leather gloves/i)
  })

  test('prompt requires JSON array output (existing-contract guard)', () => {
    expect(VOICE_QA_VERIFY_SYSTEM).toMatch(/JSON array only/i)
    expect(VOICE_QA_VERIFY_SYSTEM).toMatch(/severity/)
    expect(VOICE_QA_VERIFY_SYSTEM).toMatch(/critical.*warning|"critical"\|"warning"/)
  })
})

test.describe('verify-sop.ts — source contract for the voice_qa extension', () => {
  function read(p: string): string {
    return fs.readFileSync(p, 'utf-8')
  }

  test('VOICE_QA_VERIFY_SYSTEM constant declared and used in the voice_qa branch', () => {
    const src = read(VERIFY_SOP)
    // Declaration
    expect(src).toMatch(/const VOICE_QA_VERIFY_SYSTEM = /)
    // Used inside the mode-branch system array
    expect(src).toMatch(/text: VOICE_QA_VERIFY_SYSTEM/)
  })

  test("'voice_qa' appears in the mode union AND as a branch discriminator", () => {
    const src = read(VERIFY_SOP)
    // Mode union
    expect(src).toMatch(/'transcript'\s*\|\s*'prompt'\s*\|\s*'voice_qa'/)
    // Branch
    expect(src).toMatch(/mode === 'voice_qa'/)
  })

  test('cache_control: ephemeral applied to the packed-SOP block on the verifier call', () => {
    const src = read(VERIFY_SOP)
    expect(src).toMatch(/cache_control:\s*\{\s*type:\s*['"]ephemeral['"]\s*\}/)
  })

  test('fail-safe synthetic warning present (Pitfall 10 — NEVER return [] on voice_qa exception)', () => {
    const src = read(VERIFY_SOP)
    expect(src).toMatch(/Verification temporarily unavailable/)
    // Fail-safe path must be inside the voice_qa branch
    expect(src).toMatch(/voice_qa verifier exception/)
  })

  test('existing PROMPT_VERIFY_SYSTEM and ADVERSARIAL_SYSTEM constants preserved (no regression)', () => {
    const src = read(VERIFY_SOP)
    expect(src).toMatch(/const PROMPT_VERIFY_SYSTEM = /)
    expect(src).toMatch(/const ADVERSARIAL_SYSTEM = /)
  })

  test('voice_qa verifier resolves its model via the shared voice-qa registry key (D-08 cache reuse)', () => {
    const src = read(VERIFY_SOP)
    // Same registry key as the answer call in voice-qa.ts — guarantees both
    // calls share one model ID so the verifier reuses the answer's cache write.
    expect(src).toMatch(/VOICE_QA_VERIFY_MODEL = aiModel\('voice-qa'\)/)
  })
})

test.describe('verify-sop.ts — fail-safe runtime path (Pitfall 10)', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY

  test.afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY
    } else {
      process.env.ANTHROPIC_API_KEY = originalKey
    }
  })

  test('voice_qa mode returns synthetic warning flag when Anthropic throws (NOT [])', async () => {
    // Force the Anthropic SDK to throw by giving it an obviously bogus key + URL.
    // The lazy-init helper instantiates with these env values; the messages.create call
    // either fails the network request, fails auth, or fails URL parsing — any of which
    // exercises the catch branch.
    process.env.ANTHROPIC_API_KEY = 'sk-ant-bogus-key-for-test-only'
    // Point base URL at a non-routable host to guarantee failure in < 1s
    process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:1'
    try {
      const flags = await verifyTranscriptVsSop(
        'SOP TITLE: Test\nSOP VERSION: 1\n\n## Hazards [type=hazards]\n',
        { answer: 'Test answer', citations: ['Hazards'] },
        { mode: 'voice_qa' },
      )
      // Pitfall 10 — synthetic warning, NEVER []
      expect(flags.length).toBeGreaterThan(0)
      expect(flags[0].severity).toBe('warning')
      expect(flags[0].description).toMatch(/temporarily unavailable/i)
      expect(flags[0].section_title).toMatch(/verification unavailable/i)
    } finally {
      delete process.env.ANTHROPIC_BASE_URL
    }
  })
})
