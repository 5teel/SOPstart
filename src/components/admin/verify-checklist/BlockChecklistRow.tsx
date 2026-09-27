'use client'

/**
 * Phase 21 (Plan 21-04 Task 1) — Single row in the VerifyChecklist sidebar.
 * Phase 21.5 (Plan 21.5-01 Task 2) — Humanized labels + word-labelled actions.
 *
 * Layout: [check-state | type label | preview text | flag badge | actions]
 *   - Verified: green check + faded text
 *   - Unverified: empty circle + normal text
 *   - Active: 2px yellow ring (`ring-2 ring-brand-yellow`) matches Spike 004
 *     focus-ring affordance — admin's eye lands here.
 *   - Flag badge: red number when `flags_count > 0 && !verified`; faded
 *     when `verified` (so the eye-flow stops at unaddressed-flag rows).
 *
 * Action labels (SPEC R5):
 *   - row-approve: "Verify step" (primary, --accent-ok green semantics)
 *   - row-decline: "Send back to edit" (--accent-measure orange)
 *   Keyboard hint `a`/`d` kept as secondary muted label only.
 */

import { humanizeBlockType } from '@/lib/builder/block-type-labels'
import type { ChecklistBlock } from './useVerifyChecklist'

export type BlockChecklistRowProps = {
  block: ChecklistBlock
  active: boolean
  onClick: () => void
  onApprove: () => void
  onDecline: () => void
}

export function BlockChecklistRow({
  block,
  active,
  onClick,
  onApprove,
  onDecline,
}: BlockChecklistRowProps): React.JSX.Element {
  const verified = block.verified_by_admin_id !== null
  const hasFlags = block.flags_count > 0

  return (
    <div
      data-testid="block-checklist-row"
      data-block-id={block.id}
      data-active={active ? 'true' : 'false'}
      data-verified={verified ? 'true' : 'false'}
      onClick={onClick}
      className={[
        'flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer rounded',
        'border border-transparent',
        active ? 'ring-2 ring-brand-yellow' : '',
        verified ? 'text-[var(--ink-500)]' : 'text-[var(--ink-700)]',
        'hover:bg-[var(--ink-100)]',
      ].join(' ')}
    >
      <span
        aria-hidden
        className={[
          'inline-flex items-center justify-center w-4 h-4 rounded-full border',
          verified
            ? 'border-accent-signoff bg-accent-signoff text-white'
            : 'border-[var(--ink-400)] bg-transparent',
        ].join(' ')}
      >
        {verified ? <span className="text-micro leading-none">&#10003;</span> : null}
      </span>

      {/* Humanized type label — SPEC R4: no raw block.type symbol rendered */}
      <span className="text-micro font-mono uppercase tracking-wider text-[var(--ink-500)] min-w-[3.5rem]">
        {humanizeBlockType(block.type)}
      </span>

      <span className="flex-1 truncate" title={block.preview}>
        {block.preview}
      </span>

      {hasFlags ? (
        <span
          data-testid="flag-badge"
          className={[
            'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-micro font-bold',
            verified
              ? 'bg-[var(--ink-200)] text-[var(--ink-500)]'
              : 'bg-accent-escalate text-white',
          ].join(' ')}
          title={`${block.flags_count} AI reviewer flag(s)`}
        >
          {block.flags_count}
        </span>
      ) : null}

      {/* Action buttons — SPEC R5: word labels as primary affordance; a/d as secondary hints */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          data-testid="row-approve"
          aria-label="Verify step"
          onClick={(e) => {
            e.stopPropagation()
            onApprove()
          }}
          className="flex items-center gap-1 px-2 py-0.5 text-micro font-mono rounded border border-accent-signoff/50 bg-accent-signoff/10 text-accent-signoff hover:bg-accent-signoff/10 disabled:opacity-40 whitespace-nowrap"
        >
          Verify step
          <kbd className="text-micro opacity-50 font-mono border border-[var(--ink-300)] rounded px-0.5 leading-none">A</kbd>
        </button>
        <button
          type="button"
          data-testid="row-decline"
          aria-label="Send back to edit"
          onClick={(e) => {
            e.stopPropagation()
            onDecline()
          }}
          className="flex items-center gap-1 px-2 py-0.5 text-micro font-mono rounded border border-[var(--accent-voice)]/50 text-[var(--accent-voice)] hover:bg-accent-voice/10 whitespace-nowrap"
        >
          Send back to edit
          <kbd className="text-micro opacity-50 font-mono border border-[var(--ink-300)] rounded px-0.5 leading-none">D</kbd>
        </button>
      </div>
    </div>
  )
}
