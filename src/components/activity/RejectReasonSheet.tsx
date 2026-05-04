'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface RejectReasonSheetProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
  isSubmitting: boolean
}

export function RejectReasonSheet({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
}: RejectReasonSheetProps) {
  const [reason, setReason] = useState('')

  const isValid = reason.trim().length >= 10
  const MAX_LENGTH = 500

  async function handleConfirm() {
    if (!isValid || isSubmitting) return
    await onConfirm(reason.trim())
    setReason('')
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-[var(--ink-900)]/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl pt-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))] px-4 flex flex-col gap-4 border-t border-[var(--ink-100)]"
        role="dialog"
        aria-modal="true"
        aria-label="Reject completion"
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-[var(--ink-300)] rounded-full mx-auto mb-2" />

        <h2 className="text-lg font-semibold text-[var(--ink-900)]">Reject completion</h2>

        <p className="text-sm text-[var(--ink-500)] -mt-2">
          The worker will be notified and asked to redo this SOP.
        </p>

        <div className="border-t border-[var(--ink-100)]" />

        <div className="flex flex-col gap-1">
          <label htmlFor="reject-reason" className="text-sm font-semibold text-[var(--ink-900)]">
            Reason for rejection
          </label>
          <p className="text-xs text-[var(--ink-500)]">
            Be specific — the worker will see this message.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <textarea
            id="reject-reason"
            className="w-full bg-[var(--paper-2)] border border-[var(--ink-100)] rounded-xl text-base text-[var(--ink-900)] p-3 resize-none min-h-[120px] focus:outline-none focus:ring-2 focus:ring-[var(--accent-escalate)]/30 placeholder:text-[var(--ink-300)]"
            placeholder="e.g. PPE photo shows gloves were not worn. Redo step 3 with correct PPE."
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, MAX_LENGTH))}
            disabled={isSubmitting}
          />
          <span className="mono text-xs text-[var(--ink-500)] text-right tabular-nums">
            {reason.length}/{MAX_LENGTH}
          </span>
        </div>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={!isValid || isSubmitting}
          className={`w-full h-[72px] rounded-xl font-bold text-lg bg-[var(--accent-escalate)] text-white flex items-center justify-center gap-2 transition-opacity ${
            !isValid || isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'
          }`}
        >
          <X size={20} />
          {isSubmitting ? 'Submitting…' : 'Confirm Rejection'}
        </button>

        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="text-sm text-[var(--ink-500)] hover:text-[var(--ink-900)] text-center mt-1 py-2 cursor-pointer transition-colors"
        >
          Cancel
        </button>
      </div>
    </>
  )
}
