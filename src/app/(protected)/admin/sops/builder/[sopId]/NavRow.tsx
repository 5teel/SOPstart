'use client'

/**
 * Phase 21.5 (Plan 21.5-04 Task 1) — Single navigator row in the Review Station.
 *
 * Renders the left-zone (Zone 1) row anatomy per UI-SPEC § "Zone 1 — Step Navigator":
 *   [check-dot 16px] [kind-pill 74px] [label flex-1 truncated] [flag-badge?]
 *
 * Row states (per UI-SPEC):
 *   - Default:  border 1px transparent; hover → background --paper-2
 *   - Active:   border 1px solid --accent-step; background #eff4ff
 *   - Verified: check dot filled --accent-ok + white ✓; text color --ink-500
 *
 * Kind pill colors come from BLOCK_TYPE_LABELS.pillVariant → CSS class .kind-*.
 * Flag badge appears only when flags_count > 0 && !verified.
 *
 * Presentational only — no data fetching.
 * D-21-09 isolation: admin-only; never imported by worker routes.
 */

import type { ChecklistBlock } from '@/components/admin/verify-checklist/useVerifyChecklist'
import {
  BLOCK_TYPE_LABELS,
  humanizeBlockType,
} from '@/lib/builder/block-type-labels'

export type NavRowProps = {
  block: ChecklistBlock
  active: boolean
  onSelect: () => void
}

/**
 * Map a pillVariant string → inline background + text + border colors.
 * Matches UI-SPEC kind pill color table.
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

export function NavRow({ block, active, onSelect }: NavRowProps): React.JSX.Element {
  const verified = block.verified_by_admin_id !== null
  const showFlagBadge = block.flags_count > 0 && !verified

  const entry = BLOCK_TYPE_LABELS[block.type]
  const pillVariant = entry?.pillVariant ?? 'kind-step'
  const pillStyle = getPillStyle(pillVariant)
  const humanLabel = humanizeBlockType(block.type)

  return (
    <div
      data-testid="nav-row"
      data-block-id={block.id}
      data-active={active ? 'true' : 'false'}
      data-verified={verified ? 'true' : 'false'}
      onClick={onSelect}
      role="button"
      tabIndex={0}
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
        padding: '8px',
        borderRadius: '3px',
        cursor: 'pointer',
        border: active
          ? '1px solid var(--accent-step)'
          : '1px solid transparent',
        background: active ? '#eff4ff' : 'transparent',
        color: verified ? 'var(--ink-500)' : 'var(--ink-900)',
        transition: 'background 0.1s ease',
      }}
      className="hover:bg-[var(--paper-2)]"
    >
      {/* Check dot — 16×16px */}
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          border: verified
            ? 'none'
            : '1.5px solid var(--ink-300)',
          background: verified ? 'var(--accent-ok)' : 'transparent',
          color: '#fff',
          fontSize: '10px',
          lineHeight: 1,
          fontWeight: 700,
        }}
      >
        {verified ? '✓' : null}
      </span>

      {/* Kind pill — 74px fixed width */}
      <span
        aria-label={`Block type: ${humanLabel}`}
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

      {/* Label — flex-1 truncated */}
      <span
        title={block.preview}
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: '12px',
          fontFamily: 'JetBrains Mono, monospace',
          color: verified ? 'var(--ink-500)' : 'var(--ink-700)',
        }}
      >
        {block.preview}
      </span>

      {/* Flag badge — only when unresolved flags exist */}
      {showFlagBadge ? (
        <span
          data-testid="flag-badge"
          aria-label={`${block.flags_count} unresolved flag(s)`}
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '16px',
            height: '16px',
            borderRadius: '50%',
            background: 'var(--accent-hazard)',
            color: '#fff',
            fontSize: '10px',
            fontWeight: 700,
            padding: '0 2px',
          }}
        >
          {block.flags_count}
        </span>
      ) : null}
    </div>
  )
}
