import Anthropic from '@anthropic-ai/sdk'
import type { ParsedSop } from '@/lib/validators/sop'
import type { VerificationFlag } from '@/types/sop'
import { aiModel } from '@/lib/ai/registry'

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

// Model IDs resolve through the AI model registry (src/lib/ai/registry.ts) —
// env-overridable, single source of truth (2026-06-02 model-rot learning).
// Phase 21 (Plan 21-01): VERIFY_MODEL exported for Job A of the AI reviewer.
export const VERIFY_MODEL = aiModel('draft-verify')

/**
 * Phase 14 D-02: opts.mode selects the verifier framing.
 * - 'transcript' (default): adversarial fidelity check against a source transcript (Phase 6 behaviour, byte-identical).
 * - 'prompt': plausibility / hallucination check against a short NL prompt (D-02). Used by /api/sops/ai-prompt.
 *
 * Backwards-compat: existing call sites `verifyTranscriptVsSop(text, parsed)` and
 * `verifyTranscriptVsSop(text, parsed, { mode: 'prompt' })` continue to work unchanged.
 */
export async function verifyTranscriptVsSop(
  sourceText: string,
  parsedOutput: ParsedSop,
  opts?: { mode?: 'transcript' | 'prompt' },
): Promise<VerificationFlag[]> {
  const mode = opts?.mode ?? 'transcript'

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
