'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { issueRecoveryCodes, recordFactorChange, recoveryCodesLeft } from '@/actions/mfa'
import { RecoveryCodes } from '@/components/auth/RecoveryCodes'

// Phase 66 / ADR-0028: your authenticator app and how many recovery codes are left (the count
// only; codes are shown once, when they are made). Changing either needs an aal2 session.

type Factor = { id: string; friendly_name?: string; created_at: string }

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Pacific/Auckland' })

export function SecondStepSection({ aal2, elevated }: { aal2: boolean; elevated: boolean }) {
  const [factors, setFactors] = useState<Factor[] | null>(null)
  const [left, setLeft] = useState<number | null>(null)
  const [codes, setCodes] = useState<string[] | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [{ data, error }, n] = await Promise.all([createClient().auth.mfa.listFactors(), recoveryCodesLeft()])
    if (error) setError("Couldn't load your sign-in steps. Refresh the page.")
    else setFactors(data.totp)
    setLeft(n)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function newCodes() {
    setBusy(true)
    setError(null)
    const res = await issueRecoveryCodes()
    if ('error' in res) setError(res.error)
    else setCodes(res.codes)
    await load()
    setBusy(false)
  }

  async function remove(id: string) {
    setBusy(true)
    setError(null)
    const res = await recordFactorChange({ kind: 'removed', factorId: id })
    if (res.error) setError(res.error)
    setConfirming(null)
    await load()
    setBusy(false)
  }

  const confirmFirst = (
    <a href="/verify?next=%2Fprofile" className="chip" data-testid="second-step-confirm">
      Confirm it&apos;s you to change this
    </a>
  )

  return (
    <section className="blueprint-frame p-5 space-y-3" data-testid="second-step-section">
      <h2 className="section-heading">Second step at sign-in</h2>
      <p className="text-sm text-[var(--ink-700)]">
        {elevated
          ? 'Admins and safety managers type a code from an authenticator app before admin work.'
          : 'A code from an authenticator app on your phone, as well as your password.'}
      </p>

      {factors && factors.length > 0 && (
        <ul className="divide-y divide-[var(--ink-100)] rounded-lg border border-[var(--ink-100)]">
          {factors.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-2 px-3 py-2 min-h-tap-glove" data-testid="second-step-row">
              {confirming === f.id ? (
                <>
                  <span className="flex-1 min-w-0 text-sm text-[var(--ink-900)]">Remove this authenticator app?</span>
                  <button type="button" className="chip border-[var(--accent-escalate)] text-[var(--accent-escalate)]" disabled={busy} onClick={() => remove(f.id)}>
                    Remove
                  </button>
                  <button type="button" className="chip" disabled={busy} onClick={() => setConfirming(null)}>
                    Keep
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-sm font-semibold text-[var(--ink-900)]">{f.friendly_name || 'Authenticator app'}</span>
                    <span className="block text-meta text-[var(--ink-500)]">Set up {day(f.created_at)}</span>
                  </span>
                  {aal2 && !elevated && (
                    <button type="button" className="chip" disabled={busy} onClick={() => setConfirming(f.id)}>
                      Remove
                    </button>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {factors && factors.length === 0 && (
        <a href="/verify?next=%2Fprofile" className="chip" data-testid="second-step-setup">
          Set up an authenticator app
        </a>
      )}

      {factors && factors.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" data-testid="recovery-left">
          <span className="flex-1 min-w-0 text-sm text-[var(--ink-900)]">
            {left === null ? 'Recovery codes' : `${left} of 10 recovery codes left`}
          </span>
          {aal2 ? (
            <button type="button" className="chip" disabled={busy} onClick={newCodes} data-testid="recovery-new">
              Make new codes
            </button>
          ) : (
            confirmFirst
          )}
        </div>
      )}

      {codes && <RecoveryCodes codes={codes} />}

      {error && (
        <p role="alert" className="text-sm text-[var(--accent-escalate)]">
          {error}
        </p>
      )}
    </section>
  )
}
