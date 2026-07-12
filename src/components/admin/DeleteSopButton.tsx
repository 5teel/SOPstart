'use client'

import { useState, useTransition } from 'react'
import { Trash2, Loader2 } from 'lucide-react'
import { deleteSop } from '@/actions/sops'
import { useRouter } from 'next/navigation'

export function DeleteSopButton({
  sopId,
  redirectTo,
  showLabel = false,
}: {
  sopId: string
  /** When set, navigate here after delete instead of refreshing (builder context — the deleted SOP's page can't refresh). */
  redirectTo?: string
  /** Render a visible text label next to the icon (labelled action menu, UX-06). */
  showLabel?: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <div className="flex gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={() => {
            startTransition(async () => {
              await deleteSop(sopId)
              setConfirming(false)
              if (redirectTo) {
                router.push(redirectTo)
              } else {
                router.refresh()
              }
            })
          }}
          disabled={pending}
          className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-900/40 border border-red-500/40 text-red-400 hover:bg-red-900/60 transition-colors"
          title="Confirm delete"
          aria-label="Confirm delete"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="flex items-center justify-center w-10 h-10 rounded-lg bg-white border border-[var(--ink-100)] text-[var(--ink-500)] hover:text-[var(--ink-900)] transition-colors text-xs font-medium"
          title="Cancel"
          aria-label="Cancel delete"
        >
          No
        </button>
      </div>
    )
  }

  if (showLabel) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--accent-escalate)] hover:bg-[var(--paper-2)] transition-colors"
        aria-label="Delete SOP"
      >
        <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        Delete SOP
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="flex items-center justify-center w-10 h-10 rounded-lg bg-white border border-[var(--ink-100)] hover:bg-red-900/30 hover:border-red-500/40 transition-colors text-[var(--ink-500)] hover:text-red-400 flex-shrink-0"
      title="Delete SOP"
      aria-label="Delete SOP"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  )
}
