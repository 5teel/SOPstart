'use client'

/**
 * Phase 60 (RQS-01, D-01, F-22) -- the request composer: a focused dialog opened from a
 * "Make a request" trigger. A lazy module (next/dynamic only) with no stylesheet import,
 * so none of it rides in the home or SOP chunks. The dialog is mounted only while open,
 * so every open starts from an empty form (CLAUDE.md 2026-10-03). The payload carries
 * kind, subject and note only; the server takes organisation and user from the session.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Loader2 } from 'lucide-react'
import { raiseRequest } from '@/actions/requests'
import { DialogShell } from '@/components/requests/DialogShell'
import { MAX_NOTE, noteRule, type RequestKind } from '@/lib/requests/model'
import { MY_REQUESTS_KEY } from '@/lib/shell/query-keys'

type Raisable = Exclude<RequestKind, 'do_sop'>

/** What the request can be about. A single-entry list renders as a fixed line, several as a select. */
export interface ComposerAbout {
  sops?: Array<{ id: string; title: string }>
  machines?: Array<{ id: string; name: string }>
  /** New SOP may also be about the whole site. */
  site?: boolean
}

const KIND_COPY: Record<Raisable, { label: string; help: string; field: string; required: boolean }> = {
  change_sop: { label: 'Change a SOP', help: 'Something in it is wrong, missing or out of date.', field: 'What needs changing?', required: true },
  new_sop: { label: 'Write a new SOP', help: "There's a job here with no SOP.", field: 'What is the job?', required: true },
  observe_me: { label: 'Observe me', help: 'Watch me do a SOP and tell me how I went.', field: 'Anything we should know?', required: false },
}
const ORDER: Raisable[] = ['change_sop', 'new_sop', 'observe_me']
const WHOLE_SITE = 'site'
const FAILED = "That didn't work. Nothing was sent — try again."

function usable(kind: Raisable, about: ComposerAbout): boolean {
  if (kind === 'new_sop') return (about.machines?.length ?? 0) > 0 || !!about.site
  return (about.sops?.length ?? 0) > 0
}

export function RequestComposerTrigger({
  kinds,
  about,
  triggerLabel = 'Make a request',
  triggerStyle = 'button',
  title = 'Make a request',
  initialNote = '',
}: {
  kinds: ReadonlyArray<Raisable>
  about: ComposerAbout
  triggerLabel?: string
  triggerStyle?: 'button' | 'text'
  title?: string
  /** Pre-fills the note on every open, e.g. the words a search found nothing for. */
  initialNote?: string
}) {
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(0)

  // The status line lives for 10 s; a second request restarts it.
  useEffect(() => {
    if (!sent) return
    const t = setTimeout(() => setSent(0), 10_000)
    return () => clearTimeout(t)
  }, [sent])

  const offered = ORDER.filter((k) => kinds.includes(k) && usable(k, about))
  if (offered.length === 0) return null

  const style =
    triggerStyle === 'button'
      ? 'mt-2 flex min-h-tap w-full items-center justify-center rounded-lg border border-ink-300 bg-paper-1 text-ui font-semibold text-ink-900'
      : 'min-h-tap text-ui text-ink-700 underline-offset-2 hover:underline'

  return (
    <div>
      <button type="button" data-testid="request-composer-trigger" onClick={() => setOpen(true)} className={style}>
        {triggerLabel}
      </button>
      {sent > 0 && (
        <p role="status" data-testid="request-sent" className="mt-2 flex items-center gap-1.5 text-ui text-ink-700">
          <Check size={16} className="text-accent-ok" aria-hidden="true" />
          Request sent. You&apos;ll see its answer under My requests.
        </p>
      )}
      {open && (
        <ComposerDialog
          kinds={offered}
          about={about}
          title={title}
          initialNote={initialNote}
          onClose={() => setOpen(false)}
          onSent={() => {
            setOpen(false)
            setSent((n) => n + 1)
          }}
        />
      )}
    </div>
  )
}

function ComposerDialog({
  kinds,
  about,
  title,
  initialNote,
  onClose,
  onSent,
}: {
  kinds: Raisable[]
  about: ComposerAbout
  title: string
  initialNote: string
  onClose(): void
  onSent(): void
}) {
  const queryClient = useQueryClient()
  const uid = useId()
  const [kind, setKind] = useState<Raisable>(kinds[0])
  const [aboutId, setAboutId] = useState('')
  const [note, setNote] = useState(initialNote)
  const [touched, setTouched] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const noteRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    noteRef.current?.focus()
  }, [])

  const copy = KIND_COPY[kind]
  const trimmed = note.trim()
  const isNew = kind === 'new_sop'

  // The choices for the current kind; a single entry is fixed, not a select.
  const choices: Array<{ id: string; label: string }> = isNew
    ? [...(about.machines ?? []).map((m) => ({ id: m.id, label: m.name })), ...(about.site ? [{ id: WHOLE_SITE, label: 'Whole site' }] : [])]
    : (about.sops ?? []).map((s) => ({ id: s.id, label: s.title }))
  const fixed = choices.length === 1 ? choices[0] : null
  const chosen = fixed?.id ?? aboutId
  const problem = noteRule(kind, trimmed)
  const valid = !!chosen && !problem

  async function send() {
    if (!valid || pending) return
    setPending(true)
    setError(null)
    try {
      const subject = isNew
        ? chosen === WHOLE_SITE
          ? { type: 'site' as const, id: null }
          : { type: 'machine' as const, id: chosen }
        : { type: 'sop' as const, id: chosen }
      const res = await raiseRequest({ kind, subject, note: trimmed })
      if ('error' in res) {
        setError(res.error)
        return
      }
      void queryClient.invalidateQueries({ queryKey: MY_REQUESTS_KEY })
      onSent()
    } catch {
      setError(FAILED)
    } finally {
      setPending(false)
    }
  }

  return (
    <DialogShell labelledBy={`${uid}-title`} testId="request-composer" onEscape={() => !pending && onClose()}>
      <h2 id={`${uid}-title`} className="text-lg font-semibold text-ink-900">
        {title}
      </h2>

      {kinds.length > 1 && (
        <div className="flex flex-col gap-2">
          <span id={`${uid}-kind`} className="text-ui font-semibold text-ink-900">
            What do you need?
          </span>
          <div role="radiogroup" aria-labelledby={`${uid}-kind`} data-testid="composer-kind" className="flex flex-col gap-2">
            {kinds.map((k) => (
              <label
                key={k}
                className={`flex min-h-tap flex-col gap-1 rounded-lg border p-3 focus-within:outline-2 focus-within:outline-accent-step ${
                  k === kind ? 'border-ink-900 bg-paper-2' : 'border-ink-300 bg-paper-1'
                }`}
              >
                <input
                  type="radio"
                  name={`${uid}-kind`}
                  value={k}
                  checked={k === kind}
                  onChange={() => {
                    setKind(k)
                    setAboutId('')
                    setError(null)
                  }}
                  className="sr-only"
                />
                <span className="text-ui font-semibold text-ink-900">{KIND_COPY[k].label}</span>
                <span className="text-ui text-ink-500">{KIND_COPY[k].help}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {fixed ? (
        <p className="text-ui text-ink-700">About · {fixed.label}</p>
      ) : (
        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-about`} className="text-ui font-semibold text-ink-900">
            {isNew ? 'Which machine?' : 'Which SOP?'}
          </label>
          <select
            id={`${uid}-about`}
            data-testid="composer-about"
            value={aboutId}
            onChange={(e) => setAboutId(e.target.value)}
            className="min-h-tap rounded-lg border border-ink-300 bg-paper-1 px-3 text-ui text-ink-900"
          >
            <option value="">Choose…</option>
            {choices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor={`${uid}-note`} className="text-ui font-semibold text-ink-900">
          {copy.field}
        </label>
        <textarea
          id={`${uid}-note`}
          ref={noteRef}
          data-testid="composer-note"
          rows={4}
          maxLength={MAX_NOTE}
          value={note}
          disabled={pending}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => setTouched(true)}
          className="w-full resize-none rounded-lg border border-ink-300 bg-paper-1 p-3 text-reading text-ink-900 focus:border-ink-900 focus:outline-none"
        />
        <div className="flex justify-between gap-2">
          {copy.required ? (
            <span className={`text-ui ${touched && problem ? 'text-accent-escalate' : 'text-ink-500'}`}>10 characters or more.</span>
          ) : (
            <span />
          )}
          <span className="mono text-meta text-ink-500">
            {note.length} / {MAX_NOTE}
          </span>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-ui text-accent-escalate">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <button
          type="button"
          data-testid="composer-send"
          disabled={!valid || pending}
          onClick={() => void send()}
          className="flex min-h-tap flex-1 items-center justify-center gap-2 rounded-lg bg-ink-900 text-ui font-semibold text-paper disabled:opacity-50"
        >
          {pending && <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {pending ? 'Sending…' : 'Send request'}
        </button>
        <button
          type="button"
          data-testid="composer-cancel"
          disabled={pending}
          onClick={onClose}
          className="min-h-tap flex-1 rounded-lg text-ui text-ink-700 hover:bg-paper-2"
        >
          Don&apos;t send
        </button>
      </div>
    </DialogShell>
  )
}
