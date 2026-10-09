'use client'

/**
 * Phase 59 (DEC-02, D-09) -- the Decisions tab: the append-only ledger, read-only, newest first.
 *
 * One query per chip; the chip is part of the key, so a chip change starts again at the newest 50.
 * Rows carry plain words only -- the read action sends titles, labels and code-literal summaries,
 * never ids or free text. Admin-chunk code: the Office pane is the only importer.
 */
import { HOME, homeFrom } from '@/lib/shell/home-state'
import { useState } from 'react'
import Link from 'next/link'
import { useInfiniteQuery } from '@tanstack/react-query'
import { listDecisions, type DecisionListRow, type DecisionPage } from '@/actions/office'
import { DECISION_GROUPS, KIND_GROUPS, KIND_WORDS, type DecisionGroupKey } from '@/lib/decisions/read'
import { nzDateTime, relativeWhen } from '@/lib/office/format'
import { focusHref } from '@/lib/sop/focus-path'

type Cursor = { createdAt: string; id: string }

const CHIP = 'rounded mono text-meta uppercase tracking-wide px-2 py-1'

function kindChipClass(row: DecisionListRow): string {
  if (row.kind === 'reject') return `${CHIP} bg-accent-escalate/10 text-accent-escalate`
  if ((KIND_GROUPS.ai as ReadonlyArray<string>).includes(row.kind)) return `${CHIP} bg-ai/10 text-ai border border-ai/40`
  return `${CHIP} bg-paper-2 text-ink-700`
}

function Row({ row }: { row: DecisionListRow }) {
  const when = nzDateTime(row.when)
  const about = row.about
  const aboutText = about.type === 'sop' ? about.title : about.text
  return (
    <tr data-testid="decisions-row" data-kind={row.kind} className="h-tap border-b border-ink-100 align-middle">
      <td className="truncate pr-2 text-ink-700">
        <time dateTime={row.when} title={when} aria-label={when}>
          {relativeWhen(row.when)}
        </time>
      </td>
      <td className="pr-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate" title={row.who.name}>
            {row.who.name}
          </span>
          {row.who.agent && <span className={`${CHIP} shrink-0 bg-ai/10 text-ai border border-ai/40`}>agent</span>}
        </div>
      </td>
      <td className="pr-2">
        <span className={`${kindChipClass(row)} inline-block max-w-full truncate align-middle`} title={KIND_WORDS[row.kind]}>
          {KIND_WORDS[row.kind]}
        </span>
      </td>
      <td className="truncate" title={aboutText}>
        {about.type === 'sop' ? (
          <Link href={focusHref(about.sopId, { from: homeFrom({ ...HOME, s: 'signoffs' }) })} className="underline-offset-2 hover:underline">
            {about.title}
          </Link>
        ) : (
          about.text
        )}
      </td>
    </tr>
  )
}

export function DecisionsTab() {
  const [group, setGroup] = useState<DecisionGroupKey>('all')
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['office-decisions', group],
    initialPageParam: undefined as Cursor | undefined,
    queryFn: async ({ pageParam }) => {
      const page = await listDecisions({ group, cursor: pageParam })
      if ('error' in page) throw new Error(page.error)
      return page as DecisionPage
    },
    getNextPageParam: (last) => (last.hasOlder ? (last.nextCursor ?? undefined) : undefined),
  })
  const rows = data?.pages.flatMap((p) => p.rows) ?? []

  return (
    <div className="flex flex-col gap-3 pt-3">
      <p className="text-ui text-ink-500">Read-only. Nothing here can be edited or deleted.</p>
      <div className="flex flex-wrap gap-2">
        {DECISION_GROUPS.map((g) => (
          <button
            key={g.key}
            type="button"
            data-testid="decisions-chip"
            data-chip={g.key}
            aria-pressed={group === g.key}
            onClick={() => setGroup(g.key)}
            className={`inline-flex h-9 items-center rounded-full border px-3 text-ui focus-visible:outline-2 focus-visible:outline-accent-step ${
              group === g.key ? 'border-ink-900 bg-ink-900 text-paper' : 'border-ink-300 text-ink-700'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div data-testid="office-loading" className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-18 animate-pulse rounded-lg bg-ink-100 motion-reduce:animate-none" />
          ))}
        </div>
      ) : isError ? (
        <div role="alert" className="flex flex-col items-start gap-2 pt-1">
          <p className="text-ui text-ink-700">Couldn&apos;t load this. Check your signal and try again.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="min-h-tap rounded-lg border border-ink-300 bg-paper-1 px-3 text-ui font-semibold text-ink-900"
          >
            Try again
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col gap-1 py-8" data-testid="decisions-empty">
          <h3 className="text-reading font-semibold text-ink-900">Nothing logged here yet.</h3>
          <p className="text-ui text-ink-500">Every approval, sign-off and change shows up here once it happens.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-ui">
              <thead>
                <tr className="border-b border-ink-200 text-left mono text-meta uppercase tracking-wide text-ink-600">
                  <th className="w-24 pb-2 pr-2 font-semibold">When</th>
                  <th className="w-36 pb-2 pr-2 font-semibold">Who</th>
                  <th className="w-36 pb-2 pr-2 font-semibold">What</th>
                  <th className="pb-2 font-semibold">About</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Row key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
          {hasNextPage ? (
            <button
              type="button"
              data-testid="decisions-show-older"
              disabled={isFetchingNextPage}
              onClick={() => void fetchNextPage()}
              className="min-h-tap w-full rounded-lg border border-ink-300 bg-paper-1 text-ui font-semibold text-ink-900 disabled:opacity-60"
            >
              {isFetchingNextPage ? 'Loading…' : 'Show older'}
            </button>
          ) : (
            <p className="mono text-meta text-ink-600">That&apos;s everything.</p>
          )}
        </>
      )}
    </div>
  )
}
