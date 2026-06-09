'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Check, ExternalLink, Loader2, Sparkles } from 'lucide-react'
import { saveFeedback } from '@/actions/uat'
import { BeforeAfter } from './BeforeAfter'
import type { UatTest, UatFeedbackRow, CriterionResponse, OverallVerdict } from '@/lib/uat/tests'

const ANSWERS: { v: CriterionResponse; label: string; on: string }[] = [
  { v: 'pass', label: 'Yes', on: '#16a34a' },
  { v: 'fail', label: 'No', on: '#dc2626' },
  { v: 'na', label: 'Not sure', on: '#78756e' },
]
const VERDICTS: { id: OverallVerdict; label: string; color: string }[] = [
  { id: 'approve', label: '👍  Looks good', color: '#16a34a' },
  { id: 'needs_work', label: '🤔  Could be better', color: '#b45309' },
  { id: 'reject', label: '👎  Not working', color: '#dc2626' },
]

interface Draft {
  questions: Record<string, CriterionResponse>
  preferredDirection: string | null
  verdict: OverallVerdict | null
  notes: string
}

function draftFrom(row: UatFeedbackRow | undefined): Draft {
  return {
    questions: { ...(row?.criteria_responses ?? {}) },
    preferredDirection: row?.preferred_direction ?? null,
    verdict: row?.overall_verdict ?? null,
    notes: row?.notes ?? '',
  }
}

interface Props {
  test: UatTest
  existingRow: UatFeedbackRow | undefined
  onClose: () => void
  onSaved: (row: UatFeedbackRow) => void
}

export function UatTestModal({ test, existingRow, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(existingRow))
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  // Portal to <body> so the fixed overlay escapes the transformed RouteTransition
  // ancestor (a transform creates a containing block and breaks position:fixed).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  function patch(p: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...p }))
    setSaveState('idle')
  }
  function setAnswer(qId: string, v: CriterionResponse) {
    setDraft((d) => {
      const next = { ...d.questions }
      if (next[qId] === v) delete next[qId]
      else next[qId] = v
      return { ...d, questions: next }
    })
    setSaveState('idle')
  }

  async function save() {
    setSaveState('saving')
    const res = await saveFeedback({
      testId: test.id,
      criteriaResponses: draft.questions,
      preferredDirection: draft.preferredDirection,
      overallVerdict: draft.verdict,
      rating: null,
      notes: draft.notes.trim() ? draft.notes.trim() : null,
    })
    if (res.success) {
      setSaveState('saved')
      onSaved(res.row)
    } else {
      setSaveState('error')
    }
  }

  const hasComparison = !!test.comparison
  const hasDirections = !!test.directions && test.directions.length > 0

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--paper)] w-full sm:max-w-4xl max-h-[94vh] sm:max-h-[90vh] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl"
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--ink-100)] bg-white">
          <div className="min-w-0">
            <span className="pill">{test.category}</span>
            <h2 className="text-lg font-semibold text-[var(--ink-900)] mt-1.5 leading-snug">{test.title}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex-shrink-0 h-9 w-9 rounded-lg hover:bg-[var(--paper-2)] flex items-center justify-center text-[var(--ink-500)]"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Body: visual (left) ↔ evaluate (right) */}
        <div className="flex-1 overflow-y-auto grid lg:grid-cols-[1.25fr_1fr]">
          {/* ---------- LEFT: the thing under review ---------- */}
          <div className="p-5 lg:border-r border-[var(--ink-100)] space-y-4">
            <p className="text-sm text-[var(--ink-700)] leading-relaxed">{test.summary}</p>

            {/* Spotlight + improvement */}
            {(test.spotlight || test.comparison) && (
              <div className="rounded-lg border border-[var(--accent-step,#2563eb)]/30 bg-[var(--accent-step,#2563eb)]/[0.06] p-3">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink-900)]">
                  <Sparkles className="h-4 w-4 text-[var(--accent-step,#2563eb)]" />
                  What&apos;s new{test.spotlight ? <> — {test.spotlight}</> : null}
                </p>
                {test.comparison && (
                  <p className="text-xs text-[var(--ink-700)] mt-1 leading-relaxed">{test.comparison.improvement}</p>
                )}
              </div>
            )}

            {/* Before/after slider */}
            {hasComparison && test.comparison && (
              <div>
                <BeforeAfter before={test.comparison.before} after={test.comparison.after} />
                <div className="flex justify-between mt-1.5 text-[11px] text-[var(--ink-500)]">
                  <span>{test.comparison.before.caption ?? 'Before'}</span>
                  <span>{test.comparison.after.caption ?? 'After'}</span>
                </div>
              </div>
            )}

            {/* Direction options (tap to pick) */}
            {!hasComparison && hasDirections && test.directions && (
              <div>
                <p className="text-[13px] font-semibold text-[var(--ink-900)] mb-2">Which do you prefer? — tap one</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {test.directions.map((dir) => {
                    const active = draft.preferredDirection === dir.id
                    return (
                      <button
                        key={dir.id}
                        onClick={() => patch({ preferredDirection: active ? null : dir.id })}
                        className="text-left rounded-xl border-2 p-3 transition-all"
                        style={{
                          borderColor: active ? 'var(--ink-900)' : 'var(--ink-100)',
                          background: active ? 'var(--paper-2)' : 'white',
                          boxShadow: active ? '0 0 0 3px rgba(0,0,0,0.06)' : 'none',
                        }}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-sm font-semibold text-[var(--ink-900)]">{dir.label}</span>
                          {active ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[var(--ink-900)] text-white rounded-full px-2 py-0.5">
                              <Check className="h-3 w-3" /> Your pick
                            </span>
                          ) : (
                            <span className="text-[11px] text-[var(--ink-500)]">Tap to pick</span>
                          )}
                        </div>
                        {dir.screenshot && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={dir.screenshot} alt={dir.label} className="w-full rounded-lg border border-[var(--ink-100)] bg-white" />
                        )}
                        <p className="text-xs text-[var(--ink-500)] mt-2 leading-relaxed">{dir.description}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Take a look (steps + open) */}
            {((test.tryIt && test.tryIt.length > 0) || (test.links && test.links.length > 0)) && (
              <div className="rounded-lg bg-white border border-[var(--ink-100)] p-3">
                <p className="text-[13px] font-semibold text-[var(--ink-900)] mb-2">👀  See it for real</p>
                {test.tryIt && test.tryIt.length > 0 && (
                  <ol className="list-decimal list-inside text-sm text-[var(--ink-700)] space-y-1 mb-3">
                    {test.tryIt.map((s, i) => <li key={i}>{s}</li>)}
                  </ol>
                )}
                {test.links && test.links.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {test.links.map((l) => (
                      <a
                        key={l.href}
                        href={l.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="evidence-btn !min-h-[38px] text-sm inline-flex items-center gap-1.5"
                      >
                        {l.label}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {test.background && (
              <details className="text-xs text-[var(--ink-500)]">
                <summary className="cursor-pointer select-none">Why we&apos;re asking</summary>
                <p className="mono text-[11px] mt-1.5 leading-relaxed">{test.background}</p>
              </details>
            )}
          </div>

          {/* ---------- RIGHT: evaluate ---------- */}
          <div className="p-5 space-y-5 bg-white">
            <div>
              <p className="text-[13px] font-semibold text-[var(--ink-900)] mb-2">A few quick questions</p>
              <ul className="space-y-2">
                {test.questions.map((q) => (
                  <li key={q.id} className="rounded-lg bg-[var(--paper)] px-3 py-2">
                    <p className="text-sm text-[var(--ink-900)] mb-1.5">{q.text}</p>
                    <div className="flex gap-1.5">
                      {ANSWERS.map((a) => {
                        const active = draft.questions[q.id] === a.v
                        return (
                          <button
                            key={a.v}
                            onClick={() => setAnswer(q.id, a.v)}
                            className="px-3 h-8 rounded-md text-xs font-semibold border transition-colors"
                            style={{
                              borderColor: active ? a.on : 'var(--ink-300)',
                              background: active ? a.on : 'white',
                              color: active ? 'white' : 'var(--ink-700)',
                            }}
                          >
                            {a.label}
                          </button>
                        )
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-[13px] font-semibold text-[var(--ink-900)] mb-2">Overall, how does it feel?</p>
              <div className="flex flex-col gap-2">
                {VERDICTS.map((v) => {
                  const active = draft.verdict === v.id
                  return (
                    <button
                      key={v.id}
                      onClick={() => patch({ verdict: active ? null : v.id })}
                      className="px-4 h-10 rounded-lg text-sm font-semibold border transition-colors text-left"
                      style={{
                        borderColor: active ? v.color : 'var(--ink-300)',
                        background: active ? v.color : 'white',
                        color: active ? 'white' : 'var(--ink-700)',
                      }}
                    >
                      {v.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="text-[13px] font-semibold text-[var(--ink-900)] mb-2">Anything else? (optional)</p>
              <textarea
                value={draft.notes}
                onChange={(e) => patch({ notes: e.target.value })}
                placeholder="Tell us anything that helped or got in your way…"
                rows={3}
                className="w-full rounded-lg border border-[var(--ink-100)] bg-white px-3 py-2 text-sm text-[var(--ink-900)] placeholder:text-[var(--ink-500)] focus:border-[var(--ink-900)] focus:outline-none resize-y"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between gap-3 px-5 py-3 border-t border-[var(--ink-100)] bg-white">
          {saveState === 'saved' ? (
            <span className="text-sm text-green-700 font-medium inline-flex items-center gap-1">
              <Check className="h-4 w-4" /> Thanks — your feedback is saved
            </span>
          ) : saveState === 'error' ? (
            <span className="text-sm text-red-500">Couldn&apos;t save — please try again.</span>
          ) : (
            <span className="text-xs text-[var(--ink-500)]">You can change your answers any time.</span>
          )}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="evidence-btn !min-h-[40px] text-sm">
              Close
            </button>
            <button
              onClick={save}
              disabled={saveState === 'saving'}
              className="evidence-btn !min-h-[40px] text-sm !bg-[var(--ink-900)] !text-white !border-[var(--ink-900)] hover:!bg-[var(--ink-700)] disabled:opacity-50 inline-flex items-center gap-2 px-5"
            >
              {saveState === 'saving' && <Loader2 className="h-4 w-4 animate-spin" />}
              {existingRow ? 'Update feedback' : 'Save feedback'}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  )
}
