'use client'

/**
 * Read-this-step-aloud button — TTS via the existing /api/voice/tts pipeline
 * (useTtsPlayback). Serves the low-literacy / language-barrier field findings
 * (Visy 2026-05-05): a worker can hear the step instead of reading it.
 *
 * Fail-silent by design (matching useTtsPlayback's contract): if TTS is
 * unavailable the tap simply does nothing — never blocks the walkthrough.
 */
import { useEffect, useState } from 'react'
import { Volume2, Square } from 'lucide-react'
import { useTtsPlayback } from './useTtsPlayback'

export function ReadAloudButton({ text, className = '' }: { text: string; className?: string }) {
  const { speak, stop, audioRef } = useTtsPlayback()
  const [playing, setPlaying] = useState(false)

  // Reset the icon when playback finishes naturally.
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onEnded = () => setPlaying(false)
    el.addEventListener('ended', onEnded)
    return () => el.removeEventListener('ended', onEnded)
  }, [audioRef])

  // Stop playback when the step (text) changes or on unmount.
  useEffect(() => {
    return () => {
      stop()
      setPlaying(false)
    }
  }, [text, stop])

  const toggle = () => {
    if (playing) {
      stop()
      setPlaying(false)
    } else {
      setPlaying(true)
      void speak(text).catch(() => setPlaying(false))
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Stop reading aloud' : 'Read this step aloud'}
        title={playing ? 'Stop' : 'Read this step aloud'}
        className={
          'inline-flex items-center justify-center h-9 w-9 rounded-full border transition-colors ' +
          (playing
            ? 'border-[var(--accent-step,#3b82f6)] text-[var(--accent-step,#3b82f6)] bg-[var(--accent-step,#3b82f6)]/10'
            : 'border-[var(--ink-200)] text-[var(--ink-500)] hover:text-[var(--ink-900)] hover:border-[var(--ink-400)]') +
          ' ' +
          className
        }
      >
        {playing ? <Square size={14} /> : <Volume2 size={16} />}
      </button>
      {/* Hidden audio element required by useTtsPlayback */}
      <audio ref={audioRef} className="hidden" />
    </>
  )
}

/** Compose the spoken text for a step: text first, then safety callouts. */
export function stepSpeechText(step: {
  text: string
  warning?: string | null
  caution?: string | null
  tip?: string | null
}): string {
  const parts = [step.text]
  if (step.warning) parts.push(`Warning: ${step.warning}`)
  if (step.caution) parts.push(`Caution: ${step.caution}`)
  if (step.tip) parts.push(`Tip: ${step.tip}`)
  return parts.join('. ')
}
