'use client'
import { useRef, useCallback, useEffect } from 'react'
import { startVoiceStream, type StreamHandle, type VoiceStreamOpts } from '@/lib/voice/deepgram-stream'

export function useDeepgramWebSocket() {
  const handleRef = useRef<StreamHandle | null>(null)

  const start = useCallback(async (opts: VoiceStreamOpts) => {
    const h = await startVoiceStream(opts)
    handleRef.current = h
    return h
  }, [])

  const stop = useCallback(async () => {
    const h = handleRef.current
    if (!h) return null
    handleRef.current = null
    return h.stop()
  }, [])

  useEffect(
    () => () => {
      // If component unmounts while listening, tear down cleanly
      if (handleRef.current) {
        void handleRef.current.stop().catch(() => {
          /* ignore */
        })
        handleRef.current = null
      }
    },
    []
  )

  return { start, stop }
}
