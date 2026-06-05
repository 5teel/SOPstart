'use client'
// D-21-09 isolation: admin-only; never imported by worker routes.

/**
 * Phase 21.6 (Plan 21.6-03 Task 1) — Block grandchild row in the BuilderTreeRail.
 *
 * Indented block row nested under a step. Simplified NavRow variant:
 *   [kind-pill 60px fixed] [humanised label flex-1 truncated, ink-500]
 *
 * Key differences from TreeStepRow:
 *   - No circle dot (no verify state in Build)
 *   - Pill width 60px (narrower — differentiates hierarchy per UI-SPEC)
 *   - paddingLeft: 40px (double step indent)
 *   - Min height: 28px
 *   - Label: JetBrains Mono 12px/400, ink-500 (muted)
 *
 * All labels MUST resolve through humanizeBlockType — no raw PascalCase strings.
 * getPillStyle() copied from NavRow.tsx (shared with TreeStepRow).
 *
 * UI-SPEC: § "Tree rail row anatomy — Block grandchild row"
 */

import { humanizeBlockType, BLOCK_TYPE_LABELS } from '@/lib/builder/block-type-labels'
import type { PuckItem } from './TreeStepRow'

export interface TreeBlockRowProps {
  item: PuckItem
  onSelect: () => void
}

/**
 * Map a pillVariant string → inline background + text + border colors.
 * Same function as NavRow.tsx and TreeStepRow.tsx — shared implementation.
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

export function TreeBlockRow({ item, onSelect }: TreeBlockRowProps): React.JSX.Element {
  const entry = BLOCK_TYPE_LABELS[item.type]
  const pillVariant = entry?.pillVariant ?? 'kind-step'
  const pillStyle = getPillStyle(pillVariant)
  const humanLabel = humanizeBlockType(item.type)

  // Preview: first 40 chars
  const rawPreview =
    item.props?.text ??
    item.props?.title ??
    item.props?.label ??
    item.props?.prompt ??
    item.props?.question ??
    item.props?.content ??
    ''
  const preview =
    String(rawPreview).slice(0, 40) + (String(rawPreview).length > 40 ? '…' : '')

  const ariaLabel = `${humanLabel}: ${preview || humanLabel}`

  return (
    <div
      data-testid="tree-block-row"
      data-block-id={item.props?.id}
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
        paddingLeft: '40px',
        paddingRight: '8px',
        paddingTop: '4px',
        paddingBottom: '4px',
        minHeight: '28px',
        cursor: 'pointer',
        borderRadius: '3px',
      }}
      className="hover:bg-[var(--paper-2)]"
    >
      {/* Kind pill — 60px (narrower than step row to differentiate hierarchy) */}
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '60px',
          minWidth: '60px',
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

      {/* Label — muted, truncated */}
      <span
        title={preview || humanLabel}
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: '12px',
          fontWeight: 400,
          fontFamily: 'JetBrains Mono, monospace',
          color: 'var(--ink-500)',
        }}
      >
        {preview || humanLabel}
      </span>
    </div>
  )
}
