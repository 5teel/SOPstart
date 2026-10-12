'use client'

/**
 * ADR-0012 -- a run of one SOP on the home: the same step list as reading, ticked.
 *
 * The server's sop_walks row is the truth (D-09): every tick and photo is written by
 * the walk actions first, and a row only shows ticked from the walk they return.
 * Reading writes nothing; this hook writes only from a person's press. State lives
 * here and resets with the view (HomeShell keys the view by SOP id).
 */
import { useCallback, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { startOverWalk, startWalk, recordWalkStep } from '@/actions/walk'
import { submitCompletion } from '@/actions/completions'
import { useStepPhotos } from '@/hooks/useStepPhotos'
import { currentIndex, isReachable, reviewMissing, type WalkEntry } from '@/lib/sop/focus'
import type { WalkState } from '@/lib/sop/walk-read'

export const SAVE_ERROR = "Couldn't save your tick. Check your signal and tap again."
export const PHOTO_ERROR = "That photo didn't upload. Try again."
export const SEND_ERROR = "Couldn't send it. Your ticks and photos are saved — try again."
// Refusals about the run's state, not the signal: tapping again would never help.
const STALE: Record<string, string> = {
  'Start the SOP again.': 'This SOP was finished or started again somewhere else. Press start to carry on.',
  'That step is not part of this SOP.': 'This SOP changed since you started. Press start to carry on.',
}
const SAID_AS_IS = new Set(['Add a photo to continue.', 'Finish the steps before this one first.', 'This SOP is not available to start.'])

export function useRun({ sopId, order, allowForward, onMoved }: { sopId: string; order: WalkEntry[]; allowForward: boolean; onMoved(sopId: string): void }) {
  const qc = useQueryClient()
  const [walk, setWalk] = useState<WalkState | null>(null)
  const [running, setRunning] = useState(false)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Local thumbnails for photos taken in this run, keyed by step id.
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const photoApi = useStepPhotos(walk?.id)

  const done = useMemo(() => new Set(Object.keys(walk?.done ?? {})), [walk])
  const acked = useMemo(() => new Set(Object.keys(walk?.acks ?? {})), [walk])
  const photoSteps = useMemo(() => new Set((walk?.photos ?? []).map((p) => p.stepId)), [walk])
  const missing = useMemo(() => reviewMissing(order, { acked, photos: photoSteps }), [order, acked, photoSteps])
  const nextId = order[currentIndex(order, done)]?.step.id ?? null
  const reachable = useCallback((id: string) => isReachable(order, id, done, allowForward), [order, done, allowForward])

  // The home's status line ("You stopped at step 3", "Waiting for sign-off") reads the walks and completions.
  const refreshLibrary = useCallback(
    () => void qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('library-') }),
    [qc],
  )

  const refused = useCallback(
    (msg: string, fallback: string) => {
      if (STALE[msg]) {
        setWalk(null)
        setRunning(false)
        refreshLibrary()
        return setError(STALE[msg])
      }
      setError(SAID_AS_IS.has(msg) ? msg : fallback)
    },
    [refreshLibrary],
  )

  /** Open (or pick up) the run on the server. Resolves true when there is a run to show. */
  const begin = useCallback(async (): Promise<boolean> => {
    setBusy(true)
    setError(null)
    try {
      const res = await startWalk({ sopId })
      if ('error' in res) return (refused(res.error, res.error), false)
      setWalk(res.walk)
      return true
    } catch {
      return (setError(SAVE_ERROR), false)
    } finally {
      setBusy(false)
    }
  }, [sopId, refused])

  /** "Begin from step 1": throw the run's ticks and photos away and open a fresh run on the latest version. */
  const startOver = useCallback(async (): Promise<boolean> => {
    setBusy(true)
    setError(null)
    try {
      const open = walk ? { walk } : await startWalk({ sopId })
      if ('error' in open) return (refused(open.error, open.error), false)
      const res = await startOverWalk({ walkId: open.walk.id })
      if ('error' in res) return (refused(res.error, res.error), false)
      setPreviews({})
      if (res.sopId !== sopId) {
        onMoved(res.sopId)
        return false
      }
      setWalk(res.walk)
      return true
    } catch {
      return (setError(SAVE_ERROR), false)
    } finally {
      setBusy(false)
    }
  }, [walk, sopId, onMoved, refused])

  const tick = useCallback(
    async (stepId: string) => {
      if (!walk || busy) return
      setBusy(true)
      setError(null)
      try {
        const res = await recordWalkStep({ walkId: walk.id, stepId, action: 'complete' })
        if ('error' in res) return refused(res.error, SAVE_ERROR)
        setWalk(res.walk)
      } catch {
        setError(SAVE_ERROR)
      } finally {
        setBusy(false)
      }
    },
    [walk, busy, refused],
  )

  /** Compress and upload under the run id, then record it on the run. Retake replaces. */
  const photo = useCallback(
    async (stepId: string, file: File) => {
      if (!walk || busy) return
      setBusy(true)
      setError(null)
      try {
        const up = await photoApi.addPhoto(walk.id, stepId, file)
        if (!up) return setError(PHOTO_ERROR)
        const res = await recordWalkStep({ walkId: walk.id, stepId, action: 'photo', photo: { localId: up.localId, storagePath: up.path } })
        if ('error' in res) return refused(res.error, PHOTO_ERROR)
        setWalk(res.walk)
        // ponytail: object URLs are not revoked; a run holds a handful of thumbnails.
        setPreviews((p) => ({ ...p, [stepId]: URL.createObjectURL(file) }))
      } catch {
        setError(PHOTO_ERROR)
      } finally {
        setBusy(false)
      }
    },
    [walk, busy, photoApi, refused],
  )

  const send = useCallback(async () => {
    if (!walk || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await submitCompletion({ walkId: walk.id })
      if (!res.success) return setError(SEND_ERROR)
      setSent(true)
      refreshLibrary()
    } catch {
      setError(SEND_ERROR)
    } finally {
      setBusy(false)
    }
  }, [walk, busy, refreshLibrary])

  const stop = useCallback(() => {
    setRunning(false)
    setError(null)
    refreshLibrary()
  }, [refreshLibrary])

  const finish = useCallback(() => {
    setSent(false)
    setRunning(false)
    setWalk(null)
  }, [])

  return {
    walk,
    running,
    setRunning,
    sent,
    busy: busy || photoApi.uploadingCount > 0,
    error,
    done,
    acked,
    photoSteps,
    missing,
    nextId,
    previews,
    reachable,
    begin,
    startOver,
    tick,
    photo,
    send,
    stop,
    finish,
  }
}
