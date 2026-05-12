/**
 * Phase 15 / Wave 0 — Anthropic SDK mock fixtures for voice Q&A tests.
 *
 * Used by:
 *   - tests/integration/voice-qa-happy-path.spec.ts (SB-LINE-03)
 *   - tests/integration/voice-grounding-scope.spec.ts (SB-LINE-04)
 *
 * Mirrors the shape of Phase 14 `tests/fixtures/anthropic-mock.ts` (verifier
 * mock) but exports two helpers: one for the answer call (claude-haiku-4-5)
 * and one for the verifier call. Both responses carry prompt-cache token
 * counts so the cache-correctness unit test (15-03-03) can assert
 * cache_read_input_tokens > 0 on the second question.
 *
 * NOTE: Wave 3 (plan 15-03) will flesh these out as the voice route ships.
 * For Wave 0 the shapes are stable enough that test scaffolds can import.
 */

export type VerificationFlag = {
  severity: 'warning' | 'critical' | 'notice'
  section_title: string
  original_text: string
  structured_text: string
  description: string
}

/**
 * Canned Anthropic SDK `messages.create` response for the answer call.
 * Sets `cache_creation_input_tokens` on first call and `cache_read_input_tokens`
 * on subsequent calls so cache hits are testable.
 */
export function mockAnswerCall(
  answer: string,
  citations: string[],
  opts: { cacheHit?: boolean } = {}
) {
  const cacheHit = opts.cacheHit ?? false
  return {
    id: `msg_mock_answer_${Math.random().toString(36).slice(2, 10)}`,
    type: 'message' as const,
    role: 'assistant' as const,
    model: 'claude-haiku-4-5-20251001',
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ answer, citations }),
      },
    ],
    stop_reason: 'end_turn' as const,
    stop_sequence: null,
    usage: {
      input_tokens: 200,
      output_tokens: 80,
      cache_creation_input_tokens: cacheHit ? 0 : 6000,
      cache_read_input_tokens: cacheHit ? 6000 : 0,
    },
  }
}

/**
 * Canned Anthropic SDK `messages.create` response for the verifier call.
 * Returns the JSON-stringified `VerificationFlag[]` in the assistant message.
 */
export function mockVerifierCall(flags: VerificationFlag[]) {
  return {
    id: `msg_mock_verify_${Math.random().toString(36).slice(2, 10)}`,
    type: 'message' as const,
    role: 'assistant' as const,
    model: 'claude-haiku-4-5-20251001',
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(flags),
      },
    ],
    stop_reason: 'end_turn' as const,
    stop_sequence: null,
    usage: {
      input_tokens: 250,
      output_tokens: 60,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 6000,
    },
  }
}

/**
 * Convenience preset for the SB-LINE-03 happy-path test:
 * "What PPE do I need for this procedure?" against the Visy ENF4-03-031 SOP.
 */
export const PPE_QUESTION_PRESET = {
  answer: mockAnswerCall(
    'You need heat-resistant gloves while handling the blank side hanger. The Hazards section calls out hot surfaces.',
    ['section:hazards']
  ),
  verifier: mockVerifierCall([]),
}

/**
 * Convenience preset for the SB-LINE-04 grounding-scope test:
 * "Can I use leather gloves instead?" — verifier should flag any
 * confident yes/no, forcing an "I'm not certain" response.
 */
export const ADVERSARIAL_QUESTION_PRESET = {
  answer: mockAnswerCall(
    "I'm not certain — the SOP doesn't specify whether leather gloves are an acceptable substitute. Please check with your supervisor.",
    []
  ),
  verifier: mockVerifierCall([]),
}
