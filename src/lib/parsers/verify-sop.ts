import Anthropic from '@anthropic-ai/sdk'
import type { ParsedSop } from '@/lib/validators/sop'
import type { VerificationFlag } from '@/types/sop'

// Lazy-initialized to avoid throwing at module load time during Next.js static analysis.
//
// Phase 15 — pass a fetch indirection so the SDK re-reads `globalThis.fetch` on every
// call (tests can swap the global; the cached singleton would otherwise hold the
// fetch reference captured at construction).
let anthropic: Anthropic | null = null
/**
 * Phase 21 (Plan 21-01): exported for the AI reviewer orchestrator
 * (src/lib/parsers/ai-reviewer/orchestrator.ts). DO NOT create a second
 * Anthropic instance there — share this lazy singleton so the fetch
 * indirection (Phase 15) is preserved and the SDK re-reads
 * globalThis.fetch on every call.
 */
export function getAnthropic(): Anthropic {
  if (!anthropic) {
    anthropic = new Anthropic({
      fetch: (input, init) => globalThis.fetch(input as RequestInfo, init),
    }) // reads ANTHROPIC_API_KEY from env
  }
  return anthropic
}

// Phase 14 D-02: prompt-mode verifier — the source is a short NL prompt, not a transcript.
// Framing shifts from "fidelity to source" (transcript mode) to "plausibility / hallucination check"
// (prompt mode). Same JSON-array output contract — both modes feed the same VerificationFlag[] consumer.
// Phase 21 (Plan 21-01): exported for Job A of the AI reviewer (job-a-hallucination.ts).
export const PROMPT_VERIFY_SYSTEM = `You are a safety auditor reviewing a Standard Operating Procedure draft generated from a user's short natural-language prompt.

The user's prompt is BRIEF — a one-sentence brief like "PPE check for forklift operators at our Hamilton site". The draft AI was instructed to apply MAXIMUM inference to flesh out hazards, PPE, steps, and emergency procedures. Reasonable inference is EXPECTED and CORRECT.

Your job is to find HALLUCINATIONS that a human reviewer would object to:
- Fake regulatory citations (made-up section numbers in the NZ HSE Act / HSWA, fabricated WorkSafe document IDs, invented AS/NZS standard numbers)
- Fabricated equipment model numbers, brand names, or part codes that the prompt did not mention
- Invented NZ locations, addresses, site names, or staff role titles that the prompt did not state
- PPE or hazards that CONTRADICT the prompt's stated industry (e.g. recommending "respirator for spray-paint fumes" when the prompt is about forklift operation — that is a contradiction, not inference)
- Internally inconsistent claims (a step references "Section 4.2" but no such subsection exists in the draft)

Do NOT flag content that was reasonably INFERRED from the prompt context. Examples of CORRECT inference (do not flag these):
- Inferring "high-vis vest" from a forklift prompt
- Inferring "steel-cap boots" from any industrial machinery prompt
- Inferring "eye protection" from a grinding / cutting / chemical-handling prompt
- Inferring NZ WorkSafe / AS/NZS standards as the regulatory frame for any NZ industrial procedure

Respond with a JSON array only. No prose, no markdown, no explanation.
Each element: { "severity": "critical"|"warning", "section_title": "string", "step_number": number|null, "original_text": "(prompt mode — reproduce the relevant phrase from the structured SOP being audited)", "structured_text": "what the SOP says", "description": "what is hallucinated and why" }
If no hallucinations found, respond with exactly: []`

// Phase 21 (Plan 21-01): exported for Job A of the AI reviewer
// (job-a-hallucination.ts). DO NOT duplicate this prompt text in the new
// reviewer — import it from here so the Phase 6 transcript-mode verifier
// and the new orchestrator share the source of truth.
export const ADVERSARIAL_SYSTEM = `You are a safety auditor reviewing an AI-generated Standard Operating Procedure (SOP).
Your job is to find discrepancies between the source transcript and the AI-structured SOP output.
Be adversarial — look for:
- Omitted safety information (hazard warnings, PPE requirements, emergency procedures)
- Changed numerical values (tolerances, temperatures, voltages, torques, pressures)
- Misattributed section content (step in wrong section, hazard listed as a tip)
- Paraphrased hazard warnings that lose meaning or weaken urgency
- Dropped PPE requirements or tools
- Added information not present in the source transcript

Respond with a JSON array only. No prose, no markdown, no explanation.
Each element: { "severity": "critical"|"warning", "section_title": "string", "step_number": number|null, "original_text": "exact quote from transcript", "structured_text": "what the SOP says", "description": "what is wrong" }
If no discrepancies found, respond with exactly: []`

// Phase 15 D-07: voice_qa-mode verifier — audits an answer string against a packed-SOP source.
// Source text is the byte-identical packSopForPrompt(sop) output (Pitfall 3 — same cache key as
// the answer call → cache HIT, 90% input-token savings).
//
// Prompt-tuning guidance (Pitfall 6): paraphrase from the SOP is OK; INVENTION is not. The verifier
// should not flag "wear heat-resistant gloves" when the SOP says "heat-resistant gloves required",
// but SHOULD flag "use leather gloves as a substitute" when the SOP says "heat-resistant gloves only".
const VOICE_QA_VERIFY_SYSTEM = `You are a safety auditor reviewing an answer that was generated in response to a worker's voice question about a Standard Operating Procedure.

Your job: confirm every claim in the answer is GROUNDED in the cited section of the SOP. The SOP content is provided in full below; the answer claims to cite specific sections.

GROUND TRUTH RULES:
- If a claim refers to PPE, hazards, tools, or steps NOT present in the cited section's text → flag it as ungrounded.
- If a claim adds detail (a brand name, a specific torque value, a temperature) that doesn't appear in the SOP → flag it.
- If the answer says "I don't know" or "this is not specified in the procedure" or "I'm not certain" → that is GROUNDED. Do not flag.
- If the answer cites a section that does not exist in the SOP → flag the entire answer as ungrounded.
- Reasonable paraphrase is OK. The answer may use different wording for the same fact: "wear gloves" / "use heat-resistant gloves" are equivalent if the SOP says "heat-resistant gloves are required". Be strict on safety specifics (PPE type, hazard class, lockout step) — those must match exactly or be paraphrased without adding new detail.
- If the answer suggests a substitution NOT in the SOP (e.g. "leather gloves as a substitute" when the SOP only lists "heat-resistant gloves"), flag it.

Respond with a JSON array only. No prose, no markdown.
Each element: { "severity": "critical"|"warning", "section_title": "string", "step_number": null, "original_text": "the unverified phrase from the answer", "structured_text": "what the cited section actually says", "description": "why this claim is not grounded in the cited section" }
If every claim is grounded, respond with exactly: []`

// Model selection: claude-haiku-4-5 for cost-effective verification.
// Override with ANTHROPIC_VERIFY_MODEL env var if needed.
// [2026-06-02] Updated from the now-retired `claude-3-5-haiku-20241022`, which
// Anthropic deprecated — every reviewer/verifier call returned
// `404 not_found_error: model: claude-3-5-haiku-20241022`. Now matches
// VOICE_QA_VERIFY_MODEL (the same current Haiku the voice-QA path already uses).
// Phase 21 (Plan 21-01): exported for Job A of the AI reviewer. Plan 21-03
// will A/B Sonnet vs Haiku for the full reviewer suite; this constant
// remains the Phase 6 transcript-mode default.
export const VERIFY_MODEL = process.env.ANTHROPIC_VERIFY_MODEL || 'claude-haiku-4-5-20251001'

// Phase 15 D-08: voice_qa uses claude-haiku-4-5 (same model as the answer call) so the
// answer-call cache write at this exact model is reused by the verifier-call cache read.
const VOICE_QA_VERIFY_MODEL = 'claude-haiku-4-5-20251001'

/**
 * Phase 14 D-02: opts.mode selects the verifier framing.
 * - 'transcript' (default): adversarial fidelity check against a source transcript (Phase 6 behaviour, byte-identical).
 * - 'prompt': plausibility / hallucination check against a short NL prompt (D-02). Used by /api/sops/ai-prompt.
 * - 'voice_qa' (Phase 15 D-07): grounding check on a voice answer. parsedOutput is `{ answer, citations }`
 *   (NOT a ParsedSop). sourceText is the packed-SOP string (byte-identical with the answer call's cache
 *   block → cache HIT). On Anthropic exception, returns a synthetic "Verification temporarily unavailable"
 *   warning flag (Pitfall 10 fail-safe to uncertainty), NEVER `[]`.
 *
 * Backwards-compat: existing call sites `verifyTranscriptVsSop(text, parsed)` and
 * `verifyTranscriptVsSop(text, parsed, { mode: 'prompt' })` continue to work unchanged.
 */
export async function verifyTranscriptVsSop(
  sourceText: string,
  parsedOutput: ParsedSop | { answer: string; citations: string[] },
  opts?: { mode?: 'transcript' | 'prompt' | 'voice_qa' },
): Promise<VerificationFlag[]> {
  const mode = opts?.mode ?? 'transcript'

  // [D-07 — voice_qa mode extension]
  if (mode === 'voice_qa') {
    const voiceOutput = parsedOutput as { answer: string; citations: string[] }
    // Nothing to verify against (empty / content-light SOP) → no claims can be
    // grounded or ungrounded, so return no flags. This ALSO avoids Anthropic's
    // 400 "cache_control cannot be set for empty text blocks", which otherwise
    // trips the synthetic "Verification temporarily unavailable" banner on
    // content-light SOPs (verified against the live API).
    if (!sourceText.trim()) return []
    try {
      const response = await getAnthropic().messages.create({
        model: VOICE_QA_VERIFY_MODEL,
        max_tokens: 2048,
        // System-array form with cache_control on the packed-SOP block — same content as the
        // answer call's cache block → cache HIT on the 2nd call within 5 minutes.
        system: [
          { type: 'text', text: VOICE_QA_VERIFY_SYSTEM },
          { type: 'text', text: sourceText, cache_control: { type: 'ephemeral' } },
        ],
        messages: [{
          role: 'user',
          content: `PROPOSED ANSWER:\n${voiceOutput.answer}\n\nCLAIMED CITATIONS: ${JSON.stringify(voiceOutput.citations)}`,
        }],
      })
      const text = response.content[0]?.type === 'text' ? response.content[0].text : '[]'
      const cleaned = text.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
      return JSON.parse(cleaned) as VerificationFlag[]
    } catch (err) {
      // [Pitfall 10 — fail-safe to uncertainty]
      // NEVER return [] here — that masks a verifier failure as "no flags" which is a safety regression.
      // Surface a synthetic warning so the modal renders the yellow Verification badge.
      console.error('voice_qa verifier exception:', err)
      return [{
        severity: 'warning',
        section_title: '(verification unavailable)',
        original_text: voiceOutput.answer ?? '',
        structured_text: '(verifier exception)',
        description: 'Verification temporarily unavailable — please re-check the SOP directly.',
      }]
    }
  }

  // Existing transcript / prompt modes — unchanged behaviour, plain `system: string` form.
  const parsedSop = parsedOutput as ParsedSop
  const systemPrompt = mode === 'prompt' ? PROMPT_VERIFY_SYSTEM : ADVERSARIAL_SYSTEM
  const sourceLabel = mode === 'prompt' ? 'SOURCE PROMPT' : 'SOURCE TRANSCRIPT'

  try {
    const response = await getAnthropic().messages.create({
      model: VERIFY_MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `${sourceLabel}:\n${sourceText}\n\nSTRUCTURED SOP (JSON):\n${JSON.stringify(parsedSop, null, 2)}`,
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
    // Strip any markdown code fence if the model wraps the JSON
    const cleaned = text.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
    return JSON.parse(cleaned) as VerificationFlag[]
  } catch (error) {
    // Verification failure is non-blocking — log and return empty (D-04 is additive, not gating)
    console.error('Adversarial verification failed:', error)
    return []
  }
}

/**
 * VID-07 / D-13: Detect missing hazards and/or PPE sections in the parsed SOP.
 * Returns verification flags for each missing section.
 */
export function detectMissingSections(parsedSop: ParsedSop): VerificationFlag[] {
  const flags: VerificationFlag[] = []
  const sectionTypes = parsedSop.sections.map((s) => s.type.toLowerCase())

  const hasHazards = sectionTypes.some((t) =>
    t.includes('hazard') || t.includes('danger') || t.includes('risk')
  )
  const hasPPE = sectionTypes.some((t) =>
    t.includes('ppe') || t.includes('personal protective') || t.includes('protective equipment')
  )

  if (!hasHazards) {
    flags.push({
      severity: 'warning',
      section_title: 'Hazards',
      original_text: '(not found in transcript)',
      structured_text: '(section absent)',
      description: 'No hazards section detected in this SOP.',
    })
  }

  if (!hasPPE) {
    flags.push({
      severity: 'warning',
      section_title: 'PPE',
      original_text: '(not found in transcript)',
      structured_text: '(section absent)',
      description: 'No PPE section detected in this SOP.',
    })
  }

  return flags
}

// Re-export the voice_qa verifier system prompt for tests that want to assert wording invariants
// without invoking Anthropic.
export { VOICE_QA_VERIFY_SYSTEM }
