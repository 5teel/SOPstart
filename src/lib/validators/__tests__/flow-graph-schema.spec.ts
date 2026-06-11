/**
 * Phase 24 Plan 01 — FlowGraphSchema relaxation contract tests.
 *
 * Asserts the three schema changes from Task 1:
 *   - node.id: z.string().min(1)  (was .uuid())
 *   - edge.from: z.string().min(1) (was .uuid())
 *   - edge.to: z.string().min(1)   (was .uuid())
 *   - node.stepId: z.string().uuid().optional() — UNCHANGED
 *
 * Registered in playwright.config.ts under project phase24-stubs.
 * CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
 */
import { test, expect } from '@playwright/test'
import { FlowGraphSchema } from '../flow-graph'

const BASE_NODE = {
  id: 'a0000000-0000-4000-8000-000000000001', // valid v4-format UUID
  type: 'step' as const,
  label: 'Open valve',
  position: { x: 0, y: 0 },
}

const BASE_GRAPH = {
  version: 1 as const,
  nodes: [BASE_NODE],
  edges: [] as Array<{ from: string; to: string; kind: 'sequential'; label?: string }>,
}

test('non-UUID node id (derived format "section-abc:0") passes schema', () => {
  const graph = {
    ...BASE_GRAPH,
    nodes: [{ ...BASE_NODE, id: 'section-abc:0' }],
  }
  const result = FlowGraphSchema.safeParse(graph)
  expect(result.success, 'non-UUID min(1) id should be accepted').toBe(true)
})

test('non-UUID edge from/to endpoints pass schema', () => {
  const graph = {
    ...BASE_GRAPH,
    nodes: [
      { ...BASE_NODE, id: 'section-a:0' },
      { ...BASE_NODE, id: 'section-b:0', label: 'Close valve', position: { x: 0, y: 100 } },
    ],
    edges: [{ from: 'section-a:0', to: 'section-b:0', kind: 'sequential' as const }],
  }
  const result = FlowGraphSchema.safeParse(graph)
  expect(result.success, 'non-UUID edge from/to should be accepted').toBe(true)
})

test('empty-string node id fails schema', () => {
  const graph = {
    ...BASE_GRAPH,
    nodes: [{ ...BASE_NODE, id: '' }],
  }
  const result = FlowGraphSchema.safeParse(graph)
  expect(result.success, 'empty-string id must be rejected (min(1))').toBe(false)
})

test('non-UUID stepId fails while valid UUID stepId passes', () => {
  // Non-UUID stepId should fail
  const graphBad = {
    ...BASE_GRAPH,
    nodes: [{ ...BASE_NODE, stepId: 'not-a-uuid' }],
  }
  const bad = FlowGraphSchema.safeParse(graphBad)
  expect(bad.success, 'non-UUID stepId must be rejected (stepId stays uuid)').toBe(false)

  // Valid UUID stepId should pass — use a proper v4-format UUID (version nibble [1-8])
  const graphGood = {
    ...BASE_GRAPH,
    nodes: [{ ...BASE_NODE, stepId: 'a1b2c3d4-e5f6-4789-abcd-ef0123456789' }],
  }
  const good = FlowGraphSchema.safeParse(graphGood)
  expect(good.success, 'valid UUID stepId must be accepted').toBe(true)
})
