'use client'

/**
 * Phase 60 (OBJ-01, OBJ-03, A-07) -- set, change, confirm and remove an objective in place.
 * Reached only through a lazy import (ObjectiveSlot), no stylesheet import, so it never rides
 * in the worker download. The action is the gate; this mount is a convenience (T-60-56).
 */
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { clearObjective, confirmObjective, setObjective } from '@/actions/objectives'
import { ObjectiveLine } from '@/components/shell/ObjectiveLine'
import { OBJECTIVE_MAX, normaliseObjectiveText, type ObjectiveSubject, type ObjectiveView } from '@/lib/objectives/model'
import { OBJECTIVES_KEY } from '@/lib/shell/query-keys'

const FAILED_COPY = "That didn't work. Nothing was changed — try again."
const GHOST = 'min-h-tap rounded-lg px-3 text-ui text-ink-700 hover:bg-paper-2'

type Result = { logged: boolean } | { error: string }

export function ObjectiveEditor({
  subject,
  current,
  prefix,
  emptyLabel,
  emptyStyle,
  onChanged,
}: {
  subject: { type: ObjectiveSubject; id: string | null }
  current: ObjectiveView | null
  prefix?: string
  emptyLabel: string
  emptyStyle: 'dashed' | 'text'
  onChanged?: () => void
}) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [due, setDue] = useState('')
  const [removing, setRemoving] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<{ text: string; bad: boolean } | null>(null)

  useEffect(() => {
    if (!receipt) return
    const t = window.setTimeout(() => setReceipt(null), 10_000)
    return () => window.clearTimeout(t)
  }, [receipt])

  // Esc closes the editor only: the shell's own Esc never sees it.
  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      setEditing(false)
      setRemoving(false)
      setError(null)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [editing])

  function open() {
    setText(current?.text ?? '')
    setDue(current?.dueOn ?? '')
    setRemoving(false)
    setError(null)
    setReceipt(null)
    setEditing(true)
  }

  async function run(act: () => Promise<Result>, word: string) {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const res = await act()
      if ('error' in res) {
        setError(res.error || FAILED_COPY)
        return
      }
      setEditing(false)
      setRemoving(false)
      setReceipt(
        res.logged
          ? { text: `${word} · logged in the decision ledger`, bad: false }
          : { text: `${word}, but it didn't reach the decision ledger. Tell an admin.`, bad: true },
      )
      void queryClient.invalidateQueries({ queryKey: OBJECTIVES_KEY })
      onChanged?.()
    } catch {
      setError(FAILED_COPY)
    } finally {
      setPending(false)
    }
  }

  const norm = normaliseObjectiveText(text)
  const unchanged = !!current && norm.ok && norm.text === current.text && due === (current.dueOn ?? '')
  const canSave = norm.ok && !unchanged && !pending
  const unconfirmed = !!current && !!current.setByAgent && !current.confirmed

  const note = (
    <>
      {receipt && (
        <p role="status" className={`text-ui ${receipt.bad ? 'text-accent-escalate' : 'text-ink-500'}`}>
          {receipt.text}
        </p>
      )}
      {error && !editing && (
        <p role="alert" className="text-ui text-accent-escalate">
          {error}
        </p>
      )}
    </>
  )

  if (editing) {
    return (
      <div data-testid="objective-editor" className="flex flex-col gap-2 rounded-lg border border-ink-200 bg-paper-1 p-3">
        <label htmlFor="objective-text" className="text-ui font-semibold text-ink-900">
          Objective
        </label>
        <textarea
          id="objective-text"
          autoFocus
          rows={3}
          maxLength={OBJECTIVE_MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="rounded-lg border border-ink-300 p-3 text-reading text-ink-900"
        />
        <p className="mono text-meta text-ink-600">
          {text.length} / {OBJECTIVE_MAX}
        </p>
        <label htmlFor="objective-due" className="text-ui font-semibold text-ink-900">
          By (optional)
        </label>
        <div className="flex items-center gap-2">
          <input
            id="objective-due"
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="min-h-tap rounded-lg border border-ink-300 bg-paper-1 px-3 text-ui text-ink-900"
          />
          {due && (
            <button type="button" onClick={() => setDue('')} className="text-ui text-ink-500 hover:text-ink-900">
              Clear date
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="text-ui text-accent-escalate">
            {error}
          </p>
        )}

        {removing ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-ui font-semibold text-ink-900">Remove this objective?</p>
            <button
              type="button"
              disabled={pending}
              onClick={() => void run(() => clearObjective({ subject }), 'Objective removed')}
              className="min-h-tap rounded-lg bg-accent-escalate px-3 text-ui font-semibold text-paper disabled:opacity-50"
            >
              Yes, remove it
            </button>
            <button type="button" disabled={pending} onClick={() => setRemoving(false)} className={GHOST}>
              Keep it
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!canSave}
              onClick={() =>
                norm.ok && void run(() => setObjective({ subject, text: norm.text, dueOn: due || null }), 'Objective set')
              }
              className="min-h-tap rounded-lg bg-ink-900 px-4 text-ui font-semibold text-paper disabled:opacity-50"
            >
              {pending ? 'Saving…' : 'Save objective'}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setEditing(false)
                setError(null)
              }}
              className={GHOST}
            >
              Don&apos;t change it
            </button>
            {current && (
              <button
                type="button"
                disabled={pending}
                onClick={() => setRemoving(true)}
                className="min-h-tap text-ui font-semibold text-accent-escalate"
              >
                Remove objective
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  if (!current) {
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={open}
          className={
            emptyStyle === 'dashed'
              ? 'min-h-tap w-full rounded-lg border border-dashed border-ink-300 px-3 text-left text-ui text-ink-500 hover:text-ink-900'
              : 'min-h-9 self-start px-2 text-ui text-ink-500 hover:text-ink-900'
          }
        >
          {emptyLabel}
        </button>
        {note}
      </div>
    )
  }

  const quiet = emptyStyle === 'text' ? 'min-h-9' : 'min-h-tap'
  return (
    <div className="flex flex-col gap-1">
      <ObjectiveLine view={current} prefix={prefix} />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={open} className={`${quiet} px-2 text-ui text-ink-500 hover:text-ink-900`}>
          Change
        </button>
        {unconfirmed && (
          <button
            type="button"
            data-testid="objective-confirm"
            disabled={pending}
            onClick={() => void run(() => confirmObjective({ objectiveId: current.id }), 'Confirmed')}
            className="min-h-tap rounded-lg border border-ink-300 bg-paper-1 px-3 text-ui font-semibold text-ink-900 disabled:opacity-50"
          >
            Confirm
          </button>
        )}
      </div>
      {note}
    </div>
  )
}
