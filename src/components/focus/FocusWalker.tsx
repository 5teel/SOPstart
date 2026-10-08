'use client'

/**
 * The worker's focus screen: browse -> walk -> review -> sent inside one frame
 * (58-11). The server page hands over the resolved SOP and the worker's own
 * in-progress walk; useWalk owns everything that changes after that.
 */
import { useEffect, useRef, useState } from 'react'
import { BEFORE_YOU_START, currentIndex, type WalkEntry } from '@/lib/sop/focus'
import type { EditorOwner, FocusSop, FocusStepRow } from '@/lib/sop/focus-read'
import type { WalkState } from '@/lib/sop/walk-read'
import type { ParseJobSnapshot } from '@/hooks/useParseJob'
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
  /** 'browse' unless the page opened the editor: ?mode=edit, or a SOP still being read. */
  initialMode: 'browse' | 'edit' | 'parsing'
  /** The latest parse job (edit and parsing only). */
  job: ParseJobSnapshot | null
  /** Admin or safety manager with edit access: the Walk / Edit switch, tick, run the AI check, publish (D-06). */
  canEdit: boolean
  /** The owner row of the editor's This SOP block; null when the viewer cannot edit. */
  owner?: EditorOwner | null
  /** ?go=1 from Read's start: begin (or pick up) the walk on arrival, once. */
  autostart?: boolean
  /** ?fresh=1 from "or begin from step 1": open the discard confirmation straight away. */
  askStartOver?: boolean
}

/** Drop a single-use flag from the address, keeping the rest (history only, no navigation). */
function stripFlag(name: string) {
  const url = new URL(window.location.href)
  if (!url.searchParams.has(name)) return
  url.searchParams.delete(name)
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`)
}

export function FocusWalker({ data: served, initialWalk, from, versionState: servedState, supersededBy, updatedSinceLastWalk, initialMode, job, canEdit, owner = null, autostart = false, askStartOver = false }: FocusWalkerProps) {
  // Walk / Edit flips in place (D-06): local state plus the address, never a navigation.
  const [editing, setEditing] = useState(initialMode !== 'browse')
  // The editor reports its latest read of the SOP, so Walk after an edit shows the steps as edited.
  const [edited, setEdited] = useState<FocusSop | null>(null)
  const data = edited ?? served
  // A draft published from the editor is live from that moment (no reload).
  const versionState: VersionState = servedState === 'draft' && data.sop.status === 'published' ? 'live' : servedState
  const w = useWalk({ data, initialWalk, from })

  function switchTo(next: 'walk' | 'edit') {
    const url = new URL(window.location.href)
    if (next === 'edit') url.searchParams.set('mode', 'edit')
    else url.searchParams.delete('mode')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`)
    setEditing(next === 'edit')
  }
  const reading = initialMode === 'parsing' && !(edited && edited.steps.length > 0)
  const frameMode = editing ? (reading ? 'parsing' : 'edit') : w.phase
  const { order, phase, walk, entry } = w
  const canWalk = versionState === 'live'

  // Start from Read lands in the running SOP, not the browse page. One start per mount; no router call
  // here (a navigation from a mount effect can strand the next server action, CLAUDE.md 2026-09-29).
  const started = useRef(false)
  const canAutostart = autostart && initialMode === 'browse' && canWalk && order.length > 0
  useEffect(() => {
    if (!canAutostart || started.current) return
    started.current = true
    stripFlag('go')
    void w.start()
  }, [canAutostart, w])
  useEffect(() => {
    if (askStartOver) stripFlag('fresh')
  }, [askStartOver])

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
  } else if (canAutostart && !w.error && !editing) {
    // The merge is landing here: hold a blank paper page until the first step arrives.
    body = <div data-testid="focus-autostart" data-fuse-hold="" className="min-h-dvh bg-paper" />
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
              initialAsking={askStartOver}
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
      mode={frameMode}
      versionState={versionState}
      from={from}
      order={order}
      position={phase === 'walk' ? w.position : undefined}
      versionChip={chip}
      rowState={rowState}
      hollowDot={hollowDot}
      onPickStep={onPickStep}
      editor={editing ? { sop: served, job, canPublish: canEdit, owner } : null}
      modeSwitch={canEdit && versionState !== 'superseded' && initialMode !== 'parsing' ? { value: editing ? 'edit' : 'walk', onChange: switchTo } : null}
      onEditorFocus={setEdited}
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
