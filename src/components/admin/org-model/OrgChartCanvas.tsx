'use client'

/**
 * Phase 32-06 — Node Chart view (D-08 default). Renders `layoutOrgTree()`
 * output as absolutely-positioned `.node` divs on 20px grid paper, with one
 * SVG underlay drawing cubic-bezier parent -> child connectors. Anchor
 * points are measured with `getBoundingClientRect()` against the canvas
 * container (FlowGraphCanvas idiom) so connectors stay pixel-accurate to
 * the actual rendered boxes, and are redrawn on resize / tree change.
 *
 * Vacancies render as first-class dashed `.person-chip.vacant` chips (never
 * styled as an error — org-model-views.md). Add-affordances are dashed
 * ghosts wired straight to the 32-04 create actions; this component owns no
 * page-level state beyond its own optimistic refresh callback.
 */

import { useCallback, useEffect, useRef } from 'react'
import type { OrgTree, OrgTreeDepartment } from '@/types/org-model'
import { layoutOrgTree, NODE_WIDTH, NODE_HEIGHT, PAD, ROW_HEIGHT, SLOT_WIDTH } from '@/lib/org-model/auto-layout'
import { createRole } from '@/actions/org-model'
import { createDepartment } from '@/actions/departments'

interface OrgChartCanvasProps {
  tree: OrgTree
  orgName?: string
  /** Called after any add-affordance mutation succeeds — caller decides how to refetch. */
  onChange?: () => void
  /** Phase 34-06 (D-03 entry A) — called only for a named (non-vacancy) person chip. */
  onSelectPerson?: (person: { id: string; name: string; roleLabel?: string }) => void
}

/** organisationId -> areas -> [ungrouped depts] edges, mirroring auto-layout's own children map (kept local — layoutOrgTree's contract is Map/width/height only). */
function orgTreeEdges(tree: OrgTree): Array<[string, string]> {
  const edges: Array<[string, string]> = []
  for (const area of tree.areas) {
    edges.push([tree.organisationId, area.id])
    for (const dept of area.departments) {
      edges.push([area.id, dept.id])
      for (const role of dept.roles) edges.push([dept.id, role.id])
    }
  }
  for (const dept of tree.ungroupedDepartments) {
    edges.push([tree.organisationId, dept.id])
    for (const role of dept.roles) edges.push([dept.id, role.id])
  }
  return edges
}

function allDepartments(tree: OrgTree): OrgTreeDepartment[] {
  return [...tree.areas.flatMap((a) => a.departments), ...tree.ungroupedDepartments]
}

function initials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || '?'
}

const NEW_DEPT_COLOUR = '#f97316'

export function OrgChartCanvas({ tree, orgName = 'Organisation', onChange, onSelectPerson }: OrgChartCanvasProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const pathRefs = useRef<Map<string, SVGPathElement>>(new Map())

  const { placed, width, height } = layoutOrgTree(tree)
  const edges = orgTreeEdges(tree)
  const depts = allDepartments(tree)

  const drawConnectors = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const canvasBox = canvas.getBoundingClientRect()
    for (const [fromId, toId] of edges) {
      const path = pathRefs.current.get(`${fromId}->${toId}`)
      const fromEl = nodeRefs.current.get(fromId)
      const toEl = nodeRefs.current.get(toId)
      if (!path || !fromEl || !toEl) continue
      const fromBox = fromEl.getBoundingClientRect()
      const toBox = toEl.getBoundingClientRect()
      const x1 = fromBox.left - canvasBox.left + fromBox.width / 2
      const y1 = fromBox.bottom - canvasBox.top
      const x2 = toBox.left - canvasBox.left + toBox.width / 2
      const y2 = toBox.top - canvasBox.top
      const my = (y1 + y2) / 2
      path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`)
    }
  }, [edges])

  useEffect(() => {
    drawConnectors()
    const onResize = () => drawConnectors()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [drawConnectors, placed])

  const registerNode = useCallback((id: string) => (el: HTMLDivElement | null) => {
    if (el) nodeRefs.current.set(id, el)
    else nodeRefs.current.delete(id)
  }, [])

  const registerPath = useCallback((key: string) => (el: SVGPathElement | null) => {
    if (el) pathRefs.current.set(key, el)
    else pathRefs.current.delete(key)
  }, [])

  const handleAddRole = useCallback(async (departmentId: string) => {
    const name = window.prompt('New role name')
    if (!name?.trim()) return
    const result = await createRole({ departmentId, name: name.trim(), budgetedCount: 1 })
    if ('error' in result) { console.error('[OrgChartCanvas] createRole failed', result.error); return }
    onChange?.()
  }, [onChange])

  const handleAddDepartment = useCallback(async () => {
    const name = window.prompt('New department name')
    if (!name?.trim()) return
    const code = (name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'DEPT')
    const result = await createDepartment({ name: name.trim(), code, colour: NEW_DEPT_COLOUR })
    if ('error' in result) { console.error('[OrgChartCanvas] createDepartment failed', result.error); return }
    onChange?.()
  }, [onChange])

  const rootPos = placed.get(tree.organisationId)
  const deptRowY = depts.length > 0 ? (placed.get(depts[0].id)?.y ?? PAD + 2 * ROW_HEIGHT) : PAD + 2 * ROW_HEIGHT
  const addDeptX = depts.length > 0
    ? Math.max(...depts.map((d) => placed.get(d.id)?.x ?? 0)) + SLOT_WIDTH
    : PAD

  return (
    <div className="h-full flex flex-col">
      <div ref={scrollRef} className="flex-1 overflow-auto bg-grid scroll-thin" style={{ minHeight: 360 }}>
        <div ref={canvasRef} className="relative" style={{ width: Math.max(width, addDeptX + NODE_WIDTH + PAD), height }}>
          <svg ref={svgRef} className="absolute inset-0 pointer-events-none" width="100%" height="100%">
            {edges.map(([fromId, toId]) => (
              <path
                key={`${fromId}->${toId}`}
                ref={registerPath(`${fromId}->${toId}`)}
                stroke="var(--ink-300)"
                strokeWidth={1.5}
                fill="none"
              />
            ))}
          </svg>

          {/* org root */}
          {rootPos && (
            <div
              ref={registerNode(tree.organisationId)}
              className="node org-root"
              style={{ left: rootPos.x, top: rootPos.y, width: rootPos.width, minHeight: rootPos.height }}
            >
              <div className="kicker mono">ORGANISATION</div>
              <div className="text-[13px] font-semibold text-[var(--ink-900)]">{orgName}</div>
            </div>
          )}

          {/* areas */}
          {tree.areas.map((area) => {
            const pos = placed.get(area.id)
            if (!pos) return null
            return (
              <div
                key={area.id}
                ref={registerNode(area.id)}
                className="node"
                style={{ left: pos.x, top: pos.y, width: pos.width, minHeight: pos.height }}
              >
                <div className="kicker mono">AREA</div>
                <div className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--ink-900)]">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: area.colour }} />
                  {area.name}
                </div>
              </div>
            )
          })}

          {/* departments (grouped + ungrouped) */}
          {depts.map((dept) => {
            const pos = placed.get(dept.id)
            if (!pos) return null
            return (
              <div
                key={dept.id}
                ref={registerNode(dept.id)}
                className="node"
                style={{ left: pos.x, top: pos.y, width: pos.width, minHeight: pos.height }}
              >
                <div className="kicker mono">DEPARTMENT</div>
                <div className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--ink-900)]">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: dept.colour }} />
                  {dept.name}
                </div>
              </div>
            )
          })}

          {/* + ADD DEPARTMENT ghost, end of the department row */}
          <button
            type="button"
            onClick={() => void handleAddDepartment()}
            className="org-add-ghost mono absolute"
            style={{ left: addDeptX, top: deptRowY, width: NODE_WIDTH, minHeight: NODE_HEIGHT }}
          >
            + ADD DEPARTMENT
          </button>

          {/* roles, with a "+ Add role" ghost after each department's last role */}
          {depts.map((dept) => {
            const roleXs = dept.roles.map((r) => placed.get(r.id)?.x).filter((x): x is number => x !== undefined)
            const deptPos = placed.get(dept.id)
            const ghostX = roleXs.length > 0 ? Math.max(...roleXs) + SLOT_WIDTH : (deptPos?.x ?? PAD)
            const ghostY = dept.roles.length > 0
              ? (placed.get(dept.roles[0].id)?.y ?? PAD + 3 * ROW_HEIGHT)
              : (deptPos ? deptPos.y + ROW_HEIGHT : PAD + 3 * ROW_HEIGHT)
            return (
              <div key={`roles-${dept.id}`}>
                {dept.roles.map((role) => {
                  const pos = placed.get(role.id)
                  if (!pos) return null
                  return (
                    <div
                      key={role.id}
                      ref={registerNode(role.id)}
                      className="node"
                      style={{ left: pos.x, top: pos.y, width: pos.width, minHeight: pos.height }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="kicker mono">ROLE</div>
                        <span className="pill">{role.filledCount}/{role.budgetedCount}</span>
                      </div>
                      <div className="text-[13px] font-medium text-[var(--ink-900)] mb-1.5">{role.name}</div>
                      <div className="flex flex-wrap gap-1">
                        {role.people.map((person, i) => {
                          const clickable = !person.isVacancy && Boolean(person.id)
                          return (
                            <span
                              key={person.id ?? `vacant-${i}`}
                              className={`person-chip${person.isVacancy ? ' vacant' : ''}${clickable ? ' cursor-pointer' : ''}`}
                              onClick={
                                clickable
                                  ? () => onSelectPerson?.({ id: person.id as string, name: person.name, roleLabel: role.name })
                                  : undefined
                              }
                            >
                              <span className="avatar">{person.isVacancy ? '+' : initials(person.name)}</span>
                              {person.isVacancy ? 'Vacant' : person.name}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
                <button
                  type="button"
                  onClick={() => void handleAddRole(dept.id)}
                  className="org-add-ghost mono absolute"
                  style={{ left: ghostX, top: ghostY, width: NODE_WIDTH, minHeight: NODE_HEIGHT }}
                >
                  + Add role
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
