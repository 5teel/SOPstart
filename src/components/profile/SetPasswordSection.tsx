'use client'

import { useState } from 'react'
import { setNewPassword } from '@/actions/auth'

// Phase 67 / ADR-0029: shown on Profile after a sign-in code. The proxy keeps the person on
// Profile until this is done; the action clears the hold and redirects on the server.
const FIELD =
  'w-full px-4 py-3 rounded-lg bg-white border border-[var(--ink-100)] text-[var(--ink-900)] focus:outline-none focus:ring-2 focus:ring-[var(--ink-900)] focus:border-transparent text-base'

export function SetPasswordSection() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await setNewPassword({ password, confirm })
      if (res?.error) setError(res.error)
    } catch {
      // redirect() throws: the password is set and the server is sending them on.
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="blueprint-frame p-5 space-y-3" data-testid="set-password-section">
      <h2 className="section-heading">Set a new password</h2>
      <p className="text-sm text-[var(--ink-700)]">
        You signed in with a code from your supervisor. Set a new password before you go on. You can add a passkey below too.
      </p>
      <div>
        <label htmlFor="new-password" className="block text-sm font-medium text-[var(--ink-900)] mb-1">
          New password
        </label>
        <input id="new-password" data-testid="set-password-new" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={FIELD} />
        <p className="mt-1 text-meta text-[var(--ink-500)]">At least 8 characters.</p>
      </div>
      <div>
        <label htmlFor="confirm-password" className="block text-sm font-medium text-[var(--ink-900)] mb-1">
          Type it again
        </label>
        <input id="confirm-password" data-testid="set-password-confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={FIELD} />
      </div>
      {error && (
        <p role="alert" data-testid="set-password-error" className="text-sm text-[var(--accent-escalate)]">
          {error}
        </p>
      )}
      <button type="submit" data-testid="set-password-submit" disabled={busy} className="w-full min-h-tap-row bg-[var(--ink-900)] disabled:opacity-60 text-white font-bold rounded-lg text-base">
        {busy ? 'Saving…' : 'Set password and go on'}
      </button>
    </form>
  )
}
