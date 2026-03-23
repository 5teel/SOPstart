'use client'
import { useEffect } from 'react'
import { useNetworkStore } from '@/stores/network'

export function useOnlineStatus() {
  const setOnline = useNetworkStore((s) => s.setOnline)
  useEffect(() => {
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
