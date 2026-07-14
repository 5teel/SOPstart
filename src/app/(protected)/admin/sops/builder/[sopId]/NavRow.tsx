'use client'

/**
 * Phase 21.5 (Plan 21.5-04 Task 1) — Single navigator row in the Review Station.
 *
 * The rail exists for ONE job: let the reviewer scan 48 rows and decide, at a
 * glance, where to jump. So the row leads with the thing that actually
 * identifies a step — its text — and demotes everything else.
 *
 * Row anatomy:
 *   [type bar 3px] [check-dot 16px] [ n · TYPE   (muted meta line)      ] [flag?]
 *                                   [ step text, 2 lines, ink-900       ]
 *
 * This replaced an anatomy that led with a 74px uppercase colour-filled kind
 * pill and pushed the step text into a 12px mono line truncated at ~20 chars.
 * The pill was the loudest element on every row while carrying the LEAST
 * information — in a hazards section all 48 rows read "HAZARD" — and the one
 * discriminating field was the one that got clipped. Type is still present
 * (colour bar + muted caption, R4 keeps it humanized) but it no longer
 * out-shouts the content.
 *
 * Row states:
 *   - Default:  border 1px transparent; hover → background --paper-2
 *   - Active:   border 1px solid --accent-step; background #eff4ff
 *   - Verified: check dot filled --accent-ok + white ✓; text color --ink-500
 *
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
  /** 0-based position; rendered 1-based so the row can be jumped to by number. */
  index: number
  active: boolean
  onSelect: () => void
}

/**
 * Map a pillVariant string → the block family's accent colour. Carried by a 3px
 * bar instead of a filled pill: same categorical signal, a fraction of the ink.
 */
function getAccentColor(pillVariant: string): string {
  switch (pillVariant) {
    case 'kind-haz':
      return 'var(--accent-hazard)'
    case 'kind-meas':
      return 'var(--accent-measure)'
    case 'kind-ins':
      return 'var(--accent-mcu)'
    case 'kind-dec':
      return 'var(--accent-decision)'
    case 'kind-esc':
      return 'var(--accent-escalate)'
    case 'kind-sign':
      return 'var(--accent-signoff)'
    case 'kind-step':
    default:
      return 'var(--accent-step)'
  }
}

export function NavRow({ block, index, active, onSelect }: NavRowProps): React.JSX.Element {
  const verified = block.verified_by_admin_id !== null
  const showFlagBadge = block.flags_count > 0 && !verified

  const entry = BLOCK_TYPE_LABELS[block.type]
  const pillVariant = entry?.pillVariant ?? 'kind-step'
  const accent = getAccentColor(pillVariant)
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
      aria-label={`Step ${index + 1}, ${humanLabel}: ${block.preview}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: '8px',
        padding: '7px 8px',
        borderRadius: '3px',
        cursor: 'pointer',
        border: active
          ? '1px solid var(--accent-step)'
          : '1px solid transparent',
        background: active ? '#eff4ff' : 'transparent',
        transition: 'background 0.1s ease',
      }}
      className="hover:bg-[var(--paper-2)]"
    >
      {/* Type bar — the categorical signal, quietly */}
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: '3px',
          borderRadius: '2px',
          background: accent,
          opacity: verified ? 0.35 : 1,
        }}
      />

      {/* Check dot — 16×16px */}
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          alignSelf: 'flex-start',
          marginTop: '1px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          border: verified ? 'none' : '1.5px solid var(--ink-300)',
          background: verified ? 'var(--accent-ok)' : 'transparent',
          color: '#fff',
          fontSize: '10px',
          lineHeight: 1,
          fontWeight: 700,
        }}
      >
        {verified ? '✓' : null}
      </span>

      {/* Content — meta line above, step text as the primary element */}
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {/* Meta: position + type. Small, muted — orientation, not headline. */}
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '9px',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--ink-500)',
            lineHeight: 1,
          }}
        >
          <span>{index + 1}</span>
          <span aria-hidden style={{ opacity: 0.5 }}>·</span>
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {humanLabel}
          </span>
        </span>

        {/* The step itself — what the reviewer actually navigates by. */}
        <span
          title={block.preview}
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            fontFamily: 'Inter, sans-serif',
            fontSize: '13px',
            lineHeight: 1.35,
            fontWeight: active ? 600 : 400,
            color: verified ? 'var(--ink-500)' : 'var(--ink-900)',
          }}
        >
          {block.preview}
        </span>
      </span>

      {/* Flag badge — only when unresolved flags exist */}
      {showFlagBadge ? (
        <span
          data-testid="flag-badge"
          aria-label={`${block.flags_count} unresolved flag(s)`}
          style={{
            flexShrink: 0,
            alignSelf: 'flex-start',
            marginTop: '1px',
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
