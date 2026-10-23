'use client'

import { useState } from 'react'
import { signInWithCode } from '@/actions/auth'

// Phase 67 / ADR-0029: "Got a code from your supervisor?" on the login screen. The action redirects
// on the server when the code is good (redirect() throws here, which is the success path); every
// failure comes back as the same one sentence.
const FIELD =
  'w-full px-4 py-3 rounded-lg bg-white border border-[var(--ink-100)] text-[var(--ink-900)] placeholder-[var(--ink-500)] focus:outline-none focus:ring-2 focus:ring-[var(--ink-900)] focus:border-transparent text-base'

export function SigninCodeForm() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) {
    return (
      <div className="mt-6 text-center">
        <button
          type="button"
          data-testid="signin-code-open"
          onClick={() => setOpen(true)}
          className="min-h-tap px-4 text-sm font-semibold text-[var(--ink-900)] underline underline-offset-4"
        >
          Got a code from your supervisor?
        </button>
      </div>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await signInWithCode({ email, code })
      if (res?.error) setError(res.error)
    } catch {
      // redirect() throws: the code was good and the server is sending them on.
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} data-testid="signin-code-form" className="mt-6 space-y-4 rounded-lg border border-[var(--ink-100)] bg-white p-4">
      <h3 className="section-heading">Sign in with a code</h3>
      <p className="text-sm text-[var(--ink-700)]">Type your email and the code your supervisor gave you. Then you set a new password.</p>
      <div>
        <label htmlFor="code-email" className="block text-sm font-medium text-[var(--ink-900)] mb-1">
          Email Address
        </label>
        <input id="code-email" data-testid="signin-code-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={FIELD} />
      </div>
      <div>
        <label htmlFor="code-code" className="block text-sm font-medium text-[var(--ink-900)] mb-1">
          Code
        </label>
        <input
          id="code-code"
          data-testid="signin-code-code"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          required
          placeholder="ABCD-EFGH"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className={`${FIELD} mono tracking-widest uppercase`}
        />
      </div>
      {error && (
        <p role="alert" data-testid="signin-code-error" className="rounded-lg border border-[var(--accent-escalate)] px-4 py-3 text-sm text-[var(--accent-escalate)]">
          {error}
        </p>
      )}
      <button
        type="submit"
        data-testid="signin-code-submit"
        disabled={busy}
        className="w-full min-h-tap-row bg-[var(--ink-900)] disabled:opacity-60 text-white font-bold rounded-lg text-base"
      >
        {busy ? 'Signing in…' : 'Sign in with the code'}
      </button>
    </form>
  )
}
