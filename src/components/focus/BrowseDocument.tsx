'use client'

/**
 * Browse state of the focus screen (D-05): every step in walk order, read only.
 * No completion exists here; "start" is the one primary and the page
 * decides whether to pass it. Text renders as plain React children only.
 */
import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { History, Lightbulb } from 'lucide-react'
import { BEFORE_YOU_START, type WalkEntry } from '@/lib/sop/focus'
import type { FocusSop, FocusStepRow } from '@/lib/sop/focus-read'
import { focusHref } from '@/lib/sop/focus-path'
import { Wordmark } from '@/components/brand/Wordmark'
import { KindChip, isSignal } from '@/components/focus/KindChip'
import { StandardLabels } from '@/components/sop/StandardLabels'
import { ObjectiveLine } from '@/components/shell/ObjectiveLine'
import { placementLabel, placementSummary } from '@/lib/sop/placement'

// Make a request: a lazy module (60 A-07), live SOPs only, never in the walk state.
const RequestTrigger = dynamic(() => import('@/components/requests/RequestComposer').then((m) => m.RequestComposerTrigger), {
  ssr: false,
  loading: () => null,
})

export interface BrowseDocumentProps {
  data: FocusSop
  order: WalkEntry<FocusStepRow>[]
  from: string | null
  /** The live version this one was replaced by (D-14). Hides start. */
  supersededBy?: { id: string; version: number } | null
  /** D-12: a newer version was published since this worker last did it. */
  updatedSinceLastWalk?: boolean
  /** Only passed for a live version a worker may walk. */
  onStartWalking?: () => void
  /** The page's resume card, shown above the steps when a walk is in progress. */
  resumeSlot?: ReactNode
}

export function BrowseDocument({ data, order, from, supersededBy, updatedSinceLastWalk, onStartWalking, resumeSlot }: BrowseDocumentProps) {
  const { sop, totalMinutes } = data
  const canStart = !!onStartWalking && !supersededBy
  const summary = [`${order.length} ${order.length === 1 ? 'step' : 'steps'}`, totalMinutes > 0 ? `about ${Math.round(totalMinutes)} min` : null]
    .filter(Boolean)
    .join(' · ')

  let lastGroup: string | null = null
  return (
    <div data-testid="focus-browse" className="relative flex min-h-full flex-col">
      <div className="mx-auto w-full max-w-205 flex-1 px-4 py-8 lg:px-8">
        {supersededBy && (
          <div
            data-testid="focus-superseded-banner"
            className="mb-6 flex items-start gap-3 rounded-lg border border-ink-200 bg-paper-2 p-4"
          >
            <History className="mt-0.5 size-4 shrink-0 text-ink-500" aria-hidden="true" />
            <p className="text-reading text-ink-900">
              v{sop.version} — superseded. Workers are on v{supersededBy.version}.{' '}
              <Link href={focusHref(supersededBy.id, { from })} className="font-semibold underline">
                Go to the current version
              </Link>
            </p>
          </div>
        )}

        <div data-testid="focus-summary" className="mb-6 flex flex-col gap-2 rounded-lg border border-ink-200 bg-paper-1 p-4">
          <p className="mono text-meta text-ink-600">{summary}</p>
          <p data-testid="sop-meta" className="text-ui text-ink-500">
            {placementLabel(placementSummary(sop.placement, data.machines.map((m) => ({ name: m.name, department: m.department }))))}
          </p>
          {data.objective && <ObjectiveLine view={data.objective} />}
          {updatedSinceLastWalk && (
            <p data-testid="focus-updated" className="flex items-center gap-2 text-ui text-ink-700">
              Updated since you last did it
            </p>
          )}
          {data.standards.sop.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <StandardLabels names={data.standards.sop.map((s) => s.name)} />
            </div>
          )}
          {sop.status === 'published' && !supersededBy && (
            <div className="self-start">
              <RequestTrigger
                kinds={['change_sop', 'observe_me']}
                about={{ sops: [{ id: sop.id, title: sop.title ?? 'this SOP' }] }}
                triggerStyle="text"
              />
            </div>
          )}
        </div>

        {resumeSlot}

        {order.length === 0 ? (
          <div data-testid="focus-empty" className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="text-reading font-semibold text-ink-900">This SOP has no steps yet.</p>
            <p className="text-reading text-ink-700">Ask an admin to finish writing it.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {order.map((entry) => {
              const { step } = entry
              const header = entry.groupLabel !== lastGroup ? entry.groupLabel : null
              lastGroup = entry.groupLabel
              const names = [...(data.standards.steps[step.id] ?? [])].map((s) => s.name)
              return (
                <div key={step.id} className="flex flex-col gap-4">
                  {header && (
                    <h2 className="section-heading mt-4 flex flex-wrap items-center gap-2">
                      {header}
                      {header !== BEFORE_YOU_START && (
                        <StandardLabels names={(data.standards.sections[step.section_id] ?? []).map((s) => s.name)} />
                      )}
                    </h2>
                  )}
                  <article
                    id={`step-${step.id}`}
                    tabIndex={-1}
                    data-testid="focus-browse-step"
                    data-kind={step.kind}
                    className="flex flex-col gap-3 rounded-lg border border-ink-200 bg-paper-1 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {isSignal(step.kind) && <KindChip kind={step.kind} />}
                      <StandardLabels names={names} />
                    </div>
                    <p className="text-reading text-ink-900">{step.text}</p>
                    {step.tip && (
                      <div className="flex items-start gap-2 rounded-lg border border-ink-200 bg-paper-2 p-4">
                        <Lightbulb className="mt-0.5 size-4 shrink-0 text-ink-500" aria-hidden="true" />
                        <p className="text-reading text-ink-900">
                          <span className="mr-2 font-semibold">Tip</span>
                          {step.tip}
                        </p>
                      </div>
                    )}
                    {step.image_urls.map((img) => (
                      <img key={img.path} src={img.url} alt="" loading="lazy" decoding="async" className="max-h-96 w-full rounded-lg object-contain" />
                    ))}
                  </article>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* The resume card carries the one start when a walk is in progress. */}
      {canStart && !resumeSlot && (
        <div className="sticky bottom-0 border-t border-ink-200 bg-paper p-4">
          <div className="mx-auto max-w-205">
            <button
              type="button"
              data-testid="focus-start-walking"
              onClick={onStartWalking}
              aria-label="start"
              className="flex min-h-tap-glove w-full items-center justify-center rounded-lg bg-ink-900"
            >
              <Wordmark variant="start" size="merge" onInk />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
