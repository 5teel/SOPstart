'use client'
// D-21-09 isolation: admin-only; never imported by worker routes.

/**
 * Phase 21.6 (Plan 21.6-03 Task 1) — Section parent row in the BuilderTreeRail.
 *
 * Renders a draggable section row with:
 *   - GripVertical drag handle (14px, ink-500, cursor-grab)
 *   - Section title (Inter 13px/500)
 *   - Collapse chevron (ChevronDown/Right, 14px, ink-400)
 *
 * Active state: border-l-2 accent-step + bg-paper-2.
 * Min height: 40px.
 *
 * UI-SPEC: § "Tree rail row anatomy — Section parent row"
 */

import { GripVertical, ChevronDown, ChevronRight } from 'lucide-react'

interface SectionLite {
  id: string
  title: string
  sort_order: number
}

export interface TreeSectionRowProps {
  section: SectionLite
  isActive: boolean
  isExpanded: boolean
  /** Verify rollup for this section's blocks - renders a n/m chip. */
  verifiedSummary?: { done: number; total: number } | null
  onToggle: () => void
  onSelect: () => void
  // HTML5 drag handlers
  draggable?: boolean
  onDragStart?: () => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: () => void
}

export function TreeSectionRow({
  section,
  isActive,
  isExpanded,
  verifiedSummary,
  onToggle,
  onSelect,
  draggable: isDraggable = true,
  onDragStart,
  onDragOver,
  onDrop,
}: TreeSectionRowProps): React.JSX.Element {
    // NOTE: root is a <div>, NOT a <li>. BuilderTreeRail already wraps each
    // section in a <li> (the list item that also holds the expanded step tree).
    // A nested <li> here is invalid HTML — the browser relocates it on the
    // client, producing a hydration mismatch (React #418). See CLAUDE.md
    // [2026-06-08] hydration learning.
  return (
    <div
      data-testid="tree-section-row"
      data-section-id={section.id}
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        display: 'flex',
        alignItems: 'center',
        minHeight: '40px',
        borderLeft: isActive ? '2px solid var(--accent-step)' : '2px solid transparent',
        background: isActive ? 'var(--paper-2)' : 'transparent',
        cursor: 'default',
      }}
    >
      {/* Drag handle */}
      <span
        className="text-[var(--ink-500)] cursor-grab"
        aria-hidden="true"
        data-drag-handle
        style={{ paddingLeft: '8px', paddingRight: '4px', flexShrink: 0 }}
      >
        <GripVertical size={14} />
      </span>

      {/* Section title button */}
      <button
        type="button"
        role="button"
        aria-expanded={isExpanded}
        aria-label={section.title}
        onClick={onSelect}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          textAlign: 'left',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '8px 4px',
          minHeight: '40px',
          fontFamily: 'Inter, sans-serif',
          fontSize: '13px',
          fontWeight: 500,
          lineHeight: 1.4,
          color: isActive ? 'var(--ink-900)' : 'var(--ink-500)',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {section.title}
        </span>
        {verifiedSummary && verifiedSummary.total > 0 && (
          <span
            aria-label={`${verifiedSummary.done} of ${verifiedSummary.total} blocks verified`}
            style={{
              flexShrink: 0,
              marginLeft: '6px',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '10px',
              fontWeight: 600,
              padding: '1px 5px',
              borderRadius: '999px',
              background: verifiedSummary.done === verifiedSummary.total ? '#ecfdf5' : '#fffbeb',
              color: verifiedSummary.done === verifiedSummary.total ? '#059669' : '#b45309',
              border: verifiedSummary.done === verifiedSummary.total ? '1px solid #6ee7b7' : '1px solid #fcd34d',
            }}
          >
            {verifiedSummary.done === verifiedSummary.total ? 'OK ' : ''}{verifiedSummary.done}/{verifiedSummary.total}
          </span>
        )}
      </button>

      {/* Collapse chevron */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 8px',
          display: 'flex',
          alignItems: 'center',
          color: 'var(--ink-400)',
          flexShrink: 0,
        }}
      >
        {isExpanded ? (
          <ChevronDown size={14} aria-hidden="true" />
        ) : (
          <ChevronRight size={14} aria-hidden="true" />
        )}
      </button>
    </div>
  )
}
