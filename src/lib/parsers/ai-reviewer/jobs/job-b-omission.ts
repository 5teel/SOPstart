/**
 * Phase 21 (Plan 21-03 Task 1) — Job B: omission reverse-scan.
 *
 * Reads the SOURCE TEXT (shared cache block) and identifies safety-critical
 * content that is PRESENT in the source but MISSING from the structured
 * draft. Verbatim adaptation of Spike 003's `JOB_B_SYSTEM` prompt with the
 * Spike 003 finding #2 verbosity caps applied:
 *   - "report at most TOP 5"
 *   - "description ≤ 100 chars"
 *
 * Output schema (`ReviewerFlag.kind = 'omission'`):
 *   { severity, kind: 'omission', source_quote, source_location_hint,
 *     missing_from, description }
 *
 * D-21-03: invoked from the orchestrator in the canonical A → B → C → D → E
 * order; the shared source-content block is sent with cache_control:
 * ephemeral so this call (the 2nd in the session) hits the prompt cache.
 */

import type { ReviewerFlag } from '../types'
import type { ReviewerJob } from './types'

// Verbatim from Spike 003 `experiment/reviewer.mjs` JOB_B_SYSTEM with the
// "top 5" + "≤ 100 chars" caps already embedded. Do NOT loosen these caps
// — Spike 003 measured 7 KB+ runaway responses without them.
const JOB_B_SYSTEM = `You are a safety auditor reviewing an AI-converted Standard Operating Procedure (SOP) draft against its source document.

Your job (Job B — OMISSION reverse-scan): scan the SOURCE TEXT and identify any safety-critical content that is PRESENT in the source but MISSING from the structured draft.

A safety-critical omission is content that, if left out, could lead a worker to injury, equipment damage, or non-compliance. Examples:
- Hazard warnings (especially "Do not …" / "Never …" / "Serious injuries may result …" type warnings)
- Mandatory PPE that is named in the source
- Emergency procedures (E-STOP locations, what to do if X happens)
- Numerical thresholds with safety implications (temperatures, pressures, torques, frequencies)
- Required pre-checks / lockouts before starting a task
- Approved compound / material restrictions

NOT a safety-critical omission:
- General prose that paraphrases an existing draft step
- Administrative metadata (revision history, approval signatures, references to other documents)
- Decorative captions on images
- Examples / illustrations that don't add safety information beyond what the draft already contains

CRITICAL: report at most the TOP 5 most serious omissions. Skip simplification/paraphrase. Keep \`description\` ≤ 100 chars.

Respond with a JSON array only — no prose, no markdown, no explanation.
Each element: { "severity": "critical"|"warning", "kind": "omission", "source_quote": "exact quote from source (≤120 chars)", "source_location_hint": "page or section", "missing_from": "draft section title", "description": "what is omitted (≤100 chars)" }
If no safety-critical omissions found, respond with exactly: []`

function safeParseFlags(raw: string): ReviewerFlag[] {
  if (!raw || typeof raw !== 'string') return []
  const cleaned = raw
    .replace(/^```json?\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim()
  if (!cleaned || cleaned === '[]') return []
  try {
    const parsed = JSON.parse(cleaned) as Array<
      Partial<ReviewerFlag> & Record<string, unknown>
    >
    if (!Array.isArray(parsed)) return []
    return parsed.map((p) => ({
      job: 'B',
      severity: (p.severity === 'critical' ? 'critical' : 'warning') as
        | 'critical'
        | 'warning',
      kind: 'omission',
      block_id: typeof p.block_id === 'string' ? p.block_id : undefined,
      source_location_hint:
        typeof p.source_location_hint === 'string'
          ? p.source_location_hint
          : undefined,
      description:
        typeof p.description === 'string' ? p.description : '(no description)',
      extras: {
        source_quote: p.source_quote,
        missing_from: p.missing_from,
      },
    }))
  } catch (err) {
    console.error('[job-b] parseResponse failed', err)
    return []
  }
}

export const JOB_B: ReviewerJob = {
  id: 'B',
  systemPrompt: JOB_B_SYSTEM,
  maxTokens: 2000,
  parseResponse: safeParseFlags,
}
