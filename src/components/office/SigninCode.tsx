'use client'

/**
 * Phase 67 / ADR-0029 -- "Give a sign-in code". The People sheet (admins and safety managers) and
 * a supervisor's "Your workers" list under the Sign-offs inbox share this. The code is shown once,
 * in large type with the person's name and the time it stops working, and lives only in this
 * component's state: Done forgets it. The server decides who may issue (issueSigninCode).
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { issueSigninCode, listSigninCodeWorkers } from '@/actions/members'
import type { RowDone } from './InboxRow'

const until = (iso: string) => new Date(iso).toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' })
const BUTTON = 'min-h-tap rounded-lg border border-ink-300 bg-paper-1 px-4 text-ui font-semibold text-ink-900 hover:bg-paper-2 disabled:opacity-50'

export function SigninCodeButton({
  userId,
  label,
  resets = false,
  onReceipt,
}: {
  userId: string
  label: string
  /** The person is an admin or safety manager: their second steps are cleared too, so ask first. */
  resets?: boolean
  onReceipt?(r: RowDone): void
}) {
  const [ask, setAsk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shown, setShown] = useState<{ code: string; name: string; expiresAt: string } | null>(null)

  async function give() {
    setBusy(true)
    setError(null)
    try {
      const res = await issueSigninCode(userId)
      if ('error' in res) setError(res.error)
      else {
        setShown({ code: res.code, name: res.name, expiresAt: res.expiresAt })
        onReceipt?.({ receipt: 'Sign-in code given', logged: res.logged })
      }
    } catch {
      setError("That didn't work. Try again.")
    } finally {
      setBusy(false)
      setAsk(false)
    }
  }

  if (shown) {
    return (
      <div data-testid="signin-code-shown" className="flex w-full flex-col gap-2 rounded-lg border border-ink-900 bg-paper-1 p-4">
        <p className="text-ui text-ink-700">Sign-in code for {shown.name}</p>
        <p data-testid="signin-code-value" className="mono text-3xl font-bold tracking-widest text-ink-900 select-all">
          {shown.code}
        </p>
        <p className="text-ui text-ink-900">
          Give this to {shown.name}. It works once, until {until(shown.expiresAt)}.
        </p>
        <p className="text-meta text-ink-500">On the login screen they tap &ldquo;Got a code from your supervisor?&rdquo;, then set a new password.</p>
        <button type="button" data-testid="signin-code-done" onClick={() => setShown(null)} className="min-h-tap self-start rounded-lg bg-ink-900 px-4 text-ui font-semibold text-paper">
          Done
        </button>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-2">
      {resets && ask ? (
        <div data-testid="signin-code-ask" className="flex flex-col gap-2">
          <p className="text-ui text-ink-900">
            Give {label} a sign-in code? Their authenticator app and recovery codes are cleared too, and every admin is told.
          </p>
          <div className="flex gap-2">
            <button type="button" data-testid="signin-code-confirm" disabled={busy} onClick={give} className="min-h-tap rounded-lg bg-ink-900 px-4 text-ui font-semibold text-paper disabled:opacity-50">
              Give a code
            </button>
            <button type="button" onClick={() => setAsk(false)} className={BUTTON}>
              Keep
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          data-testid="signin-code-give"
          aria-label={`Give ${label} a sign-in code`}
          disabled={busy}
          onClick={() => (resets ? setAsk(true) : void give())}
          className={`${BUTTON} self-start`}
        >
          {busy ? 'Making a code…' : 'Give a sign-in code'}
        </button>
      )}
      {error && (
        <p role="alert" data-testid="signin-code-refused" className="text-ui text-accent-escalate">
          {error}
        </p>
      )}
    </div>
  )
}

/** A supervisor's own workers, each with "Give a sign-in code" (D-01 row 1). */
export function SigninCodeWorkers() {
  const q = useQuery({ queryKey: ['signin-code-workers'], queryFn: () => listSigninCodeWorkers() })
  const workers = q.data && 'workers' in q.data ? q.data.workers : []
  if (workers.length === 0) return null
  return (
    <section data-testid="signin-code-workers" className="mt-8 flex flex-col gap-3 border-t border-ink-200 pt-4">
      <h3 className="section-heading">Your workers</h3>
      <p className="text-meta text-ink-500">Locked out? Give them a sign-in code in person.</p>
      <ul className="flex flex-col gap-3">
        {workers.map((w) => (
          <li key={w.userId} data-testid="signin-code-worker" className="flex flex-col gap-2">
            <span className="text-ui font-semibold text-ink-900">{w.name}</span>
            <SigninCodeButton userId={w.userId} label={w.name} />
          </li>
        ))}
      </ul>
    </section>
  )
}
