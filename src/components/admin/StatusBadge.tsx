import type { SopStatus, ParseJobStatus } from '@/types/sop'

interface StatusBadgeProps {
  status: SopStatus | ParseJobStatus
}

const variantMap: Record<string, string> = {
  // SOP statuses
  uploading: 'bg-steel-700 text-steel-400',
  parsing: 'bg-blue-500/20 text-blue-400 animate-pulse',
  draft: 'bg-brand-yellow/20 text-brand-yellow',
  published: 'bg-green-500/20 text-green-400',
  // ParseJob statuses
  queued: 'bg-steel-700 text-steel-400',
  processing: 'bg-blue-500/20 text-blue-400 animate-pulse',
  completed: 'bg-green-500/20 text-green-400',
  failed: 'bg-red-500/20 text-red-400',
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
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const variantClass = variantMap[status] ?? 'bg-steel-700 text-steel-400'
  const label = labelMap[status] ?? status

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold ${variantClass}`}
    >
      {label}
    </span>
  )
}
