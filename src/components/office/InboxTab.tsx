'use client'

/**
 * Phase 59 (OFF-01, D-04, D-05, A-11) -- the Inbox tab: one row per thing to do.
 *
 * The list and the shell's Office pin come from the same derivation. A cleared row
 * leaves without a reload: the tab refetches OFFICE_INBOX_KEY (the supervisor pin reads
 * that same query), then WRITES the new count and chips into the admin shell cache. The
 * shell query is never invalidated -- a refetch re-signs the scene image URL (F-02).
 * No router, no navigation from an effect (CLAUDE.md 2026-09-29). Admin-chunk code: the
 * Office pane is the only importer.
 */
import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle } from 'lucide-react'
import { countClearedToday, getOfficeInbox, type OfficeInbox } from '@/actions/office'
import type { AdminShellData } from '@/actions/shell'
import { useRole } from '@/components/providers/RoleProvider'
import { INBOX_CHIPS, chipMatches, inboxCounts, type InboxChip, type InboxItem } from '@/lib/governance/inbox'
import { OFFICE_INBOX_KEY, SHELL_KEY } from '@/lib/shell/query-keys'
import { InboxRow, type RowDone } from './InboxRow'

const CLEARED_TODAY_KEY = ['office-cleared-today'] as const

export type ChipKey = 'all' | InboxChip
type InboxData = OfficeInbox | { error: string }

/** The one read behind the Inbox tab, the tab count and the chips. */
export function useOfficeInbox() {
  return useQuery({ queryKey: OFFICE_INBOX_KEY, queryFn: () => getOfficeInbox() })
}

export function inboxItemsOf(data: InboxData | undefined): InboxItem[] | null {
  return data && !('error' in data) ? data.items : null
}

/** Chip bar for the pane header. A supervisor sees none: one kind of row needs no filter. */
export function InboxChips({
  data,
  chip,
  onChip,
}: {
  data: InboxData | undefined
  chip: ChipKey
  onChip(c: ChipKey): void
}) {
  const items = inboxItemsOf(data)
  if (!items || items.length === 0 || (data && !('error' in data) && data.role === 'supervisor')) return null
  const counts = inboxCounts(items)
  const visible = INBOX_CHIPS.filter((c) => c.key === 'all' || counts[c.key] > 0 || c.key === chip)
  return (
    <div className="flex flex-wrap gap-2 pb-2">
      {visible.map((c) => (
        <button
          key={c.key}
          type="button"
          data-testid="office-chip"
          data-chip={c.key}
          aria-pressed={chip === c.key}
          onClick={() => onChip(c.key)}
          className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-ui focus-visible:outline-2 focus-visible:outline-accent-step ${
            chip === c.key ? 'border-ink-900 bg-ink-900 text-paper' : 'border-ink-300 text-ink-700'
          }`}
        >
          {c.label}
          <span className="mono text-meta">{counts[c.key]}</span>
        </button>
      ))}
    </div>
  )
}

type Ghost = { item: InboxItem; index: number; go: boolean }

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function InboxTab({
  chip,
  onChip,
  onReceipt,
}: {
  chip: ChipKey
  onChip(c: ChipKey): void
  onReceipt(r: RowDone): void
}) {
  const queryClient = useQueryClient()
  const role = useRole()
  // A-04: the ledger is readable by admin and safety manager only, so a supervisor never asks.
  const canSeeLedger = role === 'admin' || role === 'safety_manager'
  const { data, isLoading, isError, refetch } = useOfficeInbox()
  const cleared = useQuery({ queryKey: CLEARED_TODAY_KEY, queryFn: () => countClearedToday(), enabled: canSeeLedger })
  const clearedCount = cleared.data && !('error' in cleared.data) ? cleared.data.count : null
  const items = inboxItemsOf(data)
  const visible = items ? items.filter((i) => chipMatches(i, chip)) : []

  const [openKey, setOpenKey] = useState<string | null>(null)
  const [ghosts, setGhosts] = useState<Ghost[]>([])
  const [focusAfter, setFocusAfter] = useState<{ key: string | null } | null>(null)
  const visibleRef = useRef(visible)
  const listRef = useRef<HTMLUListElement>(null)
  const emptyRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    visibleRef.current = visible
  })

  // Focus moves to the next row's button, else the previous, else the empty heading.
  useEffect(() => {
    if (!focusAfter) return
    const id = requestAnimationFrame(() => {
      const target = focusAfter.key
        ? listRef.current?.querySelector<HTMLElement>(`[data-key="${focusAfter.key}"] [data-testid="office-row-action"]`)
        : null
      ;(target ?? emptyRef.current)?.focus()
      setFocusAfter(null)
    })
    return () => cancelAnimationFrame(id)
  }, [focusAfter])

  async function handleDone(item: InboxItem, r: RowDone) {
    onReceipt(r)
    setOpenKey(null)
    const before = visibleRef.current
    void queryClient.invalidateQueries({ queryKey: CLEARED_TODAY_KEY })
    await queryClient.invalidateQueries({ queryKey: OFFICE_INBOX_KEY })
    const fresh = queryClient.getQueryData<InboxData>(OFFICE_INBOX_KEY)
    const freshItems = inboxItemsOf(fresh)
    if (!fresh || !freshItems) return

    // The Office pin and the tab count must agree: write the shell cache, never refetch it.
    if (!('error' in fresh) && fresh.role !== 'supervisor') {
      queryClient.setQueryData<AdminShellData | { error: string }>(SHELL_KEY, (old) =>
        old && !('error' in old) ? { ...old, inboxCount: freshItems.length, inboxChips: inboxCounts(freshItems) } : old,
      )
    }

    const stillThere = new Set(freshItems.filter((i) => chipMatches(i, chip)).map((i) => i.key))
    const index = before.findIndex((i) => i.key === item.key)
    if (stillThere.has(item.key)) {
      setFocusAfter({ key: item.key })
      return
    }
    const neighbour =
      before.slice(index + 1).find((i) => stillThere.has(i.key)) ?? before.slice(0, index).reverse().find((i) => stillThere.has(i.key))
    setFocusAfter({ key: neighbour?.key ?? null })

    // The cleared row collapses over 200 ms; under reduced motion it is simply gone.
    if (prefersReducedMotion()) return
    setGhosts((g) => [...g, { item, index, go: false }])
    requestAnimationFrame(() => setGhosts((g) => g.map((x) => (x.item.key === item.key ? { ...x, go: true } : x))))
    setTimeout(() => setGhosts((g) => g.filter((x) => x.item.key !== item.key)), 220)
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

  if (isError || !items) {
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

  if (items.length === 0 && ghosts.length === 0) {
    return (
      <div className="flex flex-col items-center px-4 py-12 text-center">
        <CheckCircle className="size-12 text-accent-ok" aria-hidden />
        <h3
          ref={emptyRef}
          tabIndex={-1}
          data-testid="office-empty"
          className="mt-3 text-lg font-semibold leading-snug text-ink-900 outline-none"
        >
          Nothing needs you. That&apos;s the goal.
        </h3>
        {canSeeLedger && clearedCount !== null && (
          <p data-testid="office-cleared-today" className="mt-1 text-ui text-ink-500">
            {clearedCount === 0 ? 'Nothing was waiting today.' : `${clearedCount} cleared today.`}
          </p>
        )}
      </div>
    )
  }

  if (visible.length === 0 && ghosts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
        <p className="text-ui text-ink-500">Nothing under this filter.</p>
        <button
          type="button"
          onClick={() => onChip('all')}
          className="min-h-tap rounded-lg border border-ink-300 bg-paper-1 px-3 text-ui font-semibold text-ink-900"
        >
          Show all
        </button>
      </div>
    )
  }

  // A row that has just cleared stays in place while it collapses.
  const rows: Array<{ item: InboxItem; ghost: Ghost | null }> = visible.map((item) => ({ item, ghost: null }))
  for (const g of ghosts) rows.splice(Math.min(g.index, rows.length), 0, { item: g.item, ghost: g })

  return (
    <ul ref={listRef} data-testid="office-list">
      {rows.map(({ item, ghost }) => (
        <InboxRow
          key={item.key}
          item={item}
          expanded={!ghost && openKey === item.key}
          leaving={ghost ? (ghost.go ? 'go' : 'ready') : undefined}
          onToggle={() => setOpenKey((k) => (k === item.key ? null : item.key))}
          onDone={(r) => void handleDone(item, r)}
        />
      ))}
    </ul>
  )
}
