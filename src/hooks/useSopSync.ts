'use client'
import { useEffect, useRef, useState } from 'react'
import { useNetworkStore } from '@/stores/network'
import { syncAssignedSops } from '@/lib/offline/sync-engine'
import { createClient } from '@/lib/supabase/client'

const SYNC_DEBOUNCE_MS = 30_000 // 30 seconds

export function useSopSync() {
  const isOnline = useNetworkStore((s) => s.isOnline)
  const lastSyncRef = useRef<number>(0)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState<{
    synced: number
    errors: string[]
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
