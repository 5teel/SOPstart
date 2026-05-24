'use client'

/**
 * Phase 21 (Plan 21-04 Task 1) — Single row in the VerifyChecklist sidebar.
 *
 * Layout: [check-state | type label | preview text | flag badge]
 *   - Verified: green check + faded text
 *   - Unverified: empty circle + normal text
 *   - Active: 2px yellow ring (`ring-2 ring-yellow-400`) matches Spike 004
 *     focus-ring affordance — admin's eye lands here.
 *   - Flag badge: red number when `flags_count > 0 && !verified`; faded
 *     when `verified` (so the eye-flow stops at unaddressed-flag rows).
 */

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
        active ? 'ring-2 ring-yellow-400' : '',
        verified ? 'text-[var(--ink-500)]' : 'text-[var(--ink-700)]',
        'hover:bg-[var(--ink-100)]',
      ].join(' ')}
    >
      <span
        aria-hidden
        className={[
          'inline-flex items-center justify-center w-4 h-4 rounded-full border',
          verified
            ? 'border-green-500 bg-green-500 text-white'
            : 'border-[var(--ink-400)] bg-transparent',
        ].join(' ')}
      >
        {verified ? <span className="text-[10px] leading-none">&#10003;</span> : null}
      </span>

      <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--ink-500)] min-w-[3.5rem]">
        {block.type}
      </span>

      <span className="flex-1 truncate" title={block.preview}>
        {block.preview}
      </span>

      {hasFlags ? (
        <span
          data-testid="flag-badge"
          className={[
            'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-[10px] font-bold',
            verified
              ? 'bg-[var(--ink-200)] text-[var(--ink-500)]'
              : 'bg-red-500 text-white',
          ].join(' ')}
          title={`${block.flags_count} AI reviewer flag(s)`}
        >
          {block.flags_count}
        </span>
      ) : null}

      <div className="flex items-center gap-1">
        <button
          type="button"
          data-testid="row-approve"
          aria-label="Approve block"
          onClick={(e) => {
            e.stopPropagation()
            onApprove()
          }}
          className="px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded border border-green-500/40 text-green-700 hover:bg-green-50 disabled:opacity-40"
        >
          a
        </button>
        <button
          type="button"
          data-testid="row-decline"
          aria-label="Decline / revisit block"
          onClick={(e) => {
            e.stopPropagation()
            onDecline()
          }}
          className="px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded border border-amber-500/40 text-amber-700 hover:bg-amber-50"
        >
          d
        </button>
      </div>
    </div>
  )
}
