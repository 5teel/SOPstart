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
        className="fixed inset-0 z-40 bg-steel-900/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 bg-steel-800 rounded-t-2xl pt-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))] px-4 flex flex-col gap-4"
        role="dialog"
        aria-modal="true"
        aria-label="Reject completion"
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-steel-600 rounded-full mx-auto mb-2" />

        {/* Heading */}
        <h2 className="text-lg font-semibold text-steel-100">Reject completion</h2>

        {/* Sub-copy */}
        <p className="text-sm text-steel-400 -mt-2">
          The worker will be notified and asked to redo this SOP.
        </p>

        <div className="border-t border-steel-700" />

        {/* Label + helper */}
        <div className="flex flex-col gap-1">
          <label htmlFor="reject-reason" className="text-sm font-semibold text-steel-100">
            Reason for rejection
          </label>
          <p className="text-xs text-steel-400">
            Be specific — the worker will see this message.
          </p>
        </div>

        {/* Textarea */}
        <div className="flex flex-col gap-1">
          <textarea
            id="reject-reason"
            className="w-full bg-steel-900 border border-steel-700 rounded-xl text-base text-steel-100 p-3 resize-none min-h-[120px] focus:outline-none focus:ring-2 focus:ring-red-500/50 placeholder:text-steel-500"
            placeholder="e.g. PPE photo shows gloves were not worn. Redo step 3 with correct PPE."
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, MAX_LENGTH))}
            disabled={isSubmitting}
          />
          <span className="text-xs text-steel-400 text-right tabular-nums">
            {reason.length}/{MAX_LENGTH}
          </span>
        </div>

        {/* Confirm Rejection button */}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!isValid || isSubmitting}
          className={`w-full h-[72px] rounded-xl font-bold text-lg bg-red-500 text-white flex items-center justify-center gap-2 transition-opacity ${
            !isValid || isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-600'
          }`}
        >
          <X size={20} />
          {isSubmitting ? 'Submitting…' : 'Confirm Rejection'}
        </button>

        {/* Cancel */}
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="text-sm text-steel-400 hover:text-steel-100 text-center mt-1 py-2 cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </>
  )
}
