/**
 * Phase 21 (Plan 21-01 Task 3) — Job A: hallucination detection.
 *
 * Wraps the Phase 6 `ADVERSARIAL_SYSTEM` prompt from `verify-sop.ts`. The
 * prompt text is NOT duplicated — it's imported from the existing module
 * (refactored to `export`-able in this plan). The Phase 6 callers continue
 * to work unchanged; this is an additive new path.
 */

import { ADVERSARIAL_SYSTEM } from '@/lib/parsers/verify-sop'
import type { ReviewerFlag } from '../types'
import type { ReviewerJob } from './types'

function safeParseFlags(raw: string): ReviewerFlag[] {
  if (!raw || typeof raw !== 'string') return []
  // Strip ```json … ``` fences if the model wrapped output.
  const cleaned = raw
    .replace(/^```json?\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim()
  if (!cleaned || cleaned === '[]') return []
  try {
    const parsed = JSON.parse(cleaned) as Array<Partial<ReviewerFlag> & Record<string, unknown>>
    if (!Array.isArray(parsed)) return []
    return parsed.map((p) => ({
      job: 'A',
      severity: (p.severity === 'critical' ? 'critical' : 'warning') as 'critical' | 'warning',
      kind: 'hallucination',
      block_id: typeof p.block_id === 'string' ? p.block_id : undefined,
      source_location_hint:
        typeof p.section_title === 'string'
          ? `${p.section_title}${p.step_number != null ? ` step ${p.step_number}` : ''}`
          : undefined,
      description: typeof p.description === 'string' ? p.description : '(no description)',
      extras: {
        original_text: p.original_text,
        structured_text: p.structured_text,
      },
    }))
  } catch (err) {
    console.error('[job-a] parseResponse failed', err)
    return []
  }
}

export const JOB_A: ReviewerJob = {
  id: 'A',
  systemPrompt: ADVERSARIAL_SYSTEM,
  maxTokens: 2000,
  parseResponse: safeParseFlags,
}
