'use client'

import Link from 'next/link'
import { Camera, ChevronRight } from 'lucide-react'
import { StatusBadge } from '@/components/admin/StatusBadge'
import type { CompletionStatus } from '@/types/sop'

interface CompletionSummaryCardProps {
  id: string
  sopTitle: string | null
  submittedAt: string
  status: CompletionStatus
  photoCount: number
  workerName: string
  workerId: string
}

function formatNZDateTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleDateString('en-NZ', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).replace(',', ' ·')
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function CompletionSummaryCard({
  id,
  sopTitle,
  submittedAt,
  status,
  photoCount,
  workerName,
}: CompletionSummaryCardProps) {
  const isPending = status === 'pending_sign_off'

  return (
    <Link href={`/activity/${id}`}>
      <div
        className={`flex items-start gap-4 p-4 bg-steel-800 rounded-xl hover:bg-steel-700 transition-colors cursor-pointer min-h-[100px] ${
          isPending ? 'border-l-4 border-brand-yellow' : ''
        }`}
      >
        {/* Worker avatar */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-steel-700 flex items-center justify-center text-xs font-bold text-steel-100">
          {getInitials(workerName)}
        </div>

        <div className="flex-1 min-w-0">
          {/* Worker name + status */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-steel-100">{workerName}</span>
            <StatusBadge status={status} />
          </div>

          {/* SOP title */}
          <p className="text-sm text-steel-400 mt-0.5 truncate">
            {sopTitle ?? 'Untitled SOP'}
          </p>

          {/* Date + photo count */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-steel-400">{formatNZDateTime(submittedAt)}</span>
            {photoCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-bold tabular-nums text-steel-400 bg-steel-700 px-2 py-0.5 rounded">
                <Camera size={10} />
                {photoCount}
              </span>
            )}
          </div>
        </div>

        <ChevronRight size={18} className="text-steel-500 flex-shrink-0 mt-2.5" />
      </div>
    </Link>
  )
}
