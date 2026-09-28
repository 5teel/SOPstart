'use client'
import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNetworkStore } from '@/stores/network'
import { syncAssignedSops } from '@/lib/offline/sync-engine'
import { createClient } from '@/lib/supabase/client'
import { purgeDraftLayoutsOnPublish } from '@/lib/offline/draftLayouts-purge'

const SYNC_DEBOUNCE_MS = 30_000 // 30 seconds

export function useSopSync() {
  const isOnline = useNetworkStore((s) => s.isOnline)
  const queryClient = useQueryClient()
  const lastSyncRef = useRef<number>(0)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState<{
    synced: number
    errors: string[]
    publishedTransitions?: string[]
  } | null>(null)

  async function triggerSync() {
    const now = Date.now()
    if (now - lastSyncRef.current < SYNC_DEBOUNCE_MS) return
    lastSyncRef.current = now

    setSyncing(true)
    try {
      const supabase = createClient()
      const result = await syncAssignedSops(supabase)
      setLastSyncResult(result)

      // Bug found live in 52-05: useAssignedSops() reads Dexie through a
      // React Query cache (persisted, staleTime 5 min). On a worker's very
      // first visit that query resolves against an EMPTY Dexie the instant
      // it mounts -- before this sync has written anything -- and the
      // resulting `[]` is then "fresh" for 5 minutes with nothing to
      // invalidate it, so newly-assigned SOPs (and everything derived from
      // them: pins, the Now card, the worker list) stay invisible even
      // after a reload rehydrates that same stale persisted cache. Every
      // completed sync must invalidate assigned-sops so the query re-reads
      // Dexie -- mirrors the existing invalidateQueries call in
      // handleAdd/handleRemove on the same page.
      queryClient.invalidateQueries({ queryKey: ['assigned-sops'] })

      // D-08 purge-on-publish: when a cached SOP moves non-published -> published
      // during this sync pass, delete any leftover draftLayouts rows for that SOP.
      // The authoritative layout now lives in sopCache via the sync just performed.
      if (result.publishedTransitions && result.publishedTransitions.length > 0) {
        for (const sopId of result.publishedTransitions) {
          await purgeDraftLayoutsOnPublish(sopId)
        }
      }
    } finally {
      setSyncing(false)
    }
  }

  // Sync on mount if online
  useEffect(() => {
    if (isOnline) {
      triggerSync()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync when coming back online
  useEffect(() => {
    if (isOnline) {
      triggerSync()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

  // Sync on visibility change to visible
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && isOnline) {
        triggerSync()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

  return { syncing, lastSyncResult }
}
