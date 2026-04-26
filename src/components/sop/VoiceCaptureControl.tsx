'use client'
import { useReducer, useCallback } from 'react'
import { useDeepgramWebSocket } from '@/hooks/useDeepgramWebSocket'
import { isVoiceCaptureSupported, pickRecorderFormat } from '@/lib/voice/media-recorder'
import { useNetworkStore } from '@/stores/network'
import { db } from '@/lib/offline/db'

type State =
  | { kind: 'idle' }
  | { kind: 'listening'; interim: string }
  | { kind: 'transcribing'; interim: string }
  | { kind: 'captured'; transcript: string; confidence: number }
  | { kind: 'error'; message: string }

type Action =
  | { type: 'START' }
  | { type: 'PARTIAL'; text: string }
  | { type: 'STOP' }
  | { type: 'CAPTURED'; transcript: string; confidence: number }
  | { type: 'ERROR'; message: string }
  | { type: 'RESET' }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'START':
      return { kind: 'listening', interim: '' }
    case 'PARTIAL':
      return state.kind === 'listening' ? { ...state, interim: action.text } : state
    case 'STOP':
      return state.kind === 'listening' ? { kind: 'transcribing', interim: state.interim } : state
    case 'CAPTURED':
      return { kind: 'captured', transcript: action.transcript, confidence: action.confidence }
    case 'ERROR':
      return { kind: 'error', message: action.message }
    case 'RESET':
      return { kind: 'idle' }
  }
}

export interface VoiceCaptureControlProps {
  target: 'measurement' | 'note'
  sopId: string
  sectionId?: string
  stepId?: string
  completionId?: string
  language: 'en-NZ' | 'en-AU' | 'en-US'
  onTranscript: (transcript: string, confidence: number) => void
}

export function VoiceCaptureControl(props: VoiceCaptureControlProps) {
  const [state, dispatch] = useReducer(reducer, { kind: 'idle' })
  const { start, stop } = useDeepgramWebSocket()
  const isOnline = useNetworkStore((s) => s.isOnline)

  const supported = typeof window !== 'undefined' ? isVoiceCaptureSupported() : true
  if (!supported) {
    return (
      <span className="text-xs text-[var(--ink-500)]">
        Voice capture requires iOS 14.3+ or desktop Chrome/Firefox/Safari
      </span>
    )
  }

  const handleStart = useCallback(async () => {
    try {
      const h = await start({ language: props.language, numerals: props.target === 'measurement' })
      h.onPartial((text) => dispatch({ type: 'PARTIAL', text }))
      h.onFinal((text, confidence) => {
        dispatch({ type: 'CAPTURED', transcript: text, confidence })
        props.onTranscript(text, confidence)
      })
      h.onError((err) => dispatch({ type: 'ERROR', message: err.message }))
      dispatch({ type: 'START' })
    } catch (err) {
      dispatch({ type: 'ERROR', message: err instanceof Error ? err.message : 'start_failed' })
    }
  }, [start, props])

  const handleStop = useCallback(async () => {
    dispatch({ type: 'STOP' })
    try {
      const result = await stop()
      if (!result) return
      // Offline → queue blob for flush on reconnect
      if (!isOnline) {
        const format = pickRecorderFormat()
        if (!format) return
        await db.voiceNotesQueue.add({
          id: crypto.randomUUID(),
          sop_id: props.sopId,
          section_id: props.sectionId,
          step_id: props.stepId,
          completion_id: props.completionId,
          block_type: props.target,
          transcript: result.transcript || undefined,
          audio_blob: result.blob,
          audio_mime: format.mimeType,
          audio_ext: result.ext,
          language: props.language,
          confidence: result.confidence || undefined,
          syncState: 'dirty',
          _createdAt: Date.now(),
        })
      }
    } catch (err) {
      dispatch({ type: 'ERROR', message: err instanceof Error ? err.message : 'stop_failed' })
    }
  }, [stop, isOnline, props])

  return (
    <div className="inline-flex items-center gap-2" data-voice-state={state.kind}>
      {state.kind === 'idle' && (
        <button
          type="button"
          className="evidence-btn"
          aria-label="Start recording"
          onClick={handleStart}
        >
          🎤 Record
        </button>
      )}
      {state.kind === 'listening' && (
        <>
          <button
            type="button"
            className="evidence-btn"
            aria-label="Stop recording"
            onClick={handleStop}
          >
            ⏹ Stop
          </button>
          <span className="text-xs text-[var(--ink-500)] italic">{state.interim || '…'}</span>
        </>
      )}
      {state.kind === 'transcribing' && (
        <span className="text-xs text-[var(--ink-500)]">Transcribing…</span>
      )}
      {state.kind === 'captured' && (
        <>
          <span className="text-sm text-[var(--ink-900)]">"{state.transcript}"</span>
          <button
            type="button"
            className="evidence-btn"
            aria-label="Record again"
            onClick={() => dispatch({ type: 'RESET' })}
          >
            Redo
          </button>
        </>
      )}
      {state.kind === 'error' && (
        <>
          <span className="text-sm text-[var(--accent-escalate)]">⚠ {state.message}</span>
          <button
            type="button"
            className="evidence-btn"
            aria-label="Try again"
            onClick={() => dispatch({ type: 'RESET' })}
          >
            Retry
          </button>
        </>
      )}
    </div>
  )
}
