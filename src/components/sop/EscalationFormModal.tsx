'use client'
import { useState } from 'react'

interface Payload {
  reason: string
  photos?: string[]
  measurements?: Record<string, unknown>
}

export function EscalationFormModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void
  onSubmit: (payload: Payload) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Escalation report"
      data-escalation-modal="true"
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
    >
      <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl">
        <h3 className="text-base font-semibold mb-3">Escalation report</h3>
        <textarea
          className="w-full border border-[var(--ink-300,#d4d4d8)] rounded p-2 min-h-[120px] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent-escalate)]"
          placeholder="Describe the issue…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-label="Reason"
          disabled={busy}
        />
        <div className="flex items-center justify-end gap-2 mt-3">
          <button
            type="button"
            className="evidence-btn"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="evidence-btn"
            style={{
              background: reason.trim().length > 0 && !busy ? 'var(--accent-escalate)' : undefined,
              color: reason.trim().length > 0 && !busy ? 'white' : undefined,
              borderColor: 'var(--accent-escalate)',
            }}
            disabled={busy || reason.trim().length === 0}
            onClick={async () => {
              setBusy(true)
              try {
                await onSubmit({ reason })
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}
