'use client'
// D-21-09 isolation: admin-only; never imported by worker routes.

/**
 * Phase 21.6 (Plan 21.6-03 Task 2) — Root left-rail tree for the Build stage.
 *
 * Responsibilities:
 *   - SECTIONS heading + draggable TreeSectionRow list with optimistic reorder
 *   - For the active section: derives a presentation-only step tree via
 *     `deriveStepTree` (pure read of layout_data.content[]; no mutation)
 *   - Renders TreeStepRow + nested TreeBlockRow children; "Before first step"
 *     header for pre-step blocks when the section HAS steps (D-01/D-02)
 *   - "＋ Add step or block" placeholder at each section end (wired in Plan 04)
 *   - `useGetPuck()` captured for programmatic block insert (AddMenu, Plan 04)
 *   - E6 display override: HeadingBlock with text starting "Unanchored figures"
 *     shows "Reference images" in the tree rail — NEVER mutated in props/layout_data
 *   - Optimistic reorder via `reorderSections` server action + revert-on-error strip
 *
 * Width: 280px (≥1024px); 240px at 768–1023px.
 * UI-SPEC: § "Left Rail: Nested Tree (D-01/D-02)" + § Copywriting Contract
 */

import { useState } from 'react'
import { GripVertical, ChevronDown, ChevronRight } from 'lucide-react'
import { useGetPuck } from '@puckeditor/core'
import { reorderSections } from '@/actions/sections'
import { humanizeBlockType } from '@/lib/builder/block-type-labels'
import { TreeSectionRow } from './TreeSectionRow'
import { TreeStepRow } from './TreeStepRow'
import { TreeBlockRow } from './TreeBlockRow'
import type { PuckItem } from './TreeStepRow'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SectionLite {
  id: string
  title: string
  sort_order: number
}

interface SectionWithContent extends SectionLite {
  layout_data?: {
    content?: unknown[]
    [key: string]: unknown
  } | null
}

interface Props {
  sections: SectionLite[]
  /** The full active section object (with layout_data) */
  activeSection: SectionWithContent | null
  activeSectionId: string
  onSelect: (id: string) => void
  sopId: string
  /** Called when a step row is selected — tracks active step for AddMenu insert anchor */
  onStepSelect?: (stepIndex: number) => void
}

// ---------------------------------------------------------------------------
// Step tree derivation (pure, no mutation)
// ---------------------------------------------------------------------------

const STEP_TYPES = new Set(['StepBlock', 'StepWithPhotosBlock'])

type TreeNode =
  | { kind: 'step'; item: PuckItem; stepNumber: number; children: PuckItem[] }
  | { kind: 'flat'; item: PuckItem }

/**
 * Derives a presentation-only step tree from flat layout_data.content[].
 * Pure read — never mutates content items.
 * Implements D-01 (step-centric with nesting) and D-02 (flat for non-step sections).
 */
function deriveStepTree(content: PuckItem[]): TreeNode[] {
  const hasSteps = content.some(item => STEP_TYPES.has(item.type))

  if (!hasSteps) {
    // D-02: all blocks as flat rows (no "Step N" prefix)
    return content.map(item => ({ kind: 'flat', item }))
  }

  // D-01: step-centric with nesting
  const nodes: TreeNode[] = []
  let stepNumber = 0
  let current: TreeNode & { kind: 'step' } | null = null
  const preFlight: PuckItem[] = [] // blocks before first step

  for (const item of content) {
    if (STEP_TYPES.has(item.type)) {
      stepNumber++
      current = { kind: 'step', item, stepNumber, children: [] }
      nodes.push(current)
    } else if (current === null) {
      preFlight.push(item)
    } else {
      current.children.push(item)
    }
  }

  // preFlight blocks unshift as flat nodes at front
  if (preFlight.length > 0) {
    nodes.unshift(...preFlight.map(item => ({ kind: 'flat' as const, item })))
  }

  return nodes
}

// ---------------------------------------------------------------------------
// E6 display label helper
// ---------------------------------------------------------------------------

/**
 * Returns the display label for a block row.
 * E6: HeadingBlock whose text starts with "Unanchored figures" → shows
 * "Reference images" in the rail. Display-only; layout_data is NEVER written.
 */
function getDisplayLabel(item: PuckItem): string {
  if (
    item.type === 'HeadingBlock' &&
    String(item.props?.text ?? '').startsWith('Unanchored figures')
  ) {
    return 'Reference images'
  }
  return (
    String(item.props?.text ?? item.props?.title ?? item.props?.label ?? '') ||
    humanizeBlockType(item.type)
  )
}

// ---------------------------------------------------------------------------
// Pill style (shared, same function as TreeStepRow/TreeBlockRow)
// ---------------------------------------------------------------------------
function getPillStyle(pillVariant: string): React.CSSProperties {
  switch (pillVariant) {
    case 'kind-haz':
      return { background: '#fef2f2', color: 'var(--accent-hazard)', border: '1px solid #fca5a5' }
    case 'kind-meas':
      return { background: '#fff5ed', color: 'var(--accent-measure)', border: '1px solid #fdba74' }
    case 'kind-ins':
      return { background: '#ecfdff', color: 'var(--accent-mcu)', border: '1px solid #67e8f9' }
    case 'kind-dec':
      return { background: '#fdf2f8', color: 'var(--accent-decision)', border: '1px solid #f9a8d4' }
    case 'kind-esc':
      return { background: '#fef2f2', color: 'var(--accent-hazard)', border: '1px solid #fca5a5' }
    case 'kind-sign':
      return { background: '#fffbeb', color: '#b45309', border: '1px solid #fcd34d' }
    case 'kind-step':
    default:
      return { background: '#eff4ff', color: 'var(--accent-step)', border: '1px solid #93c5fd' }
  }
}

// ---------------------------------------------------------------------------
// BuilderTreeRail component
// ---------------------------------------------------------------------------

export function BuilderTreeRail({
  sections,
  activeSection,
  activeSectionId,
  onSelect,
  sopId,
  onStepSelect,
}: Props): React.JSX.Element {
  // ---- Section reorder state (folded from SectionListSidebar) ----
  const [order, setOrder] = useState<SectionLite[]>(() =>
    [...sections].sort((a, b) => a.sort_order - b.sort_order)
  )
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [reorderError, setReorderError] = useState<string | null>(null)

  // ---- Section expand state ----
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(
    activeSectionId
  )

  // ---- Active step tracking (insert anchor for Plan 04 AddMenu) ----
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null)

  // ---- useGetPuck — captured here for Plan 04 block insert dispatch ----
  // Must use useGetPuck (not usePuck) because BuilderTreeRail renders OUTSIDE <Puck>.
  const getPuck = useGetPuck()

  // insertBlock helper — dispatch wired in Plan 04; defined here as source of truth
  function insertBlock(componentType: string, afterIndex: number) {
    const puck = getPuck()
    puck.dispatch({
      type: 'insert',
      componentType,
      destinationIndex: afterIndex + 1,
      destinationZone: 'root:default-zone',
    })
  }

  // ---- Section reorder handlers ----
  async function commitReorder(next: SectionLite[]) {
    setReorderError(null)
    const prev = order
    setOrder(next) // optimistic
    const result = await reorderSections({
      sopId,
      orderedSectionIds: next.map((s) => s.id),
    })
    if ('error' in result) {
      setOrder(prev) // revert
      setReorderError(result.error)
    }
  }

  function handleDrop(targetIdx: number) {
    if (draggedIdx === null || draggedIdx === targetIdx) return
    const next = [...order]
    const [moved] = next.splice(draggedIdx, 1)
    next.splice(targetIdx, 0, moved)
    setDraggedIdx(null)
    void commitReorder(next)
  }

  // ---- Derive step tree for the active section ----
  const activeSectionContent: PuckItem[] = (() => {
    if (!activeSection?.layout_data?.content) return []
    return (activeSection.layout_data.content as unknown[])
      .filter((item): item is PuckItem => {
        return (
          item !== null &&
          typeof item === 'object' &&
          'type' in item &&
          'props' in item
        )
      })
  })()

  const stepTree = deriveStepTree(activeSectionContent)
  const hasPreFlightBlocks =
    stepTree.length > 0 &&
    activeSectionContent.some(item => STEP_TYPES.has(item.type)) &&
    stepTree[0].kind === 'flat'

  return (
    <nav
      aria-label="SOP builder — sections and steps"
      data-testid="builder-tree-rail"
      className="w-[240px] lg:w-[280px] shrink-0 border-r border-[var(--ink-100)] overflow-y-auto bg-[var(--paper)]"
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      {/* Reorder error strip */}
      {reorderError && (
        <div
          role="alert"
          className="px-4 py-2 text-xs border-b border-red-500/30 bg-red-500/10"
          style={{ color: 'var(--accent-hazard)', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' }}
        >
          {`Couldn't save order — try again`}
        </div>
      )}

      {/* SECTIONS heading */}
      <div
        style={{
          padding: '12px 12px 4px',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '10px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--ink-500)',
          lineHeight: 1.3,
        }}
      >
        SECTIONS
      </div>

      {/* Section list */}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {order.map((s, idx) => {
          const isActive = s.id === activeSectionId
          const isExpanded = expandedSectionId === s.id

          return (
            <li key={s.id}>
              {/* Section parent row */}
              <TreeSectionRow
                section={s}
                isActive={isActive}
                isExpanded={isExpanded}
                onToggle={() =>
                  setExpandedSectionId(prev => (prev === s.id ? null : s.id))
                }
                onSelect={() => {
                  onSelect(s.id)
                  setExpandedSectionId(s.id)
                }}
                draggable
                onDragStart={() => setDraggedIdx(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(idx)}
              />

              {/* Expanded: step tree for active section */}
              {isExpanded && isActive && (
                <div>
                  {activeSectionContent.length === 0 ? (
                    /* Empty section state */
                    <div
                      style={{
                        padding: '8px 12px 8px 24px',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '11px',
                        color: 'var(--ink-500)',
                        lineHeight: 1.4,
                      }}
                    >
                      This section has no content yet. Use ＋ Add to add your first step.
                    </div>
                  ) : (
                    <>
                      {/* "Before first step" header — only when section HAS steps AND there are pre-step blocks */}
                      {hasPreFlightBlocks && (
                        <div
                          style={{
                            padding: '4px 8px 2px 24px',
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: '10px',
                            fontWeight: 500,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            color: 'var(--ink-500)',
                          }}
                        >
                          Before first step
                        </div>
                      )}

                      {stepTree.map((node, nodeIdx) => {
                        if (node.kind === 'flat') {
                          // Flat block row (D-02 non-step section, or pre-flight block)
                          const displayLabel = getDisplayLabel(node.item)
                          return (
                            <TreeBlockRow
                              key={node.item.props?.id ?? nodeIdx}
                              item={{ ...node.item }}
                              onSelect={() => {}}
                            />
                          )
                        }

                        // Step row with nested children
                        const isActiveStep = activeStepIndex === node.stepNumber - 1
                        return (
                          <div key={node.item.props?.id ?? nodeIdx}>
                            <TreeStepRow
                              item={node.item}
                              stepNumber={node.stepNumber}
                              isActive={isActiveStep}
                              onSelect={() => {
                                const stepIdx = node.stepNumber - 1
                                setActiveStepIndex(stepIdx)
                                onStepSelect?.(stepIdx)
                              }}
                            />
                            {/* Nested block children */}
                            {node.children.map((child, childIdx) => (
                              <TreeBlockRow
                                key={child.props?.id ?? childIdx}
                                item={child}
                                onSelect={() => {}}
                              />
                            ))}
                          </div>
                        )
                      })}
                    </>
                  )}

                  {/* Add control — placeholder until Plan 04 wires AddMenu */}
                  <div style={{ padding: '4px 8px 8px 24px' }}>
                    <button
                      type="button"
                      data-testid="add-control"
                      aria-haspopup="menu"
                      aria-label={`Add step or block to ${s.title}`}
                      onClick={() => {
                        // AddMenu wired in Plan 04
                      }}
                      style={{
                        width: '100%',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        background: 'none',
                        border: '1px dashed var(--ink-300)',
                        borderRadius: '2px',
                        cursor: 'pointer',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '11px',
                        fontWeight: 400,
                        color: 'var(--ink-500)',
                      }}
                    >
                      ＋ Add step or block
                    </button>
                  </div>
                </div>
              )}

              {/* Expanded: non-active section shows collapsed children */}
              {isExpanded && !isActive && (
                <div style={{ padding: '4px 0 4px 24px' }}>
                  <span
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '10px',
                      color: 'var(--ink-400)',
                    }}
                  >
                    Select section to view content
                  </span>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

