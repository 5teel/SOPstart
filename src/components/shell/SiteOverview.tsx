'use client'

/**
 * Phase 60 (SHL-03, NTF-01, RQS-01, RQS-03, D-13, A-06) -- the site overview body: the detail pane
 * with nothing selected, under the counts card. Objectives, then Notifications, then My requests,
 * then the Office line. A lazy module (next/dynamic only) with no stylesheet import.
 *
 * Notifications are read, counted and marked read with the BROWSER Supabase client under RLS:
 * there is no server action on this path (CLAUDE.md 2026-09-29, the Next 16.2.1 action-queue
 * orphan). Opening one navigates only inside the click handler, never from an effect.
 */
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { declineAsk, stopAsking } from '@/actions/asks'
import { getOfficeInbox } from '@/actions/office'
import { listMyRequests, withdrawRequest } from '@/actions/requests'
import { ReasonDialog } from '@/components/office/ReasonDialog'
import { ObjectiveLine, useObjectives } from '@/components/shell/ObjectiveLine'
import { createClient } from '@/lib/supabase/client'
import { NOTIFICATION_KIND_WORDS, type NotificationKind } from '@/lib/notifications/kinds'
import { placeTarget } from '@/lib/notifications/places'
import { relativeWhen } from '@/lib/office/format'
import {
  REQUEST_KIND_WORDS,
  REQUEST_STATE_WORDS,
  ROLE_PLURAL,
  canAnswerRequests,
  groupMyRequests,
  type MyRequest,
} from '@/lib/requests/model'
import { OVERVIEW_SECTION_EVENT, requestOverviewSection, takeOverviewSection, type OverviewSection } from '@/lib/shell/overview-focus'
import type { Place } from '@/lib/shell/place'
import { MY_REQUESTS_KEY, NOTIFICATIONS_KEY, OFFICE_INBOX_KEY } from '@/lib/shell/query-keys'
import { focusHref } from '@/lib/sop/focus-path'

const ObjectiveSlot = dynamic(() => import('@/components/shell/ObjectiveSlot').then((m) => m.ObjectiveSlot), {
  ssr: false,
  loading: () => null,
})
const RequestComposerTrigger = dynamic(() => import('@/components/requests/RequestComposer').then((m) => m.RequestComposerTrigger), {
  ssr: false,
  loading: () => null,
})

const READ_KEY = [...NOTIFICATIONS_KEY, 'read'] as const
const FAILED_COPY = "That didn't work. Nothing was changed — try again."
const HEADING = 'mono px-4 pb-1 pt-4 text-meta uppercase tracking-wide text-ink-500'
const CHIP = 'rounded mono text-meta font-semibold uppercase px-2 py-1'
const STATE_CHIP: Record<string, string> = {
  open: 'bg-paper-2 text-ink-700',
  accepted: 'bg-accent-ok/10 text-accent-ok',
  declined: 'bg-paper-2 text-ink-900 border border-ink-300',
  withdrawn: 'bg-paper-2 text-ink-500',
  asked: 'bg-accent-measure/10 text-accent-measure',
}
const SMALL_BUTTON = 'min-h-tap rounded-lg border border-ink-300 bg-paper-1 px-3 text-ui font-semibold text-ink-900 disabled:opacity-50'

interface NotificationRow {
  id: string
  kind: NotificationKind
  title: string
  place: string
  read_at: string | null
  created_at: string
}
const COLUMNS = 'id, kind, title, place, read_at, created_at'

type Dialog = { mode: 'decline' | 'stop'; req: MyRequest }

export interface SiteOverviewProps {
  role: string | null
  select: (place: Place) => void
  machines: ReadonlyArray<{ id: string; name: string }>
  departments: ReadonlyArray<{ id: string; name: string }>
}

export function SiteOverview({ role, select, machines, departments }: SiteOverviewProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const isAdmin = role === 'admin' || role === 'safety_manager'

  const { find } = useObjectives()
  const siteObjective = find('site', null)
  const deptObjectives = departments.flatMap((d) => {
    const o = find('department', d.id)
    return o ? [{ d, o }] : []
  })

  // Notifications: own rows only (RLS), filtered in the query, never a server action.
  const unreadQ = useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('notifications')
        .select(COLUMNS)
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as NotificationRow[]
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })
  const readQ = useQuery({
    queryKey: READ_KEY,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('notifications')
        .select(COLUMNS)
        .not('read_at', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return (data ?? []) as NotificationRow[]
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })
  const unread = unreadQ.data ?? []
  const read = readQ.data ?? []
  const [showAllUnread, setShowAllUnread] = useState(false)
  const [showRead, setShowRead] = useState(false)
  const [dimmed, setDimmed] = useState<ReadonlySet<string>>(new Set())

  // Newly asked of me: the machine badge and the Now card follow without a reload (Pitfall 8).
  const askedSeen = useRef('')
  const askedIds = unread
    .filter((n) => n.kind === 'asked')
    .map((n) => n.id)
    .join(',')
  useEffect(() => {
    if (!askedIds || askedIds === askedSeen.current) return
    askedSeen.current = askedIds
    void queryClient.invalidateQueries({ queryKey: ['user-sop-assignments'] })
  }, [askedIds, queryClient])

  async function open(n: NotificationRow) {
    setDimmed((s) => new Set(s).add(n.id))
    if (!n.read_at) {
      try {
        // The hand-extended table types resolve this Update to never; the column is read_at only (RLS grants no other).
        const patch = createClient()
          .from('notifications')
          .update({ read_at: new Date().toISOString() } as never)
          .eq('id', n.id)
        await Promise.race([patch, new Promise((resolve) => setTimeout(resolve, 3000))])
      } catch {
        // a failed mark-read still opens the place
      }
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY })
      void queryClient.invalidateQueries({ queryKey: READ_KEY })
      if (n.kind === 'asked')
        void queryClient.invalidateQueries({
          queryKey: ['user-sop-assignments'],
        })
    }
    const target = placeTarget(n.place)
    if (target.type === 'href') {
      router.push(target.href)
      return
    }
    select(target.place)
    if (target.place.kind === 'overview') requestOverviewSection('requests')
  }

  // My requests.
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

  // Office line: roles that answer requests.
  const canAnswer = canAnswerRequests(role)
  const inboxQ = useQuery({
    queryKey: OFFICE_INBOX_KEY,
    queryFn: () => getOfficeInbox(),
    enabled: canAnswer,
  })
  const officeCount = inboxQ.data && !('error' in inboxQ.data) ? inboxQ.data.requests.length : 0

  // Scroll to a section when asked. Scrolls and focuses only -- never navigates.
  const bodyRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Record<OverviewSection, HTMLElement | null>>({
    notifications: null,
    requests: null,
  })
  const wanted = useRef<OverviewSection | null>(null)
  const settled = !unreadQ.isLoading && !reqQ.isLoading
  function tryScroll() {
    const want = wanted.current
    if (!want) return
    const el = sectionRefs.current[want]
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const behavior = reduce ? 'auto' : 'smooth'
    if (el) {
      el.scrollIntoView({ block: 'start', behavior })
      el.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
    } else if (settled) {
      bodyRef.current?.scrollIntoView({ block: 'start', behavior })
    } else return
    wanted.current = null
  }
  useEffect(() => {
    const take = () => {
      wanted.current = takeOverviewSection() ?? wanted.current
      tryScroll()
    }
    take()
    window.addEventListener(OVERVIEW_SECTION_EVENT, take)
    return () => window.removeEventListener(OVERVIEW_SECTION_EVENT, take)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    tryScroll()
  })

  const loading = unreadQ.isLoading || reqQ.isLoading
  const failed = unreadQ.isError || reqQ.isError || (reqQ.data && 'error' in reqQ.data)
  const shownUnread = showAllUnread ? unread : unread.slice(0, 5)
  const anyNotifications = unread.length > 0 || read.length > 0
  const anyRequests = !!groups && (groups.askedOfYou.length > 0 || groups.youAsked.length > 0 || groups.answered.length > 0)

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
        <p className="mono flex flex-wrap items-center gap-2 text-meta text-ink-500">
          <span>{REQUEST_KIND_WORDS[r.kind]}</span>
          {r.agent && <span className="rounded border border-ai/40 bg-ai/10 px-2 py-1 uppercase text-ai">agent</span>}
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

  return (
    <div ref={bodyRef} data-testid="overview-body" className="px-4 pb-8">
      {loading && (
        <div className="flex flex-col gap-2 pt-4" aria-hidden="true">
          <div className="h-18 animate-pulse rounded-lg bg-ink-100 motion-reduce:animate-none" />
          <div className="h-18 animate-pulse rounded-lg bg-ink-100 motion-reduce:animate-none" />
        </div>
      )}
      {failed && !loading && (
        <div role="alert" className="flex flex-col items-start gap-2 pt-4">
          <p className="text-ui text-accent-escalate">Couldn&apos;t load this. Check your signal and try again.</p>
          <button
            type="button"
            className={SMALL_BUTTON}
            onClick={() => {
              void unreadQ.refetch()
              void reqQ.refetch()
            }}
          >
            Try again
          </button>
        </div>
      )}

      {(isAdmin || siteObjective || deptObjectives.length > 0) && (
        <section data-testid="overview-objectives" className="-mx-4">
          <h2 className={HEADING}>OBJECTIVES</h2>
          <div className="flex flex-col gap-2 px-4">
            {isAdmin ? (
              <ObjectiveSlot
                subject={{ type: 'site', id: null }}
                current={siteObjective}
                prefix="Site"
                emptyLabel="Set a site objective"
                emptyStyle="dashed"
              />
            ) : (
              siteObjective && <ObjectiveLine view={siteObjective} prefix="Site" />
            )}
            {deptObjectives.map(({ d, o }) => (
              <ObjectiveLine key={d.id} view={o} prefix={d.name} />
            ))}
          </div>
        </section>
      )}

      {anyNotifications && (
        <section data-testid="overview-notifications" ref={(el) => void (sectionRefs.current.notifications = el)} className="-mx-4">
          <h2 tabIndex={-1} className={HEADING}>
            NOTIFICATIONS · {unread.length}
          </h2>
          <ul className="flex flex-col gap-1 px-4">
            {unread.length === 0 && <li className="text-ui text-ink-500">Nothing unread.</li>}
            {shownUnread.map((n) => notificationRow(n))}
            {showRead && read.map((n) => notificationRow(n))}
          </ul>
          <div className="flex flex-wrap gap-2 px-4">
            {!showAllUnread && unread.length > 5 && (
              <button
                type="button"
                className="min-h-tap text-ui text-ink-700 underline-offset-2 hover:underline"
                onClick={() => setShowAllUnread(true)}
              >
                Show {unread.length - 5} more
              </button>
            )}
            {read.length > 0 && (
              <button
                type="button"
                data-testid="notification-show-read"
                className="min-h-tap text-ui text-ink-700 underline-offset-2 hover:underline"
                onClick={() => setShowRead((v) => !v)}
              >
                {showRead ? 'Hide read' : 'Show read'}
              </button>
            )}
          </div>
        </section>
      )}

      {anyRequests && groups && (
        <section data-testid="overview-requests" ref={(el) => void (sectionRefs.current.requests = el)} className="-mx-4">
          <>
            <div className="flex items-center justify-between gap-2 pr-4">
              <h2 tabIndex={-1} className={HEADING}>
                MY REQUESTS
              </h2>
              {(role === 'worker' || role === 'supervisor') && (
                <RequestComposerTrigger
                  kinds={['new_sop']}
                  about={{ machines: [...machines], site: true }}
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
                  <h3 className="mono pb-1 text-meta uppercase tracking-wide text-ink-500">Asked of you</h3>
                  <ul className="flex flex-col gap-2">{groups.askedOfYou.map((r) => requestRow(r, 'asked'))}</ul>
                </div>
              )}
              {youAsked.length > 0 && (
                <div>
                  <h3 className="mono pb-1 text-meta uppercase tracking-wide text-ink-500">You asked</h3>
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
                  <h3 className="mono pb-1 text-meta uppercase tracking-wide text-ink-500">Answered</h3>
                  <ul className="flex flex-col gap-2">{groups.answered.map((r) => requestRow(r, 'answered'))}</ul>
                </div>
              )}
            </div>
          </>
        </section>
      )}

      {canAnswer && officeCount > 0 && (
        <button
          type="button"
          data-testid="overview-office-link"
          onClick={() => select({ kind: 'room', id: 'office', tab: 'requests' })}
          className="mt-4 flex min-h-tap w-full items-center justify-between rounded-lg border border-ink-300 bg-paper-1 px-3 text-ui font-semibold text-ink-900"
        >
          <span>Open requests in the Office · {officeCount}</span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      )}

      {dialog && (
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
      )}
    </div>
  )

  function notificationRow(n: NotificationRow) {
    const isUnread = !n.read_at && !dimmed.has(n.id)
    return (
      <li key={n.id}>
        <button
          type="button"
          data-testid="notification-row"
          data-kind={n.kind}
          data-unread={isUnread ? 'true' : 'false'}
          onClick={() => void open(n)}
          className={`flex min-h-tap w-full items-start gap-2 rounded-lg px-1 py-2 text-left hover:bg-paper-2 ${isUnread ? '' : 'opacity-70'}`}
        >
          <span className={`mt-1 size-3 shrink-0 rounded-full ${isUnread ? 'bg-accent-measure' : ''}`} aria-hidden="true" />
          <span className="flex min-w-0 flex-col">
            <span className="mono text-meta uppercase text-ink-500">
              {NOTIFICATION_KIND_WORDS[n.kind]} · {relativeWhen(n.created_at)}
            </span>
            <span className="line-clamp-2 text-ui text-ink-900">{n.title}</span>
          </span>
        </button>
      </li>
    )
  }
}
