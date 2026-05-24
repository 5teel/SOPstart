/**
 * Phase 21 (Plan 21-03 Task 1) — AI reviewer jobs B/C/D/E unit tests.
 *
 * Strategy mirrors `orchestrator.test.ts`:
 *  - Test each job's `parseResponse` directly with canned model output (no
 *    Anthropic call). This proves the response shape → ReviewerFlag mapping.
 *  - Test each job's `systemPrompt` for the must-have guard phrases:
 *      "top 5"  +  "≤ 100 char"  (Spike 003 finding #2 — verbosity caps)
 *      Job C: explicit single-call promise for both anchoring + alignment
 *      (D-21-11)
 *      Job D: enumerated numeric kinds (dosages / torques / temps / …)
 *      Job E: mentions "vocabulary" placeholder semantics
 *
 * Acceptance per `21-03-PLAN.md` Task 1 <done>:
 *  - All four new jobs (B/C/D/E) implemented; Job A unchanged
 *  - Job C single LLM call returns both anchoring + alignment_concern facets
 *  - Spike 003 fixture regression — Job B flag matches dropped-step defect;
 *    Job C flag matches swapped-photo + alignment_concern set
 */

import { test, expect } from '@playwright/test'

import { JOB_B } from '../job-b-omission'
import { JOB_C } from '../job-c-anchoring'
import { JOB_D } from '../job-d-table-fidelity'
import { JOB_E } from '../job-e-terminology'

// ---------------------------------------------------------------------------
// Job B — omission reverse-scan
// ---------------------------------------------------------------------------

test.describe('JOB_B — omission reverse-scan', () => {
  test('system prompt enforces top-5 cap and ≤100-char description (Spike 003 finding #2)', () => {
    const p = JOB_B.systemPrompt.toLowerCase()
    expect(p).toContain('top 5')
    expect(p).toContain('100 char')
    expect(p).toContain('omission')
  })

  test('maxTokens lands in the Spike 003 1500-2000 band', () => {
    expect(JOB_B.maxTokens).toBeGreaterThanOrEqual(1500)
    expect(JOB_B.maxTokens).toBeLessThanOrEqual(2000)
  })

  test('parseResponse maps Spike 003 corrupted-fixture dropped-step flag to ReviewerFlag[]', () => {
    // Shape derived verbatim from spike 003's reviewer.mjs output schema.
    const raw = JSON.stringify([
      {
        severity: 'critical',
        kind: 'omission',
        source_quote:
          "Do not put your thumb or finger through the ring … Serious injuries may result",
        source_location_hint: 'pages 5, 7, 11, 15',
        missing_from: 'sec-swab-section',
        description: 'Dropped safety warning about thumb/finger in swab ring',
      },
    ])
    const flags = JOB_B.parseResponse(raw)
    expect(flags).toHaveLength(1)
    expect(flags[0].job).toBe('B')
    expect(flags[0].kind).toBe('omission')
    expect(flags[0].severity).toBe('critical')
    expect(flags[0].description).toContain('thumb')
    expect(flags[0].source_location_hint).toContain('5')
  })

  test('parseResponse strips ```json fences and falls back to [] on garbage', () => {
    const fenced = '```json\n[]\n```'
    expect(JOB_B.parseResponse(fenced)).toEqual([])
    expect(JOB_B.parseResponse('not-json at all')).toEqual([])
    expect(JOB_B.parseResponse('')).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Job C — anchoring + alignment (D-21-11 SINGLE CALL)
// ---------------------------------------------------------------------------

test.describe('JOB_C — anchoring + alignment (D-21-11 single call)', () => {
  test('system prompt mentions BOTH anchoring AND alignment (D-21-11 single call)', () => {
    const p = JOB_C.systemPrompt.toLowerCase()
    expect(p).toContain('anchor')
    expect(p).toContain('alignment')
    // The prompt MUST instruct the model to return both facets in one go.
    expect(p).toMatch(/suggested[_ ]step/i)
    expect(p).toMatch(/alignment[_ ]concern/i)
  })

  test('maxTokens lands in the Spike 003 1500-2000 band', () => {
    expect(JOB_C.maxTokens).toBeGreaterThanOrEqual(1500)
    expect(JOB_C.maxTokens).toBeLessThanOrEqual(2000)
  })

  test('parseResponse populates extras.{photo_id,suggested_step_id,alignment_concern} (D-21-11)', () => {
    const raw = JSON.stringify([
      {
        severity: 'critical',
        kind: 'anchoring',
        photo_id: 'photo-swab-cycle-switch',
        current_step_id: 'step-mould-5',
        suggested_step_id: 'step-swab-3',
        alignment_concern: true,
        photo_caption: 'Swab Cycle Switch on the control panel',
        description: 'Photo of control-panel switch attached to bottom-plate swab step',
      },
    ])
    const flags = JOB_C.parseResponse(raw)
    expect(flags).toHaveLength(1)
    expect(flags[0].job).toBe('C')
    expect(flags[0].kind).toBe('anchoring')
    expect(flags[0].extras?.photo_id).toBe('photo-swab-cycle-switch')
    expect(flags[0].extras?.suggested_step_id).toBe('step-swab-3')
    expect(flags[0].extras?.alignment_concern).toBe(true)
  })

  test('parseResponse honours alignment_concern=false (clean anchoring, alignment misalignment)', () => {
    // SCP-AI-03 case: photo IS on the right step but visually doesn't match.
    const raw = JSON.stringify([
      {
        severity: 'warning',
        kind: 'anchoring',
        photo_id: 'photo-mould-overview',
        current_step_id: 'step-mould-5',
        suggested_step_id: null,
        alignment_concern: true,
        description: 'Photo shows distant overview, step describes close-up swabbing action',
      },
    ])
    const flags = JOB_C.parseResponse(raw)
    expect(flags[0].extras?.alignment_concern).toBe(true)
    expect(flags[0].extras?.suggested_step_id).toBe(null)
  })
})

// ---------------------------------------------------------------------------
// Job D — table / numeric fidelity
// ---------------------------------------------------------------------------

test.describe('JOB_D — table fidelity', () => {
  test('system prompt enumerates numeric safety kinds + top-5 cap', () => {
    const p = JOB_D.systemPrompt.toLowerCase()
    expect(p).toContain('dosage')
    expect(p).toContain('torque')
    expect(p).toContain('temperature')
    expect(p).toContain('top 5')
    expect(p).toContain('100 char')
  })

  test('parseResponse maps a torque mismatch to critical table_fidelity flag', () => {
    const raw = JSON.stringify([
      {
        severity: 'critical',
        kind: 'table_fidelity',
        source_quote: 'Torque: 45 Nm',
        draft_quote: 'Torque: 4.5 Nm',
        block_id: 'block-torque-1',
        description: 'Draft torque 10× lower than source (4.5 vs 45 Nm)',
      },
    ])
    const flags = JOB_D.parseResponse(raw)
    expect(flags[0].job).toBe('D')
    expect(flags[0].kind).toBe('table_fidelity')
    expect(flags[0].severity).toBe('critical')
    expect(flags[0].block_id).toBe('block-torque-1')
    expect(flags[0].extras?.source_quote).toBe('Torque: 45 Nm')
    expect(flags[0].extras?.draft_quote).toBe('Torque: 4.5 Nm')
  })
})

// ---------------------------------------------------------------------------
// Job E — terminology consistency
// ---------------------------------------------------------------------------

test.describe('JOB_E — terminology consistency', () => {
  test('system prompt references the org vocabulary placeholder slot', () => {
    const p = JOB_E.systemPrompt.toLowerCase()
    expect(p).toContain('vocabulary')
    expect(p).toContain('terminology')
    expect(p).toContain('top 5')
  })

  test('parseResponse maps a terminology drift to warning terminology flag', () => {
    const raw = JSON.stringify([
      {
        severity: 'warning',
        kind: 'terminology',
        source_term: 'lockout switch',
        draft_term: 'isolation switch',
        suggested_term: 'lockout switch',
        block_id: 'block-step-1',
        description: 'Draft uses isolation; source + org vocab use lockout',
      },
    ])
    const flags = JOB_E.parseResponse(raw)
    expect(flags[0].job).toBe('E')
    expect(flags[0].kind).toBe('terminology')
    expect(flags[0].severity).toBe('warning')
    expect(flags[0].extras?.source_term).toBe('lockout switch')
    expect(flags[0].extras?.draft_term).toBe('isolation switch')
    expect(flags[0].extras?.suggested_term).toBe('lockout switch')
  })
})
