import Anthropic from '@anthropic-ai/sdk'
import type { ParsedSop } from '@/lib/validators/sop'
import type { VerificationFlag } from '@/types/sop'

// Lazy-initialized to avoid throwing at module load time during Next.js static analysis
let anthropic: Anthropic | null = null
function getAnthropic(): Anthropic {
  if (!anthropic) {
    anthropic = new Anthropic() // reads ANTHROPIC_API_KEY from env
  }
  return anthropic
}

const ADVERSARIAL_SYSTEM = `You are a safety auditor reviewing an AI-generated Standard Operating Procedure (SOP).
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

// Model selection: claude-3-5-haiku for cost (~$0.01/SOP).
// Override with ANTHROPIC_VERIFY_MODEL env var if needed.
const VERIFY_MODEL = process.env.ANTHROPIC_VERIFY_MODEL || 'claude-3-5-haiku-20241022'

export async function verifyTranscriptVsSop(
  transcriptText: string,
  parsedSop: ParsedSop,
): Promise<VerificationFlag[]> {
  try {
    const response = await getAnthropic().messages.create({
      model: VERIFY_MODEL,
      max_tokens: 2048,
      system: ADVERSARIAL_SYSTEM,
      messages: [{
        role: 'user',
        content: `SOURCE TRANSCRIPT:\n${transcriptText}\n\nSTRUCTURED SOP (JSON):\n${JSON.stringify(parsedSop, null, 2)}`,
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
