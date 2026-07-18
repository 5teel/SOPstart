import { test, expect } from '@playwright/test'
import { layoutOrgTree } from '../auto-layout'
import type { OrgTree, OrgTreeRole } from '@/types/org-model'

function role(id: string, departmentId: string): OrgTreeRole {
  return {
    id,
    organisationId: 'org-1',
    departmentId,
    name: `Role ${id}`,
    budgetedCount: 1,
    filledCount: 0,
    people: [{ id: null, name: `Role ${id}`, isVacancy: true }],
  }
}

const TREE: OrgTree = {
  organisationId: 'org-1',
  areas: [
    {
      id: 'area-1',
      organisationId: 'org-1',
      name: 'Manufacturing',
      colour: '#f97316',
      sort: 0,
      departments: [
        {
          id: 'dept-1',
          areaId: 'area-1',
          name: 'Forming',
          colour: '#f97316',
          icon: null,
          roles: [role('role-1', 'dept-1'), role('role-2', 'dept-1'), role('role-3', 'dept-1')],
        },
      ],
    },
  ],
  // Null-area department — must attach directly under the org root, no
  // synthetic area node created for it (D-04 / plan <behavior>).
  ungroupedDepartments: [
    {
      id: 'dept-2',
      areaId: null,
      name: 'Admin',
      colour: '#3b82f6',
      icon: null,
      roles: [role('role-4', 'dept-2')],
    },
  ],
}

test('layoutOrgTree is deterministic across calls', () => {
  const a = layoutOrgTree(TREE)
  const b = layoutOrgTree(TREE)
  expect(a.width).toBe(b.width)
  expect(a.height).toBe(b.height)
  for (const [id, posA] of a.placed) {
    const posB = b.placed.get(id)
    expect(posB).toEqual(posA)
  }
})

test('null-area department attaches directly under org root (no synthetic area node)', () => {
  const { placed } = layoutOrgTree(TREE)
  // Only real ids are placed — no synthetic 'area' id was invented for dept-2.
  expect(placed.size).toBe(1 /* root */ + 1 /* area-1 */ + 2 /* dept-1, dept-2 */ + 4 /* roles */)
  const groupedDept = placed.get('dept-1')!
  const ungroupedDept = placed.get('dept-2')!
  // Both departments are placed at the SAME depth row (fixed depth = 2),
  // regardless of whether they came via an area or attached to root directly.
  expect(ungroupedDept.y).toBe(groupedDept.y)
})

test('siblings at a depth are evenly spaced', () => {
  const { placed } = layoutOrgTree(TREE)
  const r1 = placed.get('role-1')!
  const r2 = placed.get('role-2')!
  const r3 = placed.get('role-3')!
  const gap1 = r2.x - r1.x
  const gap2 = r3.x - r2.x
  expect(gap1).toBe(gap2)
  expect(gap1).toBeGreaterThan(0)
})

test('parent is centered over its children span', () => {
  const { placed } = layoutOrgTree(TREE)
  const r1 = placed.get('role-1')!
  const r3 = placed.get('role-3')!
  const dept1 = placed.get('dept-1')!
  const expectedCenter = (r1.x + r1.width / 2 + r3.x + r3.width / 2) / 2
  expect(dept1.x + dept1.width / 2).toBe(expectedCenter)
})

test('canvas width/height cover every placed node', () => {
  const { placed, width, height } = layoutOrgTree(TREE)
  for (const node of placed.values()) {
    expect(node.x + node.width).toBeLessThanOrEqual(width)
    expect(node.y + node.height).toBeLessThanOrEqual(height)
  }
})
