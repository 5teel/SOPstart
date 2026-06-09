'use client'

import { useMemo, useState } from 'react'
import { Check, ExternalLink, Loader2, ChevronDown } from 'lucide-react'
import { saveFeedback } from '@/actions/uat'
import type {
  UatTest,
  UatFeedbackRow,
  CriterionResponse,
  OverallVerdict,
} from '@/lib/uat/tests'

interface Props {
  tests: UatTest[]
  feedback: UatFeedbackRow[]
  currentUserId: string
}

interface Draft {
  questions: Record<string, CriterionResponse>
  preferredDirection: string | null
  verdict: OverallVerdict | null
  notes: string
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

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

function emptyDraft(): Draft {
  return { questions: {}, preferredDirection: null, verdict: null, notes: '' }
}

function draftFromRow(row: UatFeedbackRow | undefined): Draft {
  if (!row) return emptyDraft()
  return {
    questions: { ...(row.criteria_responses ?? {}) },
    preferredDirection: row.preferred_direction ?? null,
    verdict: row.overall_verdict ?? null,
    notes: row.notes ?? '',
  }
}

export function UatBoardClient({ tests, feedback, currentUserId }: Props) {
  const myByTest = useMemo(() => {
    const m = new Map<string, UatFeedbackRow>()
    for (const r of feedback) if (r.user_id === currentUserId) m.set(r.test_id, r)
    return m
  }, [feedback, currentUserId])

  const othersByTest = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of feedback) {
      if (r.user_id === currentUserId) continue
      m.set(r.test_id, (m.get(r.test_id) ?? 0) + 1)
    }
    return m
  }, [feedback, currentUserId])

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(tests.map((t) => t.category)))],
    [tests]
  )

  const [category, setCategory] = useState('All')
  const [showArchived, setShowArchived] = useState(false)
  const [openBg, setOpenBg] = useState<Record<string, boolean>>({})
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const init: Record<string, Draft> = {}
    for (const t of tests) init[t.id] = draftFromRow(myByTest.get(t.id))
    return init
  })
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({})

  const activeTests = tests.filter((t) => t.status === 'active')
  const reviewed = activeTests.filter((t) => myByTest.has(t.id)).length

  const visible = tests.filter(
    (t) =>
      (category === 'All' || t.category === category) &&
      (showArchived || t.status === 'active')
  )

  function patch(testId: string, p: Partial<Draft>) {
    setDrafts((d) => ({ ...d, [testId]: { ...d[testId], ...p } }))
    setSaveStates((s) => ({ ...s, [testId]: 'idle' }))
  }

  function setAnswer(testId: string, qId: string, value: CriterionResponse) {
    setDrafts((d) => {
      const cur = d[testId]
      const next = { ...cur.questions }
      if (next[qId] === value) delete next[qId]
      else next[qId] = value
      return { ...d, [testId]: { ...cur, questions: next } }
    })
    setSaveStates((s) => ({ ...s, [testId]: 'idle' }))
  }

  async function save(testId: string) {
    const d = drafts[testId]
    setSaveStates((s) => ({ ...s, [testId]: 'saving' }))
    const res = await saveFeedback({
      testId,
      criteriaResponses: d.questions,
      preferredDirection: d.preferredDirection,
      overallVerdict: d.verdict,
      rating: null,
      notes: d.notes.trim() ? d.notes.trim() : null,
    })
    setSaveStates((s) => ({ ...s, [testId]: res.success ? 'saved' : 'error' }))
  }

  return (
    <div>
      {/* How this works */}
      <div className="rounded-xl border border-[var(--ink-100)] bg-white p-4 mb-6">
        <p className="text-sm font-semibold text-[var(--ink-900)] mb-2">How this works</p>
        <ol className="grid sm:grid-cols-3 gap-3 text-sm text-[var(--ink-700)]">
          <Howto n={1} text="Have a look, or compare the options shown." />
          <Howto n={2} text="Answer a couple of quick questions." />
          <Howto n={3} text="Add any comments and hit Save." />
        </ol>
        <p className="text-xs text-[var(--ink-500)] mt-3">
          Takes a minute or two each. You can change your answers any time.
          {activeTests.length > 0 && (
            <> &nbsp;·&nbsp; You&apos;ve done <strong className="text-[var(--ink-900)]">{reviewed} of {activeTests.length}</strong>.</>
          )}
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1 border-b border-[var(--ink-100)] mb-6 overflow-x-auto">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className="tab"
            data-active={category === c ? 'true' : undefined}
          >
            {c}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs text-[var(--ink-500)] pl-4 whitespace-nowrap">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="w-4 h-4 accent-[var(--ink-900)]"
          />
          Show finished
        </label>
      </div>

      <ul className="space-y-8">
        {visible.map((t) => {
          const draft = drafts[t.id]
          const saveState = saveStates[t.id] ?? 'idle'
          const otherCount = othersByTest.get(t.id) ?? 0
          const done = myByTest.has(t.id)
          return (
            <li key={t.id} className="rounded-xl border border-[var(--ink-100)] bg-white overflow-hidden">
              {/* Header */}
              <div className="px-5 pt-5">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="pill">{t.category}</span>
                  {t.status === 'archived' && <span className="pill" style={{ opacity: 0.6 }}>FINISHED</span>}
                  {done && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700">
                      <Check className="h-3.5 w-3.5" /> Your feedback saved
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-semibold text-[var(--ink-900)] leading-snug">{t.title}</h2>
                <p className="text-sm text-[var(--ink-700)] mt-2 leading-relaxed">{t.summary}</p>
              </div>

              <div className="px-5 pb-5 pt-4 space-y-5">
                {/* Take a look */}
                {((t.tryIt && t.tryIt.length > 0) || (t.links && t.links.length > 0)) && (
                  <Section label="👀  Take a look">
                    {t.tryIt && t.tryIt.length > 0 && (
                      <ol className="list-decimal list-inside text-sm text-[var(--ink-700)] space-y-1 mb-3">
                        {t.tryIt.map((s, i) => <li key={i}>{s}</li>)}
                      </ol>
                    )}
                    {t.links && t.links.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {t.links.map((l) => (
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
                  </Section>
                )}

                {/* Standalone screenshots */}
                {t.screenshots && t.screenshots.length > 0 && (
                  <div className="flex gap-3 flex-wrap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {t.screenshots.map((src) => (
                      <img key={src} src={src} alt="" className="max-h-56 rounded-lg border border-[var(--ink-100)]" />
                    ))}
                  </div>
                )}

                {/* Directions — tap to pick */}
                {t.directions && t.directions.length > 0 && (
                  <Section label="Which do you prefer? — tap one">
                    <div className="grid sm:grid-cols-2 gap-3">
                      {t.directions.map((dir) => {
                        const active = draft.preferredDirection === dir.id
                        return (
                          <button
                            key={dir.id}
                            onClick={() => patch(t.id, { preferredDirection: active ? null : dir.id })}
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
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--ink-900)] bg-[var(--ink-900)] text-white rounded-full px-2 py-0.5">
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
                  </Section>
                )}

                {/* Questions */}
                <Section label="A few quick questions">
                  <ul className="space-y-2">
                    {t.questions.map((q) => (
                      <li
                        key={q.id}
                        className="flex items-center justify-between gap-3 flex-wrap rounded-lg bg-[var(--paper)] px-3 py-2"
                      >
                        <span className="flex-1 text-sm text-[var(--ink-900)] min-w-[180px]">{q.text}</span>
                        <div className="flex gap-1.5">
                          {ANSWERS.map((a) => {
                            const active = draft.questions[q.id] === a.v
                            return (
                              <button
                                key={a.v}
                                onClick={() => setAnswer(t.id, q.id, a.v)}
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
                </Section>

                {/* Overall */}
                <Section label="Overall, how does it feel?">
                  <div className="flex gap-2 flex-wrap">
                    {VERDICTS.map((v) => {
                      const active = draft.verdict === v.id
                      return (
                        <button
                          key={v.id}
                          onClick={() => patch(t.id, { verdict: active ? null : v.id })}
                          className="px-4 h-10 rounded-lg text-sm font-semibold border transition-colors"
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
                </Section>

                {/* Comments */}
                <Section label="Anything else? (optional)">
                  <textarea
                    value={draft.notes}
                    onChange={(e) => patch(t.id, { notes: e.target.value })}
                    placeholder="Tell us anything that helped or got in your way…"
                    rows={3}
                    className="w-full rounded-lg border border-[var(--ink-100)] bg-white px-3 py-2 text-sm text-[var(--ink-900)] placeholder:text-[var(--ink-500)] focus:border-[var(--ink-900)] focus:outline-none resize-y"
                  />
                </Section>

                {/* Save + status */}
                <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => save(t.id)}
                      disabled={saveState === 'saving'}
                      className="evidence-btn !min-h-[44px] text-sm !bg-[var(--ink-900)] !text-white !border-[var(--ink-900)] hover:!bg-[var(--ink-700)] disabled:opacity-50 inline-flex items-center gap-2 px-5"
                    >
                      {saveState === 'saving' && <Loader2 className="h-4 w-4 animate-spin" />}
                      {saveState === 'saved' ? 'Saved ✓' : done ? 'Update my feedback' : 'Save my feedback'}
                    </button>
                    {saveState === 'error' && (
                      <span className="text-xs text-red-500">Couldn&apos;t save — please try again.</span>
                    )}
                  </div>
                  <span className="text-xs text-[var(--ink-500)]">
                    {otherCount > 0
                      ? `${otherCount} teammate${otherCount === 1 ? '' : 's'} also weighed in`
                      : 'Be the first to weigh in'}
                  </span>
                </div>

                {/* Why we're asking (optional, technical) */}
                {t.background && (
                  <div className="pt-1">
                    <button
                      onClick={() => setOpenBg((o) => ({ ...o, [t.id]: !o[t.id] }))}
                      className="inline-flex items-center gap-1 text-xs text-[var(--ink-500)] hover:text-[var(--ink-700)]"
                    >
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openBg[t.id] ? 'rotate-180' : ''}`} />
                      Why we&apos;re asking
                    </button>
                    {openBg[t.id] && (
                      <p className="mono text-[11px] text-[var(--ink-500)] mt-1.5 leading-relaxed">{t.background}</p>
                    )}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {visible.length === 0 && (
        <div className="rounded-xl border border-[var(--ink-100)] bg-white text-center py-10 text-sm text-[var(--ink-500)]">
          Nothing to review here right now.
        </div>
      )}
    </div>
  )
}

function Howto({ n, text }: { n: number; text: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="flex-shrink-0 mono text-[11px] font-bold text-white bg-[var(--ink-900)] rounded-full h-5 w-5 flex items-center justify-center">
        {n}
      </span>
      <span>{text}</span>
    </li>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[13px] font-semibold text-[var(--ink-900)] mb-2">{label}</p>
      {children}
    </div>
  )
}
