'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { recordPasskeyChange } from '@/actions/passkeys'
import { browserHasPasskeys, passkeyErrorWords } from '@/lib/auth/passkey-words'

// Phase 65 / ADR-0027: add, rename and remove your own passkeys. The ceremony and the rename
// run in the browser; adding is then checked and logged by recordPasskeyChange, and removing
// runs on the server through it, so every ledger row follows a real change.

type Passkey = { id: string; friendly_name?: string; created_at: string }

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Pacific/Auckland' })

export function PasskeysSection() {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [passkeys, setPasskeys] = useState<Passkey[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await createClient().auth.passkey.list()
    if (error) setError("Couldn't load your passkeys. Refresh the page.")
    else setPasskeys(data ?? [])
  }, [])

  useEffect(() => {
    setSupported(browserHasPasskeys())
    void load()
  }, [load])

  async function add() {
    setBusy(true)
    setError(null)
    const { data, error } = await createClient().auth.registerPasskey()
    if (error || !data) setError(passkeyErrorWords(error, 'add'))
    else {
      const res = await recordPasskeyChange({ kind: 'added', passkeyId: data.id })
      if (res.error) setError(res.error)
    }
    await load()
    setBusy(false)
  }

  async function rename() {
    if (!renaming) return
    const name = renaming.name.trim().slice(0, 120)
    if (!name) return setRenaming(null)
    setBusy(true)
    setError(null)
    const { error } = await createClient().auth.passkey.update({ passkeyId: renaming.id, friendlyName: name })
    if (error) setError("The name wasn't saved. Try again.")
    else setRenaming(null)
    await load()
    setBusy(false)
  }

  async function remove(id: string) {
    setBusy(true)
    setError(null)
    const res = await recordPasskeyChange({ kind: 'removed', passkeyId: id })
    if (res.error) setError(res.error)
    setConfirming(null)
    await load()
    setBusy(false)
  }

  return (
    <section className="blueprint-frame p-5 space-y-3" data-testid="passkeys-section">
      <h2 className="section-heading">Passkeys</h2>
      <p className="text-sm text-[var(--ink-700)]">
        Use your phone&apos;s face or fingerprint unlock to sign in. Your password still works.
      </p>

      {passkeys && passkeys.length > 0 && (
        <ul className="divide-y divide-[var(--ink-100)] rounded-lg border border-[var(--ink-100)]">
          {passkeys.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2 min-h-tap-glove" data-testid="passkey-row">
              {renaming?.id === p.id ? (
                <>
                  <label className="sr-only" htmlFor={`passkey-name-${p.id}`}>Passkey name</label>
                  <input
                    id={`passkey-name-${p.id}`}
                    value={renaming.name}
                    maxLength={120}
                    onChange={(e) => setRenaming({ id: p.id, name: e.target.value })}
                    className="min-h-tap flex-1 min-w-0 rounded-lg border border-[var(--ink-300)] bg-white px-3 text-base text-[var(--ink-900)]"
                  />
                  <button type="button" className="chip" disabled={busy} onClick={rename}>Save</button>
                  <button type="button" className="chip" disabled={busy} onClick={() => setRenaming(null)}>Cancel</button>
                </>
              ) : confirming === p.id ? (
                <>
                  <span className="flex-1 min-w-0 text-sm text-[var(--ink-900)]">Remove this passkey?</span>
                  <button
                    type="button"
                    className="chip border-[var(--accent-escalate)] text-[var(--accent-escalate)]"
                    disabled={busy}
                    onClick={() => remove(p.id)}
                  >
                    Remove
                  </button>
                  <button type="button" className="chip" disabled={busy} onClick={() => setConfirming(null)}>Keep</button>
                </>
              ) : (
                <>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-sm font-semibold text-[var(--ink-900)]">{p.friendly_name || 'Passkey'}</span>
                    <span className="block text-meta text-[var(--ink-500)]">Added {day(p.created_at)}</span>
                  </span>
                  <button type="button" className="chip" disabled={busy} onClick={() => setRenaming({ id: p.id, name: p.friendly_name ?? '' })}>
                    Rename
                  </button>
                  <button type="button" className="chip" disabled={busy} onClick={() => setConfirming(p.id)}>Remove</button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {passkeys && passkeys.length === 0 && <p className="text-sm text-[var(--ink-500)]">No passkeys yet.</p>}

      {error && (
        <p role="alert" className="text-sm text-[var(--accent-escalate)]">{error}</p>
      )}

      {supported === false && <p className="text-sm text-[var(--ink-500)]">This browser can&apos;t use passkeys.</p>}
      {supported && (
        <button
          type="button"
          onClick={add}
          disabled={busy}
          className="w-full min-h-tap-glove rounded-lg bg-[var(--ink-900)] text-white font-semibold text-base disabled:opacity-60"
        >
          {busy ? 'Working…' : 'Add a passkey'}
        </button>
      )}
    </section>
  )
}
