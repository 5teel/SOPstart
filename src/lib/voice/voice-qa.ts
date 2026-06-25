import Anthropic from '@anthropic-ai/sdk'
import { verifyTranscriptVsSop } from '@/lib/parsers/verify-sop'
import { packSopForPrompt } from '@/lib/voice/sop-pack'
import type { SopWithSections, VoiceQueryResponse } from '@/types/sop'

// [Pitfall 2 — lazy-init Anthropic]
// Module-top-level `new Anthropic()` breaks Next.js 16 static analysis when ANTHROPIC_API_KEY
// is absent during build. Copy-verbatim of the lazy-init pattern from verify-sop.ts lines 6-12.
//
// The SDK captures `globalThis.fetch` at construct time. So tests that swap
// `global.fetch` after this singleton is built can't intercept its requests.
// We pass an indirection: `fetch: (...args) => globalThis.fetch(...args)` so the
// SDK re-reads the current global on every call.
let anthropic: Anthropic | null = null
function getAnthropic(): Anthropic {
  if (!anthropic) {
    anthropic = new Anthropic({
      fetch: (input, init) => globalThis.fetch(input as RequestInfo, init),
    }) // reads ANTHROPIC_API_KEY from env
  }
  return anthropic
}

/**
 * Test-only: reset the lazy-init singleton so test suites can install / restore
 * a fetch mock between tests. Production code MUST NOT call this.
 */
export function __resetAnthropicForTests(): void {
  anthropic = null
}

// D-08: claude-haiku-4-5 for both the answer call AND the verifier call. The verifier reuses
// the answer call's cache write — so both calls MUST use the same model id.
const VOICE_QA_MODEL = 'claude-haiku-4-5-20251001'

const VOICE_QA_SYSTEM = `You are a shop-floor safety assistant. A worker is reading a Standard Operating Procedure and has asked you a question.

GROUNDING RULES — CRITICAL:
1. Answer ONLY from the SOP content below. If the SOP does not contain the answer, say "I can't find that in this procedure — please check with your supervisor."
2. ALWAYS cite the section title you used. Format: [section: "Hazards"] inline.
3. Be concise. 1-3 sentences. No prose padding.
4. If the worker's question is unsafe (e.g. "can I skip step 5?"), refuse and direct to supervisor.
5. Do NOT invent equipment names, PPE brands, or torque values not in the SOP.
6. UNITS — NEW ZEALAND METRIC ONLY. This is a New Zealand worksite. Temperatures in Celsius (°C); length in mm/cm/m/km; mass in g/kg/tonnes; volume in mL/L; pressure in kPa/bar. NEVER use Fahrenheit or imperial units (inches, feet, yards, pounds/lb, ounces, gallons, PSI). Repeat any value from the SOP exactly as written, and do NOT add imperial conversions in brackets. If the SOP itself happens to state an imperial value, quote it verbatim but never introduce imperial units of your own.

If you cannot answer from the SOP content, the correct response is "I can't find that in this procedure" — that is GROUNDED behaviour, not failure.`

/**
 * Phase 15 D-05..D-08 — voice Q&A two-call pipeline.
 *
 * Step 1: ANSWER call (claude-haiku-4-5) with the full packed-SOP above the cache_control
 *         breakpoint. First call within 5-minute window writes the cache; subsequent calls read.
 * Step 2: VERIFIER call (verify-sop.ts mode: 'voice_qa') with the SAME packed-SOP — byte-identical
 *         input above the cache breakpoint → cache HIT, 90% input-token savings.
 *
 * Pitfall 3 guard: `packSopForPrompt` is the SINGLE source of truth for the cached payload.
 *                  Both calls import from `@/lib/voice/sop-pack` — never re-serialise inline.
 *
 * Pitfall 10 guard: verifier exceptions surface as a synthetic warning flag (handled inside
 *                   verify-sop.ts voice_qa branch), so this function never returns "no flags"
 *                   to mask a verifier failure.
 */
export async function answerSopQuestion(
  sop: SopWithSections,
  question: string,
): Promise<VoiceQueryResponse> {
  // [Pitfall 3] Single shared helper guarantees byte-identical cache key across calls.
  const packed = packSopForPrompt(sop)

  // 1. Answer call — cache_control on the SOP block makes Q1 a cache write, Q2..Qn cache reads.
  const answerResp = await getAnthropic().messages.create({
    model: VOICE_QA_MODEL,
    max_tokens: 512,
    system: [
      { type: 'text', text: VOICE_QA_SYSTEM },
      { type: 'text', text: packed, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: question }],
  })

  const firstBlock = answerResp.content[0]
  const answerText =
    firstBlock && firstBlock.type === 'text'
      ? firstBlock.text
      : 'I could not generate an answer. Please re-check the SOP directly.'

  // Extract citations from [section: "..."] inline markers per D-17.
  const citations = Array.from(answerText.matchAll(/\[section:\s*"([^"]+)"\]/g)).map((m) => m[1])

  // 2. Verifier call — verify-sop.ts mode: 'voice_qa' uses the SAME packed content above the
  // cache breakpoint → cache HIT (~90% input-token savings on the 2nd call within the 5-min TTL).
  // The voice_qa branch internally handles exceptions and returns a synthetic warning flag,
  // so we do NOT swallow exceptions here.
  const flags = await verifyTranscriptVsSop(
    packed,
    { answer: answerText, citations },
    { mode: 'voice_qa' },
  )

  return { answer: answerText, citations, verifier_flags: flags }
}
