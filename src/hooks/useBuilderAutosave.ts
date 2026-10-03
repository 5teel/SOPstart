'use client'
import { useCallback, useEffect, useRef } from 'react'
import { create } from 'zustand'
import { updateSectionLayout } from '@/actions/sections'
import { CURRENT_LAYOUT_VERSION } from '@/lib/builder/supported-versions'

/**
 * Bespoke `layout_data` shape (Phase 26 D-01 — Puck removed). Structurally the
 * same JSON Puck's `Data` described: a block list + root/zones metadata.
 */
type Data = { content: unknown[]; root: Record<string, unknown>; zones?: Record<string, unknown> }

const DEBOUNCE_MS = 750 // CONTEXT D-06
const RETRY_MS = 5_000
const MAX_RETRIES = 3

/** What BuilderClient reads for the SAVED pill and the "Updated by another admin" toast. */
export const useBuilderSaveStatus = create<{
  pending: number
  lastSavedAt: number | null
  error: string | null
  overwrittenSectionIds: string[]
  clearOverwritten: () => void
}>((set) => ({
  pending: 0,
  lastSavedAt: null,
  error: null,
  overwrittenSectionIds: [],
  clearOverwritten: () => set({ overwrittenSectionIds: [] }),
}))

/** Resolves true when the server took the edit (or deliberately dropped it as server_newer). */
async function saveLayout(sectionId: string, data: Data): Promise<boolean> {
  const status = useBuilderSaveStatus
  status.setState((s) => ({ pending: s.pending + 1 }))
  let ok = true
  try {
    const result = await updateSectionLayout({
      sectionId,
      layoutData: data,
      layoutVersion: CURRENT_LAYOUT_VERSION,
      clientUpdatedAt: Date.now(),
    })
    if ('error' in result) {
      // D-07 LWW: the server row is newer, so the local edit is dropped.
      if (result.error === 'server_newer') {
        status.setState((s) => ({ overwrittenSectionIds: [...s.overwrittenSectionIds, sectionId] }))
      } else {
        ok = false
        status.setState({ error: result.error })
      }
    } else {
      status.setState({ lastSavedAt: Date.now(), error: null })
    }
  } catch (err) {
    ok = false
    status.setState({ error: err instanceof Error ? err.message : String(err) })
  } finally {
    status.setState((s) => ({ pending: s.pending - 1 }))
  }
  return ok
}

/**
 * A failed save is re-sent a few times so a transient error (or closing the tab
 * right after one) does not lose the edit. A newer edit supersedes the retry:
 * it carries the latest data and runs its own save.
 */
async function saveWithRetry(
  sectionId: string,
  data: Data,
  isLatest: () => boolean,
  retriesLeft = MAX_RETRIES
) {
  if ((await saveLayout(sectionId, data)) || retriesLeft <= 0) return
  setTimeout(() => {
    if (isLatest()) void saveWithRetry(sectionId, data, isLatest, retriesLeft - 1)
  }, RETRY_MS)
}

/**
 * Returns a stable onChange handler for the section editor. Debounces by
 * 750ms, then saves the section's layout straight to the `updateSectionLayout`
 * server action. A pending edit is flushed immediately when the tab is hidden
 * or closed.
 */
export function useBuilderAutosave(sectionId: string, sopId: string) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dataRef = useRef<Data | null>(null)

  const flush = useCallback(() => {
    if (!timerRef.current || !dataRef.current) return
    clearTimeout(timerRef.current)
    timerRef.current = null
    const data = dataRef.current
    void saveWithRetry(sectionId, data, () => dataRef.current === data)
  }, [sectionId])

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHidden)
      flush()
    }
  }, [flush])

  return useCallback(
    (data: Data) => {
      if (!sectionId || !sopId) return
      dataRef.current = data
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        void saveWithRetry(sectionId, data, () => dataRef.current === data)
      }, DEBOUNCE_MS)
    },
    [sectionId, sopId]
  )
}
