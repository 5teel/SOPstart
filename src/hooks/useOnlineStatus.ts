'use client'
import { useEffect } from 'react'
import { useNetworkStore } from '@/stores/network'

export function useOnlineStatus() {
  const setOnline = useNetworkStore((s) => s.setOnline)
  useEffect(() => {
    // Sync the real status once on mount. Effects run client-only, AFTER
    // hydration, so reading navigator here cannot cause a mismatch — while the
    // store's SSR-safe `true` default keeps the first paint identical on both
    // sides. (CLAUDE.md [2026-06-08] hydration learning.)
    setOnline(navigator.onLine)
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [setOnline])
}
