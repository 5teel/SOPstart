interface ObservationRowProps {
  sopTitle: string | null
  sopVersion: number
  verdict: string
  note: string | null
  observerName: string
  createdAt: string
  labels: { performed_to_sop: string; needs_support: string }
}

function formatNZDateTime(isoString: string): string {
  const date = new Date(isoString)
  return date
    .toLocaleDateString('en-NZ', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    .replace(',', ' ·')
}

export function ObservationRow({
  sopTitle,
  sopVersion,
  verdict,
  note,
  observerName,
  createdAt,
  labels,
}: ObservationRowProps) {
  const accentVar = verdict === 'needs_support' ? '--accent-decision' : '--accent-ok'
  const verdictLabel = (labels as Record<string, string>)[verdict] ?? verdict

  return (
    <div className="flex items-start gap-3 py-3 px-3.5 border-b border-[var(--ink-100)] last:border-b-0">
      <span
        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
        style={{ background: `var(${accentVar})` }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-[var(--ink-900)]">
          {sopTitle ?? 'Untitled SOP'}{' '}
          <span className="font-normal text-[var(--ink-500)]">— {verdictLabel}</span>
        </div>
        <div className="text-xs text-[var(--ink-500)] mt-0.5">
          Observed by {observerName} · {formatNZDateTime(createdAt)} · SOP v{sopVersion}
        </div>
        {note && (
          <p className="text-sm text-[var(--ink-700)] mt-1.5 whitespace-pre-wrap">{note}</p>
        )}
      </div>
    </div>
  )
}
