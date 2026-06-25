'use client'
import { useEffect, useRef, useState } from 'react'
import { X, AlertTriangle, Mic, MicOff, Loader2, Volume2 } from 'lucide-react'
import type { VoiceQueryResponse, VerificationFlag } from '@/types/sop'
import type { SopWithSections } from '@/types/sop'
import { startVoiceStream } from '@/lib/voice/deepgram-stream'
import type { StreamHandle } from '@/lib/voice/deepgram-stream'
import { classifyIntent } from '@/lib/voice/intent-classifier'
import { extractKeyterms } from '@/lib/voice/extract-keyterms'
import { useTtsPlayback } from './useTtsPlayback'

/**
 * Phase 15/22 — voice Q&A modal with real Deepgram STT + intent dispatch + TTS.
 *
 * Phase 15 (Wave 2) built the modal chrome + state machine with a stubbed
 * /api/voice/query call. Phase 22 (Plan 03) wires the real voice loop:
 *   - Real Deepgram STT via startVoiceStream({ language: 'en-NZ', keyterms })
 *   - Intent classification via classifyIntent to route final transcripts
 *   - Navigation: voice "next"/"done" → onVoiceNext → handleMarkComplete (D-02 path)
 *   - D-02 negative gate: voice "next" before ack → TTS "please acknowledge first"
 *   - TTS read-back: answers read aloud via useTtsPlayback.speak()
 *   - TTS step-entry: currentStepText changes trigger speak() for VDW-LIT-03
 *
 * Bundle isolation: this component is ONLY imported via `next/dynamic`
 * from WalkthroughSwitcher.tsx. The Wave 0 lint guard enforces this.
 *
 * a11y (D-15):
 * - `role="dialog" aria-modal="true"`; titled by `walkthrough-voice-title`
 * - ESC closes; backdrop click closes; inner card click does not
 * - Stop button receives focus on open
 * - Transcript region uses `aria-live="polite"` for screen-reader updates
 *
 * Citation chips (D-17): the answer text is rendered as plain React
 * children (no `dangerouslySetInnerHTML` — XSS mitigation per T-15-02-03).
 * If the answer contains `[section: "Name"]` markers, those are rendered
 * as separate clickable chips that scroll the underlying walkthrough.
 *
 * Verifier flags (D-18): when `verifier_flags.length > 0`, render a
 * yellow badge ("Verification flag — please re-check the SOP").
 *
 * iOS audio notes (RESEARCH Pitfall 1, 5):
 * - On first mic press (user gesture), call audioRef.current.play() synchronously
 *   to unlock the iOS audio context before speak() fires asynchronously.
 * - Mic tracks are released via StreamHandle.stop() before TTS plays (sequencing).
 * - Push-to-talk naturally sequences: mic button press → startListening → button
 *   release/final transcript → handleFinalTranscript → tts.speak (after stop).
 */
interface Props {
  sopId: string
  onClose: () => void
  // Phase 22 additions (Plan 03):
  onVoiceNext: () => void    // calls handleMarkComplete(currentStepId) in MobileWalkthrough
  onVoicePrev: () => void    // calls handleStepChange(prevStep.id)
  currentStepText: string    // TTS reads this on modal open + after step advance (VDW-LIT-03)
  onAdvance?: () => void     // optional: refresh currentStepText after advance (switcher can use)
  isAcknowledged?: boolean   // D-02 gate — from MobileWalkthroughHandle; prevents voice bypass
  sop?: SopWithSections      // optional: for extractKeyterms (STT vocabulary injection)
}

type ModalState = 'idle' | 'listening' | 'transcribing' | 'querying' | 'answered' | 'speaking' | 'error'

interface HistoryEntry {
  q: string
  r: VoiceQueryResponse
}

/**
 * Naively parses `[section: "X"]` markers out of an answer string and
 * returns an alternating array of text segments and chip descriptors.
 */
function splitAnswer(answer: string): Array<{ type: 'text'; value: string } | { type: 'chip'; label: string }> {
  const parts: Array<{ type: 'text'; value: string } | { type: 'chip'; label: string }> = []
  const re = /\[section:\s*"([^"]+)"\]/g
  let lastIdx = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(answer)) !== null) {
    if (m.index > lastIdx) {
      parts.push({ type: 'text', value: answer.slice(lastIdx, m.index) })
    }
    parts.push({ type: 'chip', label: m[1] })
    lastIdx = m.index + m[0].length
  }
  if (lastIdx < answer.length) {
    parts.push({ type: 'text', value: answer.slice(lastIdx) })
  }
  return parts
}

function slugify(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/**
 * Maps the specific error codes thrown by startVoiceStream (propagated from
 * /api/voice/token) to worker-readable text. Unknown codes fall back to the raw
 * message so nothing is silently swallowed (Phase 22 UAT — token_grant_failed
 * was opaque about a Railway env-var mismatch).
 */
function friendlyVoiceError(raw: string): string {
  switch (raw) {
    case 'deepgram_not_configured':
      return 'Voice isn’t set up on the server yet (speech key missing). Please tell your administrator — you can still type your question below.'
    case 'token_grant_failed':
      return 'Couldn’t start voice right now (speech service rejected the request). You can still type your question below.'
    case 'unauthorized':
      return 'Your session expired. Please refresh and sign in again.'
    case 'Voice capture not supported in this browser':
      return 'Voice isn’t supported in this browser. You can still type your question below.'
    default:
      return raw
  }
}

export function WalkthroughVoiceModal({
  sopId,
  onClose,
  onVoiceNext,
  onVoicePrev,
  currentStepText,
  onAdvance,
  isAcknowledged,
  sop,
}: Props) {
  const [state, setState] = useState<ModalState>('idle')
  const [transcript, setTranscript] = useState('')
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const stopBtnRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Deepgram StreamHandle ref — stored so we can stop it on unmount / voice command.
  // Token is fetched fresh on each mic press (RESEARCH Pitfall 2 — not on modal mount).
  const streamHandleRef = useRef<StreamHandle | null>(null)

  // TTS playback hook (useTtsPlayback is the custom hook from Plan 02)
  const tts = useTtsPlayback()

  // Track whether the iOS audio context has been unlocked by a user gesture.
  const audioUnlocked = useRef(false)

  // ── a11y: ESC closes, focus Stop on open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    // Defer focus to next tick so the dialog node is in the DOM tree.
    const t = window.setTimeout(() => {
      stopBtnRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(t)
  }, [])

  // ── TTS on step entry / advance (VDW-LIT-03) ────────────────────────────
  // `currentStepText` is a reactive useState-backed prop from WalkthroughSwitcher
  // (set AFTER each ref advance — Task 1). When it changes, speak the new step.
  // Keep currentStepText in the dep array — it IS a reactive prop (not a ref read).
  // Guard prevents double-read on the initial mount (empty string from state seed).
  const prevStepTextRef = useRef<string>('')
  useEffect(() => {
    if (currentStepText && currentStepText !== prevStepTextRef.current) {
      prevStepTextRef.current = currentStepText
      void tts.speak(currentStepText)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepText])

  // Cleanup: stop any in-progress stream on unmount
  useEffect(() => {
    return () => {
      if (streamHandleRef.current) {
        void streamHandleRef.current.stop().catch(() => {})
        streamHandleRef.current = null
      }
      tts.stop()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Voice flow: real Deepgram STT ────────────────────────────────────────
  // Token is fetched per mic-press (Pitfall 2), not per modal mount.
  // Push-to-talk: startListening on press, handleFinalTranscript fires on
  // onFinal callback after user stops speaking / presses Stop.
  async function startListening() {
    setErrorMsg(null)
    setTranscript('')
    setState('listening')

    // iOS autoplay unlock: call play() synchronously on the user gesture
    // so the audio context is unlocked before the async speak() fires later.
    // (RESEARCH Pitfall 5 — a synchronous play() on a gesture event unlocks iOS)
    if (tts.audioRef.current && !audioUnlocked.current) {
      audioUnlocked.current = true
      // Trigger with empty src to unlock context without playing real audio.
      // The NotAllowedError is swallowed if already unlocked or in desktop context.
      const silentPlay = tts.audioRef.current.play()
      if (silentPlay) silentPlay.catch(() => {})
    }

    // Stop any in-progress TTS before opening mic (Pitfall 1 sequencing)
    tts.stop()

    try {
      const keyterms = sop ? extractKeyterms(sop) : []
      const h = await startVoiceStream({ language: 'en-NZ', keyterms })
      streamHandleRef.current = h

      h.onPartial((text) => {
        setTranscript(text)
      })

      h.onFinal((text) => {
        // Keep the box in sync with the full accumulated transcript. Only voice
        // NAVIGATION commands auto-act on a final; QUESTIONS keep listening and
        // accumulating until the worker taps Stop — so a mid-question pause no
        // longer truncates and submits half a question.
        setTranscript(text)
        void handleFinalTranscript(text)
      })

      h.onError((err) => {
        setErrorMsg(friendlyVoiceError(err.message))
        setState('error')
        streamHandleRef.current = null
      })
    } catch (err) {
      setErrorMsg(friendlyVoiceError(err instanceof Error ? err.message : 'mic_start_failed'))
      setState('error')
    }
  }

  // ── Intent dispatch ───────────────────────────────────────────────────────
  // Classifies the final transcript and routes to the appropriate action.
  // D-02 negative gate: voice "next" before isAcknowledged → TTS prompt, no advance.
  async function handleFinalTranscript(text: string) {
    const intent = classifyIntent(text)

    if (intent === 'next' || intent === 'done') {
      // Stop mic before any TTS (Pitfall 1 sequencing)
      if (streamHandleRef.current) {
        await streamHandleRef.current.stop().catch(() => {})
        streamHandleRef.current = null
      }
      tts.stop()

      // D-02 negative gate: if safety has not been acknowledged, speak a prompt
      // instead of advancing. Voice does NOT get a weaker gate than tap.
      if (isAcknowledged === false) {
        void tts.speak('Please acknowledge the safety hazards first')
        setState('idle')
        return
      }

      // Safety acknowledged — advance via the D-02 path (onVoiceNext →
      // handleMarkComplete in MobileWalkthrough). The TTS read-aloud for the
      // new step fires via the currentStepText useEffect in this modal when
      // WalkthroughSwitcher mirrors the updated text (Task 1 reactivity fix).
      onVoiceNext()
      onAdvance?.()
      setState('idle')
    } else if (intent === 'prev') {
      if (streamHandleRef.current) {
        await streamHandleRef.current.stop().catch(() => {})
        streamHandleRef.current = null
      }
      tts.stop()
      onVoicePrev()
      onAdvance?.()
      setState('idle')
    } else {
      // 'question' — do NOT submit here. Stay in 'listening' and let the
      // transcript keep accumulating across pauses; the worker taps Stop
      // (handleStopListening → stopAndAsk) to submit the full question.
      // Acting on the first Deepgram final truncated questions mid-sentence.
    }
  }

  // `explicitQuestion` is supplied by the voice path (stale-closure-safe);
  // manual text entry / the Stop button fall back to the live `transcript`.
  async function stopAndAsk(explicitQuestion?: string) {
    // Stop mic before querying (Pitfall 1) — do this first so the stream is
    // always released, even if the question turns out too short.
    if (streamHandleRef.current) {
      await streamHandleRef.current.stop().catch(() => {})
      streamHandleRef.current = null
    }

    const question = (explicitQuestion ?? transcript).trim()
    if (!question || question.length < 5) {
      // Don't close the modal here — just report and return to idle so the
      // worker can retry or type. (The old guard read a stale `transcript`/`state`
      // from the onFinal closure and wrongly called onClose(), dismissing the
      // modal mid-transcription.)
      setErrorMsg('Question is too short. Please try again.')
      setState('idle')
      return
    }

    setState('querying')
    try {
      const res = await fetch('/api/voice/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sopId, question }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as VoiceQueryResponse
      setHistory((h) => [...h, { q: question, r: data }])
      setTranscript('')
      setState('answered')

      // VDW-VOICE-02: read the answer aloud via TTS (fail-silent — useTtsPlayback
      // swallows errors so this never blocks the answer display)
      void tts.speak(data.answer.slice(0, 500))
      setState('speaking')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Voice query failed.')
      setState('error')
    }
  }

  function scrollToSection(label: string) {
    // Scroll the underlying walkthrough to the cited section if a
    // matching anchor is present. The walkthrough surfaces sections
    // via section-{slug} ids when rendered.
    const slug = slugify(label)
    const el =
      document.getElementById(`section-${slug}`) ??
      document.querySelector(`[data-section="${slug}"]`) ??
      document.querySelector(`[data-section-title="${label}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleCitation(label: string) {
    scrollToSection(label)
  }

  // Verification-flag CTA: dismiss the voice modal and take the worker back to
  // the SOP, scrolling to the flagged section when we have a real one. Section
  // anchors live in the underlying SOP page, so the scroll runs a tick AFTER the
  // modal closes (overlay gone first).
  function goToSop(sectionTitle?: string) {
    onClose()
    if (!sectionTitle) return
    window.setTimeout(() => scrollToSection(sectionTitle), 80)
  }

  // Stop the stream and show Stop/Speak buttons
  async function handleStopListening() {
    if (streamHandleRef.current) {
      await streamHandleRef.current.stop().catch(() => {})
      streamHandleRef.current = null
    }
    if (transcript.trim()) {
      void stopAndAsk(transcript)
    } else {
      setState('idle')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--ink-900)]/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* Hidden audio element for TTS playback (useTtsPlayback contract).
          When playback finishes naturally, leave 'speaking' → 'answered' so the
          mic re-enables for a follow-up question (multi-turn). Guarded so it
          never clobbers a state the worker already moved on to (e.g. listening). */}
      <audio
        ref={tts.audioRef}
        className="hidden"
        aria-hidden="true"
        onEnded={() => setState((s) => (s === 'speaking' ? 'answered' : s))}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="walkthrough-voice-title"
        data-testid="voice-modal"
        className="bg-[var(--paper)] border border-[var(--ink-100)] rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--ink-100)]">
          <h2
            id="walkthrough-voice-title"
            className="text-xl font-semibold text-[var(--ink-900)]"
          >
            Ask about this SOP
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-lg hover:bg-[var(--ink-50)] transition-colors"
          >
            <X className="h-5 w-5 text-[var(--ink-500)]" />
          </button>
        </header>

        <div className="px-6 py-5 space-y-4">
          {/* Live state row */}
          <div className="flex items-center justify-between gap-3">
            <div
              role="status"
              aria-live="polite"
              className="flex items-center gap-2 text-sm text-[var(--ink-500)] mono uppercase tracking-wider"
              data-testid="voice-status"
            >
              {state === 'idle' && <span>Idle — press the mic to ask</span>}
              {state === 'listening' && (
                <>
                  <Mic className="h-4 w-4 text-[var(--accent-decision)] animate-pulse" aria-hidden="true" />
                  Listening — tap Stop to ask
                </>
              )}
              {state === 'transcribing' && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Transcribing
                </>
              )}
              {state === 'querying' && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Answering
                </>
              )}
              {state === 'answered' && <span>Answer ready</span>}
              {state === 'speaking' && (
                <>
                  <Volume2 className="h-4 w-4 text-[var(--accent-decision)] animate-pulse" aria-hidden="true" />
                  Speaking
                </>
              )}
              {state === 'error' && <span className="text-[var(--accent-escalate)]">Error</span>}
            </div>

            {/* Push-to-talk mic button — large glove-friendly target (D-03) */}
            {state === 'listening' || state === 'transcribing' ? (
              <button
                ref={stopBtnRef}
                type="button"
                onClick={handleStopListening}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--ink-900)] text-[var(--paper)] text-sm font-medium hover:opacity-90"
                data-testid="voice-stop"
                aria-label="Stop recording"
              >
                <MicOff className="h-4 w-4" aria-hidden="true" />
                Stop
              </button>
            ) : (
              <button
                ref={stopBtnRef}
                type="button"
                onClick={startListening}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-decision)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="voice-start"
                // Only block the mic while the answer is being fetched. During
                // 'speaking'/'answered' it stays live so the worker can barge in —
                // startListening() calls tts.stop() first, cutting off the spoken
                // answer and starting a fresh question (multi-turn conversation).
                disabled={state === 'querying'}
                aria-label={
                  state === 'answered' || state === 'speaking'
                    ? 'Ask another question'
                    : 'Start recording — push to talk'
                }
              >
                <Mic className="h-4 w-4" aria-hidden="true" />
                {state === 'answered' || state === 'speaking' ? 'Ask again' : 'Speak'}
              </button>
            )}
          </div>

          {/* Manual text input — always-visible tap fallback (D-04) */}
          <label className="block">
            <span className="mono text-[11px] uppercase tracking-wider text-[var(--ink-500)]">
              Your question
            </span>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={2}
              placeholder="Type or speak your question…"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--ink-300)] focus:outline-none focus:border-[var(--ink-900)] text-base"
              data-testid="transcription"
            />
          </label>

          {/* Always-visible tap fallback: Ask button for manual text entry (D-04) */}
          {transcript.trim().length >= 5 && state === 'idle' && (
            <button
              type="button"
              onClick={() => stopAndAsk(transcript)}
              className="w-full px-4 py-2 rounded-lg bg-[var(--ink-900)] text-[var(--paper)] text-sm font-medium hover:opacity-90"
            >
              Ask
            </button>
          )}

          {errorMsg && (
            <p className="text-sm text-[var(--accent-escalate)]" role="alert">
              {errorMsg}
            </p>
          )}

          {/* Answer history */}
          {history.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-[var(--ink-100)]">
              {history.map((entry, idx) => (
                <AnswerCard
                  key={idx}
                  entry={entry}
                  onCitationClick={handleCitation}
                  onGoToSop={goToSop}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Synthetic placeholder section titles used by the verifier's fallback flags —
// these are not real SOP sections, so the "go to section" link degrades to
// "Open the SOP" rather than trying to scroll to a non-existent anchor.
const SYNTHETIC_SECTION_TITLES = new Set(['(verification unavailable)', '(verifier exception)'])

function AnswerCard({
  entry,
  onCitationClick,
  onGoToSop,
}: {
  entry: HistoryEntry
  onCitationClick: (label: string) => void
  onGoToSop: (sectionTitle?: string) => void
}) {
  const parts = splitAnswer(entry.r.answer)
  const flagged = (entry.r.verifier_flags ?? []).length > 0
  // First real (non-synthetic) flagged section, if any — the link scrolls there.
  const targetSection = (entry.r.verifier_flags ?? [])
    .map((f) => f.section_title)
    .find((s): s is string => !!s && !SYNTHETIC_SECTION_TITLES.has(s))
  return (
    <div className="space-y-2">
      <p className="text-sm text-[var(--ink-500)] mono uppercase tracking-wider">
        Q: {entry.q}
      </p>
      <div
        className="text-base text-[var(--ink-900)] leading-relaxed"
        data-testid="answer"
      >
        {parts.map((part, i) =>
          part.type === 'text' ? (
            <span key={i}>{part.value}</span>
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => onCitationClick(part.label)}
              data-testid="citation-chip"
              className="inline-flex items-center px-2 py-0.5 mx-1 rounded-md bg-[var(--accent-decision)]/15 text-[var(--accent-decision)] text-sm font-medium hover:bg-[var(--accent-decision)]/25 transition-colors"
            >
              {part.label}
            </button>
          )
        )}
      </div>

      {flagged && (
        <div
          role="alert"
          className="flex items-start gap-2 mt-2 p-3 rounded-lg bg-amber-50 border-l-4 border-amber-500"
          data-testid="verifier-flag"
        >
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Verification flag — please re-check the SOP</p>
            <ul className="mt-1 space-y-0.5">
              {entry.r.verifier_flags.map((f: VerificationFlag, i: number) => (
                <li key={i}>• {f.description}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => onGoToSop(targetSection)}
              data-testid="verifier-flag-goto"
              className="mt-2 inline-flex items-center gap-1 font-medium text-amber-900 underline underline-offset-2 hover:text-amber-700"
            >
              {targetSection ? `Open “${targetSection}” in the SOP` : 'Open the SOP'}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
