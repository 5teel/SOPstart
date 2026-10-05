'use client'

/**
 * The worker's focus screen: browse -> walk -> review -> sent inside one frame
 * (58-11). The server page hands over the resolved SOP and the worker's own
 * in-progress walk; useWalk owns everything that changes after that.
 */
import { BEFORE_YOU_START, currentIndex, type WalkEntry } from '@/lib/sop/focus'
import type { FocusSop, FocusStepRow } from '@/lib/sop/focus-read'
import type { WalkState } from '@/lib/sop/walk-read'
import { useWalk } from '@/hooks/useWalk'
import { FocusFrame, type VersionState } from '@/components/focus/FocusFrame'
import { BrowseDocument } from '@/components/focus/BrowseDocument'
import { WalkStep } from '@/components/focus/WalkStep'
import { ReviewAndSend } from '@/components/focus/ReviewAndSend'
import { SentPanel } from '@/components/focus/SentPanel'
import { ResumeCard } from '@/components/focus/ResumeCard'

export interface FocusWalkerProps {
  data: FocusSop
  initialWalk: WalkState | null
  from: string | null
  versionState: VersionState
  /** The live version a superseded one was replaced by (D-14). */
  supersededBy: { id: string; version: number } | null
  updatedSinceLastWalk: boolean
}

export function FocusWalker({ data, initialWalk, from, versionState, supersededBy, updatedSinceLastWalk }: FocusWalkerProps) {
  const w = useWalk({ data, initialWalk, from })
  const { order, phase, walk, entry } = w
  const canWalk = versionState === 'live'

  const chip = versionState === 'superseded' ? `v${data.sop.version} — superseded` : versionState === 'draft' ? 'Draft' : null

  const walking = phase !== 'browse' && !!walk
  const rowState = walking
    ? (e: WalkEntry<FocusStepRow>) =>
        w.done.has(e.step.id) ? 'done' : phase === 'walk' && e.step.id === entry?.step.id ? 'current' : w.reachable(e.step.id) ? 'open' : 'locked'
    : undefined
  const hollowDot = walking && w.allowForward ? (e: WalkEntry<FocusStepRow>) => (e.step.kind === 'hazard' || e.step.kind === 'ppe') && !w.acked.has(e.step.id) : undefined
  const onPickStep = walking ? (e: WalkEntry<FocusStepRow>) => phase !== 'sent' && w.pick(e.step.id) : undefined

  const resumeAt = Math.min(currentIndex(order, w.done) + 1, order.length)

  let body
  if (phase === 'walk' && walk && entry) {
    const names = (data.standards.steps[entry.step.id] ?? []).map((s) => s.name)
    body = (
      <WalkStep
        key={entry.step.id}
        entry={entry}
        total={order.length}
        isLast={order.every((e) => e.step.id === entry.step.id || w.done.has(e.step.id))}
        standardNames={names}
        groupStandardNames={entry.groupLabel === BEFORE_YOU_START ? [] : (data.standards.sections[entry.step.section_id] ?? []).map((s) => s.name)}
        hasPhoto={w.photoSteps.has(entry.step.id)}
        previewUrl={w.previews[`${walk.id}:${entry.step.id}`]}
        busy={w.busy}
        error={w.error}
        hasPrevious={entry.index > 1}
        onComplete={() => void w.complete(entry.step.id)}
        onPhoto={(file) => void w.photo(entry.step.id, file)}
        onPrevious={w.previous}
      />
    )
  } else if (phase === 'review' && walk) {
    body = (
      <ReviewAndSend
        walk={walk}
        order={order}
        missing={w.missing}
        previews={w.previews}
        onReopen={w.reopenFromReview}
        onKeepChecking={() => w.goStep(order[order.length - 1]?.step.id ?? null)}
        onSent={w.sent}
      />
    )
  } else if (phase === 'sent') {
    body = <SentPanel />
  } else {
    body = (
      <BrowseDocument
        data={data}
        order={order}
        from={from}
        supersededBy={supersededBy}
        updatedSinceLastWalk={updatedSinceLastWalk}
        onStartWalking={canWalk && order.length > 0 ? () => void w.start() : undefined}
        resumeSlot={
          walk && canWalk ? (
            <ResumeCard
              position={resumeAt}
              total={order.length}
              busy={w.busy}
              onResume={() => void w.start()}
              onStartOver={() => void w.startOver()}
            />
          ) : undefined
        }
      />
    )
  }

  return (
    <FocusFrame
      title={data.sop.title ?? 'Untitled SOP'}
      mode={phase}
      versionState={versionState}
      from={from}
      order={order}
      position={phase === 'walk' ? w.position : undefined}
      versionChip={chip}
      rowState={rowState}
      hollowDot={hollowDot}
      onPickStep={onPickStep}
    >
      {phase === 'browse' && w.error && (
        <p role="alert" data-testid="walk-error" className="mx-auto max-w-205 px-4 pt-4 text-ui text-accent-escalate lg:px-8">
          {w.error}
        </p>
      )}
      {body}
    </FocusFrame>
  )
}
