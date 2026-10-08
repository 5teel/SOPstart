'use client'
/**
 * Phase 63 (HOME-03) -- the Read view of the reader pane (sketch 009 A, readHtml).
 *
 * Static on purpose: it is on the start path. The outline is a browser-client read
 * (useReadSop); the one server action here is the owner's name, enabled only for
 * supervisor and up (R4, T-63-16). The Wordmark halves carry the data-fuse hooks
 * the Start animation (63-15) reads; this plan only shapes them.
 *
 * Pitfall 6: the machine panel and browse page this start skips were the entry points
 * for Make a request, Ask and Edit, so Read carries all three, each gated by role.
 */
import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { getSopOwner } from '@/actions/sop-owner'
import { Wordmark } from '@/components/brand/Wordmark'
import { KindChip } from '@/components/focus/KindChip'
import { DOT } from '@/components/home/SopRow'
import { StandardLabels } from '@/components/sop/StandardLabels'
import { useReadSop } from '@/hooks/useReadSop'
import type { LibraryRow } from '@/hooks/useLibrary'
import { walkOrder } from '@/lib/sop/focus'
import { focusHref } from '@/lib/sop/focus-path'

// Raise and ask are lazy modules: neither rides in the home download (60 A-07).
const RequestComposerTrigger = dynamic(
  () => import('@/components/requests/RequestComposer').then((m) => m.RequestComposerTrigger),
  { ssr: false, loading: () => null },
)
const AskTrigger = dynamic(() => import('@/components/requests/AskPicker').then((m) => m.AskTrigger), {
  ssr: false,
  loading: () => null,
})

const OWNER_ROLES = ['supervisor', 'admin', 'safety_manager']

export function ReadView({
  row,
  role,
  from,
  backLabel,
  onBack,
}: {
  row: LibraryRow
  role: string | null
  from: string
  backLabel: string
  onBack(): void
}) {
  const router = useRouter()
  const { data, isLoading } = useReadSop(row.id)
  const supervisorUp = !!role && OWNER_ROLES.includes(role)
  const canEdit = role === 'admin' || role === 'safety_manager'
  const ownerQ = useQuery({
    queryKey: ['sop-owner', row.id],
    enabled: supervisorUp,
    staleTime: 1000 * 60 * 5,
    queryFn: () => getSopOwner(row.id),
  })
  const owner = ownerQ.data && 'label' in ownerQ.data ? ownerQ.data.label : null

  const startHref = focusHref(row.id, { from })
  useEffect(() => {
    router.prefetch(startHref)
  }, [router, startHref])

  const back = (
    <button type="button" data-testid="read-back" onClick={onBack} className="mb-4 block min-h-tap text-ui text-ink-600">
      ‹ {backLabel}
    </button>
  )
  if (data === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8">
        {back}
        <p data-testid="read-missing" className="text-reading text-ink-700">This SOP isn&apos;t in your library.</p>
      </div>
    )
  }

  const order = data ? walkOrder(data.sections, data.steps) : []
  const { status } = row

  return (
    <div data-testid="read-view" className="mx-auto max-w-3xl px-4 pb-24 pt-6 lg:px-8">
      {back}
      <Wordmark variant="chip" size="merge" data-fuse="sop" />
      <h1 className="mb-1.5 mt-2.5 text-2xl font-semibold text-ink-900">{row.title}</h1>
      <p className="font-mono text-meta text-ink-500">
        <i aria-hidden="true" className="mr-1 inline-block size-2 rounded align-baseline" style={{ background: row.colourVar }} />
        {row.areaName} · {row.type} · v{row.version ?? 1}
        {owner ? ` · owner ${owner}` : ''}
        {row.minutes ? ` · ~${row.minutes} min` : ''}
      </p>
      {data && data.standards.sop.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <StandardLabels names={data.standards.sop.map((s) => s.name)} />
        </div>
      )}
      {status && (
        <p data-testid="read-status" className="mt-3 flex items-center gap-1.5 text-ui text-ink-600">
          <i aria-hidden="true" className={`size-2 shrink-0 rounded-full ${DOT[status.kind]}`} />
          {status.text}
        </p>
      )}

      <div className="mb-1.5 mt-5 flex flex-wrap items-center gap-3.5">
        <button
          type="button"
          data-testid="read-start"
          data-fuse="button"
          aria-label="start"
          onClick={() => router.push(startHref)}
          className="flex min-h-tap-glove w-full items-center justify-center rounded-lg bg-ink-900 lg:w-auto lg:px-10"
        >
          <Wordmark variant="start" size="merge" onInk data-fuse="start" />
        </button>
        <span className="text-ui text-ink-600">
          {status?.kind === 'stopped' ? (
            <>
              Picks up at step {status.step} of {status.total} ·{' '}
              <Link data-testid="read-begin-again" href={startHref} className="underline">
                or begin from step 1
              </Link>
            </>
          ) : data ? (
            `${order.length} steps`
          ) : null}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-ui text-ink-700">
        <RequestComposerTrigger
          kinds={['change_sop', 'observe_me']}
          about={{ sops: [{ id: row.id, title: row.title }] }}
          triggerStyle="text"
        />
        {supervisorUp && <AskTrigger sopId={row.id} sopTitle={row.title} variant="rail" align="start" />}
        {canEdit && (
          <Link data-testid="read-edit" href={focusHref(row.id, { mode: 'edit', from })} className="underline">
            Edit
          </Link>
        )}
      </div>

      <h2 className="mono mb-1 mt-7 text-meta uppercase text-ink-500">What you&apos;ll do</h2>
      {isLoading || !data ? (
        <div aria-busy="true" className="space-y-3 pt-2">
          <div className="h-5 w-3/4 animate-pulse rounded bg-paper-2 motion-reduce:animate-none" />
          <div className="h-5 w-1/2 animate-pulse rounded bg-paper-2 motion-reduce:animate-none" />
        </div>
      ) : (
        <ol data-testid="read-steps" className="m-0 list-none p-0">
          {order.map((e) => (
            <li key={e.step.id} className="flex gap-3 border-b border-ink-200 py-2.5 text-reading">
              <span className="w-6 shrink-0 pt-1 font-mono text-meta text-ink-500">{e.index}</span>
              <span className="flex-1">
                {e.step.text}
                {e.step.photo_required && <span className="font-mono text-meta text-ink-500"> · photo</span>}
              </span>
              <span className="h-fit shrink-0">
                <KindChip kind={e.step.kind} />
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
