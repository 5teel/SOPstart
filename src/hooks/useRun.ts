'use client'

/**
 * ADR-0012 -- a run of one SOP on the home: the same step list as reading, ticked.
 *
 * The server's sop_walks row is the truth (D-09). A tick shows at once and its write
 * joins one queue, so writes land in order; a refused write puts the rows back to the
 * last walk the server returned. Photos and Send wait for the queue.
 * Reading writes nothing; this hook writes only from a person's press. State lives
 * here and resets with the view (HomeShell keys the view by SOP id).
 */
import { useCallback, useMemo, useRef, useState } from 'react'
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
const holdUnload = (e: BeforeUnloadEvent) => e.preventDefault()
const SAID_AS_IS = new Set(['Add a photo to continue.', 'Finish the steps before this one first.', 'This SOP is not available to start.'])

export function useRun({ sopId, order, allowForward, onMoved }: { sopId: string; order: WalkEntry[]; allowForward: boolean; onMoved(sopId: string): void }) {
  const qc = useQueryClient()
  const [walk, setWalk] = useState<WalkState | null>(null)
  const [running, setRunning] = useState(false)
  /** When the run was sent ("2:41 pm"), null until then. */
  const [sent, setSent] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Local thumbnails for photos taken in this run, keyed by step id.
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const photoApi = useStepPhotos(walk?.id)
  // Writes run one after another; `saved` is the last walk the server returned.
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const pending = useRef(0)
  const saved = useRef<WalkState | null>(null)
  const show = useCallback((w: WalkState | null) => {
    saved.current = w
    setWalk(w)
  }, [])
  /** Run `write` after every earlier write; the rows follow the server once the queue is empty. */
  const enqueue = useCallback((write: () => Promise<WalkState | null>) => {
    // While a tick is unsaved, leaving the page asks first.
    if (++pending.current === 1) window.addEventListener('beforeunload', holdUnload)
    const drained = () => {
      if (--pending.current > 0) return
      window.removeEventListener('beforeunload', holdUnload)
      setWalk(saved.current)
    }
    const run = queue.current.then(write).then(
      (w) => {
        if (w) saved.current = w
        drained()
      },
      drained,
    )
    queue.current = run
    return run
  }, [])

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
        show(null)
        setRunning(false)
        refreshLibrary()
        return setError(STALE[msg])
      }
      setError(SAID_AS_IS.has(msg) ? msg : fallback)
    },
    [refreshLibrary, show],
  )

  /** Open (or pick up) the run on the server. Resolves true when there is a run to show. */
  const begin = useCallback(async (): Promise<boolean> => {
    setBusy(true)
    setError(null)
    try {
      const res = await startWalk({ sopId })
      if ('error' in res) return (refused(res.error, res.error), false)
      show(res.walk)
      return true
    } catch {
      return (setError(SAVE_ERROR), false)
    } finally {
      setBusy(false)
    }
  }, [sopId, refused, show])

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
      show(res.walk)
      return true
    } catch {
      return (setError(SAVE_ERROR), false)
    } finally {
      setBusy(false)
    }
  }, [walk, sopId, onMoved, refused, show])

  /** Shows the tick now; the write follows in the queue and a refusal undoes it. */
  const tick = useCallback(
    (stepId: string) => {
      if (!walk || busy || walk.done[stepId]) return
      const kind = order.find((e) => e.step.id === stepId)?.step.kind
      const now = new Date().toISOString()
      setError(null)
      // Functional: two quick ticks before a render both land.
      setWalk((w) =>
        w && {
          ...w,
          done: { ...w.done, [stepId]: now },
          acks: kind === 'hazard' || kind === 'ppe' ? { ...w.acks, [stepId]: now } : w.acks,
        },
      )
      return enqueue(async () => {
        try {
          const res = await recordWalkStep({ walkId: walk.id, sopId: walk.sop_id, stepId, action: 'complete' })
          if ('error' in res) return (refused(res.error, SAVE_ERROR), null)
          return res.walk
        } catch {
          return (setError(SAVE_ERROR), null)
        }
      })
    },
    [walk, busy, order, enqueue, refused],
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
        await queue.current
        const res = await recordWalkStep({ walkId: walk.id, sopId: walk.sop_id, stepId, action: 'photo', photo: { localId: up.localId, storagePath: up.path } })
        if ('error' in res) return refused(res.error, PHOTO_ERROR)
        show(res.walk)
        // ponytail: object URLs are not revoked; a run holds a handful of thumbnails.
        setPreviews((p) => ({ ...p, [stepId]: URL.createObjectURL(file) }))
      } catch {
        setError(PHOTO_ERROR)
      } finally {
        setBusy(false)
      }
    },
    [walk, busy, photoApi, refused, show],
  )

  const send = useCallback(async () => {
    if (!walk || busy) return
    setBusy(true)
    setSending(true)
    setError(null)
    try {
      await queue.current
      const res = await submitCompletion({ walkId: walk.id })
      if (!res.success) return setError(SEND_ERROR)
      setSent(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))
      refreshLibrary()
    } catch {
      setError(SEND_ERROR)
    } finally {
      setBusy(false)
      setSending(false)
    }
  }, [walk, busy, refreshLibrary])

  /** Back to reading once every queued tick is saved, so "Picks up at step N" is the server's N. */
  const stop = useCallback(async () => {
    setBusy(true)
    await queue.current
    setBusy(false)
    setRunning(false)
    setError(null)
    refreshLibrary()
  }, [refreshLibrary])

  const finish = useCallback(() => {
    setSent(null)
    setRunning(false)
    show(null)
  }, [show])

  return {
    walk,
    running,
    setRunning,
    sent,
    sending,
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
