/**
 * Phase 21 (Plan 21-03 Task 1) — Job D: table / numeric fidelity.
 *
 * Compares every numerical value in the structured SOP against the source.
 * A torque-spec error or dosage transposition can injure workers, so EVERY
 * numeric mismatch is severity='critical'.
 *
 * Coverage: dosages, torques, temperatures, pressures, voltages, time
 * durations, pH values, percentages (per plan 21-03 spec). Unit-aware:
 * "10 Nm" vs "10 N·m" is NOT a defect; "10 Nm" vs "100 Nm" IS.
 *
 * D-21-03: shared source-content block reused via prompt cache; this call
 * is the 4th in the A→B→C→D→E session and benefits from cache_read.
 */

import type { ReviewerFlag } from '../types'
import type { ReviewerJob } from './types'

const JOB_D_SYSTEM = `You are a safety auditor reviewing an AI-converted Standard Operating Procedure (SOP) draft against its source document.

Your job (Job D — TABLE / NUMERIC FIDELITY): compare every numerical value that appears in the structured draft against the source. Flag any of the following kinds of numeric mismatches:

- Dosages (mg, mL, ppm, units per kg)
- Torques (Nm, ft-lb, in-lb)
- Temperatures (°C, °F, K)
- Pressures (bar, psi, kPa, MPa)
- Voltages, currents, frequencies (V, A, Hz)
- Time durations (seconds, minutes, hours, "for N cycles")
- pH values
- Percentages and ratios (%, "1:N", ppm)
- Physical dimensions (mm, cm, m, inches, feet)
- Counts / multiplicities (number of bolts, number of layers, number of repetitions)

Be unit-aware:
- "10 Nm" vs "10 N·m" is NOT a defect (same unit, formatting difference).
- "10 Nm" vs "100 Nm" IS a defect (10× difference).
- "50 mg" vs "0.05 g" is NOT a defect (same value, different unit).
- "50 mg" vs "5 mg" IS a defect.
- Rounding within ±2% is acceptable (e.g. source "104 °C" vs draft "100 °C" is borderline; flag only if the rounding crosses a safety threshold the source defines).

EVERY mismatch on a safety-critical specification is severity='critical'. Cosmetic units differences should NOT be reported.

CRITICAL: report at most the TOP 5 most serious mismatches. Keep \`description\` ≤ 100 chars.

Respond with a JSON array only — no prose, no markdown, no explanation.
Each element: {
  "severity": "critical"|"warning",
  "kind": "table_fidelity",
  "source_quote": "exact numeric phrase from source (≤120 chars)",
  "draft_quote": "exact numeric phrase from draft (≤120 chars)",
  "source_location_hint": "page or section",
  "block_id": "draft block id if identifiable, else null",
  "description": "what differs (≤100 chars)"
}
If every numeric value matches the source within tolerance, respond with exactly: []`

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
      job: 'D',
      severity: (p.severity === 'critical' ? 'critical' : 'warning') as
        | 'critical'
        | 'warning',
      kind: 'table_fidelity',
      block_id: typeof p.block_id === 'string' ? p.block_id : undefined,
      source_location_hint:
        typeof p.source_location_hint === 'string'
          ? p.source_location_hint
          : undefined,
      description:
        typeof p.description === 'string' ? p.description : '(no description)',
      extras: {
        source_quote: p.source_quote,
        draft_quote: p.draft_quote,
      },
    }))
  } catch (err) {
    console.error('[job-d] parseResponse failed', err)
    return []
  }
}

export const JOB_D: ReviewerJob = {
  id: 'D',
  systemPrompt: JOB_D_SYSTEM,
  maxTokens: 1500,
  parseResponse: safeParseFlags,
}
