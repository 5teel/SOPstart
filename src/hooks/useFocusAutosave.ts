'use client'
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { create } from 'zustand'
import { updateFocusStep } from '@/actions/focus-steps'

/**
 * Phase 58 (58-12) -- autosave for the focus editor, the useBuilderAutosave idiom
 * re-keyed to steps: edits to one step merge into one patch, a 750 ms quiet gap
 * sends it, a failed send is retried every 5 s up to three times, and a pending
 * edit goes out at once when the tab is hidden or the caller flushes (Back).
 *
 * There is no last-write-wins branch: a step edit is a plain write to a draft.
 * A patch that still fails after the retries stays queued (never dropped); the
 * next edit or flush sends it again.
 *
 * State is module-level on purpose: one editor is on screen at a time, and
 * `flush` must be callable from the frame's Back, which is not under the editor.
 */

const DEBOUNCE_MS = 750
const RETRY_MS = 5_000
const MAX_RETRIES = 3

type Patch = Parameters<typeof updateFocusStep>[0]['patch']
export type FocusStepPatch = Patch

export type FocusSaveState = 'idle' | 'saving' | 'saved' | 'error'

/** What the top-bar pill and the "didn't save" strip read. */
export const useFocusSaveStatus = create<{ state: FocusSaveState; gaveUp: boolean }>(() => ({
  state: 'idle',
  gaveUp: false,
}))

const pending = new Map<string, Patch>()
const failures = new Map<string, number>()
const inflight = new Set<Promise<void>>()
const afterSave = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | null = null

function schedule(ms: number) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    void send()
  }, ms)
}

function settle() {
  if (failures.size > 0) {
    useFocusSaveStatus.setState({ state: 'error', gaveUp: [...failures.values()].some((n) => n > MAX_RETRIES) })
    return
  }
  if (pending.size === 0 && inflight.size === 0) {
    useFocusSaveStatus.setState({ state: 'saved', gaveUp: false })
    afterSave.forEach((fn) => fn())
  }
}

function send(): Promise<void> {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  const batch = [...pending]
  pending.clear()
  if (batch.length === 0) return Promise.resolve()

  const run = Promise.all(
    batch.map(async ([stepId, patch]) => {
      let ok = false
      try {
        ok = !('error' in (await updateFocusStep({ stepId, patch })))
      } catch {
        ok = false
      }
      if (ok) {
        failures.delete(stepId)
        return
      }
      const n = (failures.get(stepId) ?? 0) + 1
      failures.set(stepId, n)
      // A newer edit to the same step wins; the failed patch fills in what it lacks.
      pending.set(stepId, { ...patch, ...pending.get(stepId) })
      if (n <= MAX_RETRIES) schedule(RETRY_MS)
    })
  ).then(() => {
    inflight.delete(run)
    settle()
  })
  inflight.add(run)
  return run
}

/** Merge `patch` into the step's pending edit and (re)start the 750 ms gap. */
function queue(stepId: string, patch: Patch) {
  pending.set(stepId, { ...pending.get(stepId), ...patch })
  useFocusSaveStatus.setState({ state: 'saving' })
  schedule(DEBOUNCE_MS)
}

/** Send everything queued now and wait for every save in flight. Back waits on this. */
async function flush(): Promise<void> {
  void send()
  await Promise.all([...inflight])
}

/**
 * Mount once per editor. `sopId` scopes the refresh: after every settled save the
 * SOP read and the publish gate are re-fetched, because a text edit clears the
 * step's tick on the server and the counts must follow.
 */
export function useFocusAutosave(sopId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    // One store serves every SOP the editor opens: a different SOP starts from a blank pill, never
    // the last SOP's saved / error state.
    useFocusSaveStatus.setState({ state: 'idle', gaveUp: false })
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ['focus-sop', sopId] })
      void queryClient.invalidateQueries({ queryKey: ['focus-gate', sopId] })
    }
    const onHidden = () => {
      if (document.visibilityState === 'hidden') void flush()
    }
    afterSave.add(refresh)
    const onPageHide = () => void flush()
    window.addEventListener('pagehide', onPageHide)
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      afterSave.delete(refresh)
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('visibilitychange', onHidden)
      void flush()
    }
  }, [queryClient, sopId])

  return { queue, flush }
}
