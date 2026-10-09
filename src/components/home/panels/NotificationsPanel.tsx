'use client'

/**
 * Phase 63 (HOME-04, R5) -- the notification list, moved out of the Phase 60 site overview so My record
 * and the old overview share one implementation. No number in the heading.
 *
 * Read, counted and marked read with the BROWSER Supabase client under RLS: there is no server action
 * on this path (CLAUDE.md 2026-09-29, the Next 16.2.1 action-queue orphan). Opening one navigates only
 * inside the click handler, never from an effect. A stored place is untrusted: isSafePlace first.
 */
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { NOTIFICATION_KIND_WORDS, type NotificationKind } from '@/lib/notifications/kinds'
import { isSafePlace } from '@/lib/notifications/places'
import { relativeWhen } from '@/lib/office/format'
import { NOTIFICATIONS_KEY } from '@/lib/shell/query-keys'
import { useSectionScroll } from './useSectionScroll'

const READ_KEY = [...NOTIFICATIONS_KEY, 'read'] as const
const HEADING = 'mono px-4 pb-1 pt-4 text-meta uppercase tracking-wide text-ink-600'

interface NotificationRow {
  id: string
  kind: NotificationKind
  title: string
  place: string
  read_at: string | null
  created_at: string
}
const COLUMNS = 'id, kind, title, place, read_at, created_at'

export function NotificationsPanel({ onOpenAddress }: { onOpenAddress(address: string): void }) {
  const router = useRouter()
  const queryClient = useQueryClient()

  // Own rows only (RLS), filtered in the query.
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
  const sectionRef = useRef<HTMLElement>(null)
  useSectionScroll('notifications', sectionRef, !unreadQ.isLoading)

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
      // supabase-js resolves { error } rather than throwing; a denied or timed-out
      // update undims the row (it is still unread) and still opens the place (WR-07).
      let failed = false
      try {
        // The hand-extended table types resolve this Update to never; the column is read_at only (RLS grants no other).
        const patch = createClient()
          .from('notifications')
          .update({ read_at: new Date().toISOString() } as never)
          .eq('id', n.id)
        const { error } = await Promise.race([
          patch,
          new Promise<{ error: Error }>((resolve) => setTimeout(() => resolve({ error: new Error('timeout') }), 3000)),
        ])
        failed = !!error
      } catch {
        failed = true
      }
      if (failed)
        setDimmed((s) => {
          const next = new Set(s)
          next.delete(n.id)
          return next
        })
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY })
      void queryClient.invalidateQueries({ queryKey: READ_KEY })
      if (n.kind === 'asked')
        void queryClient.invalidateQueries({
          queryKey: ['user-sop-assignments'],
        })
    }
    if (isSafePlace(n.place) && n.place.startsWith('/sops/')) {
      router.push(n.place)
      return
    }
    onOpenAddress(isSafePlace(n.place) ? n.place : '/')
  }

  if (unreadQ.isLoading) {
    return (
      <div className="pt-4" aria-hidden="true">
        <div className="h-18 animate-pulse rounded-lg bg-ink-100 motion-reduce:animate-none" />
      </div>
    )
  }
  if (unreadQ.isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-2 pt-4">
        <p className="text-ui text-accent-escalate">Couldn&apos;t load this. Check your signal and try again.</p>
        <button
          type="button"
          className="min-h-tap rounded-lg border border-ink-300 bg-paper-1 px-3 text-ui font-semibold text-ink-900"
          onClick={() => void unreadQ.refetch()}
        >
          Try again
        </button>
      </div>
    )
  }
  if (unread.length === 0 && read.length === 0) return null

  const shownUnread = showAllUnread ? unread : unread.slice(0, 5)

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
            <span className="mono text-meta uppercase text-ink-600">
              {NOTIFICATION_KIND_WORDS[n.kind]} · {relativeWhen(n.created_at)}
            </span>
            <span className="line-clamp-2 text-ui text-ink-900">{n.title}</span>
          </span>
        </button>
      </li>
    )
  }

  return (
    <section data-testid="overview-notifications" ref={sectionRef} className="-mx-4">
      <h2 tabIndex={-1} className={HEADING}>
        NOTIFICATIONS
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
  )
}
