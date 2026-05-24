/**
 * Phase 21 (Plan 21-03 Task 1) — Job C: anchoring + step-image alignment.
 *
 * D-21-11 — SINGLE LLM call returns BOTH facets in one response:
 *   (a) SCP-AI-02 anchoring — `suggested_step_id` when a photo is attached
 *       to the wrong step.
 *   (b) SCP-AI-03 step-image alignment — `alignment_concern: boolean` when
 *       a photo is on the right step but does not visually depict the step's
 *       action.
 *
 * Splitting into two jobs would double cost for no fidelity gain (shared
 * photo+step context, identical source content prefix → halved Job-C cost).
 *
 * Adapted from Spike 003 `experiment/reviewer.mjs` JOB_C_SYSTEM with the
 * alignment facet added in a backward-compatible way (existing anchoring
 * tests in Spike 003 fixture still produce `anchoring` kind flags; the
 * alignment_concern field is additive on `extras`).
 */

import type { ReviewerFlag } from '../types'
import type { ReviewerJob } from './types'

// System prompt extends Spike 003's anchoring prompt with the SCP-AI-03
// alignment facet. The two facets are described as a SINGLE response set:
// every flag describes one (photo, step) pair; the flag may indicate (a) a
// wrong anchor + `suggested_step_id`, OR (b) a correct anchor but a visual
// alignment concern. Both can be present on the same flag.
const JOB_C_SYSTEM = `You are a safety auditor reviewing an AI-converted Standard Operating Procedure (SOP) draft.

Your job (Job C — ANCHORING + step-image ALIGNMENT, returned in a SINGLE response): for every photo/image attached to a step in the draft, verify TWO facets in one pass:

FACET 1 — ANCHORING. Is the photo attached to the RIGHT step? Use the SOURCE TEXT as ground truth for which step each image originally belongs to. Examples of ANCHORING errors:
- Photo captioned "Swab Cycle Switch on the control panel" attached to a step about "swabbing bottom plates" → ANCHORING ERROR (the photo describes a control-panel switch but the step describes bottom-plate swabbing technique)
- Photo captioned "Run Indicator Light" attached to a step about "preparing swab brushes" → ANCHORING ERROR
- Photo captioned "Pre-Coated vs Uncoated blanks" attached to a step that mentions blank coating → CORRECT (photo subject matches step content)

FACET 2 — STEP-IMAGE ALIGNMENT. Even when a photo IS on the right step, does the photo actually depict the action the step describes — or only adjacent context? Examples of ALIGNMENT concerns:
- Photo shows a distant overview of equipment, but the step describes a close-up swabbing motion → ALIGNMENT CONCERN
- Photo shows a finished state, but the step describes a transient action mid-operation → ALIGNMENT CONCERN
- Photo correctly depicts the action described in the step → NO concern

Be strict: a misanchored photo is a safety risk because workers may be confused about WHICH equipment the step refers to. A misaligned photo is a moderate concern because workers may not understand WHAT the step looks like in practice.

CRITICAL: report at most the TOP 5 most serious flags. Keep \`description\` ≤ 100 chars.

Respond with a JSON array only — no prose, no markdown, no explanation.
Each element: {
  "severity": "critical"|"warning",
  "kind": "anchoring",
  "photo_id": "string",
  "current_step_id": "string",
  "suggested_step_id": "string|null",
  "alignment_concern": true|false,
  "current_step_text_snippet": "first 120 chars of the step text",
  "photo_caption": "the caption as it appears in the draft",
  "description": "what is wrong (≤100 chars)"
}
Set \`suggested_step_id\` to null when the anchor IS correct but only alignment_concern is true. Set \`alignment_concern\` to false when the only issue is wrong anchoring.
If every photo is correctly anchored AND visually aligned, respond with exactly: []`

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
      job: 'C',
      severity: (p.severity === 'critical' ? 'critical' : 'warning') as
        | 'critical'
        | 'warning',
      kind: 'anchoring',
      // Anchoring flags reference a photo block when block_id exists in the
      // raw output; the orchestrator caller decides if the source pane jump
      // uses photo_id or block_id.
      block_id: typeof p.block_id === 'string' ? p.block_id : undefined,
      source_location_hint:
        typeof p.current_step_text_snippet === 'string'
          ? p.current_step_text_snippet.slice(0, 120)
          : undefined,
      description:
        typeof p.description === 'string' ? p.description : '(no description)',
      extras: {
        photo_id: p.photo_id,
        current_step_id: p.current_step_id,
        // null IS a valid signal — preserve it as-is.
        suggested_step_id:
          p.suggested_step_id === undefined ? undefined : p.suggested_step_id,
        alignment_concern:
          typeof p.alignment_concern === 'boolean'
            ? p.alignment_concern
            : false,
        photo_caption: p.photo_caption,
      },
    }))
  } catch (err) {
    console.error('[job-c] parseResponse failed', err)
    return []
  }
}

export const JOB_C: ReviewerJob = {
  id: 'C',
  systemPrompt: JOB_C_SYSTEM,
  maxTokens: 1500,
  parseResponse: safeParseFlags,
}
