'use client'
import { useEffect, useRef, useState } from 'react'
import { X, AlertTriangle, Mic, MicOff, Loader2 } from 'lucide-react'
import type { VoiceQueryResponse, VerificationFlag } from '@/types/sop'

/**
 * Phase 15 — voice Q&A modal shell (D-14..D-18).
 *
 * Wave 2 scope: render the modal chrome + state machine (idle / listening
 * / transcribing / querying / answered / error) with a stubbed
 * `/api/voice/query` call. The actual API route ships in Wave 3.
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
 */
interface Props {
  sopId: string
  onClose: () => void
}

type ModalState = 'idle' | 'listening' | 'transcribing' | 'querying' | 'answered' | 'error'

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

export function WalkthroughVoiceModal({ sopId, onClose }: Props) {
  const [state, setState] = useState<ModalState>('idle')
  const [transcript, setTranscript] = useState('')
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const stopBtnRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

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

  // ── Voice flow (Wave 3 will wire Deepgram; for now we simulate)
  async function startListening() {
    setErrorMsg(null)
    setTranscript('')
    setState('listening')
    // In Wave 3 this is replaced by useDeepgramWebSocket().start({onTranscript: ...})
  }

  async function stopAndAsk() {
    if (state !== 'listening' && state !== 'transcribing' && !transcript) {
      // Nothing recorded — just dismiss
      onClose()
      return
    }
    const question = transcript.trim()
    if (!question || question.length < 5) {
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
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Voice query failed.')
      setState('error')
    }
  }

  function handleCitation(label: string) {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--ink-900)]/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
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
                  <Mic className="h-4 w-4 text-[var(--accent-decision)] animate-pulse" />
                  Listening
                </>
              )}
              {state === 'transcribing' && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Transcribing
                </>
              )}
              {state === 'querying' && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Answering
                </>
              )}
              {state === 'answered' && <span>Answer ready</span>}
              {state === 'error' && <span className="text-[var(--accent-escalate)]">Error</span>}
            </div>

            {state === 'listening' || state === 'transcribing' ? (
              <button
                ref={stopBtnRef}
                type="button"
                onClick={stopAndAsk}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--ink-900)] text-[var(--paper)] text-sm font-medium hover:opacity-90"
                data-testid="voice-stop"
              >
                <MicOff className="h-4 w-4" />
                Stop
              </button>
            ) : (
              <button
                ref={stopBtnRef}
                type="button"
                onClick={startListening}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-decision)] text-white text-sm font-medium hover:opacity-90"
                data-testid="voice-start"
                disabled={state === 'querying'}
              >
                <Mic className="h-4 w-4" />
                Speak
              </button>
            )}
          </div>

          {/* Manual text input (fallback / Wave-3 voice still to come) */}
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
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AnswerCard({
  entry,
  onCitationClick,
}: {
  entry: HistoryEntry
  onCitationClick: (label: string) => void
}) {
  const parts = splitAnswer(entry.r.answer)
  const flagged = (entry.r.verifier_flags ?? []).length > 0
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
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Verification flag — please re-check the SOP</p>
            <ul className="mt-1 space-y-0.5">
              {entry.r.verifier_flags.map((f: VerificationFlag, i: number) => (
                <li key={i}>• {f.description}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
