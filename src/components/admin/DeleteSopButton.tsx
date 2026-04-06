'use client'

import { useState, useTransition } from 'react'
import { Trash2, Loader2 } from 'lucide-react'
import { deleteSop } from '@/actions/sops'
import { useRouter } from 'next/navigation'

export function DeleteSopButton({ sopId }: { sopId: string }) {
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
              router.refresh()
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
          className="flex items-center justify-center w-10 h-10 rounded-lg bg-steel-800 border border-steel-700 text-steel-400 hover:text-steel-100 transition-colors text-xs font-medium"
          title="Cancel"
          aria-label="Cancel delete"
        >
          No
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="flex items-center justify-center w-10 h-10 rounded-lg bg-steel-800 border border-steel-700 hover:bg-red-900/30 hover:border-red-500/40 transition-colors text-steel-400 hover:text-red-400 flex-shrink-0"
      title="Delete SOP"
      aria-label="Delete SOP"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  )
}
