'use client'
// D-21-09 isolation: admin-only; never imported by worker routes.

/**
 * Phase 21.6 (Plan 21.6-03 Task 1) — Step child row in the BuilderTreeRail.
 *
 * Mirrors NavRow.tsx anatomy (from the Review Station) adapted for the Build stage:
 *   [circle-dot 16px] [kind-pill 74px fixed] [Step N: label flex-1 truncated]
 *
 * Key differences from NavRow:
 *   - No verify/flag state (Build stage only)
 *   - Adds stepNumber prop; renders "Step {N}" prefix
 *   - paddingLeft: 24px indent
 *   - data-testid="tree-step-row"
 *
 * getPillStyle() is copied verbatim from NavRow.tsx (lines 37–83).
 * All labels resolve through humanizeBlockType / BLOCK_TYPE_LABELS — no raw PascalCase.
 *
 * UI-SPEC: § "Tree rail row anatomy — Step child row"
 */

import { BLOCK_TYPE_LABELS, humanizeBlockType } from '@/lib/builder/block-type-labels'

/** Minimal shape of a Puck layout_data.content[] item. */
export interface PuckItem {
  type: string
  props: {
    id?: string
    junctionId?: string
    text?: string
    title?: string
    label?: string
    prompt?: string
    question?: string
    content?: string
    [key: string]: unknown
  }
}

export interface TreeStepRowProps {
  item: PuckItem
  stepNumber: number
  isActive: boolean
  onSelect: () => void
}

/**
 * Map a pillVariant string → inline background + text + border colors.
 * Copied verbatim from NavRow.tsx getPillStyle (lines 37–83).
 */
function getPillStyle(pillVariant: string): React.CSSProperties {
  switch (pillVariant) {
    case 'kind-haz':
      return {
        background: '#fef2f2',
        color: 'var(--accent-hazard)',
        border: '1px solid #fca5a5',
      }
    case 'kind-meas':
      return {
        background: '#fff5ed',
        color: 'var(--accent-measure)',
        border: '1px solid #fdba74',
      }
    case 'kind-ins':
      return {
        background: '#ecfdff',
        color: 'var(--accent-mcu)',
        border: '1px solid #67e8f9',
      }
    case 'kind-dec':
      return {
        background: '#fdf2f8',
        color: 'var(--accent-decision)',
        border: '1px solid #f9a8d4',
      }
    case 'kind-esc':
      return {
        background: '#fef2f2',
        color: 'var(--accent-hazard)',
        border: '1px solid #fca5a5',
      }
    case 'kind-sign':
      return {
        background: '#fffbeb',
        color: '#b45309',
        border: '1px solid #fcd34d',
      }
    case 'kind-step':
    default:
      return {
        background: '#eff4ff',
        color: 'var(--accent-step)',
        border: '1px solid #93c5fd',
      }
  }
}

export function TreeStepRow({
  item,
  stepNumber,
  isActive,
  onSelect,
}: TreeStepRowProps): React.JSX.Element {
  const entry = BLOCK_TYPE_LABELS[item.type]
  const pillVariant = entry?.pillVariant ?? 'kind-step'
  const pillStyle = getPillStyle(pillVariant)
  const humanLabel = humanizeBlockType(item.type)

  // Preview: first 60 chars from the most relevant text prop
  const rawPreview =
    item.props?.text ??
    item.props?.title ??
    item.props?.label ??
    item.props?.prompt ??
    item.props?.question ??
    item.props?.content ??
    ''
  const preview =
    String(rawPreview).slice(0, 60) + (String(rawPreview).length > 60 ? '…' : '')

  const ariaLabel = `Step ${stepNumber}: ${preview || humanLabel}`

  return (
    <div
      data-testid="tree-step-row"
      data-block-id={item.props?.id}
      data-active={isActive ? 'true' : 'false'}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        paddingLeft: '24px',
        paddingRight: '8px',
        paddingTop: '6px',
        paddingBottom: '6px',
        minHeight: '36px',
        borderRadius: '3px',
        cursor: 'pointer',
        border: isActive ? '1px solid var(--accent-step)' : '1px solid transparent',
        background: isActive ? '#eff4ff' : 'transparent',
        transition: 'background 0.1s ease',
      }}
      className="hover:bg-[var(--paper-2)]"
    >
      {/* Circle dot — 16×16px; empty in Build stage (no verify state) */}
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          border: '1.5px solid var(--ink-300)',
          background: 'transparent',
        }}
      />

      {/* Kind pill — 74px fixed width */}
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '74px',
          minWidth: '74px',
          fontSize: '10px',
          fontWeight: 600,
          fontFamily: 'JetBrains Mono, monospace',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          borderRadius: '2px',
          padding: '2px 4px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          ...pillStyle,
        }}
      >
        {humanLabel}
      </span>

      {/* Step label — "Step N" prefix + preview text */}
      <span
        title={`Step ${stepNumber}: ${preview}`}
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: '12px',
          fontWeight: 500,
          fontFamily: 'JetBrains Mono, monospace',
          color: 'var(--ink-900)',
        }}
      >
        {`Step ${stepNumber}`}
        {preview ? ` ${preview}` : ''}
      </span>
    </div>
  )
}
