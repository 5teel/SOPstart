'use client'
import { useRef, useCallback } from 'react'

/**
 * Phase 22 — VDW-VOICE-02: TTS playback hook for the voice walkthrough modal.
 *
 * Fetches audio from /api/voice/tts and plays it through a hidden <audio> element.
 * The hook is intentionally fail-silent — TTS is an additive feature (D-04/D-06):
 * a TTS failure must NEVER block step progression, Q&A, or any walkthrough action.
 *
 * Usage:
 *   const { speak, stop, audioRef } = useTtsPlayback()
 *   // In JSX: <audio ref={audioRef} className="hidden" aria-hidden="true" />
 *
 * Caller (WalkthroughVoiceModal) renders the hidden <audio> element and
 * uses speak() / stop() in its state machine.
 *
 * PATTERNS.md § useTtsPlayback.ts (lines 145-193) — implementation reference.
 * RESEARCH Pitfall 1 — mic-stop sequencing: always call stop() before startListening().
 * RESEARCH Pitfall 1 — iOS autoplay: caller must play() once during a user gesture
 *   (e.g. the mic button press) to unlock the audio context before speak() fires.
 */
export function useTtsPlayback() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // Track the active object URL so we can revoke it (createObjectURL leaks the
  // blob until revoked; multi-turn Q&A would accumulate one per answer).
  // Inlined at each use site (not a shared fn) to keep the useCallback dep
  // arrays empty — it only ever touches the stable urlRef.
  const urlRef = useRef<string | null>(null)

  /**
   * Speak the given text via /api/voice/tts.
   *
   * Fail-silent contract: this function never throws to the caller.
   *   - Empty text → no-op (returns immediately without fetching)
   *   - !res.ok → silent return (non-200 TTS response)
   *   - NotAllowedError from audio.play() → swallowed (iOS autoplay lock)
   *   - Any other fetch/audio error → swallowed
   */
  const speak = useCallback(async (text: string) => {
    if (!text) return

    // Stop any in-progress playback before starting new (mic-stop sequencing, Pitfall 1).
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }

    try {
      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      // Non-200 responses fail silently — TTS is additive, not a blocker.
      if (!res.ok) return

      const blob = await res.blob()
      // Revoke the previous answer's URL before minting a new one (no leak).
      if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null }
      const url = URL.createObjectURL(blob)
      urlRef.current = url

      if (audioRef.current) {
        audioRef.current.src = url
        // play() may throw NotAllowedError on iOS if no prior user gesture —
        // swallow silently, worker falls back to reading.
        try {
          await audioRef.current.play()
        } catch {
          /* iOS autoplay restriction — fail silently */
        }
      }
    } catch {
      /* Network error or any other exception — fail silently */
    }
  }, [])

  /**
   * Stop any currently-playing TTS audio.
   * Safe to call even when no audio is playing.
   */
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null }
  }, [])

  return { speak, stop, audioRef }
}
