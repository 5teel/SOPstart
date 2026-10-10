'use client'

/**
 * Phase 63 (HOME-04) -- "my requests", moved out of the Phase 60 site overview so My record and the
 * old overview share one implementation. Asked of you / You asked / Answered, with withdraw, decline
 * and stop asking (the last two through the reason dialog, which logs to the decision ledger).
 */
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { declineAsk, stopAsking } from '@/actions/asks'
import { listMyRequests, withdrawRequest } from '@/actions/requests'
import { ReasonDialog } from '@/components/office/ReasonDialog'
import type { ComposerAbout } from '@/components/requests/RequestComposer'
import { relativeWhen } from '@/lib/office/format'
import { REQUEST_KIND_WORDS, REQUEST_STATE_WORDS, ROLE_PLURAL, groupMyRequests, type MyRequest } from '@/lib/requests/model'
import { MY_REQUESTS_KEY } from '@/lib/shell/query-keys'
import { focusHref } from '@/lib/sop/focus-path'
import { useSectionScroll } from './useSectionScroll'

const RequestComposerTrigger = dynamic(() => import('@/components/requests/RequestComposer').then((m) => m.RequestComposerTrigger), {
  ssr: false,
  loading: () => null,
})

const FAILED_COPY = "That didn't work. Nothing was changed — try again."
const HEADING = 'section-heading px-4 pb-1 pt-4'
const CHIP = 'rounded mono text-meta font-semibold px-2 py-1'
const STATE_CHIP: Record<string, string> = {
  open: 'bg-paper-2 text-ink-700',
  accepted: 'bg-accent-ok/10 text-accent-ok',
  declined: 'bg-paper-2 text-ink-900 border border-ink-300',
  withdrawn: 'bg-paper-2 text-ink-500',
  asked: 'bg-accent-measure/10 text-accent-measure',
}
const SMALL_BUTTON = 'min-h-tap rounded-lg border border-ink-300 bg-paper-1 px-3 text-ui font-semibold text-ink-900 disabled:opacity-50'

type Dialog = { mode: 'decline' | 'stop'; req: MyRequest }

export function MyRequestsPanel({ role, about }: { role: string | null; about: ComposerAbout }) {
  const queryClient = useQueryClient()

  const reqQ = useQuery({
    queryKey: MY_REQUESTS_KEY,
    queryFn: () => listMyRequests(),
    staleTime: 30_000,
  })
  const reqData = reqQ.data && !('error' in reqQ.data) ? reqQ.data : null
  const groups = reqData ? groupMyRequests(reqData.rows, reqData.me, new Date()) : null
  const [showAllAsked, setShowAllAsked] = useState(false)
  const youAsked = groups ? (showAllAsked ? groupMyRequests(reqData!.rows, reqData!.me, new Date(), 1000).youAsked : groups.youAsked) : []
  const [receipts, setReceipts] = useState<Record<string, string>>({})
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [pending, setPending] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)
  const sectionRef = useRef<HTMLElement>(null)
  useSectionScroll('requests', sectionRef, !reqQ.isLoading)

  const receiptCount = Object.keys(receipts).length
  useEffect(() => {
    if (!receiptCount) return
    const t = window.setTimeout(() => {
      setReceipts({})
      void queryClient.invalidateQueries({ queryKey: MY_REQUESTS_KEY })
    }, 10_000)
    return () => window.clearTimeout(t)
  }, [receiptCount, queryClient])

  async function withdraw(r: MyRequest) {
    if (pending) return
    setPending(true)
    setRowError(null)
    try {
      const res = await withdrawRequest({ requestId: r.id })
      if ('error' in res) setRowError(res.error || FAILED_COPY)
      else setReceipts((x) => ({ ...x, [r.id]: 'Withdrawn.' }))
    } catch {
      setRowError(FAILED_COPY)
    } finally {
      setPending(false)
    }
  }

  async function answer(d: Dialog, note: string) {
    setPending(true)
    setDialogError(null)
    try {
      const res = d.mode === 'decline' ? await declineAsk({ requestId: d.req.id, note }) : await stopAsking({ requestId: d.req.id, note })
      if ('error' in res) {
        setDialogError(res.error || FAILED_COPY)
        return
      }
      const word = d.mode === 'decline' ? 'Declined' : 'Stopped asking'
      setReceipts((x) => ({
        ...x,
        [d.req.id]: res.logged
          ? `${word} · logged in the decision ledger`
          : `${word}, but it didn't reach the decision ledger. Tell an admin.`,
      }))
      setDialog(null)
      void queryClient.invalidateQueries({
        queryKey: ['user-sop-assignments'],
      })
    } catch {
      setDialogError(FAILED_COPY)
    } finally {
      setPending(false)
    }
  }

  function aboutTitle(r: MyRequest) {
    return r.subject.type === 'sop' && r.subject.id ? (
      <Link
        href={focusHref(r.subject.id, { from: null })}
        className="truncate text-reading font-semibold text-ink-900 underline-offset-2 hover:underline"
      >
        {r.subject.title}
      </Link>
    ) : (
      <span className="truncate text-reading font-semibold text-ink-900">{r.subject.title}</span>
    )
  }

  function requestRow(r: MyRequest, group: 'asked' | 'youAsked' | 'answered') {
    const receipt = receipts[r.id]
    if (receipt)
      return (
        <li key={r.id} role="status" className="flex min-h-18 items-center rounded-lg border border-ink-200 px-4 text-ui text-ink-700">
          {receipt}
        </li>
      )
    const chip = group === 'asked' ? 'asked' : r.state
    const chipWord = group === 'asked' ? 'Asked of you' : REQUEST_STATE_WORDS[r.state]
    const canWithdraw = group === 'youAsked' && r.kind !== 'do_sop' && r.state === 'open'
    const canStop = group === 'youAsked' && r.kind === 'do_sop' && r.state === 'accepted'
    const answerLine =
      group === 'answered'
        ? r.state === 'accepted'
          ? `Accepted by ${r.answeredByLabel ?? 'someone'}.`
          : r.state === 'declined' && r.answerNote
            ? `${r.answeredByLabel ?? 'Someone'}: “${r.answerNote}”`
            : null
        : null
    return (
      <li
        key={r.id}
        data-testid={group === 'asked' ? 'ask-row' : 'request-row'}
        className="flex min-h-18 flex-col gap-1 rounded-lg border border-ink-200 px-4 py-2"
      >
        <div className="flex items-center justify-between gap-2">
          {aboutTitle(r)}
          <span className={`${CHIP} shrink-0 ${STATE_CHIP[chip]}`}>{chipWord}</span>
        </div>
        <p className="mono flex flex-wrap items-center gap-2 text-meta text-ink-600">
          <span>{REQUEST_KIND_WORDS[r.kind]}</span>
          {r.agent && <span className="rounded border border-ai/40 bg-ai/10 px-2 py-1 text-ai">agent</span>}
          <span>{relativeWhen(r.createdAt)}</span>
        </p>
        {r.note && <p className="line-clamp-2 text-ui text-ink-700">{r.note}</p>}
        {answerLine && <p className="text-ui text-ink-700">{answerLine}</p>}
        {group === 'asked' && (
          <button
            type="button"
            data-testid="ask-decline"
            className={`${SMALL_BUTTON} self-start`}
            onClick={() => setDialog({ mode: 'decline', req: r })}
          >
            Decline
          </button>
        )}
        {canWithdraw && (
          <button
            type="button"
            data-testid="request-withdraw"
            disabled={pending}
            className={`${SMALL_BUTTON} self-start`}
            onClick={() => void withdraw(r)}
          >
            Withdraw
          </button>
        )}
        {canStop && (
          <button
            type="button"
            data-testid="ask-stop"
            className={`${SMALL_BUTTON} self-start`}
            onClick={() => setDialog({ mode: 'stop', req: r })}
          >
            Stop asking
          </button>
        )}
      </li>
    )
  }

  const stopWho = (r: MyRequest) =>
    r.targetRole && r.targetRole in ROLE_PLURAL ? ROLE_PLURAL[r.targetRole as keyof typeof ROLE_PLURAL] : (r.targetLabel ?? 'them')

  const dialogEl = () =>
    dialog && (
      <ReasonDialog
        title={dialog.mode === 'decline' ? `Decline ${dialog.req.subject.title}?` : `Stop asking ${stopWho(dialog.req)} to do this?`}
        body={
          dialog.mode === 'decline'
            ? 'Whoever asked will see your reason. It stops being due for you.'
            : `It stops being due for ${dialog.req.targetRole ? 'everyone in that role' : 'them'}.`
        }
        label={dialog.mode === 'decline' ? "Why can't you do it?" : 'Why are you stopping it?'}
        confirmLabel={dialog.mode === 'decline' ? 'Decline' : 'Stop asking'}
        confirmTone="ink"
        cancelLabel={dialog.mode === 'decline' ? 'Keep it' : 'Keep asking'}
        pending={pending}
        error={dialogError}
        onConfirm={(note) => void answer(dialog, note)}
        onCancel={() => {
          setDialog(null)
          setDialogError(null)
        }}
      />
    )

  if (reqQ.isLoading) {
    return (
      <div className="pt-4" aria-hidden="true">
        <div className="h-18 animate-pulse rounded-lg bg-ink-100 motion-reduce:animate-none" />
      </div>
    )
  }
  if (reqQ.isError || (reqQ.data && 'error' in reqQ.data)) {
    return (
      <div role="alert" className="flex flex-col items-start gap-2 pt-4">
        <p className="text-ui text-accent-escalate">Couldn&apos;t load this. Check your signal and try again.</p>
        <button type="button" className={SMALL_BUTTON} onClick={() => void reqQ.refetch()}>
          Try again
        </button>
      </div>
    )
  }
  const anyRequests = !!groups && (groups.askedOfYou.length > 0 || groups.youAsked.length > 0 || groups.answered.length > 0)
  if (!anyRequests || !groups) return dialogEl()

  return (
    <>
      <section data-testid="overview-requests" ref={sectionRef} className="-mx-4">
        <div className="flex items-center justify-between gap-2 pr-4">
          <h2 tabIndex={-1} className={HEADING}>
            MY REQUESTS
          </h2>
          {(role === 'worker' || role === 'supervisor') && (
            <RequestComposerTrigger
              kinds={['new_sop']}
              about={about}
              triggerLabel="Ask for a new SOP"
              triggerStyle="text"
              title="Ask for a new SOP"
            />
          )}
        </div>
        {rowError && (
          <p role="alert" className="px-4 text-ui text-accent-escalate">
            {rowError}
          </p>
        )}
        <div className="flex flex-col gap-3 px-4">
          {groups.askedOfYou.length > 0 && (
            <div>
              <h3 className="section-heading pb-1">Asked of you</h3>
              <ul className="flex flex-col gap-2">{groups.askedOfYou.map((r) => requestRow(r, 'asked'))}</ul>
            </div>
          )}
          {youAsked.length > 0 && (
            <div>
              <h3 className="section-heading pb-1">You asked</h3>
              <ul className="flex flex-col gap-2">{youAsked.map((r) => requestRow(r, 'youAsked'))}</ul>
              {!showAllAsked && groups.youAskedTotal > youAsked.length && (
                <button
                  type="button"
                  className="min-h-tap text-ui text-ink-700 underline-offset-2 hover:underline"
                  onClick={() => setShowAllAsked(true)}
                >
                  Show all {groups.youAskedTotal}
                </button>
              )}
            </div>
          )}
          {groups.answered.length > 0 && (
            <div>
              <h3 className="section-heading pb-1">Answered</h3>
              <ul className="flex flex-col gap-2">{groups.answered.map((r) => requestRow(r, 'answered'))}</ul>
            </div>
          )}
        </div>
      </section>
      {dialogEl()}
    </>
  )
}
