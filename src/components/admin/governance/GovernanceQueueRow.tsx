'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { confirmSopCurrent } from '@/actions/governance'
import type { GovernanceRow } from '@/actions/governance'
import { OwnerPicker } from './OwnerPicker'

const FLAG_STYLE: Record<GovernanceRow['flags'][number], string> = {
  overdue: 'bg-red-500/20 text-red-600',
  due_soon: 'bg-amber-500/20 text-amber-700',
  unowned: 'bg-[var(--paper-2)] text-[var(--ink-500)]',
  stale_role: 'bg-[var(--paper-2)] text-[var(--ink-500)]',
}

const FLAG_LABEL: Record<GovernanceRow['flags'][number], string> = {
  overdue: 'Overdue',
  due_soon: 'Due soon',
  unowned: 'Unowned',
  stale_role: 'Stale role',
}

function formatDate(iso: string | null): string {
  if (!iso) return 'No date set'
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function GovernanceQueueRow({ row }: { row: GovernanceRow }) {
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

  return (
    <li className="blueprint-frame flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-base font-semibold text-[var(--ink-900)] truncate">
          {row.title ?? 'Untitled SOP'}
        </p>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {row.category && <span className="text-xs text-[var(--ink-500)]">{row.category}</span>}
          <span className="mono text-[11px] text-[var(--ink-500)]">Owner: {row.ownerLabel}</span>
          <span className="mono text-[11px] text-[var(--ink-500)]">Due: {formatDate(row.reviewDueAt)}</span>
          {row.flags.map((flag) => (
            <span
              key={flag}
              className={`mono text-[11px] px-1.5 py-0.5 rounded ${FLAG_STYLE[flag]}`}
            >
              {FLAG_LABEL[flag]}
            </span>
          ))}
        </div>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>

      <div className="flex-shrink-0">
        {row.flags.includes('unowned') ? (
          <OwnerPicker sopId={row.id} ownerUserId={row.ownerUserId} ownerLabel={row.ownerLabel} />
        ) : row.flags.includes('stale_role') ? (
          <Link href={`/admin/sops/${row.id}/assign`} className="evidence-btn !min-h-[36px] text-sm">
            Fix assignment
          </Link>
        ) : (
          <button
            type="button"
            onClick={handleConfirmCurrent}
            disabled={isPending}
            className="evidence-btn !min-h-[36px] text-sm"
          >
            {isPending ? 'Confirming…' : 'Confirm current'}
          </button>
        )}
      </div>
    </li>
  )
}
