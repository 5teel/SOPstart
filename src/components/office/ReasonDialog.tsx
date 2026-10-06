'use client'

/**
 * Phase 59 -- the one focused reason dialog (Reject / Send back / Remove). The screen
 * recedes behind a scrim; Esc closes only this layer (A-12); the server keeps its own
 * 10-character rule, this is the polite half.
 */
import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { DialogShell } from '@/components/requests/DialogShell'

export interface ReasonDialogProps {
  title: string
  body: string
  label: string
  confirmLabel: string
  confirmTone: 'escalate' | 'ink'
  cancelLabel?: string
  pending: boolean
  error: string | null
  onConfirm(reason: string): void
  onCancel(): void
}

const MIN = 10

export function ReasonDialog({
  title,
  body,
  label,
  confirmLabel,
  confirmTone,
  cancelLabel = 'Keep reviewing',
  pending,
  error,
  onConfirm,
  onCancel,
}: ReasonDialogProps) {
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  const trimmed = reason.trim()
  const valid = trimmed.length >= MIN

  // Focus lands in the field; the shell hands it back to whatever opened the dialog.
  useEffect(() => {
    fieldRef.current?.focus()
  }, [])

  const confirmClass =
    confirmTone === 'escalate' ? 'bg-accent-escalate text-white' : 'bg-ink-900 text-paper'

  return (
    <DialogShell
      labelledBy="reason-dialog-title"
      testId="reason-dialog"
      onEscape={() => {
        if (!pending) onCancel()
      }}
    >
        <h2 id="reason-dialog-title" className="text-lg font-semibold text-ink-900">
          {title}
        </h2>
        <p className="text-ui text-ink-700">{body}</p>
        <div className="flex flex-col gap-1">
          <label htmlFor="reason-dialog-field" className="text-ui font-semibold text-ink-900">
            {label}
          </label>
          <textarea
            id="reason-dialog-field"
            ref={fieldRef}
            data-testid="reason-dialog-field"
            rows={4}
            maxLength={500}
            value={reason}
            disabled={pending}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
            className="w-full resize-none rounded-lg border border-ink-300 bg-paper-1 p-3 text-reading text-ink-900 focus:border-ink-900 focus:outline-none"
          />
          <span className={`text-ui ${touched && !valid ? 'text-accent-escalate' : 'text-ink-500'}`}>
            10 characters or more.
          </span>
        </div>
        {error && (
          <p role="alert" className="text-ui text-accent-escalate">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            data-testid="reason-dialog-confirm"
            disabled={!valid || pending}
            onClick={() => onConfirm(trimmed)}
            className={`flex min-h-tap flex-1 items-center justify-center gap-2 rounded-lg text-ui font-semibold disabled:opacity-50 ${confirmClass}`}
          >
            {pending && <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {confirmLabel}
          </button>
          <button
            type="button"
            data-testid="reason-dialog-cancel"
            disabled={pending}
            onClick={onCancel}
            className="min-h-tap flex-1 rounded-lg text-ui text-ink-700 hover:bg-paper-2"
          >
            {cancelLabel}
          </button>
        </div>
    </DialogShell>
  )
}
