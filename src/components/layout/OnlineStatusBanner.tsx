'use client'
import { useState, useEffect } from 'react'
import { useNetworkStore } from '@/stores/network'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export function OnlineStatusBanner() {
  useOnlineStatus()
  const isOnline = useNetworkStore((s) => s.isOnline)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Don't render during SSR to avoid hydration mismatch
  if (!mounted || isOnline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2
                 bg-brand-orange text-white text-sm font-medium py-2 px-4"
    >
      <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
      Offline — changes saved locally
    </div>
  )
}
