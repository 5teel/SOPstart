'use client'

/**
 * Phase 60 (RQS-02, D-03) -- the Requests tab: one row per open request, newest first.
 *
 * Reads the same OFFICE_INBOX_KEY query as the Inbox tab and the supervisor pin. After an
 * answer the tab refetches it, then WRITES the pin count into the admin shell cache (never
 * invalidates it -- a refetch re-signs the scene image URL). No router, no navigation from
 * an effect. Admin-chunk code: the Office pane is the only importer.
 */
import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle } from 'lucide-react'
import type { OfficeInbox } from '@/actions/office'
import { OFFICE_INBOX_KEY } from '@/lib/shell/query-keys'
import { useOfficeInbox } from './InboxTab'
import type { RowDone } from './InboxRow'
import { RequestRow } from './RequestRow'

type InboxData = OfficeInbox | { error: string }

export function RequestsTab({ onReceipt }: { onReceipt(r: RowDone): void }) {
  const queryClient = useQueryClient()
  const { data, isLoading, isError, refetch } = useOfficeInbox()
  const requests = data && !('error' in data) ? data.requests : null
  const [focusAfter, setFocusAfter] = useState<{ id: string | null } | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const emptyRef = useRef<HTMLHeadingElement>(null)
  const rowsRef = useRef(requests)
  useEffect(() => {
    rowsRef.current = requests
  })

  // Focus moves to the next row's first button, else the previous, else the empty heading.
  useEffect(() => {
    if (!focusAfter) return
    const id = requestAnimationFrame(() => {
      const target = focusAfter.id
        ? listRef.current?.querySelector<HTMLElement>(`[data-key="${focusAfter.id}"] [data-testid="request-accept"]`)
        : null
      ;(target ?? emptyRef.current)?.focus()
      setFocusAfter(null)
    })
    return () => cancelAnimationFrame(id)
  }, [focusAfter])

  async function handleDone(id: string, r: RowDone) {
    onReceipt(r)
    const before = rowsRef.current ?? []
    await queryClient.invalidateQueries({ queryKey: OFFICE_INBOX_KEY })
    const fresh = queryClient.getQueryData<InboxData>(OFFICE_INBOX_KEY)
    if (!fresh || 'error' in fresh) return

    const stillThere = new Set(fresh.requests.map((x) => x.id))
    const index = before.findIndex((x) => x.id === id)
    const neighbour =
      before.slice(index + 1).find((x) => stillThere.has(x.id)) ??
      before.slice(0, index).reverse().find((x) => stillThere.has(x.id))
    setFocusAfter({ id: neighbour?.id ?? null })
  }

  if (isLoading) {
    return (
      <div data-testid="office-loading" className="flex flex-col gap-2 pt-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-18 animate-pulse rounded-lg bg-ink-100 motion-reduce:animate-none" />
        ))}
      </div>
    )
  }

  if (isError || !requests) {
    return (
      <div role="alert" className="flex flex-col items-start gap-2 pt-4">
        <p className="text-ui text-ink-700">Couldn&apos;t load this. Check your signal and try again.</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="min-h-tap rounded-lg border border-ink-300 bg-paper-1 px-3 text-ui font-semibold text-ink-900"
        >
          Try again
        </button>
      </div>
    )
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center px-4 py-12 text-center">
        <CheckCircle className="size-12 text-accent-ok" aria-hidden />
        <h3
          ref={emptyRef}
          tabIndex={-1}
          data-testid="requests-empty"
          className="mt-3 text-lg font-semibold leading-snug text-ink-900 outline-none"
        >
          No requests waiting.
        </h3>
        <p className="mt-1 text-ui text-ink-500">
          When someone asks for a change, a new SOP or to be observed, it shows up here.
        </p>
      </div>
    )
  }

  return (
    <ul ref={listRef} data-testid="requests-list">
      {requests.map((request) => (
        <RequestRow key={request.id} request={request} onDone={(r) => void handleDone(request.id, r)} />
      ))}
    </ul>
  )
}
