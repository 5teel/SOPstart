'use client'

/**
 * Phase 60 (RQS-02, RQS-04, D-03, D-04, D-05) -- one open request, two buttons.
 *
 * The row only SHOWS Accept and Decline; answerRequest() decides whether the caller may
 * answer. Accept has no dialog. Decline asks for a reason (the server keeps its own
 * 10-character rule). A change-a-SOP receipt links to the editor for admin and safety
 * manager and to the browse address for a supervisor (F-23). Admin-chunk code: the Office
 * pane is the only importer. No router, no navigation from an effect.
 */
import { HOME, homeFrom } from '@/lib/shell/home-state'
import { useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { answerRequest } from '@/actions/requests'
import { useRole } from '@/components/providers/RoleProvider'
import { relativeWhen } from '@/lib/office/format'
import { REQUEST_KIND_WORDS, type OfficeRequest } from '@/lib/requests/model'
import { focusHref } from '@/lib/sop/focus-path'
import { ReasonDialog } from './ReasonDialog'
import type { RowDone } from './InboxRow'

const FAILED_COPY = "That didn't work. Nothing was changed — try again."
const CHIP = 'rounded mono text-meta uppercase px-2 py-1'
const BUTTON =
  'inline-flex min-h-tap flex-1 items-center justify-center gap-1.5 rounded-lg text-ui font-semibold focus-visible:outline-2 focus-visible:outline-accent-step disabled:opacity-60'

export function RequestRow({ request, onDone }: { request: OfficeRequest; onDone(r: RowDone): void }) {
  const role = useRole()
  const canEdit = role === 'admin' || role === 'safety_manager'
  const [pending, setPending] = useState<'accept' | 'decline' | null>(null)
  const [declining, setDeclining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const { subject } = request
  const sopId = subject.type === 'sop' ? subject.id : null

  function receiptFor(answer: 'accept' | 'decline', logged: boolean): RowDone {
    if (answer === 'decline') return { receipt: 'Declined', logged }
    let link: RowDone['link']
    if (logged) {
      if (request.kind === 'change_sop' && sopId) {
        link = canEdit
          ? { href: focusHref(sopId, { mode: 'edit', from: homeFrom({ ...HOME, s: 'signoffs' }) }), label: 'Open the SOP' }
          : { href: focusHref(sopId, { from: homeFrom({ ...HOME, s: 'signoffs' }) }), label: 'Open the SOP' }
      } else if (request.kind === 'new_sop' && canEdit) {
        link = {
          href: subject.type === 'machine' && subject.id ? `/admin/sops/new/blank?machine=${encodeURIComponent(subject.id)}` : '/admin/sops/new/blank',
          label: 'Start the SOP',
        }
      }
    }
    if (request.kind === 'observe_me' && logged) {
      return { receipt: 'Accepted', logged, after: "They've been told you'll observe." }
    }
    return { receipt: 'Accepted', logged, ...(link ? { link, hold: true } : {}) }
  }

  async function answer(which: 'accept' | 'decline', note?: string) {
    if (pending) return
    setPending(which)
    setError(null)
    setDialogError(null)
    try {
      const result = await answerRequest({ requestId: request.id, answer: which, ...(note ? { note } : {}) })
      if ('error' in result) {
        if (which === 'decline' && declining) setDialogError(result.error)
        else setError(result.error)
      } else {
        setDeclining(false)
        onDone(receiptFor(which, result.logged))
      }
    } catch {
      if (which === 'decline' && declining) setDialogError(FAILED_COPY)
      else setError(FAILED_COPY)
    } finally {
      setPending(null)
    }
  }

  const name = request.askerLabel

  return (
    <li
      data-testid="request-row"
      data-key={request.id}
      data-kind={request.kind}
      data-agent={request.agent ? 'true' : 'false'}
      className={`min-h-tap-row border-b border-ink-100 px-4 py-3 ${pending ? 'opacity-60' : ''}`}
    >
      <div className="flex gap-3">
        <span className={`mt-1 size-3 shrink-0 rounded-full ${request.agent ? 'bg-ink-300' : 'bg-accent-measure'}`} aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {sopId ? (
            <Link href={focusHref(sopId, { from: homeFrom({ ...HOME, s: 'signoffs' }) })} className="truncate text-reading font-semibold text-ink-900 hover:underline">
              {subject.title}
            </Link>
          ) : (
            <span className="truncate text-reading font-semibold text-ink-900">{subject.title}</span>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`${CHIP} bg-paper-2 text-ink-700`}>{REQUEST_KIND_WORDS[request.kind]}</span>
            {request.agent && <span className={`${CHIP} border border-ai/40 bg-ai/10 text-ai`}>agent</span>}
            <span className="mono text-meta text-ink-600">{relativeWhen(request.createdAt)}</span>
          </div>
          <p className="text-ui font-semibold text-ink-900">{name}</p>
          {request.note && <p className="text-ui text-ink-700">{request.note}</p>}
          {error && (
            <p role="alert" className="text-ui text-accent-escalate">
              {error}
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              data-testid="request-accept"
              aria-label={`Accept the request about ${subject.title}`}
              disabled={pending !== null}
              onClick={() => void answer('accept')}
              className={`${BUTTON} bg-ink-900 text-paper`}
            >
              {pending === 'accept' ? (
                <>
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                  Accepting…
                </>
              ) : (
                'Accept'
              )}
            </button>
            <button
              type="button"
              data-testid="request-decline"
              aria-label={`Decline the request about ${subject.title}`}
              disabled={pending !== null}
              onClick={() => setDeclining(true)}
              className={`${BUTTON} border border-ink-300 bg-paper-1 text-ink-900`}
            >
              Decline
            </button>
          </div>
        </div>
      </div>
      {declining && (
        <ReasonDialog
          title="Decline this request?"
          body={`${name} will see your answer.`}
          label="Why are you declining it?"
          confirmLabel="Decline request"
          confirmTone="ink"
          cancelLabel="Keep it open"
          pending={pending === 'decline'}
          error={dialogError}
          onConfirm={(reason) => void answer('decline', reason)}
          onCancel={() => {
            setDeclining(false)
            setDialogError(null)
          }}
        />
      )}
    </li>
  )
}
