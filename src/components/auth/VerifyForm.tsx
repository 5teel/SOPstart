'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { issueRecoveryCodes, recordFactorChange, redeemRecoveryCode } from '@/actions/mfa'
import { RecoveryCodes } from './RecoveryCodes'

// Phase 66 / ADR-0028. Three states: set up an authenticator app (then the recovery codes),
// enter a code, or use a recovery code. Every success reloads /verify, and the server page
// sends an aal2 session on to the validated `next` (no client router redirect).

type Mode = 'enrol' | 'challenge' | 'recovery'
const INPUT =
  'w-full px-4 py-3 rounded-lg bg-white border border-[var(--ink-100)] text-[var(--ink-900)] placeholder-[var(--ink-500)] focus:outline-none focus:ring-2 focus:ring-[var(--ink-900)] focus:border-transparent text-base'
const PRIMARY = 'w-full min-h-tap-row rounded-lg bg-[var(--ink-900)] text-white font-bold text-base disabled:opacity-60'
const LINK = 'min-h-tap text-sm font-semibold text-[var(--ink-900)] underline'

export function VerifyForm({
  mode: initial,
  factorId,
  next,
  elevated,
}: {
  mode: 'enrol' | 'challenge'
  factorId: string | null
  next: string
  elevated: boolean
}) {
  const [mode, setMode] = useState<Mode>(initial)
  const [setup, setSetup] = useState<{ id: string; qr: string; secret: string } | null>(null)
  const [codes, setCodes] = useState<string[] | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const again = () => window.location.assign(`/verify?next=${encodeURIComponent(next)}`)
  const switchTo = (m: Mode) => {
    setMode(m)
    setCode('')
    setError(null)
  }

  async function start() {
    setBusy(true)
    setError(null)
    const sb = createClient()
    // A set-up left half-way leaves an unverified factor behind; clear it before starting again.
    const { data: listed } = await sb.auth.mfa.listFactors()
    for (const f of listed?.all ?? []) if (f.status !== 'verified') await sb.auth.mfa.unenroll({ factorId: f.id })
    const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator app' })
    if (error || !data) setError("Couldn't start. Try again.")
    else setSetup({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
    setBusy(false)
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault()
    const id = mode === 'enrol' ? setup?.id : factorId
    if (!id) return
    setBusy(true)
    setError(null)
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId: id, code: code.replace(/\s/g, '') })
    if (error) {
      setError("That code didn't work. Check the time on your phone and try the newest code.")
      setBusy(false)
      return
    }
    if (mode !== 'enrol') return again()
    await recordFactorChange({ kind: 'enrolled', factorId: id })
    const res = await issueRecoveryCodes()
    if ('error' in res) {
      setError(`${res.error} You can make codes later on Profile.`)
      setBusy(false)
      return
    }
    setCodes(res.codes)
    setBusy(false)
  }

  async function recover(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await redeemRecoveryCode(code)
    if ('error' in res) {
      setError(res.error)
      setBusy(false)
      return
    }
    again()
  }

  if (codes) {
    return (
      <section className="space-y-4" data-testid="verify-codes">
        <h2 className="text-xl font-semibold text-[var(--ink-900)] text-center">Your recovery codes</h2>
        <RecoveryCodes codes={codes} />
        <button type="button" className={PRIMARY} onClick={again} data-testid="verify-continue">
          I&apos;ve saved them. Continue
        </button>
      </section>
    )
  }

  const heading = mode === 'enrol' ? 'Set up a second step' : mode === 'challenge' ? "Confirm it's you" : 'Use a recovery code'
  return (
    <section className="space-y-4" data-testid={`verify-${mode}`}>
      <h2 className="text-xl font-semibold text-[var(--ink-900)] text-center">{heading}</h2>

      {mode === 'enrol' && !setup && (
        <>
          <p className="text-sm text-[var(--ink-700)]">
            {elevated
              ? 'Admin work needs a second step when you sign in: a code from an authenticator app on your phone, such as Google Authenticator or Microsoft Authenticator.'
              : 'Add a second step when you sign in: a code from an authenticator app on your phone.'}
          </p>
          <button type="button" className={PRIMARY} onClick={start} disabled={busy} data-testid="verify-start">
            {busy ? 'Working…' : 'Set up an authenticator app'}
          </button>
        </>
      )}

      {mode === 'enrol' && setup && (
        <div className="space-y-3">
          <p className="text-sm text-[var(--ink-700)]">Scan this with your authenticator app, then type the six-digit code it shows.</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- Supabase returns the QR code as an SVG data URL */}
          <img
            src={setup.qr}
            alt="QR code for your authenticator app"
            className="mx-auto size-48 rounded-lg border border-[var(--ink-100)] bg-white p-2"
            data-testid="verify-qr"
          />
          <p className="text-meta text-[var(--ink-500)]">
            Can&apos;t scan? Type this setup key:{' '}
            <span className="mono break-all text-[var(--ink-900)]" data-testid="verify-secret">
              {setup.secret}
            </span>
          </p>
        </div>
      )}

      {(mode === 'challenge' || (mode === 'enrol' && setup)) && (
        <form onSubmit={confirm} className="space-y-3">
          {mode === 'challenge' && <p className="text-sm text-[var(--ink-700)]">Type the six-digit code from your authenticator app.</p>}
          <label htmlFor="verify-code" className="sr-only">
            Six-digit code
          </label>
          <input
            id="verify-code"
            data-testid="verify-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`${INPUT} mono text-center tracking-widest`}
          />
          <button type="submit" className={PRIMARY} disabled={busy || code.replace(/\s/g, '').length !== 6} data-testid="verify-submit">
            {busy ? 'Checking…' : 'Confirm'}
          </button>
        </form>
      )}

      {mode === 'recovery' && (
        <form onSubmit={recover} className="space-y-3">
          <p className="text-sm text-[var(--ink-700)]">
            Type one of the codes you saved when you set up. It clears your authenticator app, and you set it up again.
          </p>
          <label htmlFor="verify-recovery" className="sr-only">
            Recovery code
          </label>
          <input
            id="verify-recovery"
            data-testid="verify-recovery-code"
            autoComplete="off"
            autoCapitalize="none"
            placeholder="abcd-efgh"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`${INPUT} mono text-center`}
          />
          <button type="submit" className={PRIMARY} disabled={busy || code.trim().length < 8} data-testid="verify-recovery-submit">
            {busy ? 'Checking…' : 'Use this code'}
          </button>
        </form>
      )}

      {error && (
        <p role="alert" data-testid="verify-error" className="rounded-lg border border-[var(--accent-escalate)] px-4 py-3 text-sm text-[var(--accent-escalate)]">
          {error}
        </p>
      )}

      <div className="flex flex-col items-center gap-1 pt-2">
        {mode === 'challenge' && (
          <button type="button" className={LINK} onClick={() => switchTo('recovery')} data-testid="verify-use-recovery">
            Use a recovery code
          </button>
        )}
        {mode === 'recovery' && (
          <button type="button" className={LINK} onClick={() => switchTo('challenge')}>
            Use my authenticator app
          </button>
        )}
        <a href="/" className={LINK} data-testid="verify-not-now">
          {elevated ? 'Not now: just read and run SOPs' : 'Not now'}
        </a>
      </div>
    </section>
  )
}
