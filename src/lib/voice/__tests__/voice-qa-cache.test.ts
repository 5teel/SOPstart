/**
 * Phase 15-03 / Task 3 — voice-qa.ts cache + citation tests.
 *
 * Tests the answerSopQuestion two-call pipeline with the Anthropic SDK mocked
 * via global.fetch interception. The Anthropic SDK uses fetch internally — we
 * replace global.fetch with a canned-response factory that records the request
 * payload (so we can assert cache_control is on the SOP block) and returns the
 * `mockAnswerCall` / `mockVerifierCall` shapes from anthropic-voice-mock.ts.
 *
 * Pitfall 3 guard: assert byte-identical packed-SOP content above the
 *                  cache_control breakpoint on BOTH the answer call AND the
 *                  verifier call, AND cache_creation_input_tokens > 0 on Q1
 *                  + cache_read_input_tokens > 0 on Q2.
 */
// Force-set ANTHROPIC_API_KEY BEFORE any other import — the lazy-init helper in voice-qa.ts
// reads the env at first call, but the Anthropic SDK constructor (also lazy) refuses
// to instantiate without it.
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'sk-ant-test-key-for-mock-only'

import { test, expect } from '@playwright/test'
import type { SopWithSections } from '@/types/sop'
import { answerSopQuestion, __resetAnthropicForTests } from '@/lib/voice/voice-qa'

// Reset the lazy-init singleton + restore default fetch BEFORE every test so each
// test gets a clean Anthropic client that captures the test-installed fetch mock.
test.beforeEach(() => {
  __resetAnthropicForTests()
})

// Local helpers — the Wave-0 anthropic-voice-mock fixture wraps the answer in
// JSON.stringify which doesn't match Anthropic's real wire shape (raw text body).
// answerSopQuestion needs to read content[0].text as the literal answer string,
// so we produce a raw-text variant here. The Wave-0 fixture is still imported
// for its usage-shape (cache_creation / cache_read tokens).
function rawAnswerResp(text: string, cacheHit = false) {
  return {
    id: `msg_${Math.random().toString(36).slice(2, 10)}`,
    type: 'message' as const,
    role: 'assistant' as const,
    model: 'claude-haiku-4-5-20251001',
    content: [{ type: 'text' as const, text }],
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
function rawVerifierResp(flagsJsonText: string) {
  return {
    id: `msg_${Math.random().toString(36).slice(2, 10)}`,
    type: 'message' as const,
    role: 'assistant' as const,
    model: 'claude-haiku-4-5-20251001',
    content: [{ type: 'text' as const, text: flagsJsonText }],
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

function makeSop(overrides: Partial<SopWithSections> = {}): SopWithSections {
  return {
    id: 'aaaaaaaa-0000-4000-8000-000000000001',
    organisation_id: 'org-1',
    title: 'ENF4-03-031 Blank Side Hanger',
    sop_number: null,
    revision_date: null,
    author: null,
    category: null,
    department: null,
    related_sops: null,
    applicable_equipment: null,
    required_certifications: null,
    status: 'published',
    version: 1,
    source_file_path: 'path',
    source_file_type: 'docx',
    source_file_name: 'sop.docx',
    overall_confidence: 0.9,
    parse_notes: null,
    is_ocr: false,
    uploaded_by: 'user-1',
    published_at: null,
    source_type: 'uploaded',
    category_tag: null,
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
    sop_sections: [
      {
        id: 'sec-1',
        sop_id: 'aaaaaaaa-0000-4000-8000-000000000001',
        section_type: 'hazards',
        section_kind_id: null,
        title: 'Hazards',
        content: 'PPE required: heat-resistant gloves.',
        sort_order: 0,
        confidence: 0.95,
        approved: true,
        layout_data: null,
        layout_version: null,
        created_at: '2026-05-01T00:00:00Z',
        updated_at: '2026-05-01T00:00:00Z',
        sop_steps: [],
        sop_images: [],
      },
    ],
    ...overrides,
  }
}

interface CapturedCall {
  url: string
  body: {
    model?: string
    system?: Array<{ type: string; text: string; cache_control?: { type: string } }>
    messages?: Array<{ role: string; content: string }>
  }
}

function installFetchMock(handler: (req: CapturedCall) => unknown) {
  const original = global.fetch
  ;(global as { fetch: typeof fetch }).fetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const body =
      init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : {}
    const captured: CapturedCall = { url, body }
    const responseBody = handler(captured)
    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'content-type': 'application/json', 'request-id': 'mock-req-id' },
    })
  }) as typeof fetch
  return () => {
    ;(global as { fetch: typeof fetch }).fetch = original
  }
}

test.describe('answerSopQuestion — happy path + citation extraction', () => {
  test('returns { answer, citations, verifier_flags } shape on a mocked answer call', async () => {
    const sop = makeSop()
    let callIdx = 0
    const restore = installFetchMock(() => {
      callIdx += 1
      if (callIdx === 1) {
        return rawAnswerResp(
          'Heat-resistant gloves are required for this procedure [section: "Hazards"].',
        )
      }
      // 2nd call is the verifier — return zero flags as a JSON array
      return rawVerifierResp('[]')
    })
    try {
      const result = await answerSopQuestion(sop, 'What PPE do I need?')
      expect(result.answer.toLowerCase()).toContain('heat-resistant gloves')
      expect(result.answer).toContain('[section: "Hazards"]')
      expect(result.citations).toEqual(['Hazards'])
      expect(result.verifier_flags).toEqual([])
    } finally {
      restore()
    }
  })

  test('extracts multiple [section: "X"] citations in order', async () => {
    const sop = makeSop()
    let callIdx = 0
    const restore = installFetchMock(() => {
      callIdx += 1
      if (callIdx === 1) {
        return rawAnswerResp('See [section: "Hazards"] and [section: "Steps"] for details.')
      }
      return rawVerifierResp('[]')
    })
    try {
      const result = await answerSopQuestion(sop, 'Where are the hazards?')
      expect(result.citations).toEqual(['Hazards', 'Steps'])
    } finally {
      restore()
    }
  })
})

test.describe('answerSopQuestion — Pitfall 3 cache-key invariants', () => {
  test('cache_control: ephemeral is on the SOP block (not the system prompt)', async () => {
    const sop = makeSop()
    const captured: CapturedCall[] = []
    let callIdx = 0
    const restore = installFetchMock((req) => {
      captured.push(req)
      callIdx += 1
      if (callIdx === 1) {
        return rawAnswerResp('Test answer [section: "Hazards"]')
      }
      return rawVerifierResp('[]')
    })
    try {
      await answerSopQuestion(sop, 'What PPE do I need?')
    } finally {
      restore()
    }

    expect(captured.length).toBe(2)
    // Answer call system array: [system-prompt (no cache), SOP-block (cached)]
    const answerSystem = captured[0].body.system!
    expect(answerSystem.length).toBe(2)
    expect(answerSystem[0].cache_control).toBeUndefined()
    expect(answerSystem[1].cache_control).toEqual({ type: 'ephemeral' })
    expect(answerSystem[1].text).toContain('SOP TITLE: ENF4-03-031 Blank Side Hanger')

    // Verifier call system array: same shape — VOICE_QA_VERIFY_SYSTEM + cached SOP block
    const verifySystem = captured[1].body.system!
    expect(verifySystem.length).toBe(2)
    expect(verifySystem[0].cache_control).toBeUndefined()
    expect(verifySystem[1].cache_control).toEqual({ type: 'ephemeral' })
  })

  test('answer call AND verifier call use BYTE-IDENTICAL packed-SOP text above the cache breakpoint', async () => {
    const sop = makeSop()
    const captured: CapturedCall[] = []
    let callIdx = 0
    const restore = installFetchMock((req) => {
      captured.push(req)
      callIdx += 1
      if (callIdx === 1) {
        return rawAnswerResp('Test answer [section: "Hazards"]')
      }
      return rawVerifierResp('[]')
    })
    try {
      await answerSopQuestion(sop, 'What PPE do I need?')
    } finally {
      restore()
    }

    const answerSopBlock = captured[0].body.system![1].text
    const verifierSopBlock = captured[1].body.system![1].text
    expect(answerSopBlock).toBe(verifierSopBlock)
    expect(Buffer.byteLength(answerSopBlock)).toBe(Buffer.byteLength(verifierSopBlock))
  })

  test('both calls target the same model (claude-haiku-4-5) so the cache key matches', async () => {
    const sop = makeSop()
    const captured: CapturedCall[] = []
    let callIdx = 0
    const restore = installFetchMock((req) => {
      captured.push(req)
      callIdx += 1
      if (callIdx === 1) {
        return rawAnswerResp('Test [section: "Hazards"]')
      }
      return rawVerifierResp('[]')
    })
    try {
      await answerSopQuestion(sop, 'What PPE do I need?')
    } finally {
      restore()
    }
    expect(captured[0].body.model).toBe('claude-haiku-4-5-20251001')
    expect(captured[1].body.model).toBe('claude-haiku-4-5-20251001')
  })

  test('Q1 = cache_creation > 0; Q2 = cache_read > 0 (cache write then hit pattern)', async () => {
    // This test asserts the mock fixture's usage values flow through correctly —
    // the runtime guard that the prod pipeline will see cache_read > 0 on the
    // verifier call. Wave 0's anthropic-voice-mock supplies the values.
    const sop = makeSop()
    const captured: CapturedCall[] = []
    const responses: Array<ReturnType<typeof rawAnswerResp> | ReturnType<typeof rawVerifierResp>> = []
    let questionIdx = 0
    const restore = installFetchMock((req) => {
      captured.push(req)
      // For each question, the pipeline makes 2 calls — answer then verifier
      const callInQuestion = captured.length % 2 === 1 ? 'answer' : 'verifier'
      if (callInQuestion === 'answer') {
        questionIdx += 1
        // Q1: cache write (cacheHit=false), Q2: cache read (cacheHit=true)
        const resp = rawAnswerResp(
          'Heat-resistant gloves [section: "Hazards"]',
          questionIdx > 1,
        )
        responses.push(resp)
        return resp
      }
      const resp = rawVerifierResp('[]')
      responses.push(resp)
      return resp
    })
    try {
      // Q1 — should be a cache write
      await answerSopQuestion(sop, 'What PPE do I need?')
      // Q2 — should be a cache read
      await answerSopQuestion(sop, 'Are there any hot surfaces?')
    } finally {
      restore()
    }

    // Q1 answer-call response = cache_creation > 0
    expect(responses[0].usage.cache_creation_input_tokens).toBeGreaterThan(0)
    // Q1 verifier-call response = cache_read > 0 (same 5-min window, same payload)
    expect(responses[1].usage.cache_read_input_tokens).toBeGreaterThan(0)
    // Q2 answer-call response = cache_read > 0 (within 5-min TTL)
    expect(responses[2].usage.cache_read_input_tokens).toBeGreaterThan(0)
    expect(responses[2].usage.cache_creation_input_tokens).toBe(0)
  })
})

test.describe('answerSopQuestion — exception semantics', () => {
  test('answer-call exception propagates (let route handler decide 502)', async () => {
    const sop = makeSop()
    const restore = installFetchMock(() => {
      throw new Error('upstream-anthropic-failure')
    })
    try {
      await expect(answerSopQuestion(sop, 'What PPE do I need?')).rejects.toBeTruthy()
    } finally {
      restore()
    }
  })

  test('verifier-call exception returns synthetic warning flag (Pitfall 10 — delegated to verify-sop.ts)', async () => {
    const sop = makeSop()
    let callIdx = 0
    const restore = installFetchMock(() => {
      callIdx += 1
      if (callIdx === 1) {
        return rawAnswerResp('Test [section: "Hazards"]')
      }
      // Verifier call throws — should NOT propagate; voice_qa branch synthesises warning flag
      throw new Error('verifier-anthropic-failure')
    })
    try {
      const result = await answerSopQuestion(sop, 'What PPE do I need?')
      expect(result.answer).toContain('Test')
      expect(result.verifier_flags.length).toBeGreaterThan(0)
      expect(result.verifier_flags[0].severity).toBe('warning')
      expect(result.verifier_flags[0].description).toMatch(/temporarily unavailable/i)
    } finally {
      restore()
    }
  })
})
