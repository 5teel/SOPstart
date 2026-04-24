'use client'
import { useCallback, useRef } from 'react'
import type { Data } from '@puckeditor/core'
import { db } from '@/lib/offline/db'
import { CURRENT_LAYOUT_VERSION } from '@/lib/builder/supported-versions'

const DEBOUNCE_MS = 750 // CONTEXT D-06

/**
 * Returns a stable onChange handler for Puck's `<Puck onChange={...}>` prop.
 * Debounces writes to Dexie by 750ms. The Dexie row is marked `syncState: 'dirty'`;
 * `useDraftLayoutSync` flushes dirty rows to Supabase on its 3s cadence.
 */
export function useBuilderAutosave(sectionId: string, sopId: string) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  return useCallback(
    (data: Data) => {
      if (!sectionId || !sopId) return
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(async () => {
        const now = Date.now()
        await db.draftLayouts.put({
          section_id: sectionId,
          sop_id: sopId,
          layout_data: data,
          layout_version: CURRENT_LAYOUT_VERSION,
          updated_at: now,
          syncState: 'dirty',
          _cachedAt: now,
        })
      }, DEBOUNCE_MS)
    },
    [sectionId, sopId]
  )
}
