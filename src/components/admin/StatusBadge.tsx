import { Clock, Check, X } from 'lucide-react'
import type { SopStatus, ParseJobStatus, CompletionStatus } from '@/types/sop'

interface StatusBadgeProps {
  status: SopStatus | ParseJobStatus | CompletionStatus
}

const variantMap: Record<string, string> = {
  // SOP statuses
  uploading: 'bg-[var(--paper-2)] text-[var(--ink-500)]',
  parsing: 'bg-accent-step/20 text-accent-step animate-pulse',
  draft: 'bg-[var(--ink-900)]/20 text-[var(--ink-900)]',
  published: 'bg-accent-signoff/20 text-accent-signoff',
  // ParseJob statuses
  queued: 'bg-[var(--paper-2)] text-[var(--ink-500)]',
  processing: 'bg-accent-step/20 text-accent-step animate-pulse',
  completed: 'bg-accent-signoff/20 text-accent-signoff',
  failed: 'bg-accent-escalate/20 text-accent-escalate',
  // Completion statuses
  pending_sign_off: 'bg-[var(--ink-900)]/20 text-[var(--ink-900)]',
  signed_off: 'bg-accent-signoff/20 text-accent-signoff',
  rejected: 'bg-accent-escalate/20 text-accent-escalate',
}

const labelMap: Record<string, string> = {
  uploading: 'Uploading',
  parsing: 'Parsing',
  draft: 'Draft',
  published: 'Published',
  queued: 'Queued',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
  pending_sign_off: 'Pending review',
  signed_off: 'Approved',
  rejected: 'Rejected',
}

const completionStatuses = new Set<string>(['pending_sign_off', 'signed_off', 'rejected'])

function CompletionIcon({ status }: { status: string }) {
  if (status === 'pending_sign_off') return <Clock size={10} />
  if (status === 'signed_off') return <Check size={10} />
  if (status === 'rejected') return <X size={10} />
  return null
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const variantClass = variantMap[status] ?? 'bg-[var(--paper-2)] text-[var(--ink-500)]'
  const label = labelMap[status] ?? status
  const isCompletion = completionStatuses.has(status)

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold ${variantClass}`}
    >
      {isCompletion && <CompletionIcon status={status} />}
      {label}
    </span>
  )
}
