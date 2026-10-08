'use client'

/**
 * Phase 58 (58-11, FOC-04) -- the worker's walk over the server walk actions.
 *
 * The server's sop_walks row is the truth (D-09): every press writes first and
 * the screen only moves from the walk the server returns. All state lives in
 * this hook's useState -- no module store, no persisted cache -- and is reset
 * whenever the SOP or the server-supplied walk id changes, so a second walk in
 * one session inherits nothing from the first (CLAUDE.md 2026-10-03). Photos go
 * through useStepPhotos(walk.id), which is also keyed to the walk.
 *
 * The current step is local state; the URL ?step= is synced with
 * history.replaceState (never router.push: CLAUDE.md 2026-05-13). router.push
 * is called only from the Start-over click handler, never from an effect.
 */
import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { startOverWalk, startWalk, recordWalkStep } from '@/actions/walk'
import { useStepPhotos } from '@/hooks/useStepPhotos'
import { currentIndex, isReachable, reviewMissing, walkOrder, type WalkEntry } from '@/lib/sop/focus'
import { focusHref } from '@/lib/sop/focus-path'
import type { FocusSop, FocusStepRow } from '@/lib/sop/focus-read'
import type { WalkState } from '@/lib/sop/walk-read'

export type WalkPhase = 'browse' | 'walk' | 'review' | 'sent'

export const SAVE_ERROR = "Couldn't save your progress. Check your signal and tap again."
export const PHOTO_ERROR = "That photo didn't upload. Try again."
// Server refusals about the run's STATE, not the signal (review WR-05): tapping again
// would never help, so the local walk is dropped and the server page re-read.
export const STALE_WALK: Record<string, string> = {
  'Start the SOP again.': 'This SOP was finished or started again somewhere else. Loading the latest.',
  'That step is not part of this SOP.': 'This SOP changed since you started. Loading the latest.',
}
export const LOCKED_STEP = 'Finish the steps before this one first.'

export function useWalk({ data, initialWalk, from }: { data: FocusSop; initialWalk: WalkState | null; from: string | null }) {
  const router = useRouter()
  const sopId = data.sop.id
  const order = useMemo(() => walkOrder(data.sections, data.steps), [data.sections, data.steps])

  const [walk, setWalk] = useState<WalkState | null>(initialWalk)
  const [phase, setPhase] = useState<WalkPhase>('browse')
  const [stepId, setStepId] = useState<string | null>(null)
  const [returnToReview, setReturnToReview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Local thumbnails for photos taken in this walk, keyed by `${walkId}:${stepId}`.
  const [previews, setPreviews] = useState<Record<string, string>>({})

  // Reset every piece of per-walk state when the SOP or the server's walk changes (render-time, not an effect).
  const seed = `${sopId}:${initialWalk?.id ?? ''}`
  const [seenSeed, setSeenSeed] = useState(seed)
  if (seed !== seenSeed) {
    setSeenSeed(seed)
    setWalk(initialWalk)
    setPhase('browse')
    setStepId(null)
    setReturnToReview(false)
    setBusy(false)
    setError(null)
    setPreviews({})
  }

  const photoApi = useStepPhotos(walk?.id)

  const done = useMemo(() => new Set(Object.keys(walk?.done ?? {})), [walk])
  const acked = useMemo(() => new Set(Object.keys(walk?.acks ?? {})), [walk])
  const photoSteps = useMemo(() => new Set((walk?.photos ?? []).map((p) => p.stepId)), [walk])
  const missing = useMemo(() => reviewMissing(order, { acked, photos: photoSteps }), [order, acked, photoSteps])

  const firstUndone = order[currentIndex(order, done)]?.step.id ?? null
  const currentId = stepId ?? firstUndone ?? order[0]?.step.id ?? null
  const entry: WalkEntry<FocusStepRow> | undefined = order.find((e) => e.step.id === currentId)
  const position = entry ? entry.index : undefined
  const allowForward = data.sop.allow_forward_jump

  const syncUrl = useCallback((id: string | null) => {
    const params = new URLSearchParams(window.location.search)
    if (id) params.set('step', id)
    else params.delete('step')
    const qs = params.toString()
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`)
  }, [])

  const goStep = useCallback(
    (id: string | null, nextPhase: WalkPhase = 'walk') => {
      setStepId(id)
      setPhase(nextPhase)
      setError(null)
      syncUrl(nextPhase === 'walk' ? id : null)
    },
    [syncUrl],
  )

  /**
   * A server refusal in the worker's words. A stale walk resets to browse and
   * re-reads the server page (from a click handler, never an effect); a locked
   * step or missing photo is said as is; anything else reads as a signal problem.
   */
  const serverError = useCallback(
    (msg: string, fallback: string) => {
      const stale = STALE_WALK[msg]
      if (stale) {
        setWalk(null)
        setPhase('browse')
        setStepId(null)
        setReturnToReview(false)
        router.refresh()
        return setError(stale)
      }
      setError(msg === 'Add a photo to continue.' || msg === LOCKED_STEP ? msg : fallback)
    },
    [router],
  )

  /** Everything the worker has to finish is done: the next screen is the review. */
  const afterWrite = useCallback(
    (next: WalkState, fromId: string) => {
      const nextDone = new Set(Object.keys(next.done))
      const remaining = order.filter((e) => !nextDone.has(e.step.id))
      if (returnToReview) {
        setReturnToReview(false)
        goStep(null, 'review')
      } else if (remaining.length === 0) {
        goStep(null, 'review')
      } else {
        const here = order.findIndex((e) => e.step.id === fromId)
        const ahead = remaining.find((e) => order.indexOf(e) > here) ?? remaining[0]
        goStep(ahead.step.id)
      }
    },
    [order, returnToReview, goStep],
  )

  /** Start a new walk or pick the existing one up where the server says it stands. */
  const start = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = walk ? { walk } : await startWalk({ sopId })
      if ('error' in res) return serverError(res.error, res.error)
      setWalk(res.walk)
      const doneIds = new Set(Object.keys(res.walk.done))
      const next = order[currentIndex(order, doneIds)]
      if (!next) goStep(null, 'review')
      else goStep(res.walk.current_step_id && !doneIds.has(res.walk.current_step_id) ? res.walk.current_step_id : next.step.id)
    } catch {
      setError(SAVE_ERROR)
    } finally {
      setBusy(false)
    }
  }, [busy, walk, sopId, order, goStep, serverError])

  const complete = useCallback(
    async (id: string) => {
      if (!walk || busy) return
      setBusy(true)
      setError(null)
      try {
        const res = await recordWalkStep({ walkId: walk.id, stepId: id, action: 'complete' })
        if ('error' in res) return serverError(res.error, SAVE_ERROR)
        setWalk(res.walk)
        afterWrite(res.walk, id)
      } catch {
        setError(SAVE_ERROR)
      } finally {
        setBusy(false)
      }
    },
    [walk, busy, afterWrite, serverError],
  )

  /** Compress + upload under the walk id, then record it on the server walk. Retake replaces. */
  const photo = useCallback(
    async (id: string, file: File) => {
      if (!walk || busy) return
      setBusy(true)
      setError(null)
      try {
        const uploaded = await photoApi.addPhoto(walk.id, id, file)
        if (!uploaded) return setError(PHOTO_ERROR)
        const res = await recordWalkStep({
          walkId: walk.id,
          stepId: id,
          action: 'photo',
          photo: { localId: uploaded.localId, storagePath: uploaded.path },
        })
        if ('error' in res) return serverError(res.error, PHOTO_ERROR)
        setWalk(res.walk)
        // ponytail: object URLs are not revoked; a walk holds a handful of thumbnails.
        setPreviews((p) => ({ ...p, [`${walk.id}:${id}`]: URL.createObjectURL(file) }))
      } catch {
        setError(PHOTO_ERROR)
      } finally {
        setBusy(false)
      }
    },
    [walk, busy, photoApi, serverError],
  )

  const startOver = useCallback(async () => {
    if (!walk || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await startOverWalk({ walkId: walk.id })
      if ('error' in res) return serverError(res.error, res.error)
      if (res.sopId !== sopId) {
        router.push(focusHref(res.sopId, { from }))
        return
      }
      setWalk(res.walk)
      setPreviews({})
      setReturnToReview(false)
      goStep(order[0]?.step.id ?? null)
    } catch {
      setError(SAVE_ERROR)
    } finally {
      setBusy(false)
    }
  }, [walk, busy, sopId, router, from, order, goStep, serverError])

  /** D-08: back through done steps; ahead only when the SOP allows jumping. */
  const reachable = useCallback(
    (id: string) => isReachable(order, id, done, allowForward),
    [order, done, allowForward],
  )
  const pick = useCallback(
    (id: string) => {
      if (!reachable(id)) return
      setReturnToReview(false)
      goStep(id)
    },
    [reachable, goStep],
  )
  /** A review row: go to that step, and come back to the review after it. */
  const reopenFromReview = useCallback(
    (id: string) => {
      setReturnToReview(true)
      goStep(id)
    },
    [goStep],
  )

  const previous = useCallback(() => {
    if (!entry) return
    const before = order[order.indexOf(entry) - 1]
    if (before) pick(before.step.id)
  }, [entry, order, pick])

  return {
    order,
    walk,
    phase,
    setPhase,
    entry,
    position,
    done,
    acked,
    photoSteps,
    missing,
    previews,
    busy: busy || photoApi.uploadingCount > 0,
    error,
    allowForward,
    start,
    complete,
    photo,
    startOver,
    reachable,
    pick,
    previous,
    reopenFromReview,
    goStep,
    sent: () => goStep(null, 'sent'),
  }
}
