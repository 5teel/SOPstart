/**
 * Phase 32-06: pure leveled-tree auto-layout for the Node Chart org view.
 *
 * No DOM, no I/O. Fixed depth per node type — org root (depth 0), areas
 * (depth 1), departments (depth 2, null-area depts attach directly to the
 * root — no synthetic area node), roles (depth 3). People render as chips
 * *inside* role nodes, not as separate layout nodes (RESEARCH Open Question 3
 * — a dedicated leveled tree, not FlowGraphCanvas's step-graph layering).
 *
 * Algorithm: bottom-up "slot span" per node (leaf = one fixed-width slot,
 * parent = sum of its children's slots), then top-down placement centering
 * each parent over its own children's span. This guarantees deterministic,
 * evenly-spaced, non-overlapping siblings with zero overlap-resolution pass.
 */

import type { OrgTree } from '@/types/org-model'

export const NODE_WIDTH = 180
export const NODE_HEIGHT = 64
const GAP_X = 24
const ROW_HEIGHT = 140
const PAD = 40
const SLOT_WIDTH = NODE_WIDTH + GAP_X

export interface PlacedNode {
  x: number
  y: number
  width: number
  height: number
}

export interface OrgTreeLayout {
  placed: Map<string, PlacedNode>
  width: number
  height: number
}

export function layoutOrgTree(tree: OrgTree): OrgTreeLayout {
  const rootId = tree.organisationId
  const depth = new Map<string, number>([[rootId, 0]])
  const children = new Map<string, string[]>()

  const addChild = (parentId: string, childId: string, childDepth: number) => {
    children.set(parentId, [...(children.get(parentId) ?? []), childId])
    depth.set(childId, childDepth)
  }

  for (const area of tree.areas) {
    addChild(rootId, area.id, 1)
    for (const dept of area.departments) {
      addChild(area.id, dept.id, 2)
      for (const role of dept.roles) addChild(dept.id, role.id, 3)
    }
  }
  // Null-area departments attach directly under the root — no synthetic area.
  for (const dept of tree.ungroupedDepartments) {
    addChild(rootId, dept.id, 2)
    for (const role of dept.roles) addChild(dept.id, role.id, 3)
  }

  const span = new Map<string, number>()
  const computeSpan = (id: string): number => {
    const kids = children.get(id) ?? []
    const s = kids.length === 0 ? SLOT_WIDTH : kids.reduce((sum, k) => sum + computeSpan(k), 0)
    span.set(id, s)
    return s
  }
  computeSpan(rootId)

  const placed = new Map<string, PlacedNode>()
  const place = (id: string, leftX: number) => {
    const kids = children.get(id) ?? []
    let centerX: number
    if (kids.length === 0) {
      centerX = leftX + span.get(id)! / 2
    } else {
      let cursor = leftX
      for (const k of kids) {
        place(k, cursor)
        cursor += span.get(k)!
      }
      const first = placed.get(kids[0])!
      const last = placed.get(kids[kids.length - 1])!
      centerX = (first.x + NODE_WIDTH / 2 + last.x + NODE_WIDTH / 2) / 2
    }
    placed.set(id, {
      x: centerX - NODE_WIDTH / 2,
      y: PAD + (depth.get(id) ?? 0) * ROW_HEIGHT,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    })
  }
  place(rootId, PAD)

  const totalSpan = span.get(rootId) ?? SLOT_WIDTH
  const maxDepth = Math.max(0, ...Array.from(depth.values()))

  return {
    placed,
    width: PAD * 2 + totalSpan,
    height: PAD * 2 + maxDepth * ROW_HEIGHT + NODE_HEIGHT,
  }
}
