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

async function saveLayout(sectionId: string, data: Data) {
  const status = useBuilderSaveStatus
  status.setState((s) => ({ pending: s.pending + 1 }))
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
        status.setState({ error: result.error })
      }
    } else {
      status.setState({ lastSavedAt: Date.now(), error: null })
    }
  } catch (err) {
    status.setState({ error: err instanceof Error ? err.message : String(err) })
  } finally {
    status.setState((s) => ({ pending: s.pending - 1 }))
  }
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
    void saveLayout(sectionId, dataRef.current)
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
        void saveLayout(sectionId, data)
      }, DEBOUNCE_MS)
    },
    [sectionId, sopId]
  )
}
