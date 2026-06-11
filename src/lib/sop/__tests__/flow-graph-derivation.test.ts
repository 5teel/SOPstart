/**
 * Phase 24 — branch-aware flow derivation unit tests.
 *
 * Verifies deriveFlowGraph walks layout_data.content[] (not just sop_steps),
 * emits typed nodes, and produces branch edges (yes/no/escalate) from
 * DecisionBlock.options[] — the core Phase 24 unlock over the pre-24 linear
 * sequential-only derivation.
 */
import { test, expect } from '@playwright/test'
import { deriveFlowGraph } from '../flow-graph'
import type { SopWithSections, SopStep } from '@/types/sop'

let uid = 0
const U = () => `00000000-0000-0000-0000-${String(++uid).padStart(12, '0')}`

function step(id: string, text: string, n: number): SopStep {
  return {
    id,
    section_id: 'sec',
    step_number: n,
    text,
    warning: null,
    caution: null,
    tip: null,
    required_tools: null,
    time_estimate_minutes: null,
    created_at: '',
    updated_at: '',
  }
}

function sop(sections: SopWithSections['sop_sections']): SopWithSections {
  return {
    id: 'sop',
    flow_graph: null,
    updated_at: '',
    sop_sections: sections,
  } as unknown as SopWithSections
}

function section(
  id: string,
  sort: number,
  content: Array<{ type: string; props: Record<string, unknown> }>,
  steps: SopStep[],
): SopWithSections['sop_sections'][number] {
  return {
    id,
    sort_order: sort,
    layout_data: { content: content.map((c) => ({ type: c.type, props: c.props })) },
    sop_steps: steps,
    sop_images: [],
  } as unknown as SopWithSections['sop_sections'][number]
}

// ---------------------------------------------------------------------------

test('linear step chain → sequential edges only', () => {
  const s1 = U(), s2 = U(), s3 = U()
  const g = deriveFlowGraph(
    sop([
      section(
        'sec',
        0,
        [
          { type: 'StepBlock', props: { id: 'b1', text: 'Open valve' } },
          { type: 'StepBlock', props: { id: 'b2', text: 'Check gauge' } },
          { type: 'StepBlock', props: { id: 'b3', text: 'Close valve' } },
        ],
        [step(s1, 'Open valve', 1), step(s2, 'Check gauge', 2), step(s3, 'Close valve', 3)],
      ),
    ]),
  )
  expect(g.nodes.map((n) => n.id)).toEqual([s1, s2, s3])
  expect(g.nodes.every((n) => n.type === 'step')).toBe(true)
  expect(g.edges).toHaveLength(2)
  expect(g.edges.every((e) => e.kind === 'sequential')).toBe(true)
})

test('typed blocks become typed nodes', () => {
  const g = deriveFlowGraph(
    sop([
      section(
        'sec',
        0,
        [
          { type: 'MeasurementBlock', props: { id: 'm', label: 'Pressure', unit: 'bar' } },
          { type: 'DecisionBlock', props: { id: 'd', question: 'In tolerance?', options: [{ label: 'Yes' }, { label: 'No' }] } },
          { type: 'EscalateBlock', props: { id: 'e', title: 'Call supervisor' } },
          { type: 'SignOffBlock', props: { id: 'so', title: 'Supervisor sign-off' } },
        ],
        [],
      ),
    ]),
  )
  expect(g.nodes.map((n) => n.type)).toEqual(['measurement', 'decision', 'escalate', 'signoff'])
  expect(g.nodes[0].label).toBe('Pressure (bar)')
  expect(g.nodes[1].label).toBe('In tolerance?')
})

test('decision with resolved nextStepId emits yes/no branch edges and suppresses linear edge', () => {
  const pass = U(), fail = U()
  const g = deriveFlowGraph(
    sop([
      section(
        'sec',
        0,
        [
          {
            type: 'DecisionBlock',
            props: {
              id: 'd',
              question: 'Pass?',
              options: [
                { label: 'Pass', nextStepId: pass },
                { label: 'Fail', nextStepId: fail },
              ],
            },
          },
          { type: 'StepBlock', props: { id: 'sp' } },
          { type: 'StepBlock', props: { id: 'sf' } },
        ],
        [step(pass, 'Proceed', 1), step(fail, 'Rework', 2)],
      ),
    ]),
  )
  const decId = g.nodes.find((n) => n.type === 'decision')!.id
  const branches = g.edges.filter((e) => e.from === decId)
  expect(branches).toHaveLength(2)
  expect(branches.map((e) => e.kind).sort()).toEqual(['no', 'yes'])
  expect(branches.map((e) => e.label).sort()).toEqual(['Fail', 'Pass'])
  expect(branches.find((e) => e.kind === 'yes')!.to).toBe(pass)
  expect(branches.find((e) => e.kind === 'no')!.to).toBe(fail)
  // No sequential edge leaving the decision (branches replaced it).
  expect(g.edges.some((e) => e.from === decId && e.kind === 'sequential')).toBe(false)
})

test('decision option flagged isEscalation → red escalate edge', () => {
  const ok = U()
  const g = deriveFlowGraph(
    sop([
      section(
        'sec',
        0,
        [
          {
            type: 'DecisionBlock',
            props: {
              id: 'd',
              question: 'Safe?',
              options: [
                { label: 'Yes', nextStepId: ok },
                { label: 'No — stop', isEscalation: true, nextStepId: ok },
              ],
            },
          },
          { type: 'StepBlock', props: { id: 's' } },
        ],
        [step(ok, 'Continue', 1)],
      ),
    ]),
  )
  expect(g.edges.some((e) => e.kind === 'escalate')).toBe(true)
})

test('decision with no resolvable targets collapses to a single sequential edge', () => {
  const g = deriveFlowGraph(
    sop([
      section(
        'sec',
        0,
        [
          { type: 'DecisionBlock', props: { id: 'd', question: 'Q?', options: [{ label: 'A' }, { label: 'B' }] } },
          { type: 'StepBlock', props: { id: 's' } },
        ],
        [step(U(), 'Next', 1)],
      ),
    ]),
  )
  const decId = g.nodes.find((n) => n.type === 'decision')!.id
  const out = g.edges.filter((e) => e.from === decId)
  expect(out).toHaveLength(1)
  expect(out[0].kind).toBe('sequential')
})

test('no node-worthy content blocks → linear fallback from sop_steps', () => {
  const a = U(), b = U()
  const g = deriveFlowGraph(
    sop([
      section(
        'sec',
        0,
        [
          { type: 'TextBlock', props: { id: 't', content: 'intro' } },
          { type: 'HeadingBlock', props: { id: 'h', text: 'Section' } },
        ],
        [step(a, 'First', 1), step(b, 'Second', 2)],
      ),
    ]),
  )
  expect(g.nodes.map((n) => n.id)).toEqual([a, b])
  expect(g.edges).toHaveLength(1)
  expect(g.edges[0].kind).toBe('sequential')
})

test('sections honour sort_order for document-order chaining', () => {
  const a = U(), b = U()
  const g = deriveFlowGraph(
    sop([
      section('secB', 1, [{ type: 'StepBlock', props: { id: 'b' } }], [step(b, 'Second', 1)]),
      section('secA', 0, [{ type: 'StepBlock', props: { id: 'a' } }], [step(a, 'First', 1)]),
    ]),
  )
  expect(g.nodes.map((n) => n.id)).toEqual([a, b])
  expect(g.edges[0]).toMatchObject({ from: a, to: b, kind: 'sequential' })
})

// ---------------------------------------------------------------------------
// Phase 24 Plan 01 — FLOW-02 coverage gap closure
// ---------------------------------------------------------------------------

test('InspectBlock and ZoneBlock produce inspect and zone typed nodes', () => {
  const g = deriveFlowGraph(
    sop([
      section(
        'sec',
        0,
        [
          { type: 'InspectBlock', props: { id: 'i1', title: 'Check bearings' } },
          { type: 'ZoneBlock', props: { id: 'z1', label: 'Clean room entry' } },
        ],
        [],
      ),
    ]),
  )
  expect(g.nodes).toHaveLength(2)
  expect(g.nodes[0].type).toBe('inspect')
  expect(g.nodes[0].label).toBe('Check bearings')
  expect(g.nodes[1].type).toBe('zone')
  expect(g.nodes[1].label).toBe('Clean room entry')
})

test('DecisionBlock option label > 60 chars produces edge label truncated to ≤ 60 chars', () => {
  const target = U()
  const longLabel = 'A'.repeat(80) // 80-char option label — exceeds the 60-char cap
  const g = deriveFlowGraph(
    sop([
      section(
        'sec',
        0,
        [
          {
            type: 'DecisionBlock',
            props: {
              id: 'd',
              question: 'Is pressure within tolerance?',
              options: [{ label: longLabel, nextStepId: target }],
            },
          },
          { type: 'StepBlock', props: { id: 's' } },
        ],
        [step(target, 'Proceed', 1)],
      ),
    ]),
  )
  const decId = g.nodes.find((n) => n.type === 'decision')!.id
  const branches = g.edges.filter((e) => e.from === decId)
  expect(branches).toHaveLength(1)
  expect(branches[0].label!.length).toBeLessThanOrEqual(60)
})

test('cross-section branch: DecisionBlock in section A with nextStepId in section B produces correct edge', () => {
  const stepInB = U()
  const g = deriveFlowGraph(
    sop([
      section(
        'secA',
        0,
        [
          {
            type: 'DecisionBlock',
            props: {
              id: 'd',
              question: 'Pass?',
              options: [{ label: 'Yes', nextStepId: stepInB }],
            },
          },
        ],
        [],
      ),
      section(
        'secB',
        1,
        [{ type: 'StepBlock', props: { id: 'sb' } }],
        [step(stepInB, 'Final check', 1)],
      ),
    ]),
  )
  const decNode = g.nodes.find((n) => n.type === 'decision')!
  const branches = g.edges.filter((e) => e.from === decNode.id)
  // The branch option resolved nextStepId to section B's step UUID
  expect(branches.some((e) => e.to === stepInB)).toBe(true)
  expect(branches.find((e) => e.to === stepInB)!.kind).toBe('yes')
})
