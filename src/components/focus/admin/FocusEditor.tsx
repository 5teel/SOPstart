'use client'

/**
 * Phase 58 (58-13) -- the lazy root of the editor. The frame mounts this through
 * one next/dynamic({ ssr: false }) seam, so none of it reaches the worker bundle.
 *
 * While a SOP is still being read it shows ParseProgress over a skeleton (the
 * screen is never empty); when the job finishes it re-reads the SOP and swaps the
 * editable document in, in place -- no route change. Otherwise it is the editor:
 * rail with "This SOP", the document with the AI check on top, and the bottom bar.
 */
import { useContext, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AiCheckBanner } from '@/components/focus/admin/AiCheckBanner'
import { EditDocument } from '@/components/focus/admin/EditDocument'
import { EditRail } from '@/components/focus/admin/EditRail'
import { ParseProgress } from '@/components/focus/admin/ParseProgress'
import { PublishBar } from '@/components/focus/admin/PublishBar'
import { ThisSopBlock } from '@/components/focus/admin/ThisSopBlock'
import { EditorSkeleton } from '@/components/focus/EditorSkeleton'
import { useFindings } from '@/hooks/useFindings'
import { FocusEditorBridgeContext } from '@/hooks/useFocusBack'
import { useFocusAutosave, useFocusSaveStatus } from '@/hooks/useFocusAutosave'
import { useFocusSop } from '@/hooks/useFocusSop'
import type { ParseJobSnapshot } from '@/hooks/useParseJob'
import { railNumber, walkOrder } from '@/lib/sop/focus'
import type { EditorOwner, FocusSop } from '@/lib/sop/focus-read'

export interface FocusEditorProps {
  /** The server page's first read of the SOP. */
  sop: FocusSop
  /** The latest parse job, when the SOP has one. */
  job: ParseJobSnapshot | null
  from: string | null
  /** Admins and safety managers: tick, run and clear the AI check, publish. */
  canPublish: boolean
  /** The owner row of This SOP; null when the page did not compute it. */
  owner: EditorOwner | null
  /** The page found the SOP still being read (or its read failed). */
  parsing: boolean
}

const PILL: Record<string, string> = { saving: 'Saving…', saved: 'Saved', error: 'Not saved — retrying' }

export function FocusEditor({ sop: initial, job, from, canPublish, owner, parsing: startedParsing }: FocusEditorProps) {
  const sopId = initial.sop.id
  const bridge = useContext(FocusEditorBridgeContext)
  const { focus, invalidate } = useFocusSop(sopId, initial)
  const { flush } = useFocusAutosave(sopId)
  const saveState = useFocusSaveStatus((s) => s.state)

  // `startedParsing` is only read on mount: the frame flips its own mode once steps arrive.
  const [wasParsing] = useState(startedParsing)
  const [parsed, setParsed] = useState(false)
  const [publishedNote, setPublishedNote] = useState(false)
  const parsing = wasParsing && !parsed
  const findingsApi = useFindings(sopId, !parsing)

  // Back waits for a pending save; the walker reads the latest steps if the admin flips to Walk.
  const setBeforeBack = bridge?.setBeforeBack
  const onFocus = bridge?.onFocus
  useEffect(() => {
    setBeforeBack?.(flush)
    return () => setBeforeBack?.(null)
  }, [setBeforeBack, flush])
  useEffect(() => {
    onFocus?.(focus)
  }, [onFocus, focus])

  const order = useMemo(() => walkOrder(focus.sections, focus.steps), [focus.sections, focus.steps])
  const stepLabel = (stepId: string) => {
    const e = order.find((x) => x.step.id === stepId)
    return e ? railNumber(e) : null
  }

  const openFindings = findingsApi.findings.flatMap((f) =>
    f.kind !== 'all_clear' && !f.cleared_at && f.step_id ? [{ id: f.id, stepId: f.step_id, text: f.description }] : []
  )
  const flagged = new Set(openFindings.map((f) => f.stepId))

  async function onDone() {
    await invalidate()
    setParsed(true)
  }

  if (parsing) {
    return (
      <EditorSkeleton>
        <ParseProgress sopId={sopId} job={job} onDone={() => void onDone()} />
      </EditorSkeleton>
    )
  }

  const pill = PILL[saveState]
  const isDraft = focus.sop.status === 'draft'

  return (
    <>
      {bridge?.saveSlot &&
        pill &&
        createPortal(
          <span
            data-testid="focus-save-pill"
            className={`mono text-meta ${saveState === 'error' ? 'text-accent-escalate' : 'text-ink-500'}`}
            role="status"
          >
            {pill}
          </span>,
          bridge.saveSlot
        )}

      <EditRail
        sopId={sopId}
        initial={initial}
        open={bridge?.railOpen ?? false}
        onClose={bridge?.closeRail ?? (() => {})}
        flaggedStepIds={flagged}
        sheetTop={bridge?.sheetTop}
        footer={<ThisSopBlock sopId={sopId} initial={initial} from={from} isAdmin={canPublish} owner={owner} />}
      />

      <main data-testid="focus-column" className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="flex-1">
          <EditDocument
            sopId={sopId}
            initial={initial}
            from={from}
            canTick={canPublish}
            findings={openFindings}
            publishedNote={publishedNote}
            bannerSlot={
              <>
                {wasParsing && parsed && (
                  <p data-testid="parse-done" role="status" aria-live="polite" className="text-ui text-ink-900">
                    Done reading. {focus.steps.length} {focus.steps.length === 1 ? 'step' : 'steps'} found — check each one.
                  </p>
                )}
                {isDraft && <AiCheckBanner api={findingsApi} canRun={canPublish} stepLabel={stepLabel} />}
              </>
            }
          />
        </div>
        <PublishBar
          sopId={sopId}
          initial={initial}
          isAdmin={canPublish}
          onPublished={() => {
            setPublishedNote(true)
            void invalidate()
          }}
        />
      </main>
    </>
  )
}
