'use client'

import Link from 'next/link'
import { Clock, CheckCircle2, XCircle, Camera, ChevronRight } from 'lucide-react'
import { StatusBadge } from '@/components/admin/StatusBadge'
import type { CompletionStatus } from '@/types/sop'

interface CompletionHistoryCardProps {
  id: string
  sopTitle: string | null
  submittedAt: string
  status: CompletionStatus
  photoCount: number
  rejectionReason?: string | null
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

function StatusIcon({ status }: { status: CompletionStatus }) {
  if (status === 'pending_sign_off') {
    return (
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-brand-yellow/15 flex items-center justify-center">
        <Clock size={20} className="text-brand-yellow" />
      </div>
    )
  }
  if (status === 'signed_off') {
    return (
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center">
        <CheckCircle2 size={20} className="text-green-400" />
      </div>
    )
  }
  return (
    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center">
      <XCircle size={20} className="text-red-400" />
    </div>
  )
}

export function CompletionHistoryCard({
  id,
  sopTitle,
  submittedAt,
  status,
  photoCount,
  rejectionReason,
}: CompletionHistoryCardProps) {
  return (
    <Link href={`/activity/${id}`}>
      <div className="flex items-start gap-4 p-4 bg-steel-800 rounded-xl hover:bg-steel-700 transition-colors cursor-pointer min-h-[88px]">
        <StatusIcon status={status} />

        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-steel-100 truncate">
            {sopTitle ?? 'Untitled SOP'}
          </p>
          <p className="text-xs text-steel-400 mt-0.5">
            {formatNZDateTime(submittedAt)}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <StatusBadge status={status} />
            {photoCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-bold tabular-nums text-steel-400 bg-steel-700 px-2 py-0.5 rounded">
                <Camera size={10} />
                {photoCount}
              </span>
            )}
          </div>
          {status === 'rejected' && rejectionReason && (
            <p className="text-xs text-red-400 mt-2 line-clamp-2">
              {rejectionReason}
            </p>
          )}
        </div>

        <ChevronRight size={18} className="text-steel-500 flex-shrink-0 mt-2.5" />
      </div>
    </Link>
  )
}
