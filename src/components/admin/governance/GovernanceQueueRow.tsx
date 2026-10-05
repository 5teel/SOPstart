'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { confirmSopCurrent } from '@/actions/governance'
import type { GovernanceRow } from '@/actions/governance'
import { approveStep } from '@/actions/approvals'
import { OwnerPicker } from './OwnerPicker'
import { focusHref } from '@/lib/sop/focus-path'

const FLAG_STYLE: Record<GovernanceRow['flags'][number], string> = {
  overdue: 'bg-accent-escalate/20 text-accent-escalate',
  due_soon: 'bg-accent-decision/20 text-accent-decision',
  unowned: 'bg-[var(--paper-2)] text-[var(--ink-500)]',
  stale_role: 'bg-[var(--paper-2)] text-[var(--ink-500)]',
  awaiting_approval: 'bg-[var(--accent-signoff)]/20 text-[var(--accent-signoff)]',
}

const FLAG_LABEL: Record<GovernanceRow['flags'][number], string> = {
  overdue: 'Overdue',
  due_soon: 'Due soon',
  unowned: 'No owner',
  stale_role: 'Owner role gone',
  awaiting_approval: 'Awaiting approval',
}

const SEVERITY_DOT: Record<'bad' | 'warn' | 'info' | 'grey', string> = {
  bad: 'bg-accent-escalate',
  warn: 'bg-accent-decision',
  info: 'bg-accent-measure',
  grey: 'bg-[var(--ink-300)]',
}

/**
 * Phase 54 (D-03): this is the one place the approval/ownership gate for a
 * governance-queue row lives. The Governance inbox (src/components/admin/
 * governance/GovernanceInbox.tsx) renders every governance-sourced item
 * through this component unchanged — the action-branch precedence below
 * (approve-me before unowned before stale-role before confirm-current) is
 * the APR-03/04 hard constraint (Phase 29/41). Do not re-implement it
 * elsewhere; add optional display props here instead.
 */
export function GovernanceQueueRow({
  row,
  title,
  meta,
  age,
  severity,
}: {
  row: GovernanceRow
  title?: string
  meta?: string
  age?: string
  severity?: 'bad' | 'warn' | 'info' | 'grey'
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleConfirmCurrent() {
    setError(null)
    startTransition(async () => {
      const result = await confirmSopCurrent(row.id)
      if ('error' in result) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  function handleApprove() {
    setError(null)
    startTransition(async () => {
      const result = await approveStep(row.id)
      if ('error' in result) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <li
      data-testid="gov-row"
      data-kind="governance"
      data-severity={severity ?? 'grey'}
      className="grid grid-cols-[10px_1fr_auto_auto] items-center gap-2.5 border-b border-[var(--ink-100)] px-3.5 py-2.5"
    >
      <span className={`h-2.5 w-2.5 rounded-full ${SEVERITY_DOT[severity ?? 'grey']}`} />

      <div className="min-w-0">
        <Link
          href={focusHref(row.id, { mode: 'edit', from: 'office' })}
          className="text-base font-semibold text-[var(--ink-900)] truncate hover:underline"
        >
          {title ?? row.title ?? 'Untitled SOP'}
        </Link>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {meta && <span className="text-meta text-[var(--ink-500)]">{meta}</span>}
          {row.flags.map((flag) => (
            <span key={flag} className={`mono text-meta px-1.5 py-0.5 rounded ${FLAG_STYLE[flag]}`}>
              {FLAG_LABEL[flag]}
            </span>
          ))}
        </div>
        {error && <p className="text-xs text-accent-escalate mt-1">{error}</p>}
      </div>

      <span className="mono text-meta text-[var(--ink-500)]">{age}</span>

      <div className="flex-shrink-0">
        {row.flags.includes('awaiting_approval') && row.isCallerNextApprover ? (
          <button
            type="button"
            onClick={handleApprove}
            disabled={isPending}
            className="evidence-btn !min-h-9 text-sm"
          >
            {isPending ? 'Approving…' : 'Approve'}
          </button>
        ) : row.flags.includes('unowned') ? (
          <OwnerPicker
            sopId={row.id}
            ownerUserId={row.ownerUserId}
            ownerLabel={row.ownerLabel}
            onDone={() => router.refresh()}
          />
        ) : row.flags.includes('stale_role') ? (
          <Link href={`/admin/sops/${row.id}/assign`} className="evidence-btn !min-h-9 text-sm">
            Fix assignment
          </Link>
        ) : (
          <button
            type="button"
            onClick={handleConfirmCurrent}
            disabled={isPending}
            className="evidence-btn !min-h-9 text-sm"
          >
            {isPending ? 'Confirming…' : 'Confirm current'}
          </button>
        )}
      </div>
    </li>
  )
}
