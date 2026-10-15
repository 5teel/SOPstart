'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/** The approval lands in the access token: take a fresh one, then try the home again. */
export function CheckAgain() {
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      data-testid="pending-check"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        await createClient().auth.refreshSession()
        window.location.assign('/')
      }}
      className="mt-4 min-h-tap rounded-lg bg-ink-900 px-5 text-ui font-semibold text-paper disabled:opacity-60"
    >
      {busy ? 'Checking…' : 'Check again'}
    </button>
  )
}
