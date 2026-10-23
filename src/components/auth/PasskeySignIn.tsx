'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { browserHasPasskeys, passkeyErrorWords } from '@/lib/auth/passkey-words'

// Phase 65 / ADR-0027: "Sign in with a passkey" above the password form. The browser client
// writes the session cookies; the full page load of /login then meets the proxy, which sends a
// signed-in visitor to the validated ?next= or their role home (the same rule as a password
// sign-in). No client router redirect. Hidden where the browser has no WebAuthn.
export function PasskeySignIn({ next }: { next?: string }) {
  const [supported, setSupported] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setSupported(browserHasPasskeys()), [])
  if (!supported) return null

  async function signIn() {
    setBusy(true)
    setError(null)
    const { data, error } = await createClient().auth.signInWithPasskey()
    if (error || !data?.session) {
      setError(passkeyErrorWords(error, 'sign-in'))
      setBusy(false)
      return
    }
    window.location.assign(next ? `/login?next=${encodeURIComponent(next)}` : '/login')
  }

  return (
    <div className="mb-6 space-y-3">
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        className="w-full min-h-tap-row rounded-lg border border-[var(--ink-900)] bg-white text-[var(--ink-900)] font-bold text-base disabled:opacity-60"
      >
        {busy ? 'Signing in…' : 'Sign in with a passkey'}
      </button>
      {error && (
        <p role="alert" className="rounded-lg border border-[var(--accent-escalate)] px-4 py-3 text-sm text-[var(--accent-escalate)]">
          {error}
        </p>
      )}
      <p className="text-center text-meta text-[var(--ink-500)]">or use your email and password</p>
    </div>
  )
}
